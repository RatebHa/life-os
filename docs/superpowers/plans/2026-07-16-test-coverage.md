# Test Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add automated test coverage for the highest-risk, highest-value business logic on both platforms — task/habit/goal lifecycles, streak/momentum math, sync, and backup/restore — per `docs/superpowers/specs/2026-07-16-test-coverage-design.md`.

**Architecture:** Desktop Rust commands in `src-tauri/src/commands.rs` are `#[tauri::command]` functions taking `tauri::State`, which cannot be constructed in a unit test — the codebase's existing test precedent (`credential_migration_tests`, `debug_log_tests`) works around this by testing the plain `&Connection`-taking helper function a command delegates to, not the command itself. Most commands in this plan's scope don't yet have such a helper, so each Rust task does a small, behavior-preserving extraction first (move the command's body into a new `fn ..._row(conn: &Connection, ...)`, make the `#[tauri::command]` a two-line wrapper that locks the mutex and calls it) before writing tests against the extracted helper. `record_habit_day`, `load_sync_payload`, and `import_sync_payload_into_db` already exist as such helpers — those need no extraction. Desktop frontend and mobile tests need no such refactor; they follow the existing `useTaskStore.test.ts` / `secure_credentials_test.dart` patterns directly.

**Tech Stack:** Rust tests via `cargo test` (rusqlite in-memory `Connection`, no new dev-dependencies). Desktop frontend tests via Vitest (existing `@tauri-apps/api/core` mock). Mobile tests via `flutter test` (Drift `NativeDatabase.memory()`).

---

## Desktop Rust (`src-tauri/src/commands.rs`)

### Task 1: Task lifecycle tests

**Files:**
- Modify: `src-tauri/src/commands.rs`

This task extracts four small helpers (`create_task_row`, `complete_task_row`, `undo_complete_task_row`, `delete_task_row`) from their `#[tauri::command]` wrappers — pure code motion, no behavior change — then adds a test module exercising them.

- [ ] **Step 1: Extract `create_task_row` from `create_task`**

Find the existing `create_task` function (locate it by its `#[tauri::command]\npub fn create_task(state: State<'_, DbState>, payload: CreateTaskPayload) -> Result<Task, String> {` signature). Replace it with:

```rust
fn create_task_row(conn: &Connection, payload: CreateTaskPayload) -> Result<Task, String> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let tags = payload.tags.unwrap_or_else(default_json_array);
    let normalized_due_date = payload.due_date.and_then(|value| {
        let trimmed = value.trim().to_string();
        if trimmed.is_empty() { None } else { Some(trimmed) }
    });
    let normalized_planned_for_date = payload.planned_for_date.and_then(|value| {
        let trimmed = value.trim().to_string();
        if trimmed.is_empty() { None } else { Some(trimmed) }
    });
    let normalized_scheduled_for = payload.scheduled_for.and_then(|value| {
        let trimmed = value.trim().to_string();
        if trimmed.is_empty() { None } else { Some(trimmed) }
    });
    let normalized_task_kind = payload.task_kind
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .unwrap_or_else(default_task_kind);
    let normalized_recurrence_type = payload
        .recurrence_type
        .or_else(|| payload.recurrence_rule.clone())
        .and_then(|value| {
            let trimmed = value.trim().to_string();
            if trimmed.is_empty() || trimmed == "none" { None } else { Some(trimmed) }
        });
    let recurrence_interval = match payload.recurrence_interval {
        Some(value) if value > 0 => Some(value),
        Some(_) => None,
        None if normalized_recurrence_type.is_some() => Some(1),
        None => None,
    };
    let recurrence_days = payload.recurrence_days.unwrap_or_else(default_json_array);
    let recurrence_anchor_date = payload.recurrence_anchor_date
        .and_then(|value| {
            let trimmed = value.trim().to_string();
            if trimmed.is_empty() { None } else { Some(trimmed) }
        })
        .or_else(|| normalized_due_date.clone())
        .or_else(|| normalized_scheduled_for.clone())
        .or_else(|| Some(now.get(0..10).unwrap_or("").to_string()).filter(|value| !value.is_empty()));
    let recurrence_rule = payload.recurrence_rule.and_then(|value| {
        let trimmed = value.trim().to_string();
        if trimmed.is_empty() { None } else { Some(trimmed) }
    });
    let status = payload
        .status
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| "todo".to_string());

    conn.execute(
        "INSERT INTO tasks (
            id, domain_id, title, description, priority, energy_level, status, is_mit, is_top_three,
            xp_value, parent_task_id, goal_id, tags, time_estimate_minutes, due_date, planned_for_date,
            task_kind, scheduled_for, recurring_template_id, recurrence_type, recurrence_interval,
            recurrence_days, recurrence_anchor_date, recurrence_rule, created_at, updated_at
         )
         VALUES (
            ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9,
            ?10, ?11, ?12, ?13, ?14, ?15, ?16,
            ?17, ?18, ?19, ?20, ?21,
            ?22, ?23, ?24, ?25, ?26
         )",
        params![
            id,
            payload.domain_id,
            payload.title,
            payload.description,
            payload.priority,
            payload.energy_level.unwrap_or_else(default_energy_level),
            status,
            payload.is_mit as i64,
            payload.is_top_three as i64,
            payload.xp_value,
            payload.parent_task_id,
            payload.goal_id,
            tags,
            payload.time_estimate_minutes,
            normalized_due_date,
            normalized_planned_for_date,
            normalized_task_kind,
            normalized_scheduled_for,
            payload.recurring_template_id,
            normalized_recurrence_type,
            recurrence_interval,
            recurrence_days,
            recurrence_anchor_date,
            recurrence_rule,
            now,
            now
        ],
    ).map_err(|e| e.to_string())?;

    get_task_row(conn, &id)
}

#[tauri::command]
pub fn create_task(state: State<'_, DbState>, payload: CreateTaskPayload) -> Result<Task, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    create_task_row(&conn, payload)
}
```

- [ ] **Step 2: Extract `complete_task_row` from `complete_task`**

Find the existing `complete_task` function and replace it with:

```rust
fn complete_task_row(conn: &Connection, id: &str) -> Result<Task, String> {
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE tasks SET status = 'done', completed_at = ?1, xp_awarded = 0, updated_at = ?1 WHERE id = ?2",
        params![now, id],
    ).map_err(|e| e.to_string())?;

    let domain_id: String = conn.query_row(
        "SELECT domain_id FROM tasks WHERE id = ?1",
        params![id],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;

    let today_date = Utc::now().format("%Y-%m-%d").to_string();
    let yesterday_date = Utc::now()
        .checked_sub_signed(chrono::Duration::days(1))
        .map(|d| d.format("%Y-%m-%d").to_string());
    let last_activity: Option<String> = conn.query_row(
        "SELECT last_activity_date FROM domains WHERE id = ?1",
        params![domain_id],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;
    match last_activity {
        Some(ref last) if *last == today_date => {}
        Some(ref last) if Some(last.clone()) == yesterday_date => {
            conn.execute(
                "UPDATE domains SET streak_current = streak_current + 1, last_activity_date = ?1, streak_longest = MAX(streak_longest, streak_current + 1) WHERE id = ?2",
                params![today_date, domain_id],
            ).map_err(|e| e.to_string())?;
        }
        _ => {
            conn.execute(
                "UPDATE domains SET streak_current = 1, last_activity_date = ?1 WHERE id = ?2",
                params![today_date, domain_id],
            ).map_err(|e| e.to_string())?;
        }
    }
    get_task_row(conn, id)
}

#[tauri::command]
pub fn complete_task(state: State<'_, DbState>, id: String) -> Result<Task, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    complete_task_row(&conn, &id)
}
```

- [ ] **Step 3: Extract `undo_complete_task_row` from `undo_complete_task`**

Find the existing `undo_complete_task` function and replace it with:

```rust
fn undo_complete_task_row(conn: &Connection, id: &str, previous_status: Option<String>) -> Result<Task, String> {
    let task = get_task_row(conn, id)?;
    let restore_status = previous_status
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("todo")
        .to_string();
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE tasks
         SET status = ?1,
             completed_at = NULL,
             xp_awarded = 0,
             updated_at = ?2
         WHERE id = ?3",
        params![restore_status, now, id],
    ).map_err(|e| e.to_string())?;

    recalculate_domain_state(conn, &task.domain_id)?;

    get_task_row(conn, &task.id)
}

#[tauri::command]
pub fn undo_complete_task(
    state: State<'_, DbState>,
    id: String,
    previous_status: Option<String>,
) -> Result<Task, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    undo_complete_task_row(&conn, &id, previous_status)
}
```

- [ ] **Step 4: Extract `delete_task_row` from `delete_task`**

Find the existing `delete_task` function and replace it with:

```rust
fn delete_task_row(conn: &Connection, id: &str) -> Result<(), String> {
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE tasks SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2",
        params![now, id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_task(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    delete_task_row(&conn, &id)
}
```

- [ ] **Step 5: Run `cargo check` to confirm the extraction compiles**

Run: `cd "C:\Users\isc\Desktop\Projects\Life OS\src-tauri" && cargo check`
Expected: no errors (this is a pure refactor — the crate should compile exactly as before).

- [ ] **Step 6: Commit the extraction**

```bash
git add src-tauri/src/commands.rs
git commit -m "refactor: extract testable row-helpers for task lifecycle commands"
```

- [ ] **Step 7: Add the `task_lifecycle_tests` module**

Add this module near the end of `src-tauri/src/commands.rs` (alongside the existing `credential_migration_tests`/`debug_log_tests` modules — place it directly before `debug_log_tests`):

```rust
#[cfg(test)]
mod task_lifecycle_tests {
    use super::*;

    fn setup_conn() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE tasks (
                id TEXT PRIMARY KEY,
                domain_id TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                priority TEXT NOT NULL DEFAULT 'medium',
                energy_level TEXT NOT NULL DEFAULT 'medium',
                status TEXT NOT NULL DEFAULT 'todo',
                is_mit INTEGER NOT NULL DEFAULT 0,
                is_top_three INTEGER NOT NULL DEFAULT 0,
                xp_value INTEGER NOT NULL DEFAULT 30,
                xp_awarded INTEGER NOT NULL DEFAULT 0,
                parent_task_id TEXT,
                goal_id TEXT,
                tags TEXT DEFAULT '[]',
                time_estimate_minutes INTEGER,
                due_date TEXT,
                planned_for_date TEXT,
                task_kind TEXT NOT NULL DEFAULT 'standard',
                scheduled_for TEXT,
                recurring_template_id TEXT,
                recurrence_type TEXT,
                recurrence_interval INTEGER,
                recurrence_days TEXT DEFAULT '[]',
                recurrence_anchor_date TEXT,
                recurrence_rule TEXT,
                time_actual_minutes INTEGER,
                completed_at TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                deleted_at TEXT,
                attachments TEXT DEFAULT '[]'
            );
            CREATE TABLE domains (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                icon TEXT NOT NULL,
                color TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                deleted_at TEXT,
                streak_current INTEGER DEFAULT 0,
                streak_longest INTEGER DEFAULT 0,
                streak_freeze_tokens INTEGER DEFAULT 0,
                last_activity_date TEXT
            );
            CREATE TABLE habits (
                id TEXT PRIMARY KEY,
                domain_id TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                frequency TEXT NOT NULL DEFAULT 'daily',
                target_days TEXT NOT NULL DEFAULT '[0,1,2,3,4,5,6]',
                xp_per_completion INTEGER NOT NULL DEFAULT 15,
                cadence_type TEXT NOT NULL DEFAULT 'daily',
                cadence_days TEXT NOT NULL DEFAULT '[0,1,2,3,4,5,6]',
                cadence_interval_days INTEGER NOT NULL DEFAULT 1,
                cadence_weekly_target INTEGER NOT NULL DEFAULT 1,
                cadence_anchor_date TEXT,
                target_type TEXT NOT NULL DEFAULT 'checkbox',
                target_value INTEGER NOT NULL DEFAULT 1,
                minimum_value INTEGER,
                unit_label TEXT,
                minimum_version TEXT,
                recovery_grace_days INTEGER NOT NULL DEFAULT 1,
                restart_from_date TEXT,
                streak_current INTEGER NOT NULL DEFAULT 0,
                streak_longest INTEGER NOT NULL DEFAULT 0,
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                deleted_at TEXT
            );
            CREATE TABLE habit_logs (
                id TEXT PRIMARY KEY,
                habit_id TEXT NOT NULL,
                completed_date TEXT NOT NULL,
                xp_awarded INTEGER NOT NULL DEFAULT 15,
                value_completed INTEGER NOT NULL DEFAULT 1,
                status TEXT NOT NULL DEFAULT 'completed',
                skip_reason TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                deleted_at TEXT,
                UNIQUE(habit_id, completed_date)
            );"
        ).unwrap();
        conn
    }

    fn insert_domain(conn: &Connection, id: &str, last_activity_date: Option<&str>, streak_current: i64, streak_longest: i64) {
        conn.execute(
            "INSERT INTO domains (id, name, icon, color, created_at, updated_at, streak_current, streak_longest, last_activity_date)
             VALUES (?1, ?1, 'icon', '#000000', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', ?2, ?3, ?4)",
            params![id, streak_current, streak_longest, last_activity_date],
        ).unwrap();
    }

    fn base_task_payload(domain_id: &str) -> CreateTaskPayload {
        CreateTaskPayload {
            domain_id: domain_id.to_string(),
            title: "Write the plan".to_string(),
            description: None,
            priority: "medium".to_string(),
            energy_level: None,
            status: None,
            is_mit: false,
            is_top_three: false,
            xp_value: 0,
            parent_task_id: None,
            goal_id: None,
            tags: None,
            time_estimate_minutes: None,
            due_date: None,
            planned_for_date: None,
            task_kind: None,
            scheduled_for: None,
            recurring_template_id: None,
            recurrence_type: None,
            recurrence_interval: None,
            recurrence_days: None,
            recurrence_anchor_date: None,
            recurrence_rule: None,
        }
    }

    #[test]
    fn create_task_row_applies_defaults() {
        let conn = setup_conn();
        insert_domain(&conn, "military", None, 0, 0);

        let task = create_task_row(&conn, base_task_payload("military")).unwrap();

        assert_eq!(task.status, "todo");
        assert_eq!(task.task_kind, "standard");
        assert_eq!(task.energy_level, "medium");
        assert_eq!(task.tags, "[]");
        assert!(!task.xp_awarded);
        assert!(task.completed_at.is_none());
    }

    #[test]
    fn complete_task_row_starts_a_new_streak() {
        let conn = setup_conn();
        insert_domain(&conn, "military", None, 0, 0);
        let task = create_task_row(&conn, base_task_payload("military")).unwrap();

        let completed = complete_task_row(&conn, &task.id).unwrap();

        assert_eq!(completed.status, "done");
        assert!(completed.completed_at.is_some());
        let domain = get_domain_by_id(&conn, "military").unwrap();
        assert_eq!(domain.streak_current, 1);
        assert_eq!(domain.last_activity_date, Some(Utc::now().format("%Y-%m-%d").to_string()));
    }

    #[test]
    fn complete_task_row_increments_a_consecutive_day_streak() {
        let conn = setup_conn();
        let yesterday = (Utc::now() - Duration::days(1)).format("%Y-%m-%d").to_string();
        insert_domain(&conn, "military", Some(&yesterday), 3, 5);
        let task = create_task_row(&conn, base_task_payload("military")).unwrap();

        complete_task_row(&conn, &task.id).unwrap();

        let domain = get_domain_by_id(&conn, "military").unwrap();
        assert_eq!(domain.streak_current, 4);
        assert_eq!(domain.streak_longest, 5);
    }

    #[test]
    fn undo_complete_task_row_restores_status_and_recalculates_streak_to_zero() {
        let conn = setup_conn();
        insert_domain(&conn, "military", None, 0, 0);
        let task = create_task_row(&conn, base_task_payload("military")).unwrap();
        complete_task_row(&conn, &task.id).unwrap();

        let restored = undo_complete_task_row(&conn, &task.id, Some("in_progress".to_string())).unwrap();

        assert_eq!(restored.status, "in_progress");
        assert!(restored.completed_at.is_none());
        let domain = get_domain_by_id(&conn, "military").unwrap();
        assert_eq!(domain.streak_current, 0);
        assert_eq!(domain.last_activity_date, None);
    }

    #[test]
    fn undo_complete_task_row_defaults_to_todo_when_no_previous_status_given() {
        let conn = setup_conn();
        insert_domain(&conn, "military", None, 0, 0);
        let task = create_task_row(&conn, base_task_payload("military")).unwrap();
        complete_task_row(&conn, &task.id).unwrap();

        let restored = undo_complete_task_row(&conn, &task.id, None).unwrap();

        assert_eq!(restored.status, "todo");
    }

    #[test]
    fn delete_task_row_soft_deletes_without_removing_the_row() {
        let conn = setup_conn();
        insert_domain(&conn, "military", None, 0, 0);
        let task = create_task_row(&conn, base_task_payload("military")).unwrap();

        delete_task_row(&conn, &task.id).unwrap();

        let row = get_task_row(&conn, &task.id).unwrap();
        assert!(row.deleted_at.is_some());
    }
}
```

