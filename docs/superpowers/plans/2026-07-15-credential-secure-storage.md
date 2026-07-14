# Credential Secure Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the Anthropic API key and Supabase session tokens out of plaintext SQLite (desktop) and plaintext Drift columns (mobile) into OS-native secure credential storage, on both platforms, including migrating existing plaintext values and stopping JSON backups from embedding the secrets.

**Architecture:** Desktop gets a new `src-tauri/src/credentials.rs` module wrapping the `keyring` crate (Windows Credential Manager). Mobile gets a new `lib/data/local/secure_credentials.dart` module wrapping `flutter_secure_storage`, injected into `AppDatabase` behind a small `SecureStore` interface so it's unit-testable without touching real platform credential storage. On both platforms, the three read/write/return points for these fields are updated to use secure storage while every other caller (frontend, `SyncRepository`, `SupabaseSyncClient`) keeps working unchanged, because the public function/command signatures never change shape.

**Tech Stack:** Rust (`keyring` crate) + rusqlite for desktop; Dart (`flutter_secure_storage`) + Drift for mobile.

---

## Before you start

Every task below references exact code read directly from the current files during planning — if a file has changed since, re-read it and adapt the surrounding context, but the target behavior described does not change.

**Direct-to-branch work, no worktrees needed** — this project's established convention is committing directly to `main` for this kind of work.

This plan covers two separate git repositories: the desktop app at `C:\Users\isc\Desktop\Projects\Life OS` (Tasks 1–9) and the mobile app at `C:\Users\isc\Desktop\Projects\life-os-mobile` (Tasks 10–15). Commit separately in each repo.

---

## Task 1: Desktop — `credentials.rs` module with round-trip test

**Files:**
- Create: `src-tauri/src/credentials.rs`
- Modify: `src-tauri/Cargo.toml`

- [ ] **Step 1: Add the `keyring` dependency**

```bash
cd "C:\Users\isc\Desktop\Projects\Life OS\src-tauri"
cargo add keyring@4
```

Expected: `Cargo.toml` gains a `keyring = "4"` line under `[dependencies]` and `Cargo.lock` updates. Windows Credential Manager is keyring v4's default platform store — no extra feature flags needed.

- [ ] **Step 2: Write `credentials.rs` with failing stubs and the round-trip test**

```rust
use keyring::Entry;

const SERVICE_NAME: &str = "com.lifeos.app";

fn entry_for(service: &str, key: &str) -> Result<Entry, String> {
    Entry::new(service, key).map_err(|e| e.to_string())
}

pub(crate) fn get_secret_from(service: &str, key: &str) -> Result<Option<String>, String> {
    unimplemented!()
}

pub(crate) fn set_secret_in(service: &str, key: &str, value: &str) -> Result<(), String> {
    unimplemented!()
}

pub(crate) fn delete_secret_from(service: &str, key: &str) -> Result<(), String> {
    unimplemented!()
}

pub fn get_secret(key: &str) -> Result<Option<String>, String> {
    get_secret_from(SERVICE_NAME, key)
}

pub fn set_secret(key: &str, value: &str) -> Result<(), String> {
    set_secret_in(SERVICE_NAME, key, value)
}

pub fn delete_secret(key: &str) -> Result<(), String> {
    delete_secret_from(SERVICE_NAME, key)
}

#[cfg(test)]
mod tests {
    use super::*;

    const TEST_SERVICE_NAME: &str = "com.lifeos.app.test";

    #[test]
    fn round_trips_a_secret_through_the_os_credential_store() {
        let key = "round_trip_test_key";
        let _ = delete_secret_from(TEST_SERVICE_NAME, key);

        assert_eq!(get_secret_from(TEST_SERVICE_NAME, key).unwrap(), None);

        set_secret_in(TEST_SERVICE_NAME, key, "s3cr3t-value").unwrap();
        assert_eq!(
            get_secret_from(TEST_SERVICE_NAME, key).unwrap(),
            Some("s3cr3t-value".to_string())
        );

        delete_secret_from(TEST_SERVICE_NAME, key).unwrap();
        assert_eq!(get_secret_from(TEST_SERVICE_NAME, key).unwrap(), None);
    }
}
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
cd "C:\Users\isc\Desktop\Projects\Life OS\src-tauri"
cargo test credentials
```

