# Persistent Debug Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the debug/error log survive app restarts on both desktop and mobile, and give mobile the same crash/error capture desktop already has.

**Architecture:** Desktop adds a `debug_log` SQLite table plus three Tauri commands, and extends the existing `useDebugStore` Zustand store to persist through them. Mobile adds an equivalent Drift table, a new `DebugLogNotifier` (Riverpod `StateNotifier`) that mirrors `useDebugStore`'s shape, three new global error handlers (`FlutterError.onError`, `PlatformDispatcher.instance.onError`, `ErrorWidget.builder`) wired in `main.dart` before `runApp`, and a new Debug Log screen reachable from Settings.

**Tech Stack:** Rust/rusqlite/Tauri (desktop backend), React/TypeScript/Zustand (desktop frontend), Dart/Drift/Riverpod/go_router (mobile).

---

## Desktop

### Task 1: `debug_log` table

**Files:**
- Modify: `src-tauri/src/db.rs:298-308`

- [ ] **Step 1: Add the table and index**

In `src-tauri/src/db.rs`, the big schema string ends with the `restore_history` table (line 298-307) followed by the closing `")?;"` on line 308:

```rust
        CREATE TABLE IF NOT EXISTS restore_history (
            id TEXT PRIMARY KEY,
            file_path TEXT NOT NULL,
            backup_name TEXT NOT NULL,
            action TEXT NOT NULL DEFAULT 'restore',
            source_exported_at TEXT,
            source_version TEXT,
            created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_restore_history_created ON restore_history(created_at);
    ")?;
```

Insert a new table block immediately after the `idx_restore_history_created` line and before the closing `")?;"`:

```rust
        CREATE TABLE IF NOT EXISTS restore_history (
            id TEXT PRIMARY KEY,
            file_path TEXT NOT NULL,
            backup_name TEXT NOT NULL,
            action TEXT NOT NULL DEFAULT 'restore',
            source_exported_at TEXT,
            source_version TEXT,
            created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_restore_history_created ON restore_history(created_at);

        CREATE TABLE IF NOT EXISTS debug_log (
            id TEXT PRIMARY KEY,
            level TEXT NOT NULL,
            scope TEXT NOT NULL,
            message TEXT NOT NULL,
            detail TEXT,
            created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_debug_log_created ON debug_log(created_at);
    ")?;
```

- [ ] **Step 2: Verify it compiles**

Run: `cd "C:\Users\isc\Desktop\Projects\Life OS\src-tauri" && cargo check`
Expected: compiles with no errors (this is a string literal change, so this step just catches typos/unbalanced quotes).

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/db.rs
git commit -m "feat: add debug_log table for persistent debug entries"
```

---

### Task 2: Rust commands for the debug log

**Files:**
- Modify: `src-tauri/src/commands.rs` (insert after line 5907, the end of `CreateTaskFrictionLogPayload`)

This task follows TDD: the test module is added first, referencing functions that don't exist yet, then the implementation is added to make it compile and pass.

- [ ] **Step 1: Write the failing test**

Add this new section at the end of `src-tauri/src/commands.rs` (after the closing `}` of `CreateTaskFrictionLogPayload` on line 5907):

```rust

// ─── Debug Log ──────────────────────────────────────────────────────────────

#[cfg(test)]
mod debug_log_tests {
    use super::*;

    fn setup_conn() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute(
            "CREATE TABLE debug_log (
                id TEXT PRIMARY KEY,
                level TEXT NOT NULL,
                scope TEXT NOT NULL,
                message TEXT NOT NULL,
                detail TEXT,
                created_at TEXT NOT NULL
            )",
            [],
        ).unwrap();
        conn
    }

    #[test]
    fn round_trips_a_debug_log_entry() {
        let conn = setup_conn();
        insert_debug_log_entry(&conn, "error", "test.scope", "boom", Some("stack trace")).unwrap();

        let entries = select_debug_log(&conn).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].level, "error");
        assert_eq!(entries[0].scope, "test.scope");
        assert_eq!(entries[0].message, "boom");
        assert_eq!(entries[0].detail.as_deref(), Some("stack trace"));

        conn.execute("DELETE FROM debug_log", []).unwrap();
        assert!(select_debug_log(&conn).unwrap().is_empty());
    }

    #[test]
    fn trims_to_the_500_most_recent_entries() {
        let conn = setup_conn();
        for i in 0..510 {
            let hour = i / 60;
            let minute = i % 60;
            conn.execute(
                "INSERT INTO debug_log (id, level, scope, message, detail, created_at) VALUES (?1, 'info', 'test', ?2, NULL, ?3)",
                params![
                    format!("id-{}", i),
                    format!("entry {}", i),
                    format!("2026-01-01T{:02}:{:02}:00Z", hour, minute)
                ],
            ).unwrap();
        }

        insert_debug_log_entry(&conn, "info", "test", "trigger trim", None).unwrap();

        let entries = select_debug_log(&conn).unwrap();
        assert_eq!(entries.len(), 500);
        assert_eq!(entries.last().unwrap().message, "trigger trim");
        assert!(!entries.iter().any(|e| e.message == "entry 0"));
    }
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd "C:\Users\isc\Desktop\Projects\Life OS\src-tauri" && cargo test debug_log_tests`
Expected: FAIL to compile — `error[E0425]: cannot find function 'insert_debug_log_entry' in this scope` (and the same for `select_debug_log`).

- [ ] **Step 3: Add the structs, helper functions, and Tauri commands**

Add this immediately above the `#[cfg(test)] mod debug_log_tests` block added in Step 1 (i.e. between the `// ─── Debug Log ───` comment and the test module):