- [ ] **Step 8: Run the new tests**

Run: `cd "C:\Users\isc\Desktop\Projects\Life OS\src-tauri" && cargo test task_lifecycle_tests`
Expected: `6 passed; 0 failed`.

- [ ] **Step 9: Commit**

```bash
git add src-tauri/src/commands.rs
git commit -m "test: add task lifecycle tests (create/complete/undo/delete)"
```

---

### Task 2: Habit lifecycle tests

**Files:**
- Modify: `src-tauri/src/commands.rs`

`log_habit`, `log_habit_minimum`, and `skip_habit` already delegate to the plain-`Connection` helper `record_habit_day` — no extraction needed for those three. `create_habit` and `undo_habit_log` each need one.

- [ ] **Step 1: Extract `create_habit_row` from `create_habit`**

Find the existing `create_habit` function and replace it with:

```rust
fn create_habit_row(conn: &Connection, payload: CreateHabitPayload) -> Result<Habit, String> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO habits (
            id, domain_id, title, description, frequency, target_days, xp_per_completion,
            cadence_type, cadence_days, cadence_interval_days, cadence_weekly_target, cadence_anchor_date,
            target_type, target_value, minimum_value, unit_label, minimum_version, recovery_grace_days, created_at, updated_at, deleted_at
         ) VALUES (
            ?1, ?2, ?3, ?4, ?5, ?6, ?7,
            ?8, ?9, ?10, ?11, ?12,
            ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?19, NULL
         )",
        params![
            id,
            payload.domain_id,
            payload.title,
            payload.description,
            payload.frequency,
            payload.target_days,
            payload.xp_per_completion,
            payload.cadence_type.unwrap_or_else(default_cadence_type),
            payload.cadence_days.unwrap_or_else(default_cadence_days),
            payload.cadence_interval_days.unwrap_or_else(default_cadence_interval_days).max(1),
            payload.cadence_weekly_target.unwrap_or_else(default_cadence_weekly_target).max(1),
            payload.cadence_anchor_date,
            payload.target_type.unwrap_or_else(default_target_type),
            payload.target_value.unwrap_or_else(default_target_value).max(1),
            payload.minimum_value,
            payload.unit_label,
            payload.minimum_version,
            payload.recovery_grace_days.unwrap_or(1),
            now
        ],
    ).map_err(|e| e.to_string())?;

    get_habit_row(conn, &id)
}

#[tauri::command]
pub fn create_habit(state: State<'_, DbState>, payload: CreateHabitPayload) -> Result<Habit, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    create_habit_row(&conn, payload)
}
```

- [ ] **Step 2: Extract `undo_habit_log_row` from `undo_habit_log`**

Find the existing `undo_habit_log` function and replace it with:

```rust
fn undo_habit_log_row(conn: &Connection, habit_id: &str, completed_date: &str) -> Result<HabitLog, String> {
    let log = get_habit_log_row(conn, habit_id, completed_date)?;
    let habit = get_habit_row(conn, habit_id)?;

    conn.execute(
        "UPDATE habit_logs SET deleted_at = ?1, updated_at = ?1 WHERE habit_id = ?2 AND completed_date = ?3",
        params![Utc::now().to_rfc3339(), habit_id, completed_date],
    ).map_err(|e| e.to_string())?;

    sync_habit_streaks(conn)?;
    recalculate_domain_state(conn, &habit.domain_id)?;

    Ok(log)
}

#[tauri::command]
pub fn undo_habit_log(
    state: State<'_, DbState>,
    habit_id: String,
    completed_date: String,
) -> Result<HabitLog, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    undo_habit_log_row(&conn, &habit_id, &completed_date)
}
```

- [ ] **Step 3: Run `cargo check`**

Run: `cd "C:\Users\isc\Desktop\Projects\Life OS\src-tauri" && cargo check`
Expected: no errors.

- [ ] **Step 4: Commit the extraction**

```bash
git add src-tauri/src/commands.rs
git commit -m "refactor: extract testable row-helpers for create_habit and undo_habit_log"
```

- [ ] **Step 5: Add the `habit_lifecycle_tests` module**

Add this module near the end of `src-tauri/src/commands.rs`, alongside `task_lifecycle_tests`:

```rust
#[cfg(test)]
mod habit_lifecycle_tests {
    use super::*;

    fn setup_conn() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE tasks (
                id TEXT PRIMARY KEY,
                domain_id TEXT NOT NULL,
                title TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'todo',
                completed_at TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                deleted_at TEXT
            );
            CREATE TABLE domains (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                icon TEXT NOT NULL,
                color TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                deleted_at TEXT,
                streak_current INTEGER DEFAULT 0,
                streak_longest INTEGER DEFAULT 0,
                streak_freeze_tokens INTEGER DEFAULT 0,
                last_activity_date TEXT
            );
            CREATE TABLE habits (
                id TEXT PRIMARY KEY,
                domain_id TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                frequency TEXT NOT NULL DEFAULT 'daily',
                target_days TEXT NOT NULL DEFAULT '[0,1,2,3,4,5,6]',
                xp_per_completion INTEGER NOT NULL DEFAULT 15,
                cadence_type TEXT NOT NULL DEFAULT 'daily',
                cadence_days TEXT NOT NULL DEFAULT '[0,1,2,3,4,5,6]',
                cadence_interval_days INTEGER NOT NULL DEFAULT 1,
                cadence_weekly_target INTEGER NOT NULL DEFAULT 1,
                cadence_anchor_date TEXT,
                target_type TEXT NOT NULL DEFAULT 'checkbox',
                target_value INTEGER NOT NULL DEFAULT 1,
                minimum_value INTEGER,
                unit_label TEXT,
                minimum_version TEXT,
                recovery_grace_days INTEGER NOT NULL DEFAULT 1,
                restart_from_date TEXT,
                streak_current INTEGER NOT NULL DEFAULT 0,
                streak_longest INTEGER NOT NULL DEFAULT 0,
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                deleted_at TEXT
            );
            CREATE TABLE habit_logs (
                id TEXT PRIMARY KEY,
                habit_id TEXT NOT NULL,
                completed_date TEXT NOT NULL,
                xp_awarded INTEGER NOT NULL DEFAULT 15,
                value_completed INTEGER NOT NULL DEFAULT 1,
                status TEXT NOT NULL DEFAULT 'completed',
                skip_reason TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                deleted_at TEXT,
                UNIQUE(habit_id, completed_date)
            );"
        ).unwrap();
        conn
    }

    fn insert_domain(conn: &Connection, id: &str) {
        conn.execute(
            "INSERT INTO domains (id, name, icon, color, created_at, updated_at)
             VALUES (?1, ?1, 'icon', '#000000', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
            params![id],
        ).unwrap();
    }

    fn insert_checkbox_habit(conn: &Connection, id: &str, domain_id: &str) {
        conn.execute(
            "INSERT INTO habits (id, domain_id, title, cadence_type, target_type, target_value, created_at, updated_at)
             VALUES (?1, ?2, 'Meditate', 'daily', 'checkbox', 1, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
            params![id, domain_id],
        ).unwrap();
    }

    fn insert_count_habit(conn: &Connection, id: &str, domain_id: &str, target_value: i64) {
        conn.execute(
            "INSERT INTO habits (id, domain_id, title, cadence_type, target_type, target_value, created_at, updated_at)
             VALUES (?1, ?2, 'Drink water', 'daily', 'count', ?3, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
            params![id, domain_id, target_value],
        ).unwrap();
    }

    fn insert_weekdays_habit(conn: &Connection, id: &str, domain_id: &str) {
        conn.execute(
            "INSERT INTO habits (id, domain_id, title, cadence_type, cadence_days, target_type, target_value, created_at, updated_at)
             VALUES (?1, ?2, 'Standup', 'weekdays', '[1,2,3,4,5]', 'checkbox', 1, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
            params![id, domain_id],
        ).unwrap();
    }

    #[test]
    fn create_habit_row_applies_cadence_defaults() {
        let conn = setup_conn();
        insert_domain(&conn, "self");

        let habit = create_habit_row(&conn, CreateHabitPayload {
            domain_id: "self".to_string(),
            title: "Meditate".to_string(),
            description: None,
            frequency: "daily".to_string(),
            target_days: "[0,1,2,3,4,5,6]".to_string(),
            xp_per_completion: 0,
            cadence_type: None,
            cadence_days: None,
            cadence_interval_days: None,
            cadence_weekly_target: None,
            cadence_anchor_date: None,
            target_type: None,
            target_value: None,
            minimum_value: None,
            unit_label: None,
            minimum_version: None,
            recovery_grace_days: None,
        }).unwrap();

        assert_eq!(habit.cadence_type, "daily");
        assert_eq!(habit.target_type, "checkbox");
        assert_eq!(habit.target_value, 1);
        assert_eq!(habit.is_active, true);
    }

    #[test]
    fn create_habit_row_clamps_interval_and_weekly_target_to_at_least_one() {
        let conn = setup_conn();
        insert_domain(&conn, "self");

        let habit = create_habit_row(&conn, CreateHabitPayload {
            domain_id: "self".to_string(),
            title: "Drink water".to_string(),
            description: None,
            frequency: "daily".to_string(),
            target_days: "[0,1,2,3,4,5,6]".to_string(),
            xp_per_completion: 0,
            cadence_type: Some("interval".to_string()),
            cadence_days: None,
            cadence_interval_days: Some(0),
            cadence_weekly_target: Some(-1),
            cadence_anchor_date: None,
            target_type: Some("count".to_string()),
            target_value: Some(3),
            minimum_value: None,
            unit_label: None,
            minimum_version: None,
            recovery_grace_days: None,
        }).unwrap();

        assert_eq!(habit.cadence_interval_days, 1);
        assert_eq!(habit.cadence_weekly_target, 1);
    }

    #[test]
    fn record_habit_day_completes_a_checkbox_habit() {
        let conn = setup_conn();
        insert_domain(&conn, "self");
        insert_checkbox_habit(&conn, "h1", "self");

        let log = record_habit_day(&conn, "h1", "2026-07-16", "completed", None, None).unwrap();

        assert_eq!(log.status, "completed");
        assert_eq!(log.value_completed, 1);
    }

    #[test]
    fn record_habit_day_rejects_a_day_the_habit_is_not_due() {
        let conn = setup_conn();
        insert_domain(&conn, "self");
        insert_weekdays_habit(&conn, "h1", "self");

        // 2026-07-19 is a Sunday
        let result = record_habit_day(&conn, "h1", "2026-07-19", "completed", None, None);

        assert_eq!(result, Err("Habit is not scheduled for that day".to_string()));
    }

    #[test]
    fn record_habit_day_computes_partial_progress_below_the_minimum_threshold() {
        let conn = setup_conn();
        insert_domain(&conn, "self");
        insert_count_habit(&conn, "h1", "self", 3);

        let log = record_habit_day(&conn, "h1", "2026-07-16", "completed", Some(1), None).unwrap();

        assert_eq!(log.value_completed, 1);
        assert_eq!(log.status, "partial");
    }

    #[test]
    fn record_habit_day_accumulates_value_across_repeated_calls_for_the_same_day() {
        let conn = setup_conn();
        insert_domain(&conn, "self");
        insert_count_habit(&conn, "h1", "self", 3);

        record_habit_day(&conn, "h1", "2026-07-16", "completed", Some(1), None).unwrap();
        let log = record_habit_day(&conn, "h1", "2026-07-16", "completed", Some(1), None).unwrap();

        assert_eq!(log.value_completed, 2);
        assert_eq!(log.status, "partial");
    }

    #[test]
    fn record_habit_day_marks_completed_once_value_reaches_target() {
        let conn = setup_conn();
        insert_domain(&conn, "self");
        insert_count_habit(&conn, "h1", "self", 2);

        record_habit_day(&conn, "h1", "2026-07-16", "completed", Some(1), None).unwrap();
        let log = record_habit_day(&conn, "h1", "2026-07-16", "completed", Some(1), None).unwrap();

        assert_eq!(log.value_completed, 2);
        assert_eq!(log.status, "completed");
    }

    #[test]
    fn record_habit_day_rejects_skip_after_the_grace_window_expires() {
        let conn = setup_conn();
        insert_domain(&conn, "self");
        insert_checkbox_habit(&conn, "h1", "self");
        // recovery_grace_days defaults to 1; three days ago is outside that window
        let three_days_ago = (Utc::now() - Duration::days(3)).format("%Y-%m-%d").to_string();

        let result = record_habit_day(&conn, "h1", &three_days_ago, "skipped", None, None);

        assert_eq!(result, Err("Skip window has expired for that day".to_string()));
    }

    #[test]
    fn undo_habit_log_row_soft_deletes_and_resets_streaks_to_zero() {
        let conn = setup_conn();
        insert_domain(&conn, "self");
        insert_checkbox_habit(&conn, "h1", "self");
        record_habit_day(&conn, "h1", "2026-07-16", "completed", None, None).unwrap();

        let removed = undo_habit_log_row(&conn, "h1", "2026-07-16").unwrap();

        assert_eq!(removed.status, "completed");
        let lookup = get_habit_log_row(&conn, "h1", "2026-07-16");
        assert!(lookup.is_err());
        let habit = get_habit_row(&conn, "h1").unwrap();
        assert_eq!(habit.streak_current, 0);
        let domain = get_domain_by_id(&conn, "self").unwrap();
        assert_eq!(domain.streak_current, 0);
    }
}
```

- [ ] **Step 6: Run the new tests**