Expected: panics with `not implemented` from one of the `unimplemented!()` stubs (the `entry_for` function will show as unused — that's expected at this stage).

- [ ] **Step 4: Implement the three functions for real**

Replace the three `unimplemented!()` bodies:

```rust
pub(crate) fn get_secret_from(service: &str, key: &str) -> Result<Option<String>, String> {
    match entry_for(service, key)?.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

pub(crate) fn set_secret_in(service: &str, key: &str, value: &str) -> Result<(), String> {
    entry_for(service, key)?.set_password(value).map_err(|e| e.to_string())
}

pub(crate) fn delete_secret_from(service: &str, key: &str) -> Result<(), String> {
    match entry_for(service, key)?.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
cd "C:\Users\isc\Desktop\Projects\Life OS\src-tauri"
cargo test credentials
```

Expected: `test credentials::tests::round_trips_a_secret_through_the_os_credential_store ... ok`, `test result: ok. 1 passed`.

- [ ] **Step 6: Commit**

```bash
cd "C:\Users\isc\Desktop\Projects\Life OS"
git add src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/src/credentials.rs
git commit -m "feat: add OS-keychain-backed credential storage module"
```

---

## Task 2: Desktop — wire the module in

**Files:**
- Modify: `src-tauri/src/lib.rs:1-2`

- [ ] **Step 1: Declare the module**

Find:
```rust
mod db;
mod commands;
```
Replace with:
```rust
mod db;
mod commands;
mod credentials;
```

- [ ] **Step 2: Verify the whole crate still builds**

```bash
cd "C:\Users\isc\Desktop\Projects\Life OS\src-tauri"
cargo build
```

Expected: clean build. `credentials.rs` isn't referenced from `commands.rs` yet, so you'll see `warning: function is never used` for the `pub`/`pub(crate)` functions — expected at this stage, resolved once Task 3 wires it in.

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\isc\Desktop\Projects\Life OS"
git add src-tauri/src/lib.rs
git commit -m "chore: register credentials module"
```

---

## Task 3: Desktop — migrate-and-merge logic in `read_app_state_row`

**Files:**
- Modify: `src-tauri/src/commands.rs:969-1001` (the `read_app_state_row` function)

This is the core of the desktop change: `read_app_state_row` is called by `get_app_state` and every sync/API-key command that returns `AppStateRow` to the frontend, plus internally by the import/restore path. After this task, whenever it's called: if the SQL columns for `api_key`/`sync_access_token`/`sync_refresh_token` still hold a plaintext value, that value moves into the keychain and the column is nulled; either way, the returned struct's three fields come from the keychain going forward.

- [ ] **Step 1: Write the migration test first (it will fail to compile — `migrate_and_read_secret` doesn't exist yet)**

Add this test module immediately after `read_app_state_row` (i.e. after the closing `}` of the function currently ending at line 1001):

```rust
#[cfg(test)]
mod credential_migration_tests {
    use super::*;

    const TEST_SERVICE_NAME: &str = "com.lifeos.app.migration-test";

    fn setup_conn() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute("CREATE TABLE app_state (id INTEGER PRIMARY KEY, api_key TEXT)", [])
            .unwrap();
        conn.execute("INSERT INTO app_state (id, api_key) VALUES (1, NULL)", [])
            .unwrap();
        conn
    }

    #[test]
    fn migrates_a_plaintext_value_into_the_keychain_and_nulls_the_column() {
        let conn = setup_conn();
        let _ = credentials::delete_secret_from(TEST_SERVICE_NAME, "api_key");

        let result = migrate_and_read_secret(
            &conn,
            TEST_SERVICE_NAME,
            "api_key",
            Some("plaintext-secret".to_string()),
        )
        .unwrap();
        assert_eq!(result, Some("plaintext-secret".to_string()));

        let column_value: Option<String> = conn
            .query_row("SELECT api_key FROM app_state WHERE id = 1", [], |row| row.get(0))
            .unwrap();
        assert_eq!(column_value, None);

        assert_eq!(
            credentials::get_secret_from(TEST_SERVICE_NAME, "api_key").unwrap(),
            Some("plaintext-secret".to_string())
        );

        credentials::delete_secret_from(TEST_SERVICE_NAME, "api_key").unwrap();
    }

    #[test]
    fn reads_from_the_keychain_when_the_column_is_already_null() {
        let conn = setup_conn();
        credentials::set_secret_in(TEST_SERVICE_NAME, "api_key", "already-migrated").unwrap();

        let result = migrate_and_read_secret(&conn, TEST_SERVICE_NAME, "api_key", None).unwrap();
        assert_eq!(result, Some("already-migrated".to_string()));

        credentials::delete_secret_from(TEST_SERVICE_NAME, "api_key").unwrap();
    }
}
```

- [ ] **Step 2: Run the tests to verify they fail to compile**

```bash
cd "C:\Users\isc\Desktop\Projects\Life OS\src-tauri"
cargo test credential_migration_tests
```

Expected: compile error, `cannot find function migrate_and_read_secret in this scope`.

- [ ] **Step 3: Bump `SERVICE_NAME` visibility in `credentials.rs`**

Find (in `src-tauri/src/credentials.rs`):
```rust
const SERVICE_NAME: &str = "com.lifeos.app";
```
Replace with:
```rust
pub(crate) const SERVICE_NAME: &str = "com.lifeos.app";
```

- [ ] **Step 4: Add `migrate_and_read_secret` and call it from `read_app_state_row`**

Find (`src-tauri/src/commands.rs`):
```rust
fn read_app_state_row(conn: &Connection) -> Result<AppStateRow, String> {
    conn.query_row(
        "SELECT id, momentum_score, last_momentum_calc, current_mit_task_id, api_key, onboarding_complete, last_opened_date, backup_directory, auto_backup_enabled, last_backup_at, crt_intensity, text_scale, ui_density, sync_enabled, sync_provider, sync_supabase_url, sync_supabase_anon_key, sync_access_token, sync_refresh_token, sync_user_id, sync_user_email, sync_last_sync_at, sync_last_sync_error, sync_last_pushed_at, sync_last_pulled_at FROM app_state WHERE id = 1",
        [],
        |row| Ok(AppStateRow {
            id: row.get(0)?,
            momentum_score: row.get(1)?,
            last_momentum_calc: row.get(2)?,
            current_mit_task_id: row.get(3)?,
            api_key: row.get(4)?,
            onboarding_complete: row.get::<_, i64>(5)? != 0,
            last_opened_date: row.get(6)?,
            backup_directory: row.get(7)?,
            auto_backup_enabled: row.get::<_, i64>(8)? != 0,
            last_backup_at: row.get(9)?,
            crt_intensity: row.get::<_, Option<String>>(10)?.unwrap_or_else(default_crt_intensity),
            text_scale: row.get::<_, Option<String>>(11)?.unwrap_or_else(default_text_scale),
            ui_density: row.get::<_, Option<String>>(12)?.unwrap_or_else(default_ui_density),
            sync_enabled: row.get::<_, Option<i64>>(13)?.unwrap_or(0) != 0,
            sync_provider: row.get(14)?,
            sync_supabase_url: row.get(15)?,
            sync_supabase_anon_key: row.get(16)?,
            sync_access_token: row.get(17)?,
            sync_refresh_token: row.get(18)?,
            sync_user_id: row.get(19)?,
            sync_user_email: row.get(20)?,
            sync_last_sync_at: row.get(21)?,
            sync_last_sync_error: row.get(22)?,
            sync_last_pushed_at: row.get(23)?,
            sync_last_pulled_at: row.get(24)?,
        })
    ).map_err(|e| e.to_string())
}
```
Replace with:
```rust
fn migrate_and_read_secret(
    conn: &Connection,
    service: &str,
    field: &str,
    sql_value: Option<String>,
) -> Result<Option<String>, String> {
    if let Some(value) = sql_value.filter(|v| !v.is_empty()) {
        credentials::set_secret_in(service, field, &value)?;
        conn.execute(
            &format!("UPDATE app_state SET {} = NULL WHERE id = 1", field),
            [],
        ).map_err(|e| e.to_string())?;
        return Ok(Some(value));
    }
    credentials::get_secret_from(service, field)
}

