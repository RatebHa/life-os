# Credential Secure Storage — Design Spec

**Goal:** Stop storing the Anthropic API key and Supabase session tokens as plaintext in the local database, on both the desktop (Tauri) and mobile (Flutter) apps, by moving them into OS-native secure credential storage.

## Problem

`app_state.api_key`, `app_state.sync_access_token`, and `app_state.sync_refresh_token` are stored as plain SQLite columns on desktop (`src-tauri/src/commands.rs`), written and read via ordinary `UPDATE`/`SELECT` statements. The mobile app has the equivalent problem: `access_token`/`refresh_token` are plain nullable text columns in the local Drift database (`lib/data/local/app_database.dart`), with no secure-storage package in use anywhere in the mobile app.

Anyone with filesystem access to either device — malware, another account on a shared machine, or a synced backup folder — can read these values straight out of the database file or out of a JSON backup export. `api_key` lets someone spend your Anthropic quota under your key; `sync_access_token`/`sync_refresh_token` let someone act as your authenticated Supabase session without knowing your password.

## Scope

**In scope:** `api_key` (desktop only — mobile has no AI features of its own), `sync_access_token`, `sync_refresh_token` (both platforms).

**Explicitly out of scope:** `sync_supabase_url`, `sync_supabase_anon_key`, `sync_user_id`, `sync_user_email` stay in their existing plain columns on both platforms — none of these let an attacker act on your behalf on their own (the anon key is Supabase's own public-by-design client key, gated server-side by RLS), and moving them would add keychain-access overhead for fields the app needs to read constantly for display purposes.

Also out of scope: a user-facing master password/PIN, broader Rust or Flutter test coverage beyond the new credential module (tracked separately), and any change to how the password itself is handled during Supabase login (it was never persisted before this change and still isn't — only the resulting session tokens are).

## Desktop design (Rust/Tauri)

New module `src-tauri/src/credentials.rs`, built on the `keyring` crate (wraps Windows Credential Manager; also covers macOS Keychain and Linux Secret Service if the app ever expands there). Three functions:

```rust
pub fn get_secret(key: &str) -> Result<Option<String>, String>;
pub fn set_secret(key: &str, value: &str) -> Result<(), String>;
pub fn delete_secret(key: &str) -> Result<(), String>;
```

Service name: `"com.lifeos.app"` (matches the existing Tauri bundle identifier). Per-secret keys: `"api_key"`, `"sync_access_token"`, `"sync_refresh_token"`.

Commands touched:
- `save_api_key` — writes via `set_secret("api_key", ...)` instead of `UPDATE app_state SET api_key = ...`.
- The command that writes `sync_access_token`/`sync_refresh_token`/`sync_user_id`/`sync_user_email` together on login splits: the two tokens go through `set_secret`; `sync_user_id`/`sync_user_email` keep writing to SQL exactly as before.
- The sync logout/clear command switches its `sync_access_token = NULL, sync_refresh_token = NULL` to `delete_secret` calls; `sync_user_id`/`sync_user_email` keep clearing via SQL as before.
- `get_app_state` fills `api_key`, `sync_access_token`, `sync_refresh_token` on the returned `AppStateRow` from `get_secret` calls instead of the SQL row's columns. The SQL `SELECT` still runs for every other field.

No frontend changes: the Tauri command signatures and the `AppStateRow` JSON shape returned to TypeScript are unchanged, so `src/lib/db.ts` and every component reading `appState.api_key` etc. needs no edits.

**Migration:** on the first `get_app_state` call after this ships, check whether the SQL columns for `api_key`, `sync_access_token`, or `sync_refresh_token` are still non-null. For each non-null value found, call `set_secret`; only if that call succeeds, null the SQL column in a follow-up `UPDATE`. If the keychain write fails, leave the plaintext column untouched so the credential isn't lost — migration is retried (harmlessly, since it's a no-op once already migrated) on every subsequent `get_app_state` call until it succeeds.

**Side effect:** the existing "preserve sync session across JSON import" logic (`preserved.sync_access_token`, `preserved.sync_refresh_token` in the import/restore path) becomes dead code and gets deleted — a JSON restore only ever touches SQL, so a live session in the keychain survives a restore automatically without any special-casing.

## Mobile design (Flutter)

Add the `flutter_secure_storage` package (iOS Keychain, Android Keystore/EncryptedSharedPreferences, Windows Credential Manager, macOS Keychain, Linux libsecret — the direct Flutter analog of the `keyring` crate).

All three read/write points live in `lib/data/local/app_database.dart` on `AppDatabase`, confirmed by reading the current implementation:
- `saveSyncSession({accessToken, refreshToken, userId, userEmail})` currently writes all four into the `SyncSettingsCompanion` for the `sync_settings` Drift table. It changes to write `accessToken`/`refreshToken` to secure storage instead; `userId`/`userEmail` keep writing to Drift exactly as before.
- `clearSyncSession()` currently nulls `accessToken`/`refreshToken`/`userId`/`userEmail`/`lastSyncError` in Drift. It changes to delete the two tokens from secure storage instead of nulling them in Drift; the other three fields keep nulling in Drift as before.
- `getSyncSetting()` currently does a single Drift `getSingleOrNull()` and returns the row. It changes to read `accessToken`/`refreshToken` from secure storage after the Drift read and return a `copyWith`'d row with those two fields overlaid (Drift's generated row class supports `copyWith`).

Because every consumer — `SyncRepository` (`signIn`, `signOut`, `hasSession`, `getBootstrapStatus`, `uploadThisDevice`, `replaceLocalWithCloud`, `syncNow`, `runAutoSyncIfReady`) and `SupabaseSyncClient` (which reads `settings.refreshToken` to call `client.auth.setSession(refreshToken)`) — only ever goes through these three `AppDatabase` methods, **zero changes are needed in `sync_repository.dart` or `supabase_sync_client.dart`**, mirroring the zero-frontend-changes property on desktop.

Same migrate-once-then-null approach: inside `getSyncSetting()`, if the Drift row still holds non-null `accessToken`/`refreshToken` values, write them to secure storage, then null them in Drift only after the write succeeds.

## Error handling

Both platforms already have an established pattern for surfacing backend failures: Rust commands return `Result<T, String>` and the frontend routes failures through `useErrorStore`'s toast; Flutter equivalent throws/catches into its existing error surface. Keychain/secure-storage failures use these same paths — no new UI is introduced on either platform.

## Testing

This is the first Rust test written for this project. Scope is deliberately narrow — just the new module, not a general backend test-coverage push (that's a separate, already-planned effort):
- Round-trip test: `set_secret` → `get_secret` returns the same value → `delete_secret` → `get_secret` returns `None`. Uses a distinct test service name so it never touches real credentials.
- Migration test: seed the SQL columns with values, run the migration routine, assert the keychain holds the values and the SQL columns are null.

Same shape on the Flutter side for the secure-storage wrapper functions.

## Out of scope

- Master password / PIN gate for the app itself.
- Encrypting anything beyond the three named fields.
- Broader Rust or Flutter automated test coverage (tracked as a separate initiative).
- Changing how the Supabase password itself is handled (already not persisted anywhere, before or after this change).