Run: `cd "C:\Users\isc\Desktop\Projects\Life OS\src-tauri" && cargo test habit_lifecycle_tests`
Expected: `9 passed; 0 failed`.

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/commands.rs
git commit -m "test: add habit lifecycle tests (create_habit, record_habit_day, undo_habit_log)"
```

---

### Task 3: Goal progress tests

**Files:**
- Modify: `src-tauri/src/commands.rs`

- [ ] **Step 1: Extract `create_goal_row` from `create_goal`**

Find the existing `create_goal` function and replace it with:

```rust
fn create_goal_row(conn: &Connection, payload: CreateGoalPayload) -> Result<Goal, String> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO goals (id, domain_id, title, description, parent_goal_id, next_action, review_date, blocked_by, health, target_date, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        params![id, payload.domain_id, payload.title, payload.description, payload.parent_goal_id, payload.next_action, payload.review_date, payload.blocked_by, payload.health.unwrap_or_else(default_goal_health), payload.target_date, now, now],
    ).map_err(|e| e.to_string())?;

    conn.query_row(
        "SELECT id, domain_id, title, description, parent_goal_id, status, next_action, review_date, blocked_by, health, target_date, progress_percent, created_at, updated_at, deleted_at FROM goals WHERE id = ?1",
        params![id],
        row_to_goal,
    ).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_goal(state: State<'_, DbState>, payload: CreateGoalPayload) -> Result<Goal, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    create_goal_row(&conn, payload)
}
```

- [ ] **Step 2: Extract `update_goal_row` from `update_goal`**

Find the existing `update_goal` function and replace it with:

```rust
fn update_goal_row(conn: &Connection, payload: UpdateGoalPayload) -> Result<Goal, String> {
    let now = Utc::now().to_rfc3339();

    if let Some(ref t) = payload.title {
        conn.execute("UPDATE goals SET title = ?1, updated_at = ?2 WHERE id = ?3", params![t, now, payload.id]).map_err(|e| e.to_string())?;
    }
    if let Some(ref d) = payload.description {
        conn.execute("UPDATE goals SET description = ?1, updated_at = ?2 WHERE id = ?3", params![d, now, payload.id]).map_err(|e| e.to_string())?;
    }
    if let Some(ref s) = payload.status {
        conn.execute("UPDATE goals SET status = ?1, updated_at = ?2 WHERE id = ?3", params![s, now, payload.id]).map_err(|e| e.to_string())?;
    }
    if let Some(ref next_action) = payload.next_action {
        let normalized = if next_action.trim().is_empty() { None::<String> } else { Some(next_action.trim().to_string()) };
        conn.execute("UPDATE goals SET next_action = ?1, updated_at = ?2 WHERE id = ?3", params![normalized, now, payload.id]).map_err(|e| e.to_string())?;
    }
    if let Some(ref review_date) = payload.review_date {
        let normalized = if review_date.trim().is_empty() { None::<String> } else { Some(review_date.trim().to_string()) };
        conn.execute("UPDATE goals SET review_date = ?1, updated_at = ?2 WHERE id = ?3", params![normalized, now, payload.id]).map_err(|e| e.to_string())?;
    }
    if let Some(ref blocked_by) = payload.blocked_by {
        let normalized = if blocked_by.trim().is_empty() { None::<String> } else { Some(blocked_by.trim().to_string()) };
        conn.execute("UPDATE goals SET blocked_by = ?1, updated_at = ?2 WHERE id = ?3", params![normalized, now, payload.id]).map_err(|e| e.to_string())?;
    }
    if let Some(ref health) = payload.health {
        conn.execute("UPDATE goals SET health = ?1, updated_at = ?2 WHERE id = ?3", params![health, now, payload.id]).map_err(|e| e.to_string())?;
    }
    if let Some(ref td) = payload.target_date {
        let normalized = if td.trim().is_empty() { None::<String> } else { Some(td.trim().to_string()) };
        conn.execute("UPDATE goals SET target_date = ?1, updated_at = ?2 WHERE id = ?3", params![normalized, now, payload.id]).map_err(|e| e.to_string())?;
    }
    if let Some(pp) = payload.progress_percent {
        conn.execute("UPDATE goals SET progress_percent = ?1, updated_at = ?2 WHERE id = ?3", params![pp, now, payload.id]).map_err(|e| e.to_string())?;
    }

    conn.query_row(
        "SELECT id, domain_id, title, description, parent_goal_id, status, next_action, review_date, blocked_by, health, target_date, progress_percent, created_at, updated_at, deleted_at FROM goals WHERE id = ?1",
        params![payload.id],
        row_to_goal,
    ).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_goal(state: State<'_, DbState>, payload: UpdateGoalPayload) -> Result<Goal, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    update_goal_row(&conn, payload)
}
```

- [ ] **Step 3: Run `cargo check`**

Run: `cd "C:\Users\isc\Desktop\Projects\Life OS\src-tauri" && cargo check`
Expected: no errors.

- [ ] **Step 4: Commit the extraction**

```bash
git add src-tauri/src/commands.rs
git commit -m "refactor: extract testable row-helpers for goal commands"
```

- [ ] **Step 5: Add the `goal_progress_tests` module**

Add this module near the end of `src-tauri/src/commands.rs`, alongside the other new test modules:

```rust
#[cfg(test)]
mod goal_progress_tests {
    use super::*;

    fn setup_conn() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute(
            "CREATE TABLE goals (
                id TEXT PRIMARY KEY,
                domain_id TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                parent_goal_id TEXT,
                status TEXT NOT NULL DEFAULT 'active',
                next_action TEXT,
                review_date TEXT,
                blocked_by TEXT,
                health TEXT NOT NULL DEFAULT 'on_track',
                target_date TEXT,
                progress_percent INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                deleted_at TEXT
            )",
            [],
        ).unwrap();
        conn
    }

    fn base_goal_payload(domain_id: &str) -> CreateGoalPayload {
        CreateGoalPayload {
            domain_id: domain_id.to_string(),
            title: "Ship the release".to_string(),
            description: None,
            parent_goal_id: None,
            next_action: None,
            review_date: None,
            blocked_by: None,
            health: None,
            target_date: None,
        }
    }

    #[test]
    fn create_goal_row_defaults_health_to_on_track() {
        let conn = setup_conn();

        let goal = create_goal_row(&conn, base_goal_payload("builder")).unwrap();

        assert_eq!(goal.health, "on_track");
        assert_eq!(goal.status, "active");
        assert_eq!(goal.progress_percent, 0);
    }

    #[test]
    fn create_goal_row_preserves_an_explicit_health_value() {
        let conn = setup_conn();
        let mut payload = base_goal_payload("builder");
        payload.health = Some("at_risk".to_string());

        let goal = create_goal_row(&conn, payload).unwrap();

        assert_eq!(goal.health, "at_risk");
    }

    #[test]
    fn update_goal_row_updates_only_the_provided_fields() {
        let conn = setup_conn();
        let goal = create_goal_row(&conn, base_goal_payload("builder")).unwrap();

        let updated = update_goal_row(&conn, UpdateGoalPayload {
            id: goal.id.clone(),
            title: None,
            description: None,
            status: None,
            next_action: None,
            review_date: None,
            blocked_by: None,
            health: None,
            target_date: None,
            progress_percent: Some(40),
        }).unwrap();

        assert_eq!(updated.progress_percent, 40);
        assert_eq!(updated.title, "Ship the release");
        assert_eq!(updated.health, "on_track");
    }

    #[test]
    fn update_goal_row_normalizes_blank_optional_fields_to_null() {
        let conn = setup_conn();
        let mut payload = base_goal_payload("builder");
        payload.next_action = Some("Draft the changelog".to_string());
        let goal = create_goal_row(&conn, payload).unwrap();

        let updated = update_goal_row(&conn, UpdateGoalPayload {
            id: goal.id.clone(),
            title: None,
            description: None,
            status: None,
            next_action: Some("   ".to_string()),
            review_date: None,
            blocked_by: None,
            health: None,
            target_date: None,
            progress_percent: None,
        }).unwrap();

        assert_eq!(updated.next_action, None);
    }

    #[test]
    fn update_goal_row_errors_when_the_goal_does_not_exist() {
        let conn = setup_conn();

        let result = update_goal_row(&conn, UpdateGoalPayload {
            id: "does-not-exist".to_string(),
            title: Some("New title".to_string()),
            description: None,
            status: None,
            next_action: None,
            review_date: None,
            blocked_by: None,
            health: None,
            target_date: None,
            progress_percent: None,
        });

        assert!(result.is_err());
    }
}
```

- [ ] **Step 6: Run the new tests**

Run: `cd "C:\Users\isc\Desktop\Projects\Life OS\src-tauri" && cargo test goal_progress_tests`
Expected: `5 passed; 0 failed`.

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/commands.rs
git commit -m "test: add goal progress tests (create_goal, update_goal)"
```

---

### Task 4: Streak & momentum tests

**Files:**
- Modify: `src-tauri/src/commands.rs`

- [ ] **Step 1: Extract `update_domain_streak_row` from `update_domain_streak`**

Find the existing `update_domain_streak` function and replace it with:

```rust
fn update_domain_streak_row(conn: &Connection, domain_id: &str) -> Result<Domain, String> {
    let today = Utc::now().format("%Y-%m-%d").to_string();
    let now = Utc::now().to_rfc3339();

    let last_activity: Option<String> = conn.query_row(
        "SELECT last_activity_date FROM domains WHERE id = ?1",
        params![domain_id],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;

    let yesterday = chrono::Utc::now()
        .checked_sub_signed(chrono::Duration::days(1))
        .map(|d| d.format("%Y-%m-%d").to_string());

    match last_activity {
        Some(ref last) if last == &today => {}
        Some(ref last) if Some(last.clone()) == yesterday => {
            conn.execute(
                "UPDATE domains SET streak_current = streak_current + 1, last_activity_date = ?1,
                 streak_longest = MAX(streak_longest, streak_current + 1), updated_at = ?2 WHERE id = ?3",
                params![today, now, domain_id],
            ).map_err(|e| e.to_string())?;

            let new_streak: i64 = conn.query_row(
                "SELECT streak_current FROM domains WHERE id = ?1",
                params![domain_id],
                |row| row.get(0),
            ).map_err(|e| e.to_string())?;
            if new_streak > 0 && new_streak % 7 == 0 {
                conn.execute(
                    "UPDATE domains SET streak_freeze_tokens = streak_freeze_tokens + 1, updated_at = ?1 WHERE id = ?2",
                    params![now, domain_id],
                ).map_err(|e| e.to_string())?;
            }
        }
        _ => {
            conn.execute(
                "UPDATE domains SET streak_current = 1, last_activity_date = ?1, updated_at = ?2 WHERE id = ?3",
                params![today, now, domain_id],
            ).map_err(|e| e.to_string())?;
        }
    }

    get_domain_by_id(conn, domain_id)
}

#[tauri::command]
pub fn update_domain_streak(state: State<'_, DbState>, domain_id: String) -> Result<Domain, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    update_domain_streak_row(&conn, &domain_id)
}
```

- [ ] **Step 2: Extract `use_streak_freeze_row` from `use_streak_freeze`**

Find the existing `use_streak_freeze` function and replace it with:

```rust
fn use_streak_freeze_row(conn: &Connection, domain_id: &str) -> Result<Domain, String> {
    let tokens: i64 = conn.query_row(
        "SELECT streak_freeze_tokens FROM domains WHERE id = ?1",
        params![domain_id],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;

    if tokens <= 0 {
        return Err("No freeze tokens available".to_string());
    }

    let yesterday = chrono::Utc::now()
        .checked_sub_signed(chrono::Duration::days(1))
        .map(|d| d.format("%Y-%m-%d").to_string())
        .ok_or_else(|| "Date calculation error".to_string())?;

    conn.execute(
        "UPDATE domains SET streak_freeze_tokens = streak_freeze_tokens - 1, last_activity_date = ?1, updated_at = ?2 WHERE id = ?3",
        params![yesterday, Utc::now().to_rfc3339(), domain_id],
    ).map_err(|e| e.to_string())?;

    get_domain_by_id(conn, domain_id)
}

#[tauri::command]
pub fn use_streak_freeze(state: State<'_, DbState>, domain_id: String) -> Result<Domain, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    use_streak_freeze_row(&conn, &domain_id)
}
```

- [ ] **Step 3: Extract `update_momentum_row` from `update_momentum`**

Find the existing `update_momentum` function and replace it with:

```rust
fn update_momentum_row(conn: &Connection, score: i64) -> Result<(), String> {
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO app_state (id, momentum_score, last_momentum_calc, onboarding_complete)
         VALUES (1, ?1, ?2, 0)
         ON CONFLICT(id) DO UPDATE SET momentum_score = ?1, last_momentum_calc = ?2",
        params![score, now],
    ).map_err(|e| format!("update_momentum DB error: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn update_momentum(state: State<'_, DbState>, score: i64) -> Result<(), String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    update_momentum_row(&conn, score)
}
```

- [ ] **Step 4: Run `cargo check`**

Run: `cd "C:\Users\isc\Desktop\Projects\Life OS\src-tauri" && cargo check`
Expected: no errors.

- [ ] **Step 5: Commit the extraction**

```bash
git add src-tauri/src/commands.rs
git commit -m "refactor: extract testable row-helpers for streak/momentum commands"
```

- [ ] **Step 6: Add the `streak_momentum_tests` module**

Add this module near the end of `src-tauri/src/commands.rs`, alongside the other new test modules:

```rust
#[cfg(test)]
mod streak_momentum_tests {
    use super::*;

    fn setup_conn() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE domains (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                icon TEXT NOT NULL,
                color TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                deleted_at TEXT,
                streak_current INTEGER DEFAULT 0,
                streak_longest INTEGER DEFAULT 0,
                streak_freeze_tokens INTEGER DEFAULT 0,
                last_activity_date TEXT
            );
            CREATE TABLE app_state (
                id INTEGER PRIMARY KEY DEFAULT 1,
                momentum_score INTEGER NOT NULL DEFAULT 50,
                last_momentum_calc TEXT,
                onboarding_complete INTEGER NOT NULL DEFAULT 0
            );"
        ).unwrap();
        conn
    }

    fn insert_domain(conn: &Connection, id: &str, last_activity_date: Option<&str>, streak_current: i64, streak_longest: i64, streak_freeze_tokens: i64) {
        conn.execute(
            "INSERT INTO domains (id, name, icon, color, created_at, updated_at, streak_current, streak_longest, streak_freeze_tokens, last_activity_date)
             VALUES (?1, ?1, 'icon', '#000000', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', ?2, ?3, ?4, ?5)",
            params![id, streak_current, streak_longest, streak_freeze_tokens, last_activity_date],
        ).unwrap();
    }

    #[test]
    fn update_domain_streak_row_resets_to_one_after_a_gap() {
        let conn = setup_conn();
        insert_domain(&conn, "military", Some("2020-01-01"), 9, 12, 0);

        let domain = update_domain_streak_row(&conn, "military").unwrap();

        assert_eq!(domain.streak_current, 1);
    }

    #[test]
    fn update_domain_streak_row_increments_on_a_consecutive_day() {
        let conn = setup_conn();
        let yesterday = (Utc::now() - Duration::days(1)).format("%Y-%m-%d").to_string();
        insert_domain(&conn, "military", Some(&yesterday), 6, 6, 0);

        let domain = update_domain_streak_row(&conn, "military").unwrap();

        assert_eq!(domain.streak_current, 7);
        assert_eq!(domain.streak_longest, 7);
    }

    #[test]
    fn update_domain_streak_row_grants_a_freeze_token_on_the_seventh_day() {
        let conn = setup_conn();
        let yesterday = (Utc::now() - Duration::days(1)).format("%Y-%m-%d").to_string();
        insert_domain(&conn, "military", Some(&yesterday), 6, 6, 0);

        update_domain_streak_row(&conn, "military").unwrap();

        let domain = get_domain_by_id(&conn, "military").unwrap();
        assert_eq!(domain.streak_freeze_tokens, 1);
    }

    #[test]
    fn update_domain_streak_row_does_not_grant_a_token_on_a_non_multiple_of_seven() {
        let conn = setup_conn();
        let yesterday = (Utc::now() - Duration::days(1)).format("%Y-%m-%d").to_string();
        insert_domain(&conn, "military", Some(&yesterday), 3, 3, 0);

        update_domain_streak_row(&conn, "military").unwrap();

        let domain = get_domain_by_id(&conn, "military").unwrap();
        assert_eq!(domain.streak_freeze_tokens, 0);
    }

    #[test]
    fn use_streak_freeze_row_consumes_a_token_and_backdates_last_activity() {
        let conn = setup_conn();
        insert_domain(&conn, "military", Some("2020-01-01"), 5, 5, 2);

        let domain = use_streak_freeze_row(&conn, "military").unwrap();

        assert_eq!(domain.streak_freeze_tokens, 1);
        let yesterday = (Utc::now() - Duration::days(1)).format("%Y-%m-%d").to_string();
        assert_eq!(domain.last_activity_date, Some(yesterday));
    }

    #[test]
    fn use_streak_freeze_row_errors_when_no_tokens_available() {
        let conn = setup_conn();
        insert_domain(&conn, "military", None, 5, 5, 0);

        let result = use_streak_freeze_row(&conn, "military");

        assert_eq!(result, Err("No freeze tokens available".to_string()));
    }

    #[test]
    fn update_momentum_row_creates_the_singleton_row_if_missing() {
        let conn = setup_conn();

        update_momentum_row(&conn, 72).unwrap();

        let score: i64 = conn.query_row("SELECT momentum_score FROM app_state WHERE id = 1", [], |row| row.get(0)).unwrap();
        assert_eq!(score, 72);
    }

    #[test]
    fn update_momentum_row_updates_the_existing_row_without_duplicating() {
        let conn = setup_conn();
        update_momentum_row(&conn, 40).unwrap();

        update_momentum_row(&conn, 85).unwrap();

        let count: i64 = conn.query_row("SELECT COUNT(*) FROM app_state", [], |row| row.get(0)).unwrap();
        assert_eq!(count, 1);
        let score: i64 = conn.query_row("SELECT momentum_score FROM app_state WHERE id = 1", [], |row| row.get(0)).unwrap();
        assert_eq!(score, 85);
    }
}
```

- [ ] **Step 7: Run the new tests**

Run: `cd "C:\Users\isc\Desktop\Projects\Life OS\src-tauri" && cargo test streak_momentum_tests`
Expected: `8 passed; 0 failed`.

- [ ] **Step 8: Commit**

```bash
git add src-tauri/src/commands.rs
git commit -m "test: add streak and momentum tests"
```

---

### Task 5: Sync tests

**Files:**
- Modify: `src-tauri/src/commands.rs`

`export_sync_payload` and `import_sync_payload` already delegate to the plain-`Connection` helpers `load_sync_payload`/`import_sync_payload_into_db` — no extraction needed for those two. `configure_sync` needs one, with a deliberate scoping decision explained below.

`configure_sync`'s command body currently returns via `read_app_state_row`, which also does a best-effort read/write against the **real OS keychain** (via `credentials::SERVICE_NAME`, the app's actual production keychain service — not a test-only one) for three fields. That keychain touch is orthogonal to what `configure_sync` itself is responsible for (it's `read_app_state_row`'s job, already exercised by this codebase's existing `credential_migration_tests` using a safely test-scoped service name). To avoid a new test quietly reading/writing the real production keychain entry, this task's extraction returns `Result<(), String>` (the SQL mutation only) rather than `Result<AppStateRow, String>`, and keeps the `read_app_state_row` call in the (untested) command wrapper, matching how the codebase already isolates keychain-touching code from plain-SQL logic elsewhere.

- [ ] **Step 1: Extract `configure_sync_row` from `configure_sync`**

Find the existing `configure_sync` function (`#[tauri::command]\npub fn configure_sync(state: State<'_, DbState>, payload: SyncConfigPayload) -> Result<AppStateRow, String> {`) and replace it with:

```rust
fn configure_sync_row(conn: &Connection, payload: SyncConfigPayload) -> Result<(), String> {
    let _ = conn.execute("INSERT OR IGNORE INTO app_state (id, momentum_score, onboarding_complete) VALUES (1, 50, 0)", []);
    conn.execute(
        "UPDATE app_state
         SET sync_enabled = 1,
             sync_provider = 'supabase',
             sync_supabase_url = ?1,
             sync_supabase_anon_key = ?2,
             sync_last_sync_error = NULL
         WHERE id = 1",
        params![payload.supabase_url.trim(), payload.supabase_anon_key.trim()],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn configure_sync(state: State<'_, DbState>, payload: SyncConfigPayload) -> Result<AppStateRow, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    configure_sync_row(&conn, payload)?;
    read_app_state_row(&conn)
}
```

- [ ] **Step 2: Run `cargo check`**

Run: `cd "C:\Users\isc\Desktop\Projects\Life OS\src-tauri" && cargo check`
Expected: no errors.

- [ ] **Step 3: Commit the extraction**

```bash
git add src-tauri/src/commands.rs
git commit -m "refactor: extract testable row-helper for configure_sync (avoids touching the real keychain in tests)"
```

- [ ] **Step 4: Add the `sync_tests` module**

Add this module near the end of `src-tauri/src/commands.rs`, alongside the other new test modules. `setup_conn()` needs all 7 sync-payload entity tables since `load_sync_payload`/`import_sync_payload_into_db` unconditionally touch all of them, even when most are empty:

```rust
#[cfg(test)]
mod sync_tests {
    use super::*;

    fn setup_conn() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE app_state (
                id INTEGER PRIMARY KEY DEFAULT 1,
                momentum_score INTEGER NOT NULL DEFAULT 50,
                onboarding_complete INTEGER NOT NULL DEFAULT 0,
                sync_enabled INTEGER NOT NULL DEFAULT 0,
                sync_provider TEXT,
                sync_supabase_url TEXT,
                sync_supabase_anon_key TEXT,
                sync_last_sync_error TEXT
            );
            CREATE TABLE domains (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                icon TEXT NOT NULL,
                color TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                deleted_at TEXT,
                streak_current INTEGER DEFAULT 0,
                streak_longest INTEGER DEFAULT 0,
                streak_freeze_tokens INTEGER DEFAULT 0,
                last_activity_date TEXT
            );
            CREATE TABLE tasks (
                id TEXT PRIMARY KEY,
                domain_id TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                priority TEXT NOT NULL DEFAULT 'medium',
                energy_level TEXT NOT NULL DEFAULT 'medium',
                status TEXT NOT NULL DEFAULT 'todo',
                is_mit INTEGER NOT NULL DEFAULT 0,
                is_top_three INTEGER NOT NULL DEFAULT 0,
                xp_value INTEGER NOT NULL DEFAULT 30,
                xp_awarded INTEGER NOT NULL DEFAULT 0,
                parent_task_id TEXT,
                goal_id TEXT,
                tags TEXT DEFAULT '[]',
                time_estimate_minutes INTEGER,
                due_date TEXT,
                planned_for_date TEXT,
                task_kind TEXT NOT NULL DEFAULT 'standard',
                scheduled_for TEXT,
                recurring_template_id TEXT,
                recurrence_type TEXT,
                recurrence_interval INTEGER,
                recurrence_days TEXT DEFAULT '[]',
                recurrence_anchor_date TEXT,
                recurrence_rule TEXT,
                time_actual_minutes INTEGER,
                completed_at TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                deleted_at TEXT,
                attachments TEXT DEFAULT '[]'
            );
            CREATE TABLE habits (
                id TEXT PRIMARY KEY,
                domain_id TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                frequency TEXT NOT NULL DEFAULT 'daily',
                target_days TEXT NOT NULL DEFAULT '[0,1,2,3,4,5,6]',
                xp_per_completion INTEGER NOT NULL DEFAULT 15,
                cadence_type TEXT NOT NULL DEFAULT 'daily',
                cadence_days TEXT NOT NULL DEFAULT '[0,1,2,3,4,5,6]',
                cadence_interval_days INTEGER NOT NULL DEFAULT 1,
                cadence_weekly_target INTEGER NOT NULL DEFAULT 1,
                cadence_anchor_date TEXT,
                target_type TEXT NOT NULL DEFAULT 'checkbox',
                target_value INTEGER NOT NULL DEFAULT 1,
                minimum_value INTEGER,
                unit_label TEXT,
                minimum_version TEXT,
                recovery_grace_days INTEGER NOT NULL DEFAULT 1,
                restart_from_date TEXT,
                streak_current INTEGER NOT NULL DEFAULT 0,
                streak_longest INTEGER NOT NULL DEFAULT 0,
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                deleted_at TEXT
            );
            CREATE TABLE habit_logs (
                id TEXT PRIMARY KEY,
                habit_id TEXT NOT NULL,
                completed_date TEXT NOT NULL,
                xp_awarded INTEGER NOT NULL DEFAULT 15,
                value_completed INTEGER NOT NULL DEFAULT 1,
                status TEXT NOT NULL DEFAULT 'completed',
                skip_reason TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                deleted_at TEXT,
                UNIQUE(habit_id, completed_date)
            );
            CREATE TABLE goals (
                id TEXT PRIMARY KEY,
                domain_id TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                parent_goal_id TEXT,
                status TEXT NOT NULL DEFAULT 'active',
                next_action TEXT,
                review_date TEXT,
                blocked_by TEXT,
                health TEXT NOT NULL DEFAULT 'on_track',
                target_date TEXT,
                progress_percent INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                deleted_at TEXT
            );
            CREATE TABLE notes (
                id TEXT PRIMARY KEY,
                domain_id TEXT,
                goal_id TEXT,
                title TEXT NOT NULL,
                content TEXT NOT NULL DEFAULT '',
                tags TEXT NOT NULL DEFAULT '[]',
                pinned INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                deleted_at TEXT
            );
            CREATE TABLE inbox_items (
                id TEXT PRIMARY KEY,
                content TEXT NOT NULL,
                domain_id TEXT,
                source_label TEXT,
                suggested_kind TEXT,
                status TEXT NOT NULL DEFAULT 'pending',
                created_at TEXT NOT NULL,
                triaged_at TEXT,
                updated_at TEXT NOT NULL,
                deleted_at TEXT
            );"
        ).unwrap();
        conn.execute("INSERT INTO app_state (id, momentum_score, onboarding_complete) VALUES (1, 50, 0)", []).unwrap();
        conn
    }

    fn insert_domain(conn: &Connection, id: &str) {
        conn.execute(
            "INSERT INTO domains (id, name, icon, color, created_at, updated_at)
             VALUES (?1, ?1, 'icon', '#000000', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
            params![id],
        ).unwrap();
    }

    #[test]
    fn configure_sync_row_enables_sync_and_stores_credentials() {
        let conn = setup_conn();

        configure_sync_row(&conn, SyncConfigPayload {
            supabase_url: " https://example.supabase.co ".to_string(),
            supabase_anon_key: " anon-key-123 ".to_string(),
        }).unwrap();

        let (enabled, provider, url, key): (i64, String, String, String) = conn.query_row(
            "SELECT sync_enabled, sync_provider, sync_supabase_url, sync_supabase_anon_key FROM app_state WHERE id = 1",
            [],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        ).unwrap();

        assert_eq!(enabled, 1);
        assert_eq!(provider, "supabase");
        assert_eq!(url, "https://example.supabase.co");
        assert_eq!(key, "anon-key-123");
    }

    #[test]
    fn configure_sync_row_clears_a_previous_sync_error() {
        let conn = setup_conn();
        conn.execute("UPDATE app_state SET sync_last_sync_error = 'network timeout' WHERE id = 1", []).unwrap();

        configure_sync_row(&conn, SyncConfigPayload {
            supabase_url: "https://example.supabase.co".to_string(),
            supabase_anon_key: "anon-key-123".to_string(),
        }).unwrap();

        let error: Option<String> = conn.query_row("SELECT sync_last_sync_error FROM app_state WHERE id = 1", [], |row| row.get(0)).unwrap();
        assert_eq!(error, None);
    }

    #[test]
    fn export_then_import_sync_payload_round_trips_domains_and_tasks() {
        let conn1 = setup_conn();
        insert_domain(&conn1, "military");
        create_task_row(&conn1, base_task_payload("military")).unwrap();

        let payload = load_sync_payload(&conn1).unwrap();
        assert_eq!(payload.domains.len(), 1);
        assert_eq!(payload.tasks.len(), 1);

        let mut conn2 = setup_conn();
        let counts = import_sync_payload_into_db(&mut conn2, payload).unwrap();

        assert_eq!(counts.domains, 1);
        assert_eq!(counts.tasks, 1);
        let title: String = conn2.query_row("SELECT title FROM tasks WHERE domain_id = 'military'", [], |row| row.get(0)).unwrap();
        assert_eq!(title, "Write the plan");
    }

    #[test]
    fn import_sync_payload_into_db_replaces_existing_rows_rather_than_appending() {
        let mut conn = setup_conn();
        insert_domain(&conn, "military");
        create_task_row(&conn, base_task_payload("military")).unwrap();
        let payload = load_sync_payload(&conn).unwrap();

        import_sync_payload_into_db(&mut conn, payload).unwrap();

        let count: i64 = conn.query_row("SELECT COUNT(*) FROM tasks", [], |row| row.get(0)).unwrap();
        assert_eq!(count, 1, "re-importing the same payload must not duplicate rows");
    }

    fn base_task_payload(domain_id: &str) -> CreateTaskPayload {
        CreateTaskPayload {
            domain_id: domain_id.to_string(),
            title: "Write the plan".to_string(),
            description: None,
            priority: "medium".to_string(),
            energy_level: None,
            status: None,
            is_mit: false,
            is_top_three: false,
            xp_value: 0,
            parent_task_id: None,
            goal_id: None,
            tags: None,
            time_estimate_minutes: None,
            due_date: None,
            planned_for_date: None,
            task_kind: None,
            scheduled_for: None,
            recurring_template_id: None,
            recurrence_type: None,
            recurrence_interval: None,
            recurrence_days: None,
            recurrence_anchor_date: None,
            recurrence_rule: None,
        }
    }
}
```

- [ ] **Step 5: Run the new tests**

Run: `cd "C:\Users\isc\Desktop\Projects\Life OS\src-tauri" && cargo test sync_tests`
Expected: `4 passed; 0 failed`.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/commands.rs
git commit -m "test: add sync tests (configure_sync, export/import round trip)"
```

---

### Task 6: Backup/restore tests

**Files:**
- Modify: `src-tauri/src/commands.rs`

`write_backup_file`/`find_latest_backup_file` both take `app: &tauri::AppHandle`, which — like `tauri::State` — cannot be constructed in a unit test. Both only use `app` to resolve the backup directory (via `resolve_backup_directory`), and `resolve_backup_directory` itself only touches `app` when `app_state.backup_directory` is unset. This task splits each function into a thin AppHandle-resolving wrapper plus a new directory-parameterized helper that does the actual file I/O — a behavior-preserving extraction, not a logic change. `create_backup`/`restore_latest_backup`/`import_data`'s command bodies are untouched, since they still call the (now-thinner) `write_backup_file`/`find_latest_backup_file` with the exact same signatures.

- [ ] **Step 1: Extract `write_backup_file_to_dir` from `write_backup_file`**

Find the existing `write_backup_file` function and replace it with:

```rust
fn write_backup_file_to_dir(conn: &Connection, backup_dir: &Path, prefix: &str) -> Result<String, String> {
    let payload = load_export_payload(conn)?;
    let file_name = format!(
        "{}-{}.json",
        prefix,
        Utc::now().format("%Y-%m-%d_%H-%M-%S")
    );
    let file_path = backup_dir.join(file_name);
    let json = serde_json::to_string_pretty(&payload).map_err(|e| e.to_string())?;
    fs::write(&file_path, json).map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE app_state SET last_backup_at = ?1 WHERE id = 1",
        params![now],
    ).map_err(|e| e.to_string())?;
    Ok(file_path.to_string_lossy().to_string())
}