```rust
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DebugEntry {
    pub id: String,
    pub level: String,
    pub scope: String,
    pub message: String,
    pub detail: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NewDebugEntryPayload {
    pub level: String,
    pub scope: String,
    pub message: String,
    pub detail: Option<String>,
}

fn insert_debug_log_entry(
    conn: &Connection,
    level: &str,
    scope: &str,
    message: &str,
    detail: Option<&str>,
) -> Result<(), String> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO debug_log (id, level, scope, message, detail, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![id, level, scope, message, detail, now],
    ).map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM debug_log WHERE id NOT IN (SELECT id FROM debug_log ORDER BY created_at DESC LIMIT 500)",
        [],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

fn select_debug_log(conn: &Connection) -> Result<Vec<DebugEntry>, String> {
    let mut stmt = conn.prepare(
        "SELECT id, level, scope, message, detail, created_at FROM debug_log ORDER BY created_at ASC"
    ).map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| {
        Ok(DebugEntry {
            id: row.get(0)?,
            level: row.get(1)?,
            scope: row.get(2)?,
            message: row.get(3)?,
            detail: row.get(4)?,
            created_at: row.get(5)?,
        })
    }).map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn log_debug_entry(state: State<'_, DbState>, payload: NewDebugEntryPayload) -> Result<(), String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    insert_debug_log_entry(&conn, &payload.level, &payload.scope, &payload.message, payload.detail.as_deref())
}

#[tauri::command]
pub fn get_debug_log(state: State<'_, DbState>) -> Result<Vec<DebugEntry>, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    select_debug_log(&conn)
}

#[tauri::command]
pub fn clear_debug_log(state: State<'_, DbState>) -> Result<(), String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    conn.execute("DELETE FROM debug_log", []).map_err(|e| e.to_string())?;
    Ok(())
}

```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd "C:\Users\isc\Desktop\Projects\Life OS\src-tauri" && cargo test debug_log_tests`
Expected: `test debug_log_tests::round_trips_a_debug_log_entry ... ok` and `test debug_log_tests::trims_to_the_500_most_recent_entries ... ok` (2 passed).

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands.rs
git commit -m "feat: add log_debug_entry, get_debug_log, clear_debug_log commands"
```

---

### Task 3: Register the commands in `lib.rs`

**Files:**
- Modify: `src-tauri/src/lib.rs:128`

- [ ] **Step 1: Add the three commands to the invoke handler**

In `src-tauri/src/lib.rs`, find line 128 (`commands::use_streak_freeze,`, the last entry before the closing `])`) and add the three new commands after it:

```rust
            commands::use_streak_freeze,
            commands::log_debug_entry,
            commands::get_debug_log,
            commands::clear_debug_log,
        ])
```

- [ ] **Step 2: Verify it builds**

Run: `cd "C:\Users\isc\Desktop\Projects\Life OS\src-tauri" && cargo build`
Expected: builds with no errors.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat: register debug log commands with Tauri"
```

---

### Task 4: Frontend types

**Files:**
- Modify: `src/lib/types.ts` (add after line 553, the end of `CreateTaskFrictionLogPayload`)

- [ ] **Step 1: Add the types**

Add to the end of `src/lib/types.ts`:

```typescript
export interface DebugEntry {
  id: string;
  level: 'info' | 'warn' | 'error';
  scope: string;
  message: string;
  detail?: string;
  created_at: string;
}

export interface NewDebugEntryPayload {
  level: 'info' | 'warn' | 'error';
  scope: string;
  message: string;
  detail?: string;
}
```

This `DebugEntry` shape is identical to the one currently declared locally in `src/store/useDebugStore.ts:3-10` — Task 6 removes that local copy and imports this one instead, so no other file's behavior changes.

- [ ] **Step 2: Verify it compiles**

Run: `cd "C:\Users\isc\Desktop\Projects\Life OS" && npx tsc --noEmit`
Expected: no errors (these are new, unused-so-far exports).

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add DebugEntry and NewDebugEntryPayload types"
```

---

### Task 5: `db.ts` typed wrappers

**Files:**
- Modify: `src/lib/db.ts`

- [ ] **Step 1: Import the new types**

In `src/lib/db.ts`, add `DebugEntry` and `NewDebugEntryPayload` to the existing type import block (the one starting `import type {` at line 2):

