# Persistent Debug/Crash Log — Design Spec

**Goal:** Make the app's debug/error log survive restarts, on both desktop (Tauri) and mobile (Flutter), so a crash that happens while the user is away is still visible when they check back.

## Problem

Desktop already captures errors into `useDebugStore` (Zustand, in-memory, capped at 120 entries): `RouteErrorBoundary`'s `componentDidCatch`, a global `window.onerror` handler, and a global `unhandledrejection` handler in `src/App.tsx` all feed it, surfaced via the floating `DebugConsole` panel. None of it survives a restart — if the app crashes while the user isn't looking, the log is gone by the time they relaunch.

Mobile has no equivalent at all: no global error handler, no debug log store, no way to see what went wrong after the fact.

## Scope

**In scope:** persistence for the existing desktop debug log; building an equivalent capture mechanism plus persistence for mobile, so both platforms end up with the same capability.

**Explicitly out of scope:** capturing true native process crashes that kill the process before any Dart/JS code can run (would require a native crash reporter like Crashlytics/Sentry — a much bigger dependency decision, not part of this effort). Remote/cloud log shipping. Log export/sharing UI. Changing the existing 120-entry in-memory cap's role in either store's live session behavior — persistence is additive, not a replacement for the in-memory array.

## Desktop design (Rust/Tauri)

New table in `src-tauri/src/db.rs`, following the file's existing `CREATE TABLE IF NOT EXISTS` convention (no formal migration system exists or is needed for desktop — every table is created idempotently on startup):

```sql
CREATE TABLE IF NOT EXISTS debug_log (
  id TEXT PRIMARY KEY,
  level TEXT NOT NULL,
  scope TEXT NOT NULL,
  message TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_debug_log_created ON debug_log(created_at);
```

Three new Tauri commands in `src-tauri/src/commands.rs`:
- `log_debug_entry(entry: NewDebugEntry) -> Result<(), String>` — inserts one row (`id` generated via `uuid`, same convention as every other table), then trims the table to the most recent 500 rows by `created_at`.
- `get_debug_log() -> Result<Vec<DebugEntry>, String>` — returns all rows ordered by `created_at` ascending (oldest first — matches the order `useDebugStore.entries` is already built in, since new entries are pushed to the end of the array).
- `clear_debug_log() -> Result<(), String>` — deletes all rows.