fn read_app_state_row(conn: &Connection) -> Result<AppStateRow, String> {
    let mut app_state = conn.query_row(
        "SELECT id, momentum_score, last_momentum_calc, current_mit_task_id, api_key, onboarding_complete, last_opened_date, backup_directory, auto_backup_enabled, last_backup_at, crt_intensity, text_scale, ui_density, sync_enabled, sync_provider, sync_supabase_url, sync_supabase_anon_key, sync_access_token, sync_refresh_token, sync_user_id, sync_user_email, sync_last_sync_at, sync_last_sync_error, sync_last_pushed_at, sync_last_pulled_at FROM app_state WHERE id = 1",
        [],
        |row| Ok(AppStateRow {
            id: row.get(0)?,
            momentum_score: row.get(1)?,
            last_momentum_calc: row.get(2)?,
            current_mit_task_id: row.get(3)?,
            api_key: row.get(4)?,
            onboarding_complete: row.get::<_, i64>(5)? != 0,
            last_opened_date: row.get(6)?,
            backup_directory: row.get(7)?,
            auto_backup_enabled: row.get::<_, i64>(8)? != 0,
            last_backup_at: row.get(9)?,
            crt_intensity: row.get::<_, Option<String>>(10)?.unwrap_or_else(default_crt_intensity),
            text_scale: row.get::<_, Option<String>>(11)?.unwrap_or_else(default_text_scale),
            ui_density: row.get::<_, Option<String>>(12)?.unwrap_or_else(default_ui_density),
            sync_enabled: row.get::<_, Option<i64>>(13)?.unwrap_or(0) != 0,
            sync_provider: row.get(14)?,
            sync_supabase_url: row.get(15)?,
            sync_supabase_anon_key: row.get(16)?,
            sync_access_token: row.get(17)?,
            sync_refresh_token: row.get(18)?,
            sync_user_id: row.get(19)?,
            sync_user_email: row.get(20)?,
            sync_last_sync_at: row.get(21)?,
            sync_last_sync_error: row.get(22)?,
            sync_last_pushed_at: row.get(23)?,
            sync_last_pulled_at: row.get(24)?,
        })
    ).map_err(|e| e.to_string())?;

    app_state.api_key = migrate_and_read_secret(conn, credentials::SERVICE_NAME, "api_key", app_state.api_key)?;
    app_state.sync_access_token = migrate_and_read_secret(conn, credentials::SERVICE_NAME, "sync_access_token", app_state.sync_access_token)?;
    app_state.sync_refresh_token = migrate_and_read_secret(conn, credentials::SERVICE_NAME, "sync_refresh_token", app_state.sync_refresh_token)?;

    Ok(app_state)
}
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
cd "C:\Users\isc\Desktop\Projects\Life OS\src-tauri"
cargo test credential_migration_tests
```

Expected: both tests pass, `test result: ok. 2 passed`.

- [ ] **Step 6: Run the full test suite and build to check nothing else broke**

```bash
cd "C:\Users\isc\Desktop\Projects\Life OS\src-tauri"
cargo test
cargo build
```

Expected: all tests pass (including the round-trip test from Task 1), clean build.

- [ ] **Step 7: Commit**

```bash
cd "C:\Users\isc\Desktop\Projects\Life OS"
git add src-tauri/src/commands.rs src-tauri/src/credentials.rs
git commit -m "feat: migrate plaintext credentials into the OS keychain on read"
```

---

## Task 4: Desktop — `save_api_key`

**Files:**
- Modify: `src-tauri/src/commands.rs:4231-4240`

- [ ] **Step 1: Replace the command body**

Find:
```rust
#[tauri::command]
pub fn save_api_key(state: State<'_, DbState>, api_key: String) -> Result<(), String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    let _ = conn.execute("INSERT OR IGNORE INTO app_state (id, momentum_score, onboarding_complete) VALUES (1, 50, 0)", []);
    conn.execute(
        "UPDATE app_state SET api_key = ?1 WHERE id = 1",
        params![api_key],
    ).map_err(|e| e.to_string())?;
    Ok(())
}
```
Replace with:
```rust
#[tauri::command]
pub fn save_api_key(state: State<'_, DbState>, api_key: String) -> Result<(), String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    let _ = conn.execute("INSERT OR IGNORE INTO app_state (id, momentum_score, onboarding_complete) VALUES (1, 50, 0)", []);
    credentials::set_secret("api_key", &api_key)?;
    conn.execute(
        "UPDATE app_state SET api_key = NULL WHERE id = 1",
        [],
    ).map_err(|e| e.to_string())?;
    Ok(())
}
```

- [ ] **Step 2: Verify build**

```bash
cd "C:\Users\isc\Desktop\Projects\Life OS\src-tauri"
cargo build
```
Expected: clean build.

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\isc\Desktop\Projects\Life OS"
git add src-tauri/src/commands.rs
git commit -m "feat: store the Anthropic API key in the OS keychain"
```