```typescript
import type {
  Domain, Task, CreateTaskPayload, UpdateTaskPayload,
  Habit, CreateHabitPayload, UpdateHabitPayload, HabitLog,
  Goal, CreateGoalPayload, UpdateGoalPayload,
  XpEvent, Achievement, AppStateRow, DailyXp, TaskStats,
  Note, CreateNotePayload, UpdateNotePayload, CalendarDay,
  InboxItem, CreateInboxItemPayload, TriageInboxItemPayload,
  TaskTemplate, CreateTaskTemplatePayload, UpdateTaskTemplatePayload,
  FocusSession, FocusTimerDraft, SaveFocusTimerDraftPayload, CompleteFocusSessionPayload, TaskFrictionLog, CreateTaskFrictionLogPayload,
  BackupPreview, BackupHistoryItem, BackupHealthStatus,
  UpdateDomainProfilePayload,
  CreateDomainPayload,
  SyncConfigPayload,
  SyncSessionPayload,
  SyncStatusPayload,
  SyncCounts,
  SyncPayload,
  SyncQueueItem,
  SyncCursor,
  DebugEntry,
  NewDebugEntryPayload,
} from './types';
```

- [ ] **Step 2: Add the three wrapper functions**

Add this new section at the end of the `db` object in `src/lib/db.ts` (immediately before its closing `};`):

```typescript
  // ─── Debug Log ─────────────────────────────────────────────────────────────
  getDebugLog: (): Promise<DebugEntry[]> =>
    invoke<Array<{ id: string; level: 'info' | 'warn' | 'error'; scope: string; message: string; detail: string | null; created_at: string }>>('get_debug_log')
      .then((rows) => rows.map((row) => ({ ...row, detail: row.detail ?? undefined }))),
  logDebugEntry: (payload: NewDebugEntryPayload) => invoke<void>('log_debug_entry', { payload }),
  clearDebugLog: () => invoke<void>('clear_debug_log'),
```

The Rust side returns `detail: Option<String>`, which serializes to `null` when absent — `getDebugLog` normalizes that to `undefined` right at the boundary so `DebugEntry.detail` has one consistent shape (`string | undefined`) everywhere in the frontend, matching what `useDebugStore` already produces for entries created in-session.

- [ ] **Step 3: Verify it compiles**

Run: `cd "C:\Users\isc\Desktop\Projects\Life OS" && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/db.ts
git commit -m "feat: add typed wrappers for the debug log commands"
```

---

### Task 6: `useDebugStore` persistence

**Files:**
- Modify: `src/store/useDebugStore.ts`

- [ ] **Step 1: Rewrite the store**

Replace the full contents of `src/store/useDebugStore.ts` with:

```typescript
import { create } from 'zustand';
import type { DebugEntry } from '../lib/types';
import { db } from '../lib/db';

interface DebugStore {
  entries: DebugEntry[];
  open: boolean;
  addEntry: (entry: Omit<DebugEntry, 'id' | 'created_at'>) => void;
  clear: () => void;
  setOpen: (open: boolean) => void;
  toggleOpen: () => void;
  loadDebugLog: () => Promise<void>;
}

let debugCounter = 0;

export const useDebugStore = create<DebugStore>((set) => ({
  entries: [],
  open: false,

  addEntry: (entry) => {
    const nextEntry: DebugEntry = {
      id: `dbg-${++debugCounter}`,
      created_at: new Date().toISOString(),
      ...entry,
    };

    set((state) => ({
      entries: [...state.entries.slice(-119), nextEntry],
      open: state.open || entry.level === 'error',
    }));

    db.logDebugEntry({
      level: entry.level,
      scope: entry.scope,
      message: entry.message,
      detail: entry.detail,
    }).catch(() => {});
  },

  clear: () => {
    set({ entries: [] });
    db.clearDebugLog().catch(() => {});
  },

  setOpen: (open) => set({ open }),
  toggleOpen: () => set((state) => ({ open: !state.open })),

  loadDebugLog: async () => {
    try {
      const loaded = await db.getDebugLog();
      set((state) => ({ entries: [...loaded, ...state.entries].slice(-119) }));
    } catch (err) {
      console.error('Failed to load debug log:', err);
    }
  },
}));
```

This keeps `DebugEntry`'s shape and every existing method's signature identical to before (`addEntry`, `clear`, `setOpen`, `toggleOpen`), so `DebugConsole.tsx` and every call site (`App.tsx`, `WeeklyReview.tsx`, `RouteErrorBoundary.tsx`) needs no changes. `addEntry` and `clear` fire their Tauri call without awaiting it and swallow any failure — a debug-log write or clear must never itself surface as a user-facing error, per the design spec. `loadDebugLog` is new — Task 7 wires it into startup hydration.

- [ ] **Step 2: Verify it compiles and existing tests still pass**