Retention cap: 500 rows (vs. the in-memory store's 120) — persisted storage is cheap and a longer history is more useful for after-the-fact investigation.

**Frontend wiring** (`src/store/useDebugStore.ts`, `src/components/shared/DebugConsole.tsx`, app startup hydration):
- `addEntry` keeps its current synchronous in-memory append unchanged, and additionally fires `invoke('log_debug_entry', {...})` without awaiting it, wrapped in a try/catch that swallows any failure silently — matching the existing silent-fallback convention in `src/lib/ai-xp.ts`. A failed debug-log write must never itself produce a visible error.
- At app startup, `get_debug_log` is called alongside the other stores' hydration calls (the existing `Promise.all()` in the startup sequence) and used to seed `useDebugStore`'s initial `entries` array.
- `DebugConsole`'s existing CLEAR button, which currently calls `useDebugStore.getState().clear()`, additionally calls `invoke('clear_debug_log')`.

**Known limitation, stated explicitly rather than implied:** this captures every case the current in-memory store already captures (React errors, `window.onerror`, `unhandledrejection`) — all cases where the JS engine is still running immediately after the error fires, giving the fire-and-forget `invoke()` a real chance to land before any restart. It cannot and does not attempt to capture a true native crash that kills the WebView process instantly, since no JS code would run to report it.

## Mobile design (Flutter)

### Capture mechanism (net new — nothing like this exists on mobile today)

Two global handlers wired in `lib/main.dart` before `runApp()`:
- `FlutterError.onError` — Flutter framework-level errors (widget build/layout throws). Direct analog of desktop's `RouteErrorBoundary` + `window.onerror`.
- `PlatformDispatcher.instance.onError` — uncaught async/isolate-level errors. Direct analog of desktop's `unhandledrejection`.

Additionally, `ErrorWidget.builder` is overridden globally: on a widget-build failure, it logs the error through the same path as the two handlers above, then renders a minimal fallback widget instead of Flutter's default red error screen. This is the closest mobile equivalent to a React error boundary — Flutter has no true per-route catch semantics, so a single global override is the idiomatic approach rather than per-screen boundaries.

### Persistence

New Drift table in `lib/data/local/app_database.dart`, named `LocalDebugLogEntries` to match the existing `LocalXxx` naming convention (`LocalDomains`, `LocalTasks`, etc.), with columns mirroring the desktop schema: `id` (text, primary key), `level` (text), `scope` (text), `message` (text), `detail` (text, nullable), `createdAt` (text).

This requires a schema migration: `AppDatabase.schemaVersion` is currently `1` with a `MigrationStrategy` that only defines `onCreate` and `beforeOpen`. It bumps to `2`, adding an `onUpgrade` step:

```dart
onUpgrade: (migrator, from, to) async {
  if (from < 2) {
    await migrator.createTable(localDebugLogEntries);
  }
},
```

New `AppDatabase` methods, following the existing method style on the class:
- `Future<void> logDebugEntry(LocalDebugLogEntriesCompanion entry)` — inserts one row, then trims to the most recent 500 rows by `createdAt` (matching desktop's cap).
- `Future<List<LocalDebugLogEntry>> getDebugLog()` — returns all rows ordered by `createdAt` ascending.
- `Future<void> clearDebugLog()` — deletes all rows.

### State + UI

New Riverpod notifier, `DebugLogNotifier`, mirroring `useDebugStore`'s shape: an `entries` list (same `level`/`scope`/`message`/`detail`/`created_at` shape as desktop), capped in-memory at 120 entries for the live session (matching desktop's live-session cap even though the persisted table holds more), an `addEntry` method that appends in-memory and calls `logDebugEntry` without awaiting (same fire-and-forget, swallow-on-failure pattern as desktop), and a `clear` method. Hydrated once at app startup via `getDebugLog()`, alongside the app's other startup data loading.

The three new global handlers (`FlutterError.onError`, `PlatformDispatcher.instance.onError`, `ErrorWidget.builder`) all call this notifier's `addEntry`.

UI surface: a dedicated **Debug Log screen**, reachable from the existing Settings screen, rather than a floating overlay like desktop's `DebugConsole` — a floating panel is a poor fit for mobile's smaller screens and would risk covering interactive content. The screen lists entries reverse-chronological, color-coded by level, with a button to clear the log (calling the notifier's `clear`, which also calls `clearDebugLog()`). Functionally equivalent to `DebugConsole.tsx`, adapted to mobile's screen-based navigation idiom.

## Error handling

Both platforms already have an established pattern for surfacing backend failures to the user (desktop: `useErrorStore` toast; mobile: its existing error-surfacing convention). Debug-log reads/writes are the one deliberate exception — a failure to log or persist a debug entry must never itself surface as a user-facing error or toast, since that would turn a best-effort diagnostic feature into a source of visible noise. No new user-facing error UI is introduced by this work.

## Testing

- Desktop: a Rust test for `log_debug_entry`/`get_debug_log`/`clear_debug_log` round-tripping through a real SQLite connection, plus a test confirming the 500-row trim behavior (insert more than 500, assert count stays at 500 and the oldest rows were the ones dropped).
- Mobile: a Drift test (using an in-memory `NativeDatabase`, following the existing test pattern in `test/data/local/secure_credentials_test.dart`) for `logDebugEntry`/`getDebugLog`/`clearDebugLog`, plus the same 500-row trim test as desktop. The three global handlers themselves are thin wiring and are not unit tested beyond confirming they call `addEntry` — Flutter's own error-handling mechanisms are trusted, not re-tested.

## Out of scope

- Native crash reporting (Crashlytics/Sentry or similar) for process-level crashes that kill the app before any Dart/JS code runs.
- Remote/cloud log shipping or export.
- Log export/sharing UI.
- Changing the 120-entry in-memory live-session cap on either platform.