---

## Task 5: Desktop — `save_sync_session`

**Files:**
- Modify: `src-tauri/src/commands.rs:4344-4366`

- [ ] **Step 1: Replace the command body**

Find:
```rust
#[tauri::command]
pub fn save_sync_session(state: State<'_, DbState>, payload: SyncSessionPayload) -> Result<AppStateRow, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    let _ = conn.execute("INSERT OR IGNORE INTO app_state (id, momentum_score, onboarding_complete) VALUES (1, 50, 0)", []);
    conn.execute(
        "UPDATE app_state
         SET sync_enabled = 1,
             sync_provider = 'supabase',
             sync_access_token = ?1,
             sync_refresh_token = ?2,
             sync_user_id = ?3,
             sync_user_email = ?4,
             sync_last_sync_error = NULL
         WHERE id = 1",
        params![
            payload.access_token.trim(),
            payload.refresh_token.trim(),
            payload.user_id.trim(),
            payload.user_email.map(|value| value.trim().to_string()).filter(|value| !value.is_empty()),
        ],
    ).map_err(|e| e.to_string())?;
    read_app_state_row(&conn)
}
```
Replace with:
```rust
#[tauri::command]
pub fn save_sync_session(state: State<'_, DbState>, payload: SyncSessionPayload) -> Result<AppStateRow, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    let _ = conn.execute("INSERT OR IGNORE INTO app_state (id, momentum_score, onboarding_complete) VALUES (1, 50, 0)", []);
    credentials::set_secret("sync_access_token", payload.access_token.trim())?;
    credentials::set_secret("sync_refresh_token", payload.refresh_token.trim())?;
    conn.execute(
        "UPDATE app_state
         SET sync_enabled = 1,
             sync_provider = 'supabase',
             sync_access_token = NULL,
             sync_refresh_token = NULL,
             sync_user_id = ?1,
             sync_user_email = ?2,
             sync_last_sync_error = NULL
         WHERE id = 1",
        params![
            payload.user_id.trim(),
            payload.user_email.map(|value| value.trim().to_string()).filter(|value| !value.is_empty()),
        ],
    ).map_err(|e| e.to_string())?;
    read_app_state_row(&conn)
}
```

- [ ] **Step 2: Verify build**

```bash
cd "C:\Users\isc\Desktop\Projects\Life OS\src-tauri"
cargo build
```
Expected: clean build.

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\isc\Desktop\Projects\Life OS"
git add src-tauri/src/commands.rs
git commit -m "feat: store sync session tokens in the OS keychain on login"
```

---

## Task 6: Desktop — `clear_sync_session`

**Files:**
- Modify: `src-tauri/src/commands.rs:4368-4386`

- [ ] **Step 1: Replace the command body**

Find:
```rust
#[tauri::command]
pub fn clear_sync_session(state: State<'_, DbState>) -> Result<AppStateRow, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    let _ = conn.execute("INSERT OR IGNORE INTO app_state (id, momentum_score, onboarding_complete) VALUES (1, 50, 0)", []);
    conn.execute(
        "UPDATE app_state
         SET sync_access_token = NULL,
             sync_refresh_token = NULL,
             sync_user_id = NULL,
             sync_user_email = NULL,
             sync_last_sync_error = NULL,
             sync_last_sync_at = NULL,
             sync_last_pushed_at = NULL,
             sync_last_pulled_at = NULL
         WHERE id = 1",
        [],
    ).map_err(|e| e.to_string())?;
    read_app_state_row(&conn)
}
```
Replace with:
```rust
#[tauri::command]
pub fn clear_sync_session(state: State<'_, DbState>) -> Result<AppStateRow, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    let _ = conn.execute("INSERT OR IGNORE INTO app_state (id, momentum_score, onboarding_complete) VALUES (1, 50, 0)", []);
    credentials::delete_secret("sync_access_token")?;
    credentials::delete_secret("sync_refresh_token")?;
    conn.execute(
        "UPDATE app_state
         SET sync_access_token = NULL,
             sync_refresh_token = NULL,
             sync_user_id = NULL,
             sync_user_email = NULL,
             sync_last_sync_error = NULL,
             sync_last_sync_at = NULL,
             sync_last_pushed_at = NULL,
             sync_last_pulled_at = NULL
         WHERE id = 1",
        [],
    ).map_err(|e| e.to_string())?;
    read_app_state_row(&conn)
}
```

- [ ] **Step 2: Verify build**

```bash
cd "C:\Users\isc\Desktop\Projects\Life OS\src-tauri"
cargo build
```
Expected: clean build.

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\isc\Desktop\Projects\Life OS"
git add src-tauri/src/commands.rs
git commit -m "feat: clear sync session tokens from the OS keychain on logout"
```