Run: `cd "C:\Users\isc\Desktop\Projects\Life OS" && npx tsc --noEmit && npm test`
Expected: no type errors; all existing tests still pass (this store has no dedicated test file today, per the design spec's testing scope — only the Rust/Drift layers get new tests).

- [ ] **Step 3: Commit**

```bash
git add src/store/useDebugStore.ts
git commit -m "feat: persist debug log entries through the SQLite-backed commands"
```

---

### Task 7: Startup hydration in `App.tsx`

**Files:**
- Modify: `src/App.tsx:177-178`, `src/App.tsx:317-330`

- [ ] **Step 1: Select the new action**

In `src/App.tsx`, immediately after line 178 (`const toggleDebugOpen = useDebugStore((state) => state.toggleOpen);`), add:

```typescript
  const loadDebugLog = useDebugStore((state) => state.loadDebugLog);
```

- [ ] **Step 2: Add it to the startup hydration**

In the `Promise.all([...])` block at line 317-330, add `loadDebugLog(),` after `loadTaskFrictionLogs(),`:

```typescript
    Promise.all([
      loadDomains(),
      loadTasks(),
      loadHabits(),
      loadGoals(),
      loadAppState(),
      loadNotes(),
      loadInbox(),
      loadTaskTemplates(),
      loadFocusSessions(),
      loadFocusDrafts(),
      loadTaskFrictionLogs(),
      loadDebugLog(),
      db.updateLastOpened(),
    ])
```

- [ ] **Step 3: Verify it compiles and existing tests still pass**

Run: `cd "C:\Users\isc\Desktop\Projects\Life OS" && npx tsc --noEmit && npm test`
Expected: no errors, all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: hydrate the debug log on app startup"
```

---

### Task 8: Desktop final verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full Rust test suite**

Run: `cd "C:\Users\isc\Desktop\Projects\Life OS\src-tauri" && cargo test`
Expected: all tests pass, including the two new `debug_log_tests` and the pre-existing `credentials`/`credential_migration_tests` modules.

- [ ] **Step 2: Run a full Rust build**

Run: `cd "C:\Users\isc\Desktop\Projects\Life OS\src-tauri" && cargo build`
Expected: builds with no errors or new warnings.

- [ ] **Step 3: Run the full frontend test suite and typecheck+build**

Run: `cd "C:\Users\isc\Desktop\Projects\Life OS" && npm test && npm run build`
Expected: all Vitest tests pass; `tsc && vite build` completes with no type errors.

- [ ] **Step 4: Manual smoke check (optional, if a GUI session is available)**

Launch `npm run tauri dev`, open the DEBUG console (bottom-right button), trigger any error (e.g. navigate to a broken route or watch a real error occur), confirm it appears in the console, restart the app, and confirm the entry is still there after restart. This confirms persistence end-to-end but isn't required to consider the desktop half of this plan done — Steps 1-3 are the hard gate.

---

## Mobile

### Task 9: Drift table, migration, and `AppDatabase` methods

**Files:**
- Modify: `lib/data/local/app_database.dart`

- [ ] **Step 1: Add the table class**

In `lib/data/local/app_database.dart`, add this new table class immediately after the `SyncCursors` class (which ends at line 253, right before the `@DriftDatabase(` annotation at line 255):

```dart
class LocalDebugLogEntries extends Table {
  TextColumn get id => text()();
  TextColumn get level => text()();
  TextColumn get scope => text()();
  TextColumn get message => text()();
  TextColumn get detail => text().nullable()();
  TextColumn get createdAt => text().named('created_at')();

  @override
  Set<Column<Object>>? get primaryKey => {id};
}
```

- [ ] **Step 2: Register the table and bump the schema version**

In the `@DriftDatabase(tables: [...])` annotation (lines 255-268), add `LocalDebugLogEntries` to the list:

```dart
@DriftDatabase(
  tables: [
    LocalDomains,
    LocalTasks,
    LocalHabits,
    LocalHabitLogs,
    LocalGoals,
    LocalNotes,
    LocalInboxItems,
    SyncSettings,
    SyncQueueItems,
    SyncCursors,
    LocalDebugLogEntries,
  ],
)
```

Then update `schemaVersion` and `migration` (lines 280-292):

```dart
  @override
  int get schemaVersion => 2;

  @override
  MigrationStrategy get migration => MigrationStrategy(
    onCreate: (migrator) async {
      await migrator.createAll();
      await _ensureBootstrapRows();
    },
    onUpgrade: (migrator, from, to) async {
      if (from < 2) {
        await migrator.createTable(localDebugLogEntries);
      }
    },
    beforeOpen: (details) async {
      await _ensureBootstrapRows();
    },
  );
```

- [ ] **Step 3: Regenerate Drift's generated code**

Run: `cd "C:\Users\isc\Desktop\Projects\life-os-mobile" && dart run build_runner build --delete-conflicting-outputs`
Expected: completes successfully, regenerating `lib/data/local/app_database.g.dart` with `LocalDebugLogEntry`, `LocalDebugLogEntriesCompanion`, and `$LocalDebugLogEntriesTable` added.

- [ ] **Step 4: Add the three database methods**

Add this new section to `AppDatabase` in `lib/data/local/app_database.dart`, near the other data-access methods (e.g. immediately after `watchInbox()`):

```dart
  Future<List<LocalDebugLogEntry>> getDebugLog() {
    return (select(localDebugLogEntries)
          ..orderBy([(table) => OrderingTerm(expression: table.createdAt)]))
        .get();
  }

  Future<void> logDebugEntry(LocalDebugLogEntriesCompanion entry) async {
    await into(localDebugLogEntries).insert(entry);
    await customStatement(
      'DELETE FROM local_debug_log_entries WHERE id NOT IN '
      '(SELECT id FROM local_debug_log_entries ORDER BY created_at DESC LIMIT 500)',
    );
  }

  Future<void> clearDebugLog() => delete(localDebugLogEntries).go();
```

- [ ] **Step 5: Verify it compiles**

Run: `cd "C:\Users\isc\Desktop\Projects\life-os-mobile" && flutter analyze lib/data/local/app_database.dart`
Expected: no issues found.

- [ ] **Step 6: Commit**

```bash
git add lib/data/local/app_database.dart lib/data/local/app_database.g.dart
git commit -m "feat: add local_debug_log_entries table and AppDatabase methods"
```

---

### Task 10: Drift tests for the debug log

**Files:**
- Create: `test/data/local/debug_log_test.dart`

- [ ] **Step 1: Write the test**

Create `test/data/local/debug_log_test.dart`:

```dart
import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:life_os_mobile/data/local/app_database.dart';

void main() {
  test('logDebugEntry round-trips through getDebugLog and clearDebugLog', () async {
    final db = AppDatabase.forTesting(NativeDatabase.memory());
    addTearDown(db.close);

    await db.logDebugEntry(
      LocalDebugLogEntriesCompanion.insert(
        id: 'entry-1',
        level: 'error',
        scope: 'test.scope',
        message: 'boom',
        detail: const Value('stack trace'),
        createdAt: '2026-01-01T00:00:00Z',
      ),
    );

    final entries = await db.getDebugLog();
    expect(entries.length, 1);
    expect(entries.first.level, 'error');
    expect(entries.first.scope, 'test.scope');
    expect(entries.first.message, 'boom');
    expect(entries.first.detail, 'stack trace');

    await db.clearDebugLog();
    expect(await db.getDebugLog(), isEmpty);
  });

  test('logDebugEntry trims to the 500 most recent entries', () async {
    final db = AppDatabase.forTesting(NativeDatabase.memory());
    addTearDown(db.close);

    for (var i = 0; i < 510; i++) {
      final hour = (i ~/ 60).toString().padLeft(2, '0');
      final minute = (i % 60).toString().padLeft(2, '0');
      await db.into(db.localDebugLogEntries).insert(
        LocalDebugLogEntriesCompanion.insert(
          id: 'id-$i',
          level: 'info',
          scope: 'test',
          message: 'entry $i',
          createdAt: '2026-01-01T$hour:$minute:00Z',
        ),
      );
    }

    await db.logDebugEntry(
      LocalDebugLogEntriesCompanion.insert(
        id: 'trigger',
        level: 'info',
        scope: 'test',
        message: 'trigger trim',
        createdAt: '2026-01-01T09:00:00Z',
      ),
    );

    final entries = await db.getDebugLog();
    expect(entries.length, 500);
    expect(entries.last.message, 'trigger trim');
    expect(entries.any((e) => e.message == 'entry 0'), isFalse);
  });
}
```

- [ ] **Step 2: Run the tests**

Run: `cd "C:\Users\isc\Desktop\Projects\life-os-mobile" && flutter test test/data/local/debug_log_test.dart`
Expected: both tests pass.

- [ ] **Step 3: Commit**

```bash
git add test/data/local/debug_log_test.dart
git commit -m "test: cover debug log round-trip and 500-row trim"
```

---

### Task 11: `DebugLogNotifier`

**Files:**
- Create: `lib/data/local/debug_log_notifier.dart`
- Modify: `lib/app/providers.dart`

- [ ] **Step 1: Write the notifier**

Create `lib/data/local/debug_log_notifier.dart`:

```dart
import 'dart:async';

import 'package:drift/drift.dart' show Value;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import 'app_database.dart';

const _uuid = Uuid();
const _maxLiveEntries = 120;

class DebugLogEntryData {
  const DebugLogEntryData({
    required this.id,
    required this.level,
    required this.scope,
    required this.message,
    required this.createdAt,
    this.detail,
  });

  final String id;
  final String level;
  final String scope;
  final String message;
  final String? detail;
  final String createdAt;
}

class DebugLogNotifier extends StateNotifier<List<DebugLogEntryData>> {
  DebugLogNotifier(this._database) : super(const []) {
    unawaited(_hydrate());
  }

  final AppDatabase _database;

  Future<void> _hydrate() async {
    try {
      final rows = await _database.getDebugLog();
      final loaded = rows
          .map(
            (row) => DebugLogEntryData(
              id: row.id,
              level: row.level,
              scope: row.scope,
              message: row.message,
              detail: row.detail,
              createdAt: row.createdAt,
            ),
          )
          .toList();
      state = _capped([...loaded, ...state]);
    } catch (_) {
      // Best-effort: a failed hydration must not block app startup.
    }
  }

  void addEntry({
    required String level,
    required String scope,
    required String message,
    String? detail,
  }) {
    final entry = DebugLogEntryData(
      id: _uuid.v4(),
      level: level,
      scope: scope,
      message: message,
      detail: detail,
      createdAt: DateTime.now().toUtc().toIso8601String(),
    );
    state = _capped([...state, entry]);
    unawaited(
      _database
          .logDebugEntry(
            LocalDebugLogEntriesCompanion.insert(
              id: entry.id,
              level: entry.level,
              scope: entry.scope,
              message: entry.message,
              detail: Value(entry.detail),
              createdAt: entry.createdAt,
            ),
          )
          .catchError((_) {}),
    );
  }

  void clear() {
    state = const [];
    unawaited(_database.clearDebugLog().catchError((_) {}));
  }

  List<DebugLogEntryData> _capped(List<DebugLogEntryData> entries) {
    if (entries.length <= _maxLiveEntries) return entries;
    return entries.sublist(entries.length - _maxLiveEntries);
  }
}
```

This mirrors `useDebugStore.ts`: an in-memory list capped at 120 (matching desktop's live-session cap), an `addEntry` that updates state immediately and persists in the background without awaiting or surfacing failures, and a `clear` that does the same for wiping the log.

- [ ] **Step 2: Register the provider**

In `lib/app/providers.dart`, add the import and provider:

```dart
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/models/sync_models.dart';
import '../data/local/app_database.dart';
import '../data/local/debug_log_notifier.dart';
import '../data/remote/supabase_sync_client.dart';
import '../data/sync/sync_coordinator.dart';
import '../data/sync/sync_repository.dart';

final appDatabaseProvider = Provider<AppDatabase>((ref) {
  final database = AppDatabase();
  ref.onDispose(database.close);
  return database;
});

final debugLogNotifierProvider =
    StateNotifierProvider<DebugLogNotifier, List<DebugLogEntryData>>((ref) {
  return DebugLogNotifier(ref.watch(appDatabaseProvider));
});
```

(Insert `debugLogNotifierProvider` right after `appDatabaseProvider`; leave every other provider in the file untouched.)

- [ ] **Step 3: Verify it compiles**

Run: `cd "C:\Users\isc\Desktop\Projects\life-os-mobile" && flutter analyze lib/data/local/debug_log_notifier.dart lib/app/providers.dart`
Expected: no issues found.

- [ ] **Step 4: Commit**

```bash
git add lib/data/local/debug_log_notifier.dart lib/app/providers.dart
git commit -m "feat: add DebugLogNotifier mirroring the desktop debug store"
```

---

### Task 12: Testable error-reporting functions, wired into `main.dart`

**Files:**
- Create: `lib/app/error_reporting.dart`
- Create: `test/app/error_reporting_test.dart`
- Modify: `lib/main.dart`

The three capture points are written as plain top-level functions that take a `DebugLogNotifier` as a parameter, rather than as closures inline in `main.dart` — closures capturing `container` directly can't be unit tested, and the design spec calls for confirming each handler calls `addEntry`.

- [ ] **Step 1: Write `error_reporting.dart`**

Create `lib/app/error_reporting.dart`:

```dart
import 'package:flutter/widgets.dart';

import '../data/local/debug_log_notifier.dart';

void reportFlutterError(DebugLogNotifier notifier, FlutterErrorDetails details) {
  notifier.addEntry(
    level: 'error',
    scope: 'FlutterError.onError',
    message: details.exceptionAsString(),
    detail: details.stack?.toString(),
  );
}

bool reportPlatformError(DebugLogNotifier notifier, Object error, StackTrace stack) {
  notifier.addEntry(
    level: 'error',
    scope: 'PlatformDispatcher.onError',
    message: error.toString(),
    detail: stack.toString(),
  );
  return true;
}

Widget reportErrorWidget(DebugLogNotifier notifier, FlutterErrorDetails details) {
  notifier.addEntry(
    level: 'error',
    scope: 'ErrorWidget.builder',
    message: details.exceptionAsString(),
    detail: details.stack?.toString(),
  );
  return const CaughtErrorFallback();
}

class CaughtErrorFallback extends StatelessWidget {
  const CaughtErrorFallback({super.key});

  @override
  Widget build(BuildContext context) {
    return const ColoredBox(
      color: Color(0xFF1A1A1A),
      child: Center(
        child: Text(
          'Something went wrong on this screen.',
          style: TextStyle(color: Color(0xFFE0E0E0)),
          textAlign: TextAlign.center,
        ),
      ),
    );
  }
}
```

- [ ] **Step 2: Write the test**

Create `test/app/error_reporting_test.dart`:

```dart
import 'package:drift/native.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:life_os_mobile/app/error_reporting.dart';
import 'package:life_os_mobile/data/local/app_database.dart';
import 'package:life_os_mobile/data/local/debug_log_notifier.dart';

void main() {
  late DebugLogNotifier notifier;

  setUp(() {
    notifier = DebugLogNotifier(AppDatabase.forTesting(NativeDatabase.memory()));
  });

  test('reportFlutterError logs an error-level entry', () {
    final details = FlutterErrorDetails(exception: Exception('boom'));
    reportFlutterError(notifier, details);

    expect(notifier.state.length, 1);
    expect(notifier.state.first.level, 'error');
    expect(notifier.state.first.scope, 'FlutterError.onError');
    expect(notifier.state.first.message, contains('boom'));
  });

  test('reportPlatformError logs an error-level entry and returns true', () {
    final handled = reportPlatformError(notifier, Exception('async boom'), StackTrace.current);

    expect(handled, isTrue);
    expect(notifier.state.length, 1);
    expect(notifier.state.first.scope, 'PlatformDispatcher.onError');
    expect(notifier.state.first.message, contains('async boom'));
  });

  test('reportErrorWidget logs an error-level entry and returns a fallback widget', () {
    final details = FlutterErrorDetails(exception: Exception('widget boom'));
    final widget = reportErrorWidget(notifier, details);

    expect(widget, isA<CaughtErrorFallback>());
    expect(notifier.state.length, 1);
    expect(notifier.state.first.scope, 'ErrorWidget.builder');
  });
}
```

- [ ] **Step 3: Run the tests**

Run: `cd "C:\Users\isc\Desktop\Projects\life-os-mobile" && flutter test test/app/error_reporting_test.dart`
Expected: all three tests pass.

- [ ] **Step 4: Wire the functions into `main.dart`**

Replace the full contents of `lib/main.dart` with:

```dart
import 'dart:ui';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app/app.dart';
import 'app/error_reporting.dart';
import 'app/providers.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  final container = ProviderContainer();
  final debugLogNotifier = container.read(debugLogNotifierProvider.notifier);

  FlutterError.onError = (details) {
    reportFlutterError(debugLogNotifier, details);
    FlutterError.presentError(details);
  };
  PlatformDispatcher.instance.onError = (error, stack) =>
      reportPlatformError(debugLogNotifier, error, stack);
  ErrorWidget.builder = (details) => reportErrorWidget(debugLogNotifier, details);

  runApp(
    UncontrolledProviderScope(
      container: container,
      child: const LifeOsMobileApp(),
    ),
  );
}
```

Two things changed from the current file, beyond wiring in the three handlers: `WidgetsFlutterBinding.ensureInitialized()` is now required because reading `debugLogNotifierProvider.notifier` constructs `AppDatabase()`, which touches platform channels before `runApp` is called (the original file never touched anything platform-specific this early, so it didn't need this). A `ProviderContainer` is created manually instead of relying solely on `ProviderScope`, so the error handlers (registered before `runApp`) and the widget tree share the same container — the app is then launched via `UncontrolledProviderScope` instead of `ProviderScope` to hand that container to the tree.

- [ ] **Step 5: Verify it compiles**

Run: `cd "C:\Users\isc\Desktop\Projects\life-os-mobile" && flutter analyze lib/main.dart lib/app/error_reporting.dart`
Expected: no issues found.

- [ ] **Step 6: Commit**

```bash
git add lib/app/error_reporting.dart test/app/error_reporting_test.dart lib/main.dart
git commit -m "feat: capture Flutter and platform errors into the debug log"
```

---

### Task 13: Debug Log screen, routing, and Settings entry point

**Files:**
- Create: `lib/features/debug/presentation/debug_log_screen.dart`
- Modify: `lib/app/router.dart`
- Modify: `lib/features/settings/presentation/settings_screen.dart`

- [ ] **Step 1: Write the screen**

Create `lib/features/debug/presentation/debug_log_screen.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../data/local/debug_log_notifier.dart';
import '../../../design_system/life_os_theme.dart';
import '../../../design_system/widgets/panel_card.dart';
import '../../../design_system/widgets/screen_frame.dart';

class DebugLogScreen extends ConsumerWidget {
  const DebugLogScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final entries = ref.watch(debugLogNotifierProvider);
    final reversed = entries.reversed.toList();

    return ScreenFrame(
      title: 'Debug Log',
      subtitle: 'Captured errors and diagnostic events, newest first.',
      sectionLabel: 'Diagnostics',
      children: [
        PanelCard(
          title: 'Recent Events',
          trailing: TextButton(
            onPressed: entries.isEmpty
                ? null
                : () => ref.read(debugLogNotifierProvider.notifier).clear(),
            child: const Text('CLEAR'),
          ),
          child: reversed.isEmpty
              ? const Text('No debug events captured yet.')
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    for (final entry in reversed) ...[
                      _DebugLogRow(entry: entry),
                      const SizedBox(height: LifeOsTheme.space2),
                    ],
                  ],
                ),
        ),
      ],
    );
  }
}