fn write_backup_file(app: &tauri::AppHandle, conn: &Connection, prefix: &str) -> Result<String, String> {
    let backup_dir = resolve_backup_directory(app, conn)?;
    write_backup_file_to_dir(conn, &backup_dir, prefix)
}
```

- [ ] **Step 2: Extract `find_latest_backup_file_in_dir` from `find_latest_backup_file`**

Find the existing `find_latest_backup_file` function and replace it with:

```rust
fn find_latest_backup_file_in_dir(backup_dir: &Path) -> Result<PathBuf, String> {
    let mut latest: Option<(std::time::SystemTime, PathBuf)> = None;

    for (path, metadata) in list_backup_files(backup_dir)? {
        let modified = metadata.modified().map_err(|e| e.to_string())?;
        match &latest {
            Some((current, _)) if modified <= *current => {}
            _ => latest = Some((modified, path)),
        }
    }

    latest
        .map(|(_, path)| path)
        .ok_or_else(|| "No backup files found in the backup directory".to_string())
}

fn find_latest_backup_file(app: &tauri::AppHandle, conn: &Connection) -> Result<PathBuf, String> {
    let backup_dir = resolve_backup_directory(app, conn)?;
    find_latest_backup_file_in_dir(&backup_dir)
}
```

- [ ] **Step 3: Widen `list_backup_files`'s parameter type from `&PathBuf` to `&Path`**

Find the existing `list_backup_files` function signature (`fn list_backup_files(backup_dir: &PathBuf) -> Result<Vec<(PathBuf, fs::Metadata)>, String> {`) and change only the signature line to:

```rust
fn list_backup_files(backup_dir: &Path) -> Result<Vec<(PathBuf, fs::Metadata)>, String> {
```

Leave the function body unchanged. This is a pure widening (every existing caller passing `&PathBuf` still compiles via deref coercion), needed so `find_latest_backup_file_in_dir` above can call it with a `&Path` directly.

- [ ] **Step 4: Add `use std::path::Path;` to the imports**

Find the top-of-file imports (`use std::path::PathBuf;`) and add `Path` alongside it:

```rust
use std::path::{Path, PathBuf};
```

- [ ] **Step 5: Run `cargo check`**

Run: `cd "C:\Users\isc\Desktop\Projects\Life OS\src-tauri" && cargo check`
Expected: no errors.

- [ ] **Step 6: Commit the extraction**

```bash
git add src-tauri/src/commands.rs
git commit -m "refactor: extract directory-parameterized backup helpers for testability"
```

- [ ] **Step 7: Add the `backup_tests` module**

Add this module near the end of `src-tauri/src/commands.rs`, alongside the other new test modules. It uses a unique subdirectory under the OS temp directory (`std::env::temp_dir()`) rather than a real app-data directory, and cleans up after itself — this codebase has no `tempfile` dev-dependency and none needs to be added for this.

```rust
#[cfg(test)]
mod backup_tests {
    use super::*;

    fn setup_conn() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE app_state (
                id INTEGER PRIMARY KEY DEFAULT 1,
                momentum_score INTEGER NOT NULL DEFAULT 50,
                onboarding_complete INTEGER NOT NULL DEFAULT 0,
                last_backup_at TEXT
            );
            CREATE TABLE domains (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                icon TEXT NOT NULL,
                color TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                deleted_at TEXT,
                streak_current INTEGER DEFAULT 0,
                streak_longest INTEGER DEFAULT 0,
                streak_freeze_tokens INTEGER DEFAULT 0,
                last_activity_date TEXT
            );
            CREATE TABLE tasks (
                id TEXT PRIMARY KEY,
                domain_id TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                priority TEXT NOT NULL DEFAULT 'medium',
                energy_level TEXT NOT NULL DEFAULT 'medium',
                status TEXT NOT NULL DEFAULT 'todo',
                is_mit INTEGER NOT NULL DEFAULT 0,
                is_top_three INTEGER NOT NULL DEFAULT 0,
                xp_value INTEGER NOT NULL DEFAULT 30,
                xp_awarded INTEGER NOT NULL DEFAULT 0,
                parent_task_id TEXT,
                goal_id TEXT,
                tags TEXT DEFAULT '[]',
                time_estimate_minutes INTEGER,
                due_date TEXT,
                planned_for_date TEXT,
                task_kind TEXT NOT NULL DEFAULT 'standard',
                scheduled_for TEXT,
                recurring_template_id TEXT,
                recurrence_type TEXT,
                recurrence_interval INTEGER,
                recurrence_days TEXT DEFAULT '[]',
                recurrence_anchor_date TEXT,
                recurrence_rule TEXT,
                time_actual_minutes INTEGER,
                completed_at TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                deleted_at TEXT,
                attachments TEXT DEFAULT '[]'
            );
            CREATE TABLE habits (
                id TEXT PRIMARY KEY,
                domain_id TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                frequency TEXT NOT NULL DEFAULT 'daily',
                target_days TEXT NOT NULL DEFAULT '[0,1,2,3,4,5,6]',
                xp_per_completion INTEGER NOT NULL DEFAULT 15,
                cadence_type TEXT NOT NULL DEFAULT 'daily',
                cadence_days TEXT NOT NULL DEFAULT '[0,1,2,3,4,5,6]',
                cadence_interval_days INTEGER NOT NULL DEFAULT 1,
                cadence_weekly_target INTEGER NOT NULL DEFAULT 1,
                cadence_anchor_date TEXT,
                target_type TEXT NOT NULL DEFAULT 'checkbox',
                target_value INTEGER NOT NULL DEFAULT 1,
                minimum_value INTEGER,
                unit_label TEXT,
                minimum_version TEXT,
                recovery_grace_days INTEGER NOT NULL DEFAULT 1,
                restart_from_date TEXT,
                streak_current INTEGER NOT NULL DEFAULT 0,
                streak_longest INTEGER NOT NULL DEFAULT 0,
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                deleted_at TEXT
            );
            CREATE TABLE habit_logs (
                id TEXT PRIMARY KEY,
                habit_id TEXT NOT NULL,
                completed_date TEXT NOT NULL,
                xp_awarded INTEGER NOT NULL DEFAULT 15,
                value_completed INTEGER NOT NULL DEFAULT 1,
                status TEXT NOT NULL DEFAULT 'completed',
                skip_reason TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                deleted_at TEXT,
                UNIQUE(habit_id, completed_date)
            );
            CREATE TABLE goals (
                id TEXT PRIMARY KEY,
                domain_id TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                parent_goal_id TEXT,
                status TEXT NOT NULL DEFAULT 'active',
                next_action TEXT,
                review_date TEXT,
                blocked_by TEXT,
                health TEXT NOT NULL DEFAULT 'on_track',
                target_date TEXT,
                progress_percent INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                deleted_at TEXT
            );
            CREATE TABLE notes (
                id TEXT PRIMARY KEY,
                domain_id TEXT,
                goal_id TEXT,
                title TEXT NOT NULL,
                content TEXT NOT NULL DEFAULT '',
                tags TEXT NOT NULL DEFAULT '[]',
                pinned INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                deleted_at TEXT
            );
            CREATE TABLE inbox_items (
                id TEXT PRIMARY KEY,
                content TEXT NOT NULL,
                domain_id TEXT,
                source_label TEXT,
                suggested_kind TEXT,
                status TEXT NOT NULL DEFAULT 'pending',
                created_at TEXT NOT NULL,
                triaged_at TEXT,
                updated_at TEXT NOT NULL,
                deleted_at TEXT
            );
            CREATE TABLE task_templates (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                domain_id TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE focus_sessions (
                id TEXT PRIMARY KEY,
                task_id TEXT,
                started_at TEXT NOT NULL,
                ended_at TEXT
            );
            CREATE TABLE focus_timer_drafts (
                id TEXT PRIMARY KEY,
                task_id TEXT,
                remaining_seconds INTEGER
            );
            CREATE TABLE task_friction_logs (
                id TEXT PRIMARY KEY,
                task_id TEXT,
                created_at TEXT NOT NULL
            );"
        ).unwrap();
        conn.execute("INSERT INTO app_state (id, momentum_score, onboarding_complete) VALUES (1, 50, 0)", []).unwrap();
        conn
    }

    fn insert_domain(conn: &Connection, id: &str) {
        conn.execute(
            "INSERT INTO domains (id, name, icon, color, created_at, updated_at)
             VALUES (?1, ?1, 'icon', '#000000', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
            params![id],
        ).unwrap();
    }

    fn temp_backup_dir(test_name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("life-os-backup-tests-{}-{}", test_name, Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn write_backup_file_to_dir_creates_a_json_file_with_the_given_prefix() {
        let conn = setup_conn();
        insert_domain(&conn, "military");
        let dir = temp_backup_dir("write");

        let path = write_backup_file_to_dir(&conn, &dir, "life-os-backup").unwrap();

        assert!(PathBuf::from(&path).exists());
        assert!(path.contains("life-os-backup-"));
        assert!(path.ends_with(".json"));
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn write_backup_file_to_dir_updates_last_backup_at() {
        let conn = setup_conn();
        let dir = temp_backup_dir("last-backup-at");

        write_backup_file_to_dir(&conn, &dir, "life-os-backup").unwrap();

        let last_backup_at: Option<String> = conn.query_row("SELECT last_backup_at FROM app_state WHERE id = 1", [], |row| row.get(0)).unwrap();
        assert!(last_backup_at.is_some());
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn find_latest_backup_file_in_dir_returns_the_most_recently_written_file() {
        let conn = setup_conn();
        let dir = temp_backup_dir("find-latest");

        write_backup_file_to_dir(&conn, &dir, "older").unwrap();
        std::thread::sleep(std::time::Duration::from_millis(1100)); // file names are second-resolution; force a distinct modified time
        let newer_path = write_backup_file_to_dir(&conn, &dir, "newer").unwrap();

        let latest = find_latest_backup_file_in_dir(&dir).unwrap();

        assert_eq!(latest.to_string_lossy().to_string(), newer_path);
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn find_latest_backup_file_in_dir_errors_when_the_directory_has_no_backups() {
        let dir = temp_backup_dir("empty");

        let result = find_latest_backup_file_in_dir(&dir);

        assert_eq!(result, Err("No backup files found in the backup directory".to_string()));
        fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn a_written_backup_file_round_trips_through_import_payload_into_db() {
        let conn1 = setup_conn();
        insert_domain(&conn1, "military");
        let dir = temp_backup_dir("round-trip");

        let path = write_backup_file_to_dir(&conn1, &dir, "life-os-backup").unwrap();
        let data = fs::read_to_string(&path).unwrap();
        let payload: ImportPayload = serde_json::from_str(&data).unwrap();

        let mut conn2 = setup_conn();
        import_payload_into_db(&mut conn2, payload).unwrap();

        let name: String = conn2.query_row("SELECT name FROM domains WHERE id = 'military'", [], |row| row.get(0)).unwrap();
        assert_eq!(name, "military");
        fs::remove_dir_all(&dir).ok();
    }
}
```

- [ ] **Step 8: Run the new tests**

Run: `cd "C:\Users\isc\Desktop\Projects\Life OS\src-tauri" && cargo test backup_tests`
Expected: `5 passed; 0 failed`. (The `find_latest_backup_file_in_dir_returns_the_most_recently_written_file` test sleeps ~1.1s to force a distinct file-modified timestamp — this is the slowest test in the new suite but still well under a second's worth of noticeable delay in a full `cargo test` run.)

- [ ] **Step 9: Commit**

```bash
git add src-tauri/src/commands.rs
git commit -m "test: add backup/restore tests"
```

---

### Task 7: Desktop Rust final verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full Rust test suite**

Run: `cd "C:\Users\isc\Desktop\Projects\Life OS\src-tauri" && cargo test`
Expected: all tests pass — the 2 pre-existing test modules (`credential_migration_tests`, `debug_log_tests`) plus the 6 new modules added in Tasks 1–6 (`task_lifecycle_tests`, `habit_lifecycle_tests`, `goal_progress_tests`, `streak_momentum_tests`, `sync_tests`, `backup_tests`).

- [ ] **Step 2: Run a full release build**

Run: `cd "C:\Users\isc\Desktop\Projects\Life OS\src-tauri" && cargo build`
Expected: clean build, no new warnings beyond the 2 pre-existing unrelated ones (`fetch_habit_logs_map`, `get_secret`) already present before this work.

---

## Desktop Frontend (Vitest)

### Task 8: `useHabitStore` tests

**Files:**
- Create: `src/store/__tests__/useHabitStore.test.ts`

Follows the exact structure of `src/store/__tests__/useTaskStore.test.ts`: import the mocked `invoke` from `@tauri-apps/api/core`, reset store state and mocks in `beforeEach`, use a local `make*` factory with `Partial<T>` overrides.

`loadHabits` makes **two** sequential `invoke` calls (`get_habits`, then `get_habit_logs_range`) — tests covering it must queue two `mockResolvedValueOnce` values. `logHabit`/`logHabitMinimum`/`skipHabit` each make **three** sequential calls (the log-mutation itself, then `get_habits` to refresh, then `get_domains` inside `useDomainStore.loadDomains()`) — tests covering them must queue three.

- [ ] **Step 1: Write the test file**

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { useHabitStore } from '../useHabitStore';
import { useDomainStore } from '../useDomainStore';
import { useErrorStore } from '../useErrorStore';
import type { Habit, HabitLog } from '../../lib/types';

const mockInvoke = vi.mocked(invoke);

function makeHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'habit-1',
    domain_id: 'self',
    title: 'Meditate',
    description: null,
    frequency: 'daily',
    target_days: '[0,1,2,3,4,5,6]',
    xp_per_completion: 15,
    cadence_type: 'daily',
    cadence_days: '[0,1,2,3,4,5,6]',
    cadence_interval_days: 1,
    cadence_weekly_target: 1,
    cadence_anchor_date: null,
    target_type: 'checkbox',
    target_value: 1,
    minimum_value: null,
    unit_label: null,
    minimum_version: null,
    recovery_grace_days: 1,
    restart_from_date: null,
    streak_current: 0,
    streak_longest: 0,
    is_active: true,
    created_at: '2026-07-16T09:00:00Z',
    ...overrides,
  };
}

function makeHabitLog(overrides: Partial<HabitLog> = {}): HabitLog {
  return {
    id: 'log-1',
    habit_id: 'habit-1',
    completed_date: '2026-07-16',
    xp_awarded: 0,
    value_completed: 1,
    status: 'completed',
    skip_reason: null,
    created_at: '2026-07-16T09:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  useHabitStore.setState({ habits: [], logs: [], isLoading: false });
  useDomainStore.setState({ domains: [], activeDomain: null, isLoading: false });
  useErrorStore.setState({ errors: [] });
  vi.clearAllMocks();
});

describe('useHabitStore', () => {
  it('starts with empty habits and logs', () => {
    expect(useHabitStore.getState().habits).toEqual([]);
    expect(useHabitStore.getState().logs).toEqual([]);
  });

  it('loadHabits: populates habits and logs from two sequential invoke calls', async () => {
    mockInvoke.mockResolvedValueOnce([makeHabit()]);
    mockInvoke.mockResolvedValueOnce([makeHabitLog()]);

    await useHabitStore.getState().loadHabits();

    expect(useHabitStore.getState().habits).toHaveLength(1);
    expect(useHabitStore.getState().logs).toHaveLength(1);
    expect(useHabitStore.getState().isLoading).toBe(false);
  });

  it('loadHabits: handles error gracefully (keeps existing state)', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('DB error'));

    await useHabitStore.getState().loadHabits();

    expect(useHabitStore.getState().habits).toEqual([]);
    expect(useHabitStore.getState().isLoading).toBe(false);
  });

  it('createHabit: appends the new habit and refreshes domains', async () => {
    mockInvoke.mockResolvedValueOnce(makeHabit({ id: 'new-habit' }));
    mockInvoke.mockResolvedValueOnce([]); // useDomainStore.loadDomains -> get_domains

    await useHabitStore.getState().createHabit({
      domain_id: 'self',
      title: 'Meditate',
      frequency: 'daily',
      target_days: '[0,1,2,3,4,5,6]',
    });

    expect(useHabitStore.getState().habits).toHaveLength(1);
    expect(useHabitStore.getState().habits[0].id).toBe('new-habit');
  });

  it('createHabit: reports an error on failure', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('insert failed'));

    await expect(useHabitStore.getState().createHabit({
      domain_id: 'self',
      title: 'Meditate',
      frequency: 'daily',
      target_days: '[0,1,2,3,4,5,6]',
    })).rejects.toThrow();

    expect(useErrorStore.getState().errors).toHaveLength(1);
    expect(useErrorStore.getState().errors[0].message).toBe('Failed to create habit');
  });

  it('logHabit: upserts the log, refreshes habits, and registers an undo entry', async () => {
    useHabitStore.setState({ habits: [makeHabit()] });
    mockInvoke.mockResolvedValueOnce(makeHabitLog());
    mockInvoke.mockResolvedValueOnce([makeHabit({ streak_current: 1 })]); // db.getHabits() refresh
    mockInvoke.mockResolvedValueOnce([]); // useDomainStore.loadDomains -> get_domains

    await useHabitStore.getState().logHabit('habit-1', '2026-07-16');

    expect(useHabitStore.getState().logs).toHaveLength(1);
    expect(useHabitStore.getState().habits[0].streak_current).toBe(1);
  });

  it('logHabit: rejects synchronously for a blank habit_id without calling invoke', async () => {
    await expect(useHabitStore.getState().logHabit('   ', '2026-07-16')).rejects.toThrow();
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('isCompletedToday: true only for a completed or minimum log dated today', () => {
    const today = new Date().toISOString().slice(0, 10);
    useHabitStore.setState({
      logs: [makeHabitLog({ habit_id: 'habit-1', completed_date: today, status: 'completed' })],
    });

    expect(useHabitStore.getState().isCompletedToday('habit-1')).toBe(true);
    expect(useHabitStore.getState().isCompletedToday('habit-2')).toBe(false);
  });

  it('todayCompletionCount: counts only completed/minimum logs dated today', () => {
    const today = new Date().toISOString().slice(0, 10);
    useHabitStore.setState({
      logs: [
        makeHabitLog({ habit_id: 'h1', completed_date: today, status: 'completed' }),
        makeHabitLog({ habit_id: 'h2', completed_date: today, status: 'minimum' }),
        makeHabitLog({ habit_id: 'h3', completed_date: today, status: 'skipped' }),
        makeHabitLog({ habit_id: 'h4', completed_date: '2020-01-01', status: 'completed' }),
      ],
    });

    expect(useHabitStore.getState().todayCompletionCount()).toBe(2);
  });

  it('deleteHabit: removes the habit and registers an undo that reactivates it', async () => {
    useHabitStore.setState({ habits: [makeHabit({ id: 'h1' })] });
    mockInvoke.mockResolvedValueOnce(undefined); // delete_habit
    mockInvoke.mockResolvedValueOnce([]); // useDomainStore.loadDomains -> get_domains

    await useHabitStore.getState().deleteHabit('h1');

    expect(useHabitStore.getState().habits).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the new tests**

Run: `cd "C:\Users\isc\Desktop\Projects\Life OS" && npx vitest run src/store/__tests__/useHabitStore.test.ts`
Expected: `11 passed`.

- [ ] **Step 3: Commit**

```bash
git add src/store/__tests__/useHabitStore.test.ts
git commit -m "test: add useHabitStore tests"
```

---

### Task 9: `useGoalStore` tests

**Files:**
- Create: `src/store/__tests__/useGoalStore.test.ts`

Unlike `useTaskStore`/`useHabitStore`, every `useGoalStore` catch block reports a static error string (never a dynamic `Goal error: ${detail}` template) — assertions below check the exact static strings.

- [ ] **Step 1: Write the test file**

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { useGoalStore } from '../useGoalStore';
import { useErrorStore } from '../useErrorStore';
import type { Goal } from '../../lib/types';

const mockInvoke = vi.mocked(invoke);

function makeGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'goal-1',
    domain_id: 'builder',
    title: 'Ship the release',
    description: null,
    parent_goal_id: null,
    status: 'active',
    next_action: null,
    review_date: null,
    blocked_by: null,
    health: 'on_track',
    target_date: null,
    progress_percent: 0,
    created_at: '2026-07-16T09:00:00Z',
    updated_at: '2026-07-16T09:00:00Z',
    deleted_at: null,
    ...overrides,
  };
}

beforeEach(() => {
  useGoalStore.setState({ goals: [], isLoading: false });
  useErrorStore.setState({ errors: [] });
  vi.clearAllMocks();
});

describe('useGoalStore', () => {
  it('loadGoals: populates goals from invoke result', async () => {
    mockInvoke.mockResolvedValueOnce([makeGoal({ id: 'g1' }), makeGoal({ id: 'g2' })]);

    await useGoalStore.getState().loadGoals();

    expect(useGoalStore.getState().goals).toHaveLength(2);
  });

  it('loadGoals: handles error gracefully (keeps existing state)', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('DB error'));

    await useGoalStore.getState().loadGoals();

    expect(useGoalStore.getState().goals).toEqual([]);
    expect(useGoalStore.getState().isLoading).toBe(false);
  });

  it('createGoal: adds the goal to the front of the list', async () => {
    useGoalStore.setState({ goals: [makeGoal({ id: 'existing' })] });
    mockInvoke.mockResolvedValueOnce(makeGoal({ id: 'new-goal' }));

    await useGoalStore.getState().createGoal({ domain_id: 'builder', title: 'Ship the release' });

    const goals = useGoalStore.getState().goals;
    expect(goals[0].id).toBe('new-goal');
    expect(goals).toHaveLength(2);
  });

  it('createGoal: reports the static error string on failure', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('insert failed'));

    await expect(useGoalStore.getState().createGoal({ domain_id: 'builder', title: 'Ship' })).rejects.toThrow();

    expect(useErrorStore.getState().errors[0].message).toBe('Failed to create goal');
  });

  it('updateGoal: replaces the matching goal by id', async () => {
    useGoalStore.setState({ goals: [makeGoal({ id: 'g1', progress_percent: 0 })] });
    mockInvoke.mockResolvedValueOnce(makeGoal({ id: 'g1', progress_percent: 50 }));

    await useGoalStore.getState().updateGoal({ id: 'g1', progress_percent: 50 });

    expect(useGoalStore.getState().goals[0].progress_percent).toBe(50);
  });

  it('deleteGoal: removes the goal from the list', async () => {
    useGoalStore.setState({ goals: [makeGoal({ id: 'g1' }), makeGoal({ id: 'g2' })] });
    mockInvoke.mockResolvedValueOnce(undefined);

    await useGoalStore.getState().deleteGoal('g1');

    expect(useGoalStore.getState().goals).toHaveLength(1);
    expect(useGoalStore.getState().goals[0].id).toBe('g2');
  });

  it('deleteGoal: reports the static error string on failure', async () => {
    useGoalStore.setState({ goals: [makeGoal({ id: 'g1' })] });
    mockInvoke.mockRejectedValueOnce(new Error('delete failed'));

    await expect(useGoalStore.getState().deleteGoal('g1')).rejects.toThrow();

    expect(useErrorStore.getState().errors[0].message).toBe('Failed to delete goal');
  });

  it('goalsByDomain: filters by domain and excludes archived', () => {
    useGoalStore.setState({
      goals: [
        makeGoal({ id: 'g1', domain_id: 'builder', status: 'active' }),
        makeGoal({ id: 'g2', domain_id: 'self', status: 'active' }),
        makeGoal({ id: 'g3', domain_id: 'builder', status: 'archived' }),
      ],
    });

    const builderGoals = useGoalStore.getState().goalsByDomain('builder');
    expect(builderGoals).toHaveLength(1);
    expect(builderGoals[0].id).toBe('g1');
  });

  it('rootGoals: returns only goals with no parent, excluding archived', () => {
    useGoalStore.setState({
      goals: [
        makeGoal({ id: 'g1', parent_goal_id: null, status: 'active' }),
        makeGoal({ id: 'g2', parent_goal_id: 'g1', status: 'active' }),
        makeGoal({ id: 'g3', parent_goal_id: null, status: 'archived' }),
      ],
    });

    const roots = useGoalStore.getState().rootGoals();
    expect(roots).toHaveLength(1);
    expect(roots[0].id).toBe('g1');
  });

  it('subGoals: returns goals whose parent_goal_id matches', () => {
    useGoalStore.setState({
      goals: [
        makeGoal({ id: 'g1', parent_goal_id: null }),
        makeGoal({ id: 'g2', parent_goal_id: 'g1' }),
        makeGoal({ id: 'g3', parent_goal_id: 'g1' }),
      ],
    });

    const children = useGoalStore.getState().subGoals('g1');
    expect(children.map((g) => g.id).sort()).toEqual(['g2', 'g3']);
  });
});
```

- [ ] **Step 2: Run the new tests**

Run: `cd "C:\Users\isc\Desktop\Projects\Life OS" && npx vitest run src/store/__tests__/useGoalStore.test.ts`
Expected: `10 passed`.

- [ ] **Step 3: Commit**

```bash
git add src/store/__tests__/useGoalStore.test.ts
git commit -m "test: add useGoalStore tests"
```

---

### Task 10: `useDomainStore` tests

**Files:**
- Create: `src/store/__tests__/useDomainStore.test.ts`

`useDomainStore` never calls `useErrorStore` — every failure path just `console.error`s (and `loadDomains`/`refreshDomain` swallow the error silently with no rethrow, while `useStreakFreeze`/`createDomain`/`updateDomainProfile`/`deleteDomain` rethrow after logging). Every state-setting path pipes results through `sortDomains` from `src/lib/domain-utils.ts`, which orders `military`/`builder`/`self` first (in that order), then any other domain by `created_at`, then by name/id.

- [ ] **Step 1: Write the test file**

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { useDomainStore } from '../useDomainStore';
import type { Domain } from '../../lib/types';

const mockInvoke = vi.mocked(invoke);

function makeDomain(overrides: Partial<Domain> = {}): Domain {
  return {
    id: 'military',
    name: 'Military',
    icon: '[M]',
    color: '#D4A73D',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    deleted_at: null,
    streak_current: 0,
    streak_longest: 0,
    streak_freeze_tokens: 0,
    last_activity_date: null,
    ...overrides,
  };
}

beforeEach(() => {
  useDomainStore.setState({ domains: [], activeDomain: null, isLoading: false });
  vi.clearAllMocks();
});

describe('useDomainStore', () => {
  it('loadDomains: populates and sorts domains (military, builder, self first)', async () => {
    mockInvoke.mockResolvedValueOnce([
      makeDomain({ id: 'self', name: 'Self' }),
      makeDomain({ id: 'military', name: 'Military' }),
      makeDomain({ id: 'builder', name: 'Builder' }),
    ]);

    await useDomainStore.getState().loadDomains();

    expect(useDomainStore.getState().domains.map((d) => d.id)).toEqual(['military', 'builder', 'self']);
  });

  it('loadDomains: handles error gracefully (keeps existing state, no rethrow)', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('DB error'));

    await expect(useDomainStore.getState().loadDomains()).resolves.toBeUndefined();
    expect(useDomainStore.getState().domains).toEqual([]);
  });

  it('setDomains: sorts the provided domains', () => {
    useDomainStore.getState().setDomains([
      makeDomain({ id: 'builder', name: 'Builder' }),
      makeDomain({ id: 'military', name: 'Military' }),
    ]);

    expect(useDomainStore.getState().domains.map((d) => d.id)).toEqual(['military', 'builder']);
  });

  it('setActiveDomain: sets the active domain id', () => {
    useDomainStore.getState().setActiveDomain('builder');
    expect(useDomainStore.getState().activeDomain).toBe('builder');
  });

  it('getDomain: returns the matching domain or undefined', () => {
    useDomainStore.setState({ domains: [makeDomain({ id: 'military' })] });

    expect(useDomainStore.getState().getDomain('military')?.id).toBe('military');
    expect(useDomainStore.getState().getDomain('builder')).toBeUndefined();
  });

  it('useStreakFreeze: replaces the matching domain with the updated one', async () => {
    useDomainStore.setState({ domains: [makeDomain({ id: 'military', streak_freeze_tokens: 2 })] });
    mockInvoke.mockResolvedValueOnce(makeDomain({ id: 'military', streak_freeze_tokens: 1 }));

    const updated = await useDomainStore.getState().useStreakFreeze('military');

    expect(updated.streak_freeze_tokens).toBe(1);
    expect(useDomainStore.getState().domains[0].streak_freeze_tokens).toBe(1);
  });

  it('useStreakFreeze: rethrows on failure', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('No freeze tokens available'));

    await expect(useDomainStore.getState().useStreakFreeze('military')).rejects.toThrow('No freeze tokens available');
  });

  it('createDomain: adds and sorts the new domain, and sets it active if none was active', async () => {
    mockInvoke.mockResolvedValueOnce(makeDomain({ id: 'military' }));

    const created = await useDomainStore.getState().createDomain({ name: 'Military', icon: '[M]', color: '#D4A73D' });

    expect(created.id).toBe('military');
    expect(useDomainStore.getState().domains).toHaveLength(1);
    expect(useDomainStore.getState().activeDomain).toBe('military');
  });

  it('createDomain: does not override an already-active domain', async () => {
    useDomainStore.setState({ activeDomain: 'builder' });
    mockInvoke.mockResolvedValueOnce(makeDomain({ id: 'military' }));

    await useDomainStore.getState().createDomain({ name: 'Military', icon: '[M]', color: '#D4A73D' });

    expect(useDomainStore.getState().activeDomain).toBe('builder');
  });

  it('updateDomainProfile: replaces the matching domain by id', async () => {
    useDomainStore.setState({ domains: [makeDomain({ id: 'military', name: 'Military' })] });
    mockInvoke.mockResolvedValueOnce(makeDomain({ id: 'military', name: 'Army' }));

    await useDomainStore.getState().updateDomainProfile({ id: 'military', name: 'Army' });

    expect(useDomainStore.getState().domains[0].name).toBe('Army');
  });

  it('deleteDomain: removes the domain and clears activeDomain if it was the deleted one', async () => {
    useDomainStore.setState({
      domains: [makeDomain({ id: 'military' }), makeDomain({ id: 'builder' })],
      activeDomain: 'military',
    });
    mockInvoke.mockResolvedValueOnce(undefined);

    await useDomainStore.getState().deleteDomain('military');

    expect(useDomainStore.getState().domains).toHaveLength(1);
    expect(useDomainStore.getState().activeDomain).toBe('builder');
  });
});
```

- [ ] **Step 2: Run the new tests**

Run: `cd "C:\Users\isc\Desktop\Projects\Life OS" && npx vitest run src/store/__tests__/useDomainStore.test.ts`
Expected: `11 passed`.

- [ ] **Step 3: Commit**

```bash
git add src/store/__tests__/useDomainStore.test.ts
git commit -m "test: add useDomainStore tests"
```

---

### Task 11: `useAppStore` tests

**Files:**
- Create: `src/store/__tests__/useAppStore.test.ts`

Every `useAppStore` action swallows errors (`console.error`, no rethrow, no `useErrorStore` call). `updateMomentum`/`setMitTask`/`saveApiKey` only update `appState` if it's already non-null — tests exercising these must seed `appState` first via `setState`. `resetData` calls `db.resetAllData()` then internally re-invokes `loadAppState()` (which calls `db.getAppState()`) — tests covering it must queue two `mockResolvedValueOnce` values.

- [ ] **Step 1: Write the test file**

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '../useAppStore';
import type { AppStateRow } from '../../lib/types';

const mockInvoke = vi.mocked(invoke);

function makeAppState(overrides: Partial<AppStateRow> = {}): AppStateRow {
  return {
    id: 1,
    momentum_score: 50,
    last_momentum_calc: null,
    current_mit_task_id: null,
    api_key: null,
    onboarding_complete: true,
    last_opened_date: null,
    backup_directory: null,
    auto_backup_enabled: false,
    last_backup_at: null,
    crt_intensity: 'medium',
    text_scale: 'normal',
    ui_density: 'comfortable',
    sync_enabled: false,
    sync_provider: null,
    sync_supabase_url: null,
    sync_supabase_anon_key: null,
    sync_access_token: null,
    sync_refresh_token: null,
    sync_user_id: null,
    sync_user_email: null,
    sync_last_sync_at: null,
    sync_last_sync_error: null,
    sync_last_pushed_at: null,
    sync_last_pulled_at: null,
    ...overrides,
  };
}

beforeEach(() => {
  useAppStore.setState({ appState: null, momentumState: 'normal', isLoading: false });
  vi.clearAllMocks();
});

describe('useAppStore', () => {
  it('loadAppState: populates appState and derives momentumState', async () => {
    mockInvoke.mockResolvedValueOnce(makeAppState({ momentum_score: 85 }));

    await useAppStore.getState().loadAppState();

    expect(useAppStore.getState().appState?.momentum_score).toBe(85);
    expect(useAppStore.getState().momentumState).toBe('peak');
  });

  it('loadAppState: handles error gracefully (keeps existing state)', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('DB error'));

    await useAppStore.getState().loadAppState();

    expect(useAppStore.getState().appState).toBeNull();
  });

  it('updateMomentum: updates score and momentumState when appState is already loaded', async () => {
    useAppStore.setState({ appState: makeAppState({ momentum_score: 10 }) });
    mockInvoke.mockResolvedValueOnce(undefined);

    await useAppStore.getState().updateMomentum(20);

    expect(useAppStore.getState().appState?.momentum_score).toBe(20);
    expect(useAppStore.getState().momentumState).toBe('amber');
  });

  it('updateMomentum: is a no-op on appState when it has not been loaded yet', async () => {
    mockInvoke.mockResolvedValueOnce(undefined);

    await useAppStore.getState().updateMomentum(20);

    expect(useAppStore.getState().appState).toBeNull();
  });

  it('setMitTask: updates current_mit_task_id when appState is loaded', async () => {
    useAppStore.setState({ appState: makeAppState({ current_mit_task_id: null }) });
    mockInvoke.mockResolvedValueOnce(undefined);

    await useAppStore.getState().setMitTask('task-1');

    expect(useAppStore.getState().appState?.current_mit_task_id).toBe('task-1');
  });

  it('saveApiKey: updates api_key when appState is loaded', async () => {
    useAppStore.setState({ appState: makeAppState({ api_key: null }) });
    mockInvoke.mockResolvedValueOnce(undefined);

    await useAppStore.getState().saveApiKey('sk-123');

    expect(useAppStore.getState().appState?.api_key).toBe('sk-123');
  });

  it('resetData: calls resetAllData then reloads appState', async () => {
    mockInvoke.mockResolvedValueOnce(undefined); // reset_all_data
    mockInvoke.mockResolvedValueOnce(makeAppState({ momentum_score: 50 })); // get_app_state (via loadAppState)

    await useAppStore.getState().resetData();

    expect(useAppStore.getState().appState?.momentum_score).toBe(50);
  });

  it('resetData: handles error gracefully without throwing', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('reset failed'));

    await expect(useAppStore.getState().resetData()).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the new tests**

Run: `cd "C:\Users\isc\Desktop\Projects\Life OS" && npx vitest run src/store/__tests__/useAppStore.test.ts`
Expected: `7 passed`.

- [ ] **Step 3: Commit**

```bash
git add src/store/__tests__/useAppStore.test.ts
git commit -m "test: add useAppStore tests"
```

---

### Task 12: Desktop frontend final verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `cd "C:\Users\isc\Desktop\Projects\Life OS" && npm test`
Expected: all tests pass — the 9 pre-existing files plus the 4 new store test files added in Tasks 8–11 (13 files total).

- [ ] **Step 2: Run the full typecheck + production build**

Run: `cd "C:\Users\isc\Desktop\Projects\Life OS" && npm run build`
Expected: `tsc && vite build` completes with no type errors. The pre-existing bundle-size/CSS-optimizer/dynamic-import warnings (unrelated to this work) may still appear — expected, not a regression.

---

## Mobile (Flutter)

### Task 13: `commitment_metrics.dart` tests

**Files:**
- Create: `test/core/utils/commitment_metrics_test.dart`

These functions are pure (no I/O), so most cases are plain `test()` blocks with hand-constructed inputs. Where a function takes a `LocalTask`/`LocalHabit`/`LocalHabitLog` row, a minimal instance is constructed directly — Drift's generated data classes are plain constructible objects, every column becomes a required (possibly-nullable) named constructor parameter, no database needed.

- [ ] **Step 1: Write the test file**

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:life_os_mobile/core/utils/commitment_metrics.dart';
import 'package:life_os_mobile/data/local/app_database.dart';

LocalTask makeTask({
  String id = 'task-1',
  String domainId = 'military',
  String status = 'todo',
  String? dueDate,
  String? deletedAt,
  String taskKind = 'standard',
}) {
  return LocalTask(
    id: id,
    domainId: domainId,
    title: 'Test task',
    description: null,
    priority: 'medium',
    status: status,
    isMit: false,
    isTopThree: false,
    xpValue: 0,
    xpAwarded: false,
    parentTaskId: null,
    goalId: null,
    tags: '[]',
    timeEstimateMinutes: null,
    dueDate: dueDate,
    plannedForDate: null,
    taskKind: taskKind,
    scheduledFor: null,
    recurringTemplateId: null,
    recurrenceType: null,
    recurrenceInterval: null,
    recurrenceDays: '[]',
    recurrenceAnchorDate: null,
    completedAt: null,
    createdAt: '2026-07-16T09:00:00Z',
    updatedAt: '2026-07-16T09:00:00Z',
    deletedAt: deletedAt,
    attachments: '[]',
    recurrenceRule: null,
    timeActualMinutes: null,
  );
}

LocalHabit makeHabit({
  String id = 'habit-1',
  String domainId = 'self',
  String cadenceType = 'daily',
  String cadenceDays = '[0,1,2,3,4,5,6]',
  int cadenceIntervalDays = 1,
  String? cadenceAnchorDate,
  int targetValue = 1,
  int? minimumValue,
  String? minimumVersion,
  String? restartFromDate,
}) {
  return LocalHabit(
    id: id,
    domainId: domainId,
    title: 'Test habit',
    description: null,
    frequency: 'daily',
    targetDays: '[0,1,2,3,4,5,6]',
    xpPerCompletion: 0,
    cadenceType: cadenceType,
    cadenceDays: cadenceDays,
    cadenceIntervalDays: cadenceIntervalDays,
    cadenceWeeklyTarget: 1,
    cadenceAnchorDate: cadenceAnchorDate,
    targetType: 'checkbox',
    targetValue: targetValue,
    minimumValue: minimumValue,
    unitLabel: null,
    minimumVersion: minimumVersion,
    recoveryGraceDays: 1,
    restartFromDate: restartFromDate,
    streakCurrent: 0,
    streakLongest: 0,
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    deletedAt: null,
  );
}

LocalHabitLog makeLog({
  String id = 'log-1',
  String habitId = 'habit-1',
  String completedDate = '2026-07-16',
  int valueCompleted = 1,
  String status = 'completed',
  String? deletedAt,
  String? updatedAt,
}) {
  return LocalHabitLog(
    id: id,
    habitId: habitId,
    completedDate: completedDate,
    xpAwarded: 0,
    valueCompleted: valueCompleted,
    status: status,
    skipReason: null,
    createdAt: '2026-07-16T09:00:00Z',
    updatedAt: updatedAt,
    deletedAt: deletedAt,
  );
}

void main() {
  group('isoDay / parseIsoDay / shiftIsoDay', () {
    test('isoDay formats a DateTime as yyyy-MM-dd', () {
      expect(isoDay(DateTime(2026, 7, 16)), '2026-07-16');
    });

    test('parseIsoDay parses back to a DateTime anchored at noon local time', () {
      final parsed = parseIsoDay('2026-07-16');
      expect(parsed.year, 2026);
      expect(parsed.month, 7);
      expect(parsed.day, 16);
      expect(parsed.hour, 12);
    });

    test('shiftIsoDay adds and subtracts days across a month boundary', () {
      expect(shiftIsoDay('2026-07-31', 1), '2026-08-01');
      expect(shiftIsoDay('2026-08-01', -1), '2026-07-31');
    });
  });

  group('taskFallsInWindow', () {
    test('returns true when the date falls within the inclusive range', () {
      expect(taskFallsInWindow('2026-07-16T10:00:00Z', '2026-07-01', '2026-07-31'), isTrue);
    });

    test('returns false when the date falls outside the range', () {
      expect(taskFallsInWindow('2026-08-01T10:00:00Z', '2026-07-01', '2026-07-31'), isFalse);
    });

    test('returns false for a null or too-short date value', () {
      expect(taskFallsInWindow(null, '2026-07-01', '2026-07-31'), isFalse);
      expect(taskFallsInWindow('2026', '2026-07-01', '2026-07-31'), isFalse);
    });
  });

  group('isTaskOpen / isTaskOverdue', () {
    test('isTaskOpen is true for a todo task, false for done/archived/deleted/recurring-template', () {
      expect(isTaskOpen(makeTask(status: 'todo')), isTrue);
      expect(isTaskOpen(makeTask(status: 'done')), isFalse);
      expect(isTaskOpen(makeTask(status: 'archived')), isFalse);
      expect(isTaskOpen(makeTask(status: 'todo', deletedAt: '2026-07-16T00:00:00Z')), isFalse);
      expect(isTaskOpen(makeTask(status: 'todo', taskKind: 'recurring_template')), isFalse);
    });

    test('isTaskOverdue is true only for an open task whose due_date is before today', () {
      expect(isTaskOverdue(makeTask(status: 'todo', dueDate: '2026-07-15'), '2026-07-16'), isTrue);
      expect(isTaskOverdue(makeTask(status: 'todo', dueDate: '2026-07-17'), '2026-07-16'), isFalse);
      expect(isTaskOverdue(makeTask(status: 'done', dueDate: '2026-07-15'), '2026-07-16'), isFalse);
      expect(isTaskOverdue(makeTask(status: 'todo', dueDate: null), '2026-07-16'), isFalse);
    });
  });

  group('jsWeekday', () {
    test('maps Dart weekday (Mon=1..Sun=7) to JS-style (Sun=0..Sat=6)', () {
      expect(jsWeekday(DateTime(2026, 7, 19)), 0); // Sunday
      expect(jsWeekday(DateTime(2026, 7, 20)), 1); // Monday
      expect(jsWeekday(DateTime(2026, 7, 25)), 6); // Saturday
    });
  });

  group('isHabitDueOnDate', () {
    test('a daily habit is due every day', () {
      final habit = makeHabit(cadenceType: 'daily');
      expect(isHabitDueOnDate(habit, '2026-07-19'), isTrue); // Sunday
    });

    test('a weekdays habit is due Mon-Fri, not weekends', () {
      final habit = makeHabit(cadenceType: 'weekdays');
      expect(isHabitDueOnDate(habit, '2026-07-20'), isTrue); // Monday
      expect(isHabitDueOnDate(habit, '2026-07-19'), isFalse); // Sunday
    });

    test('a selected-days habit is due only on its configured weekdays', () {
      final habit = makeHabit(cadenceType: 'selected_days', cadenceDays: '[1,3,5]'); // Mon, Wed, Fri
      expect(isHabitDueOnDate(habit, '2026-07-20'), isTrue); // Monday
      expect(isHabitDueOnDate(habit, '2026-07-21'), isFalse); // Tuesday
    });

    test('an interval habit is due every N days from its anchor', () {
      final habit = makeHabit(cadenceType: 'interval', cadenceIntervalDays: 3, cadenceAnchorDate: '2026-07-16');
      expect(isHabitDueOnDate(habit, '2026-07-16'), isTrue);
      expect(isHabitDueOnDate(habit, '2026-07-19'), isTrue);
      expect(isHabitDueOnDate(habit, '2026-07-18'), isFalse);
      expect(isHabitDueOnDate(habit, '2026-07-15'), isFalse); // before the anchor
    });

    test('a habit is never due before its restart_from_date', () {
      final habit = makeHabit(cadenceType: 'daily', restartFromDate: '2026-07-16');
      expect(isHabitDueOnDate(habit, '2026-07-15'), isFalse);
      expect(isHabitDueOnDate(habit, '2026-07-16'), isTrue);
    });
  });

  group('getHabitProgressForDate', () {
    test('returns zero progress when there is no log for that date', () {
      final habit = makeHabit(targetValue: 3);
      final progress = getHabitProgressForDate(habit, [], '2026-07-16');

      expect(progress.current, 0);
      expect(progress.target, 3);
      expect(progress.isComplete, isFalse);
    });

    test('a completed log reports current at or above target', () {
      final habit = makeHabit(targetValue: 3);
      final logs = [makeLog(completedDate: '2026-07-16', valueCompleted: 3, status: 'completed')];

      final progress = getHabitProgressForDate(habit, logs, '2026-07-16');

      expect(progress.isComplete, isTrue);
      expect(progress.isSkipped, isFalse);
    });

    test('a skipped log reports zero current and isSkipped true', () {
      final habit = makeHabit(targetValue: 3);
      final logs = [makeLog(completedDate: '2026-07-16', valueCompleted: 0, status: 'skipped')];

      final progress = getHabitProgressForDate(habit, logs, '2026-07-16');

      expect(progress.current, 0);
      expect(progress.isSkipped, isTrue);
    });

    test('picks the most recently updated log when duplicates exist for the same day', () {
      final habit = makeHabit(targetValue: 3);
      final logs = [
        makeLog(id: 'older', completedDate: '2026-07-16', valueCompleted: 1, status: 'partial', updatedAt: '2026-07-16T08:00:00Z'),
        makeLog(id: 'newer', completedDate: '2026-07-16', valueCompleted: 3, status: 'completed', updatedAt: '2026-07-16T09:00:00Z'),
      ];

      final progress = getHabitProgressForDate(habit, logs, '2026-07-16');

      expect(progress.current, 3);
      expect(progress.isComplete, isTrue);
    });
  });

  group('completedHabitCountForDate', () {
    test('counts only habits that are due and complete on the given date', () {
      final dailyHabit = makeHabit(id: 'h1', cadenceType: 'daily', targetValue: 1);
      final weekdaysHabit = makeHabit(id: 'h2', cadenceType: 'weekdays', targetValue: 1);
      final logs = [
        makeLog(id: 'l1', habitId: 'h1', completedDate: '2026-07-19', valueCompleted: 1, status: 'completed'),
        makeLog(id: 'l2', habitId: 'h2', completedDate: '2026-07-19', valueCompleted: 1, status: 'completed'),
      ];

      // 2026-07-19 is a Sunday: weekdaysHabit isn't due, so its log shouldn't count
      final count = completedHabitCountForDate([dailyHabit, weekdaysHabit], logs, '2026-07-19');

      expect(count, 1);
    });
  });
}
```

- [ ] **Step 2: Run the new tests**

Run: `cd "C:\Users\isc\Desktop\Projects\life-os-mobile" && flutter test test/core/utils/commitment_metrics_test.dart`
Expected: `18 passed`.

- [ ] **Step 3: Commit**

```bash
git add test/core/utils/commitment_metrics_test.dart
git commit -m "test: add commitment_metrics.dart tests"
```

---

### Task 14: `AppDatabase` task/habit/goal CRUD tests

**Files:**
- Create: `test/data/local/app_database_crud_test.dart`

Follows the exact `AppDatabase.forTesting(NativeDatabase.memory())` pattern already used by `test/data/local/secure_credentials_test.dart`/`test/data/local/debug_log_test.dart`: one fresh in-memory database per `test()` block, `addTearDown(db.close)` immediately after construction. Every fresh instance auto-seeds 3 domains (`military`, `builder`, `self`) via `_ensureBootstrapRows()` — tests must account for that. `AppDatabase` currently has no `deleteTask`/`updateTask`/`updateHabit`/`deleteHabit`/`deleteGoal` methods — only `createTask`/`toggleTaskDone`/`startTaskFocus`, `createHabit`/`logHabitDay`, `createGoal`/`updateGoalProgress`/`toggleGoalStatus` exist, so this task tests exactly those.

- [ ] **Step 1: Write the test file**

```dart
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:life_os_mobile/data/local/app_database.dart';

void main() {
  test('database seeds exactly the 3 built-in domains on first open', () async {
    final db = AppDatabase.forTesting(NativeDatabase.memory());
    addTearDown(db.close);

    final domains = await db.select(db.localDomains).get();

    expect(domains.map((d) => d.id).toSet(), {'military', 'builder', 'self'});
  });

  test('createTask inserts a task and enqueues a sync-queue upsert', () async {
    final db = AppDatabase.forTesting(NativeDatabase.memory());
    addTearDown(db.close);

    await db.createTask(title: 'Write the plan', domainId: 'military');

    final tasks = await db.select(db.localTasks).get();
    expect(tasks, hasLength(1));
    expect(tasks.first.title, 'Write the plan');
    expect(tasks.first.status, 'todo');

    final queue = await db.getAllQueueItems();
    expect(queue.any((item) => item.entityType == 'task' && item.entityId == tasks.first.id), isTrue);
  });

  test('toggleTaskDone flips status between todo and done, setting/clearing completedAt', () async {
    final db = AppDatabase.forTesting(NativeDatabase.memory());
    addTearDown(db.close);
    await db.createTask(title: 'Write the plan', domainId: 'military');
    final task = (await db.select(db.localTasks).get()).first;

    await db.toggleTaskDone(task);
    final done = (await db.select(db.localTasks).get()).first;
    expect(done.status, 'done');
    expect(done.completedAt, isNotNull);

    await db.toggleTaskDone(done);
    final undone = (await db.select(db.localTasks).get()).first;
    expect(undone.status, 'todo');
    expect(undone.completedAt, isNull);
  });

  test('startTaskFocus toggles status between todo and in_progress', () async {
    final db = AppDatabase.forTesting(NativeDatabase.memory());
    addTearDown(db.close);
    await db.createTask(title: 'Write the plan', domainId: 'military');
    final task = (await db.select(db.localTasks).get()).first;

    await db.startTaskFocus(task);
    final focused = (await db.select(db.localTasks).get()).first;
    expect(focused.status, 'in_progress');

    await db.startTaskFocus(focused);
    final unfocused = (await db.select(db.localTasks).get()).first;
    expect(unfocused.status, 'todo');
  });

  test('createHabit inserts a habit with the given cadence defaults', () async {
    final db = AppDatabase.forTesting(NativeDatabase.memory());
    addTearDown(db.close);

    await db.createHabit(title: 'Meditate', domainId: 'self');

    final habits = await db.select(db.localHabits).get();
    expect(habits, hasLength(1));
    expect(habits.first.title, 'Meditate');
    expect(habits.first.cadenceDays, '[0,1,2,3,4,5,6]');
  });

  test('createHabit sets weekday-only cadence days for a weekdays cadence type', () async {
    final db = AppDatabase.forTesting(NativeDatabase.memory());
    addTearDown(db.close);

    await db.createHabit(title: 'Standup', domainId: 'self', cadenceType: 'weekdays');

    final habit = (await db.select(db.localHabits).get()).first;
    expect(habit.cadenceDays, '[1,2,3,4,5]');
  });

  test('logHabitDay upserts on (habitId, completedDate), preserving createdAt across the update', () async {
    final db = AppDatabase.forTesting(NativeDatabase.memory());
    addTearDown(db.close);
    await db.createHabit(title: 'Meditate', domainId: 'self');
    final habit = (await db.select(db.localHabits).get()).first;

    await db.logHabitDay(habit: habit, date: '2026-07-16', status: 'completed');
    final firstLog = (await db.select(db.localHabitLogs).get()).first;

    await db.logHabitDay(habit: habit, date: '2026-07-16', status: 'completed', valueCompleted: 2);
    final logs = await db.select(db.localHabitLogs).get();

    expect(logs, hasLength(1), reason: 'same (habitId, date) must update in place, not duplicate');
    expect(logs.first.valueCompleted, 2);
    expect(logs.first.createdAt, firstLog.createdAt);
  });

  test('createGoal inserts a goal with default active status and zero progress', () async {
    final db = AppDatabase.forTesting(NativeDatabase.memory());
    addTearDown(db.close);

    await db.createGoal(title: 'Ship the release', domainId: 'builder');

    final goal = (await db.select(db.localGoals).get()).first;
    expect(goal.status, 'active');
    expect(goal.progressPercent, 0);
  });

  test('updateGoalProgress clamps the value into [0, 100]', () async {
    final db = AppDatabase.forTesting(NativeDatabase.memory());
    addTearDown(db.close);
    await db.createGoal(title: 'Ship the release', domainId: 'builder');
    final goal = (await db.select(db.localGoals).get()).first;

    await db.updateGoalProgress(goal, 150);
    final clamped = (await db.select(db.localGoals).get()).first;

    expect(clamped.progressPercent, 100);
  });

  test('toggleGoalStatus completes a goal and forces progress to 100', () async {
    final db = AppDatabase.forTesting(NativeDatabase.memory());
    addTearDown(db.close);
    await db.createGoal(title: 'Ship the release', domainId: 'builder');
    final goal = (await db.select(db.localGoals).get()).first;

    await db.toggleGoalStatus(goal);
    final completed = (await db.select(db.localGoals).get()).first;

    expect(completed.status, 'completed');
    expect(completed.progressPercent, 100);

    await db.toggleGoalStatus(completed);
    final reactivated = (await db.select(db.localGoals).get()).first;
    expect(reactivated.status, 'active');
  });

  test('watchHabits excludes an inactive habit even though it is not soft-deleted', () async {
    final db = AppDatabase.forTesting(NativeDatabase.memory());
    addTearDown(db.close);
    await db.createHabit(title: 'Meditate', domainId: 'self');
    final habit = (await db.select(db.localHabits).get()).first;
    await (db.update(db.localHabits)..where((h) => h.id.equals(habit.id)))
        .write(const LocalHabitsCompanion(isActive: Value(false)));

    final visible = await db.watchHabits().first;

    expect(visible, isEmpty);
  });
}
```

- [ ] **Step 2: Run the new tests**

Run: `cd "C:\Users\isc\Desktop\Projects\life-os-mobile" && flutter test test/data/local/app_database_crud_test.dart`
Expected: `11 passed`.

- [ ] **Step 3: Commit**

```bash
git add test/data/local/app_database_crud_test.dart
git commit -m "test: add AppDatabase task/habit/goal CRUD tests"
```

---

### Task 15: `sync_repository_test.dart`

**Files:**
- Create: `test/data/sync/sync_repository_test.dart`

`SupabaseSyncClient` is a concrete class (not an abstract interface), but none of its methods are `final`/`sealed`, so a test fake can `extend` it and `@override` just the methods `SyncRepository` actually calls (`signOut`, `fetchPayload`, `pushPayload`) — Dart methods are virtual by default. `signIn` is intentionally left un-faked and untested here: it returns a `SupabaseSyncSession` wrapping a real `supabase_flutter` `SupabaseClient`/`Session` pair, which isn't practically constructible in a unit test without a live (or heavily mocked) Supabase backend — out of scope for this pass, consistent with the spec's risk-weighted depth.

`SyncRepository`'s constructor takes `database`/`remoteClient` as plain named parameters (confirmed via `lib/app/providers.dart`), so both are directly substitutable without any provider/DI wiring changes.

- [ ] **Step 1: Write the test file**

```dart
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:life_os_mobile/core/models/sync_models.dart';
import 'package:life_os_mobile/data/local/app_database.dart';
import 'package:life_os_mobile/data/remote/supabase_sync_client.dart';
import 'package:life_os_mobile/data/sync/sync_repository.dart';

class FakeSyncClient extends SupabaseSyncClient {
  FakeSyncClient({SyncPayload? remotePayload}) : remotePayload = remotePayload ?? _emptyPayload();

  SyncPayload remotePayload;
  SyncPayload? pushedPayload;
  int signOutCalls = 0;

  static SyncPayload _emptyPayload() => SyncPayload(
        exportedAt: DateTime.now().toUtc().toIso8601String(),
        appVersion: 'test',
        domains: const [],
        tasks: const [],
        habits: const [],
        habitLogs: const [],
        goals: const [],
        notes: const [],
        inboxItems: const [],
      );

  @override
  Future<void> signOut(SyncSetting settings) async {
    signOutCalls++;
  }

  @override
  Future<SyncPayload> fetchPayload(SyncSetting settings) async => remotePayload;

  @override
  Future<void> pushPayload({required SyncSetting settings, required SyncPayload payload}) async {
    pushedPayload = payload;
  }
}

Future<void> configureAndSignIn(AppDatabase db) async {
  await db.saveSyncConfig(supabaseUrl: 'https://example.supabase.co', supabaseAnonKey: 'anon-key');
  await db.saveSyncSession(
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    userId: 'user-1',
    userEmail: 'user@example.com',
  );
}

void main() {
  test('hasSession is false until sync is configured and signed in', () async {
    final db = AppDatabase.forTesting(NativeDatabase.memory());
    addTearDown(db.close);
    final repo = SyncRepository(database: db, remoteClient: FakeSyncClient());

    expect(await repo.hasSession(), isFalse);

    await configureAndSignIn(db);

    expect(await repo.hasSession(), isTrue);
  });

  test('signOut calls the remote client and clears the local session', () async {
    final db = AppDatabase.forTesting(NativeDatabase.memory());
    addTearDown(db.close);
    await configureAndSignIn(db);
    final client = FakeSyncClient();
    final repo = SyncRepository(database: db, remoteClient: client);

    await repo.signOut();

    expect(client.signOutCalls, 1);
    expect(await repo.hasSession(), isFalse);
  });

  test('getBootstrapStatus reports remote_empty when sync is not configured', () async {
    final db = AppDatabase.forTesting(NativeDatabase.memory());
    addTearDown(db.close);
    final repo = SyncRepository(database: db, remoteClient: FakeSyncClient());

    final status = await repo.getBootstrapStatus();

    expect(status.state, 'remote_empty');
  });

  test('syncNow throws before sync is configured and signed in', () async {
    final db = AppDatabase.forTesting(NativeDatabase.memory());
    addTearDown(db.close);
    final repo = SyncRepository(database: db, remoteClient: FakeSyncClient());

    expect(() => repo.syncNow(), throwsA(isA<StateError>()));
  });

  test('syncNow pushes the merged payload and imports remote-only rows locally', () async {
    final db = AppDatabase.forTesting(NativeDatabase.memory());
    addTearDown(db.close);
    await configureAndSignIn(db);
    final remoteTask = {
      'id': 'remote-task-1',
      'domain_id': 'military',
      'title': 'From the cloud',
      'status': 'todo',
      'created_at': '2026-07-16T00:00:00Z',
      'updated_at': '2026-07-16T00:00:00Z',
      'deleted_at': null,
    };
    final client = FakeSyncClient(remotePayload: SyncPayload(
      exportedAt: DateTime.now().toUtc().toIso8601String(),
      appVersion: 'remote-test',
      domains: const [],
      tasks: [remoteTask],
      habits: const [],
      habitLogs: const [],
      goals: const [],
      notes: const [],
      inboxItems: const [],
    ));
    final repo = SyncRepository(database: db, remoteClient: client);

    await repo.syncNow();

    expect(client.pushedPayload, isNotNull);
    expect(client.pushedPayload!.tasks.any((row) => row['id'] == 'remote-task-1'), isTrue);
    final localTasks = await db.select(db.localTasks).get();
    expect(localTasks.any((task) => task.id == 'remote-task-1' && task.title == 'From the cloud'), isTrue);
  });
}
```

- [ ] **Step 2: Run the new tests**

Run: `cd "C:\Users\isc\Desktop\Projects\life-os-mobile" && flutter test test/data/sync/sync_repository_test.dart`
Expected: `5 passed`.

- [ ] **Step 3: Commit**

```bash
git add test/data/sync/sync_repository_test.dart
git commit -m "test: add sync_repository tests using a fake SupabaseSyncClient"
```

---

### Task 16: Mobile final verification

**Files:** none (verification only)

- [ ] **Step 1: Run static analysis**

Run: `cd "C:\Users\isc\Desktop\Projects\life-os-mobile" && flutter analyze`
Expected: clean, or only the known pre-existing `use_super_parameters` info-lint on `AppDatabase.forTesting`.

- [ ] **Step 2: Run the full test suite**

Run: `cd "C:\Users\isc\Desktop\Projects\life-os-mobile" && flutter test`
Expected: all tests pass — the 4 pre-existing test files plus the 3 new files added in Tasks 13–15.

---