---

## Task 7: Desktop — stop embedding sync tokens in JSON backups

**Files:**
- Modify: `src-tauri/src/commands.rs:1206-1207`

The codebase already blanks `api_key` before writing a backup export (someone already thought about this for that one field) — this task extends the same existing scrub to the two sync tokens, which are currently NOT blanked and so are embedded in every JSON backup file today.

- [ ] **Step 1: Extend the existing scrub**

Find:
```rust
    let mut app_state = read_app_state_row(conn)?;
    app_state.api_key = None;
```
Replace with:
```rust
    let mut app_state = read_app_state_row(conn)?;
    app_state.api_key = None;
    app_state.sync_access_token = None;
    app_state.sync_refresh_token = None;
```

- [ ] **Step 2: Verify build**

```bash
cd "C:\Users\isc\Desktop\Projects\Life OS\src-tauri"
cargo build
```
Expected: clean build.

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\isc\Desktop\Projects\Life OS"
git add src-tauri/src/commands.rs
git commit -m "fix: stop embedding sync session tokens in JSON backup exports"
```

---

## Task 8: Desktop — remove the now-dangerous import "preserve" lines

**Files:**
- Modify: `src-tauri/src/commands.rs:1900,1908-1909`

`import_payload_into_db` reads the current `AppStateRow` into a `preserved` variable, then copies specific fields from it onto the freshly-imported state before writing it back to SQL. Now that `read_app_state_row` (called to build `preserved`) returns the real secret values sourced from the keychain, these three lines would write the live secrets straight back into the SQL columns on every single import/restore — silently undoing this entire change every time a backup is restored. They must be deleted, not just left alone.

- [ ] **Step 1: Remove the three lines**

Find:
```rust
    imported_app_state.api_key = preserved.api_key.clone();
    imported_app_state.backup_directory = preserved.backup_directory.clone();
    imported_app_state.auto_backup_enabled = preserved.auto_backup_enabled;
    imported_app_state.last_backup_at = preserved.last_backup_at.clone();
    imported_app_state.sync_enabled = preserved.sync_enabled;
    imported_app_state.sync_provider = preserved.sync_provider.clone();
    imported_app_state.sync_supabase_url = preserved.sync_supabase_url.clone();
    imported_app_state.sync_supabase_anon_key = preserved.sync_supabase_anon_key.clone();
    imported_app_state.sync_access_token = preserved.sync_access_token.clone();
    imported_app_state.sync_refresh_token = preserved.sync_refresh_token.clone();
    imported_app_state.sync_user_id = preserved.sync_user_id.clone();
    imported_app_state.sync_user_email = preserved.sync_user_email.clone();
```
Replace with:
```rust
    imported_app_state.backup_directory = preserved.backup_directory.clone();
    imported_app_state.auto_backup_enabled = preserved.auto_backup_enabled;
    imported_app_state.last_backup_at = preserved.last_backup_at.clone();
    imported_app_state.sync_enabled = preserved.sync_enabled;
    imported_app_state.sync_provider = preserved.sync_provider.clone();
    imported_app_state.sync_supabase_url = preserved.sync_supabase_url.clone();
    imported_app_state.sync_supabase_anon_key = preserved.sync_supabase_anon_key.clone();
    imported_app_state.sync_user_id = preserved.sync_user_id.clone();
    imported_app_state.sync_user_email = preserved.sync_user_email.clone();
```

(`imported_app_state.api_key`, `.sync_access_token`, `.sync_refresh_token` now keep whatever `ImportAppState`'s deserialization gave them — `None` for any backup taken after Task 7 ships, since those fields are no longer present in new exports; and even for an old backup that still has a plaintext value in its JSON, the very next `read_app_state_row` call after the restore will sweep it into the keychain automatically per Task 3's migration logic, since that logic re-runs on every read.)

- [ ] **Step 2: Verify build**

```bash
cd "C:\Users\isc\Desktop\Projects\Life OS\src-tauri"
cargo build
```
Expected: clean build.

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\isc\Desktop\Projects\Life OS"
git add src-tauri/src/commands.rs
git commit -m "fix: stop re-plaintexting credentials into SQL on JSON import"
```

---

## Task 9: Desktop — final verification

**Files:** none (verification only)

- [ ] **Step 1: Full Rust test suite**

```bash
cd "C:\Users\isc\Desktop\Projects\Life OS\src-tauri"
cargo test
```
Expected: all tests pass, including `credentials::tests` and `credential_migration_tests`.

- [ ] **Step 2: Frontend type-check, tests, and build (nothing here should have changed, this confirms it)**

```bash
cd "C:\Users\isc\Desktop\Projects\Life OS"
npx tsc --noEmit
npm test
npm run build
```
Expected: all clean — zero frontend files touched by this plan, so this is a regression check, not expected to surface anything new.

- [ ] **Step 3: Full Tauri build**

```bash
cd "C:\Users\isc\Desktop\Projects\Life OS"
npm run tauri build
```
Expected: clean build producing the NSIS/MSI bundles as usual.

- [ ] **Step 4: Manual migration smoke test**

Since this machine has real plaintext credentials sitting in the current SQLite database (per the earlier evaluation), this is the one moment to verify the actual migration against real data rather than just the test-service-name unit tests:

1. Back up `C:\Users\isc\AppData\Roaming\com.lifeos.app\*.sqlite` (or wherever `db::get_db_path` resolves — check `src-tauri/src/db.rs` if unsure) before running the freshly built exe, in case anything needs rolling back.
2. Run the freshly built exe once, open Settings, confirm the API key field still shows your existing key (proves `get_app_state` still returns it) and sync still shows connected if it was before.
3. Open Windows Credential Manager (Control Panel → Credential Manager → Windows Credentials) and confirm entries under `com.lifeos.app` now exist for `api_key` and, if sync was configured, `sync_access_token`/`sync_refresh_token`.
4. Inspect the SQLite `app_state` row directly (e.g. via `sqlite3` CLI or DB Browser for SQLite) and confirm `api_key`, `sync_access_token`, `sync_refresh_token` are now `NULL`.
5. Create a new backup (Settings → Create Backup Now) and open the resulting JSON file — confirm `app_state.api_key`, `app_state.sync_access_token`, `app_state.sync_refresh_token` are all `null`.

- [ ] **Step 5: Commit anything found broken** (skip if nothing needed fixing)

```bash
cd "C:\Users\isc\Desktop\Projects\Life OS"
git add -A
git commit -m "fix: address issues found during credential storage final verification"
```

---

## Task 10: Mobile — `secure_credentials.dart` module

**Files:**
- Create: `lib/data/local/secure_credentials.dart`
- Modify: `pubspec.yaml`

`FlutterSecureCredentialStore` is a 3-method pass-through wrapper with no branching logic of its own, and `flutter_secure_storage` talks to a platform channel that isn't reachable from plain `flutter test` (no device/emulator involved) — mocking that channel would mean fragile tests pinned to the plugin's internal channel name. The meaningful test coverage for this module is deferred to Task 14, where `SecureStore` gets exercised through real `AppDatabase` migration logic via dependency injection (a hand-written in-memory fake implementing the interface) — that test is what actually proves the integration works, not a test of the wrapper in isolation.

- [ ] **Step 1: Add the `flutter_secure_storage` dependency**

Find (in `pubspec.yaml`):
```yaml
dependencies:
  flutter:
    sdk: flutter
  cupertino_icons: ^1.0.8
  flutter_riverpod: ^2.6.1
  go_router: ^16.2.0
  connectivity_plus: ^7.0.0
  supabase_flutter: ^2.10.4
  drift: ^2.28.2
  sqlite3_flutter_libs: ^0.5.39
  path: ^1.9.1
  uuid: ^4.5.1
  intl: ^0.20.2
```
Replace with:
```yaml
dependencies:
  flutter:
    sdk: flutter
  cupertino_icons: ^1.0.8
  flutter_riverpod: ^2.6.1
  go_router: ^16.2.0
  connectivity_plus: ^7.0.0
  supabase_flutter: ^2.10.4
  drift: ^2.28.2
  sqlite3_flutter_libs: ^0.5.39
  path: ^1.9.1
  uuid: ^4.5.1
  intl: ^0.20.2
  flutter_secure_storage: ^10.3.1
```

Then run:
```bash
cd "C:\Users\isc\Desktop\Projects\life-os-mobile"
flutter pub get
```
Expected: `Got dependencies!`, `pubspec.lock` updates.

- [ ] **Step 2: Write `secure_credentials.dart`**

This defines a small `SecureStore` interface (so `AppDatabase` can take a fake implementation in tests, per Task 14) plus the real `flutter_secure_storage`-backed implementation used in production.

```dart
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

abstract class SecureStore {
  Future<String?> read(String key);
  Future<void> write(String key, String value);
  Future<void> delete(String key);
}

class FlutterSecureCredentialStore implements SecureStore {
  const FlutterSecureCredentialStore();

  static const _storage = FlutterSecureStorage();

  @override
  Future<String?> read(String key) => _storage.read(key: key);

  @override
  Future<void> write(String key, String value) =>
      _storage.write(key: key, value: value);

  @override
  Future<void> delete(String key) => _storage.delete(key: key);
}
```

- [ ] **Step 3: Verify analysis passes**

```bash
cd "C:\Users\isc\Desktop\Projects\life-os-mobile"
flutter analyze
```
Expected: no errors. `FlutterSecureCredentialStore` will show as unused until Task 11 wires it in — expected at this stage.

- [ ] **Step 4: Commit**

```bash
cd "C:\Users\isc\Desktop\Projects\life-os-mobile"
git add pubspec.yaml pubspec.lock lib/data/local/secure_credentials.dart
git commit -m "feat: add secure-storage-backed credential store"
```

---

## Task 11: Mobile — inject `SecureStore` into `AppDatabase`

**Files:**
- Modify: `lib/data/local/app_database.dart:268-269`

- [ ] **Step 1: Add the import and constructor field**

Find:
```dart
import 'dart:convert';

import 'package:drift/drift.dart';
import 'package:uuid/uuid.dart';

import '../../core/models/sync_models.dart';
import 'connection/connection.dart';
```
Replace with:
```dart
import 'dart:convert';

import 'package:drift/drift.dart';
import 'package:uuid/uuid.dart';

import '../../core/models/sync_models.dart';
import 'connection/connection.dart';
import 'secure_credentials.dart';
```

Find:
```dart
class AppDatabase extends _$AppDatabase {
  AppDatabase() : super(openConnection());
```
Replace with:
```dart
class AppDatabase extends _$AppDatabase {
  AppDatabase({SecureStore? secureStore})
      : _secureStore = secureStore ?? const FlutterSecureCredentialStore(),
        super(openConnection());

  final SecureStore _secureStore;
```