class _DebugLogRow extends StatelessWidget {
  const _DebugLogRow({required this.entry});

  final DebugLogEntryData entry;

  Color _levelColor() {
    switch (entry.level) {
      case 'error':
        return LifeOsTheme.danger;
      case 'warn':
        return LifeOsTheme.warning;
      default:
        return LifeOsTheme.accent;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(LifeOsTheme.space3),
      decoration: BoxDecoration(
        border: Border.all(color: LifeOsTheme.border),
        color: LifeOsTheme.surfaceHover,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '${entry.level.toUpperCase()} :: ${entry.scope}',
                style: Theme.of(
                  context,
                ).textTheme.labelMedium?.copyWith(color: _levelColor()),
              ),
              Text(
                entry.createdAt.length >= 19
                    ? entry.createdAt.substring(11, 19)
                    : entry.createdAt,
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ),
          const SizedBox(height: LifeOsTheme.space1),
          Text(entry.message),
          if (entry.detail != null) ...[
            const SizedBox(height: LifeOsTheme.space1),
            Text(entry.detail!, style: Theme.of(context).textTheme.bodySmall),
          ],
        ],
      ),
    );
  }
}
```

- [ ] **Step 2: Add the route**

In `lib/app/router.dart`, add the import:

```dart
import '../features/account/presentation/account_screen.dart';
import '../features/analytics/presentation/analytics_screen.dart';
import '../features/calendar/presentation/calendar_screen.dart';
import '../features/debug/presentation/debug_log_screen.dart';
import '../features/domains/presentation/domain_detail_screen.dart';
```

Then add a new `GoRoute` inside the `/more` route's `routes` list, alongside `settings`/`sync`/`account`:

```dart
              GoRoute(
                path: 'settings',
                builder: (context, state) => const SettingsScreen(),
              ),
              GoRoute(
                path: 'sync',
                builder: (context, state) => const SyncScreen(),
              ),
              GoRoute(
                path: 'account',
                builder: (context, state) => const AccountScreen(),
              ),
              GoRoute(
                path: 'debug-log',
                builder: (context, state) => const DebugLogScreen(),
              ),
