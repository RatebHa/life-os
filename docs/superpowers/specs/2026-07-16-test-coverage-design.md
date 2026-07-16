# Test Coverage — Design Spec

**Goal:** Add automated test coverage for the highest-risk, highest-value business logic on both platforms — task/habit/goal lifecycles, gamification math, sync, and backup/restore — that currently has none.

## Problem

Desktop's Rust backend (`src-tauri/src/commands.rs`) has 98 `#[tauri::command]` functions and only two narrow test modules (`credential_migration_tests`, `debug_log_tests`), both added in the last two sub-projects. Every other command — task/habit/goal CRUD, XP awarding, streak/momentum/achievement math, sync, backup/restore — has zero automated coverage; correctness currently depends entirely on manual testing.

Desktop's frontend has 142 Vitest tests across 11 files, but of 14 Zustand stores only 3 (`useTaskStore`, `useNoteStore`, `useCalendarStore`) are tested — the other 11, including the ones wrapping gamification and sync state, are not.

Mobile has a handful of tests from the two most recent sub-projects (`secure_credentials_test.dart`, `debug_log_test.dart`, `error_reporting_test.dart`, plus the default `widget_test.dart` smoke test) but no coverage of its own core logic: date/schedule calculations in `lib/core/utils/commitment_metrics.dart`, sync flows in `lib/data/sync/sync_repository.dart`, or the Drift CRUD methods for tasks/habits/goals in `lib/data/local/app_database.dart`.

## Scope

**In scope — desktop Rust** (`src-tauri/src/commands.rs`), each tested against a real in-memory SQLite connection with a minimal hand-created schema (the pattern already established by `credential_migration_tests`/`debug_log_tests` — not the full `db::init_db`, to keep each test file-scoped and fast):
- Task lifecycle: `create_task`, `complete_task` (XP award correctness via `xp_events`), `undo_complete_task`, `delete_task`
- Habit lifecycle: `create_habit`, `log_habit`, `log_habit_minimum`, `skip_habit`, `undo_habit_log` (streak increment/reset correctness)
- Goal progress: `create_goal`, `update_goal`
- Gamification: `update_domain_streak`, `use_streak_freeze`, `unlock_achievement`, `update_momentum`
- Sync: `configure_sync`, `export_sync_payload`, `import_sync_payload`
- Backup/restore: `create_backup`, `restore_latest_backup`, `import_data`