This is backward compatible — `AppDatabase()` (used in `lib/app/providers.dart`'s `appDatabaseProvider`) keeps working unchanged since `secureStore` is optional.

- [ ] **Step 2: Verify analysis passes**

```bash
cd "C:\Users\isc\Desktop\Projects\life-os-mobile"
flutter analyze
```
Expected: no new errors (the `_secureStore` field will show an "unused field" info/warning until Task 12 uses it — expected at this stage).

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\isc\Desktop\Projects\life-os-mobile"
git add lib/data/local/app_database.dart
git commit -m "chore: inject SecureStore into AppDatabase"
```

---

## Task 12: Mobile — `saveSyncSession`

**Files:**
- Modify: `lib/data/local/app_database.dart:447-465`

- [ ] **Step 1: Replace the method body**

Find:
```dart
  Future<void> saveSyncSession({
    required String accessToken,
    required String refreshToken,
    required String userId,
    required String? userEmail,
  }) {
    return into(syncSettings).insertOnConflictUpdate(
      SyncSettingsCompanion(
        id: const Value(1),
        syncEnabled: const Value(true),
        provider: const Value('supabase'),
        accessToken: Value(accessToken),
        refreshToken: Value(refreshToken),
        userId: Value(userId),
        userEmail: Value(userEmail),
        lastSyncError: const Value(null),
      ),
    );
  }
```
Replace with:
```dart
  Future<void> saveSyncSession({
    required String accessToken,
    required String refreshToken,
    required String userId,
    required String? userEmail,
  }) async {
    await _secureStore.write('sync_access_token', accessToken);
    await _secureStore.write('sync_refresh_token', refreshToken);
    await into(syncSettings).insertOnConflictUpdate(
      SyncSettingsCompanion(
        id: const Value(1),
        syncEnabled: const Value(true),
        provider: const Value('supabase'),
        userId: Value(userId),
        userEmail: Value(userEmail),
        lastSyncError: const Value(null),
      ),
    );
  }
```

- [ ] **Step 2: Verify analysis passes**

```bash
cd "C:\Users\isc\Desktop\Projects\life-os-mobile"
flutter analyze
```
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\isc\Desktop\Projects\life-os-mobile"
git add lib/data/local/app_database.dart
git commit -m "feat: store sync session tokens in secure storage on login"
```

---

## Task 13: Mobile — `clearSyncSession`

**Files:**
- Modify: `lib/data/local/app_database.dart:467-478`

- [ ] **Step 1: Replace the method body**

Find:
```dart
  Future<void> clearSyncSession() {
    return into(syncSettings).insertOnConflictUpdate(
      const SyncSettingsCompanion(
        id: Value(1),
        accessToken: Value(null),
        refreshToken: Value(null),
        userId: Value(null),
        userEmail: Value(null),
        lastSyncError: Value(null),
      ),
    );
  }
```
Replace with:
```dart
  Future<void> clearSyncSession() async {
    await _secureStore.delete('sync_access_token');
    await _secureStore.delete('sync_refresh_token');
    await into(syncSettings).insertOnConflictUpdate(
      const SyncSettingsCompanion(
        id: Value(1),
        userId: Value(null),
        userEmail: Value(null),
        lastSyncError: Value(null),
      ),
    );
  }
```

- [ ] **Step 2: Verify analysis passes**

```bash
cd "C:\Users\isc\Desktop\Projects\life-os-mobile"
flutter analyze
```
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\isc\Desktop\Projects\life-os-mobile"
git add lib/data/local/app_database.dart
git commit -m "feat: clear sync session tokens from secure storage on logout"
```

---

## Task 14: Mobile — `getSyncSetting` migrate-and-merge

**Files:**
- Modify: `lib/data/local/app_database.dart:391-394`

Mirrors the desktop's `read_app_state_row` migration logic: if the Drift row still holds a plaintext token, move it to secure storage and null the column; otherwise read the current value from secure storage. Every caller — `SyncRepository.hasSession`, `.signIn`, `.signOut`, `.getBootstrapStatus`, `.uploadThisDevice`, `.replaceLocalWithCloud`, `.syncNow`, `.runAutoSyncIfReady`, and `SupabaseSyncClient` reading `settings.refreshToken` — goes through this one method, so none of them need changes.

- [ ] **Step 1: Add a `forTesting` constructor so tests can inject both the DB executor and a fake `SecureStore`**

The generated Drift base class's constructor takes a positional `QueryExecutor` — confirmed by reading `lib/data/local/app_database.g.dart:8075`: `_$AppDatabase(QueryExecutor e) : super(e);` (the parameter is named `e`, not `executor` — matters if using Dart's `super.paramName` shorthand, which is why the code below calls `super(executor)` explicitly instead of relying on shorthand).

Find (in `app_database.dart`):
```dart
  AppDatabase({SecureStore? secureStore})
      : _secureStore = secureStore ?? const FlutterSecureCredentialStore(),
        super(openConnection());

  final SecureStore _secureStore;
```
Replace with:
```dart
  AppDatabase({SecureStore? secureStore})
      : _secureStore = secureStore ?? const FlutterSecureCredentialStore(),
        super(openConnection());

  AppDatabase.forTesting(QueryExecutor executor, {SecureStore? secureStore})
      : _secureStore = secureStore ?? const FlutterSecureCredentialStore(),
        super(executor);

  final SecureStore _secureStore;
```

- [ ] **Step 2: Write the failing test first**

Create `test/data/local/secure_credentials_test.dart`:

```dart
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:life_os_mobile/data/local/app_database.dart';
import 'package:life_os_mobile/data/local/secure_credentials.dart';

class InMemorySecureStore implements SecureStore {
  final Map<String, String> _values = {};

  @override
  Future<String?> read(String key) async => _values[key];

  @override
  Future<void> write(String key, String value) async {
    _values[key] = value;
  }

  @override
  Future<void> delete(String key) async {
    _values.remove(key);
  }
}

void main() {
  test('getSyncSetting migrates a plaintext token into secure storage', () async {
    final store = InMemorySecureStore();
    final db = AppDatabase.forTesting(NativeDatabase.memory(), secureStore: store);
    addTearDown(db.close);

    await db.into(db.syncSettings).insertOnConflictUpdate(
      const SyncSettingsCompanion(
        id: Value(1),
        accessToken: Value('plaintext-access'),
        refreshToken: Value('plaintext-refresh'),
      ),
    );

    final settings = await db.getSyncSetting();

    expect(settings?.accessToken, 'plaintext-access');
    expect(settings?.refreshToken, 'plaintext-refresh');
    expect(await store.read('sync_access_token'), 'plaintext-access');
    expect(await store.read('sync_refresh_token'), 'plaintext-refresh');
  });

  test('getSyncSetting reads from secure storage once the columns are migrated', () async {
    final store = InMemorySecureStore();
    await store.write('sync_access_token', 'already-migrated-access');
    await store.write('sync_refresh_token', 'already-migrated-refresh');
    final db = AppDatabase.forTesting(NativeDatabase.memory(), secureStore: store);
    addTearDown(db.close);

    await db.into(db.syncSettings).insertOnConflictUpdate(
      const SyncSettingsCompanion(id: Value(1), userId: Value('user-1')),
    );

    final settings = await db.getSyncSetting();

    expect(settings?.accessToken, 'already-migrated-access');
    expect(settings?.refreshToken, 'already-migrated-refresh');
  });
}
```

Check `pubspec.yaml`'s `name:` field before assuming the import path — this plan assumes `package:life_os_mobile/...` matching `name: life_os_mobile`; adjust the imports if it differs.

- [ ] **Step 3: Run the tests to verify they fail to compile**

```bash
cd "C:\Users\isc\Desktop\Projects\life-os-mobile"
flutter test test/data/local/secure_credentials_test.dart
```
Expected: the test compiles (since `getSyncSetting`'s current signature already matches this test's usage) but the first test's assertions fail, because the existing implementation never touches secure storage or nulls the Drift columns. Confirm you see a genuine failure before moving on — if it passes immediately, something's wrong with the test setup, not the implementation.

- [ ] **Step 4: Implement the migration logic**

Find (in `app_database.dart`):
```dart
  Future<SyncSetting?> getSyncSetting() {
    final query = select(syncSettings)..where((table) => table.id.equals(1));
    return query.getSingleOrNull();
  }
```
Replace with:
```dart
  Future<SyncSetting?> getSyncSetting() async {
    final query = select(syncSettings)..where((table) => table.id.equals(1));
    final row = await query.getSingleOrNull();
    if (row == null) return null;

    final accessToken = await _migrateAndReadSecret(
      'sync_access_token',
      row.accessToken,
    );
    final refreshToken = await _migrateAndReadSecret(
      'sync_refresh_token',
      row.refreshToken,
    );

    return row.copyWith(
      accessToken: Value(accessToken),
      refreshToken: Value(refreshToken),
    );
  }

  Future<String?> _migrateAndReadSecret(String key, String? columnValue) async {
    if (columnValue != null && columnValue.isNotEmpty) {
      await _secureStore.write(key, columnValue);
      await into(syncSettings).insertOnConflictUpdate(
        SyncSettingsCompanion(
          id: const Value(1),
          accessToken: key == 'sync_access_token' ? const Value(null) : const Value.absent(),
          refreshToken: key == 'sync_refresh_token' ? const Value(null) : const Value.absent(),
        ),
      );
      return columnValue;
    }
    return _secureStore.read(key);
  }
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
cd "C:\Users\isc\Desktop\Projects\life-os-mobile"
flutter test test/data/local/secure_credentials_test.dart
```
Expected: both tests pass, `00:0X +2: All tests passed!`

- [ ] **Step 6: Verify analysis passes**

```bash
cd "C:\Users\isc\Desktop\Projects\life-os-mobile"
flutter analyze
```
Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
cd "C:\Users\isc\Desktop\Projects\life-os-mobile"
git add lib/data/local/app_database.dart test/data/local/secure_credentials_test.dart
git commit -m "feat: migrate plaintext sync tokens into secure storage on read"
```

---

## Task 15: Mobile — final verification

**Files:** none (verification only)

- [ ] **Step 1: Full analysis and test suite**

```bash
cd "C:\Users\isc\Desktop\Projects\life-os-mobile"
flutter analyze
flutter test
```
Expected: no errors, all tests pass.

- [ ] **Step 2: Confirm no remaining direct reads of the old plaintext columns outside `app_database.dart`**

```bash
cd "C:\Users\isc\Desktop\Projects\life-os-mobile"
grep -rn "\.accessToken\|\.refreshToken" lib/data/sync/ lib/data/remote/
```
Expected: matches only show reads of `settings.accessToken`/`settings.refreshToken` (the merged values coming back from `getSyncSetting()`), not direct Drift column manipulation — confirming `SyncRepository` and `SupabaseSyncClient` needed no changes, as designed.

- [ ] **Step 3: Commit anything found broken** (skip if nothing needed fixing)

```bash
cd "C:\Users\isc\Desktop\Projects\life-os-mobile"
git add -A
git commit -m "fix: address issues found during credential storage final verification"
```