```

- [ ] **Step 3: Add the Settings nav entry**

In `lib/features/settings/presentation/settings_screen.dart`, add a `_NavRow` to the "System" `PanelCard` (the first one, currently containing Overview/Weekly Review/Calendar/Analytics):

```dart
                PanelCard(
                  title: 'System',
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _NavRow(
                        title: 'Overview',
                        subtitle: 'Orientation and system drift',
                        onTap: () => context.go('/overview'),
                      ),
                      _NavRow(
                        title: 'Weekly Review',
                        subtitle: 'Reflection and carry-forward',
                        onTap: () => context.go('/more/review'),
                      ),
                      _NavRow(
                        title: 'Calendar',
                        subtitle: 'Monthly task and habit history',
                        onTap: () => context.go('/more/calendar'),
                      ),
                      _NavRow(
                        title: 'Analytics',
                        subtitle: 'Signals and honesty metrics',
                        onTap: () => context.go('/more/analytics'),
                      ),
                      _NavRow(
                        title: 'Debug Log',
                        subtitle: 'Captured errors and diagnostic events',
                        onTap: () => context.go('/more/debug-log'),
                      ),
                    ],
                  ),
                ),
```

- [ ] **Step 4: Verify it compiles**

Run: `cd "C:\Users\isc\Desktop\Projects\life-os-mobile" && flutter analyze`
Expected: no issues found.

- [ ] **Step 5: Commit**

```bash
git add lib/features/debug/presentation/debug_log_screen.dart lib/app/router.dart lib/features/settings/presentation/settings_screen.dart
git commit -m "feat: add Debug Log screen reachable from Settings"
```

---

### Task 14: Mobile final verification

**Files:** none (verification only)

- [ ] **Step 1: Run static analysis**

Run: `cd "C:\Users\isc\Desktop\Projects\life-os-mobile" && flutter analyze`
Expected: "No issues found!"

- [ ] **Step 2: Run the full test suite**

Run: `cd "C:\Users\isc\Desktop\Projects\life-os-mobile" && flutter test`
Expected: all tests pass, including the two new tests in `test/data/local/debug_log_test.dart`, the three new tests in `test/app/error_reporting_test.dart`, and the pre-existing `secure_credentials_test.dart`.

- [ ] **Step 3: Confirm dependencies resolve cleanly**

Run: `cd "C:\Users\isc\Desktop\Projects\life-os-mobile" && flutter pub get`
Expected: completes with no errors (no new dependency was added in this plan — `drift`, `uuid`, and `flutter_riverpod` were already present).