**In scope — desktop frontend** (Vitest, `src/store/__tests__/`): `useHabitStore`, `useGoalStore`, `useDomainStore`, `useAppStore` — following the exact structure of the three existing store test files (mock `@tauri-apps/api/core`'s `invoke` per-test via `vi.mocked(invoke).mockResolvedValueOnce(...)`, reset state in `beforeEach`, never `vi.resetModules()`).

**In scope — mobile** (`flutter test`):
- `lib/core/utils/commitment_metrics.dart`'s pure functions: `isoDay`/`parseIsoDay`/`shiftIsoDay` (date arithmetic), `taskFallsInWindow`/`isTaskOpen`/`isTaskOverdue`, `isHabitDueOnDate`/`jsWeekday`, `getHabitProgressForDate`, `completedHabitCountForDate`
- `lib/data/sync/sync_repository.dart`'s core flows: `signIn`, `signOut`, `syncNow` — against a fake `SupabaseSyncClient`-shaped remote (an in-memory test double, not a real Supabase call)
- `lib/data/local/app_database.dart`'s task/habit/goal CRUD methods (create/update/delete/watch), against `AppDatabase.forTesting(NativeDatabase.memory())` — the same pattern already used by `secure_credentials_test.dart`/`debug_log_test.dart`

**Explicitly out of scope:** presentational components, pages/screens, and pure-UI widgets on either platform (both apps' own conventions already treat visual correctness as a manual/screenshot-verification concern, not a unit-test concern — see this project's CLAUDE.md: "Type checking and test suites verify code correctness, not feature correctness"). Also out of scope: end-to-end/integration tests that drive the actual compiled app (Tauri or a Flutter device/emulator) — everything here is unit/component-level, run via `cargo test` / `npm test` / `flutter test`. AI-scored XP (`lib/ai-xp.ts`) — already has an explicit, tested fallback-on-error contract and depends on a live API key; out of scope for this pass. Achievement trigger logic (`src/lib/achievement-checker.ts`) and the rule-based XP engine (`src/lib/xp-engine.ts`) — already fully covered by existing tests, nothing to add.

## Desktop Rust test design

Each area gets its own `#[cfg(test)] mod` inside `commands.rs`, following the established convention: a local `setup_conn()` helper creates only the tables that area's functions touch (e.g. the task tests' `setup_conn()` creates `tasks`, `domains`, and `xp_events`; the sync tests' creates `app_state` and `sync_queue`), not the full schema. This keeps each test module fast, readable in isolation, and free of hidden cross-table coupling.

Representative cases per area (not exhaustive — the plan will enumerate exact test functions):
- `complete_task`: completing a task awards the XP value computed by the rule-based engine's inputs (priority/time estimate/MIT/on-time) into `xp_events` and marks `completed_at`; completing an already-completed task is a no-op or error (whichever the current implementation does — the test documents actual behavior, doesn't invent new behavior).
- `log_habit`: logging increments `streak_current`, and logging on a day that breaks the streak (a gap) resets it to 1; `undo_habit_log` reverses the log and streak change.
- `update_momentum`: recalculating from a set of seeded `xp_events` rows produces the score `lib/momentum.ts`'s desktop-mirrored formula would predict (cross-checked against the existing frontend `momentum.test.ts` expectations for the same inputs, since both sides are supposed to agree).
- `export_sync_payload`/`import_sync_payload`: a round-trip (export then import into a fresh empty schema) reproduces the original rows; importing a payload with a newer `updated_at` for an existing row updates it, an older one doesn't (last-write-wins, whatever the current logic actually implements).
- `create_backup`/`restore_latest_backup`: a backup file is created on disk in the configured backup directory, and restoring it round-trips the data — using a temp directory, not the real user backup directory.

## Desktop frontend test design

Same shape as `useTaskStore.test.ts`: for each store, cover the load action (success + error-swallowed-to-console-only per the established convention), each mutation action (success path updates state optimistically, error path calls `useErrorStore`'s `addError` where the store already does that), and any store-local derived/selector logic. No new mocking conventions — reuse `src/test/__mocks__/tauri.ts`.

## Mobile test design

`commitment_metrics.dart` functions are pure (no I/O), so these are plain `test()` blocks with hand-constructed inputs — no `AppDatabase` needed except where a function takes a `LocalTask`/`LocalHabit`/`LocalDomain` row shape as input, in which case a minimal in-memory row is constructed directly (Drift's generated data classes are plain constructible objects, no DB required to build one).

`sync_repository_test.dart` needs a fake remote client implementing whatever interface `SupabaseSyncClient` exposes to `SyncRepository` (checked against the actual current constructor/method signatures when the plan is written — `SyncRepository` already takes `remoteClient` as a constructor parameter per `providers.dart`, so this is already designed for substitution, not something this work needs to introduce).

`app_database_crud_test.dart` (or similar) follows the exact `AppDatabase.forTesting(NativeDatabase.memory())` pattern already used twice in this repo.

## Out of scope

- Presentational components, pages/screens, pure-UI widgets (either platform).
- End-to-end/integration tests against a running app.
- `lib/ai-xp.ts` (AI-scored XP).
- `src/lib/achievement-checker.ts`, `src/lib/xp-engine.ts` (already fully covered).
- Any refactoring of the code under test beyond what's strictly needed to make it testable (e.g. if a Rust command's logic is genuinely untestable without extracting a helper function, extracting one mirrors the precedent already set by `insert_debug_log_entry`/`select_debug_log` in the debug-log sub-project — but this plan does not go looking for refactors, only adds tests around existing behavior).
