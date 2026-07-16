# Remove XP/Level/Achievement System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove XP, domain levels, and achievements entirely from both the desktop and mobile apps, keeping streaks and momentum working exactly as they do today, with no database columns or tables dropped (additive-only, matching this codebase's existing migration convention).

**Architecture:** This is a removal, not a new feature — there is no new architecture. Work proceeds in dependency order: desktop Rust commands/structs first (self-contained, nothing else depends on removing them), then desktop frontend (deletes dead-code definition files, then strips the files that reference them), then mobile (three display-only edits), then documentation.

**Tech Stack:** Rust/rusqlite/Tauri (desktop backend), React/TypeScript/Zustand (desktop frontend), Dart/Flutter (mobile).

---

## Desktop (Rust)

### Task 1: Remove achievement commands, struct, and table usage

**Files:**
- Modify: `src-tauri/src/commands.rs`

- [ ] **Step 1: Delete the `Achievement` struct**

Delete lines 469-477:

```rust
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Achievement {
    pub id: String,
    pub title: String,
    pub description: String,
    pub icon: String,
    pub unlocked: bool,
    pub unlocked_at: Option<String>,
}
```

- [ ] **Step 2: Delete the `get_achievements` and `unlock_achievement` commands**

Delete the full `// ─── Achievements ───...` section (lines 4240-4287):

```rust
// ─── Achievements ─────────────────────────────────────────────────────────────

#[tauri::command]
pub fn get_achievements(state: State<'_, DbState>) -> Result<Vec<Achievement>, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    let mut stmt = conn.prepare(
        "SELECT id, title, description, icon, unlocked, unlocked_at FROM achievements"
    ).map_err(|e| e.to_string())?;

    let achievements = stmt.query_map([], |row| {
        Ok(Achievement {
            id: row.get(0)?,
            title: row.get(1)?,
            description: row.get(2)?,
            icon: row.get(3)?,
            unlocked: row.get::<_, i64>(4)? != 0,
            unlocked_at: row.get(5)?,
        })
    }).map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())?;

    Ok(achievements)
}

#[tauri::command]
pub fn unlock_achievement(state: State<'_, DbState>, id: String) -> Result<Achievement, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE achievements SET unlocked = 1, unlocked_at = ?1 WHERE id = ?2 AND unlocked = 0",
        params![now, id],
    ).map_err(|e| e.to_string())?;

    conn.query_row(
        "SELECT id, title, description, icon, unlocked, unlocked_at FROM achievements WHERE id = ?1",
        params![id],
        |row| Ok(Achievement {
            id: row.get(0)?,
            title: row.get(1)?,
            description: row.get(2)?,
            icon: row.get(3)?,
            unlocked: row.get::<_, i64>(4)? != 0,
            unlocked_at: row.get(5)?,
        })
    ).map_err(|e| e.to_string())
}

```

Leave the `// ─── App State ───...` comment that follows (was line 4289) as the next section header.

- [ ] **Step 3: Remove `achievements` from `load_export_payload`**

In `load_export_payload`, delete this block (currently lines 1163-1178, immediately before `let notes = {`):

```rust
    let achievements = {
        let mut stmt = conn.prepare(
            "SELECT id, title, description, icon, unlocked, unlocked_at FROM achievements"
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], |row| {
            Ok(Achievement {
                id: row.get(0)?,
                title: row.get(1)?,
                description: row.get(2)?,
                icon: row.get(3)?,
                unlocked: row.get::<_, i64>(4)? != 0,
                unlocked_at: row.get(5)?,
            })
        }).map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
    };

```

Then find the `ExportPayload { ... }` struct literal later in the same function and remove the `achievements,` field from it (leave every other field as-is).

- [ ] **Step 4: Remove `achievements` from `import_payload_into_db`**

In the delete-batch inside `import_payload_into_db` (around line 2029), remove this line from the `tx.execute_batch("...")` string:

```sql
        DELETE FROM achievements;
```

Then delete this whole loop (currently lines 2218-2231, immediately before `for note in payload.notes {`):

```rust
    for achievement in payload.achievements {
        tx.execute(
            "INSERT INTO achievements (id, title, description, icon, unlocked, unlocked_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                achievement.id,
                achievement.title,
                achievement.description,
                achievement.icon,
                achievement.unlocked as i64,
                achievement.unlocked_at
            ],
        ).map_err(|e| e.to_string())?;
    }

```

- [ ] **Step 5: Remove `achievements` from `ExportPayload` and `ImportPayload`**

In the `ExportPayload` struct (around line 706), remove:
```rust
    achievements: Vec<Achievement>,
```

In the `ImportPayload` struct (around line 726), remove:
```rust
    #[serde(default)]
    achievements: Vec<Achievement>,
```

- [ ] **Step 6: Remove the achievements line from `reset_all_data`**

In `reset_all_data`'s `execute_batch` (around line 4701), remove this line:

```sql
        UPDATE achievements SET unlocked = 0, unlocked_at = NULL;
```

- [ ] **Step 7: Verify it compiles**

Run: `cd "C:\Users\isc\Desktop\Projects\Life OS\src-tauri" && cargo check`
Expected: fails to compile — `BackupCounts.achievements` and `preview_from_export_payload`/`build_backup_counts` still reference `.achievements` on `ExportPayload`/`ImportPayload`, which no longer exists. This is expected; Task 4 removes those. Confirm the ONLY errors are about `.achievements` (not about anything from Steps 1-6 themselves) — if there are other errors, something in this task was applied incorrectly.

- [ ] **Step 8: Commit**

```bash
git add src-tauri/src/commands.rs
git commit -m "feat: remove achievement commands, struct, and table usage from Rust backend"
```

This task is expected to leave the crate in a temporarily non-compiling state (fixed by Task 4) — this is normal for a removal spanning multiple structs with cross-references; commit anyway so the diff stays reviewable in small pieces.

---

### Task 2: Remove XP-events commands, structs, and table usage

**Files:**
- Modify: `src-tauri/src/commands.rs`

- [ ] **Step 1: Delete the `XpEvent` struct**

Delete lines 458-467:

```rust
pub struct XpEvent {
    pub id: String,
    pub domain_id: String,
    pub source_type: String,
    pub source_id: String,
    pub xp_amount: i64,
    pub ai_scored: bool,
    pub ai_reasoning: Option<String>,
    pub created_at: String,
}
```

(The `#[derive(...)]` line immediately above it, shared with nothing else, goes too — confirm by reading the line above line 458 before deleting; it should be a `#[derive(Debug, Serialize, Deserialize, Clone)]` line belonging only to `XpEvent`.)

- [ ] **Step 2: Delete `get_xp_events`, `get_xp_events_by_domain_and_range`, and `claim_recovery_bonus`**

Delete the full `// ─── XP Events ───...` section (lines 4148-4238):

```rust
// ─── XP Events ────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn get_xp_events(state: State<'_, DbState>, limit: i64) -> Result<Vec<XpEvent>, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    let mut stmt = conn.prepare(
        "SELECT id, domain_id, source_type, source_id, xp_amount, ai_scored, ai_reasoning, created_at FROM xp_events ORDER BY created_at DESC LIMIT ?1"
    ).map_err(|e| e.to_string())?;

    let events = stmt.query_map(params![limit], |row| {
        Ok(XpEvent {
            id: row.get(0)?,
            domain_id: row.get(1)?,
            source_type: row.get(2)?,
            source_id: row.get(3)?,
            xp_amount: row.get(4)?,
            ai_scored: row.get::<_, i64>(5)? != 0,
            ai_reasoning: row.get(6)?,
            created_at: row.get(7)?,
        })
    }).map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())?;

    Ok(events)
}

#[tauri::command]
pub fn get_xp_events_by_domain_and_range(state: State<'_, DbState>, domain_id: String, start_date: String, end_date: String) -> Result<Vec<XpEvent>, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    let mut stmt = conn.prepare(
        "SELECT id, domain_id, source_type, source_id, xp_amount, ai_scored, ai_reasoning, created_at FROM xp_events WHERE domain_id = ?1 AND created_at >= ?2 AND created_at <= ?3 ORDER BY created_at DESC"
    ).map_err(|e| e.to_string())?;

    let events = stmt.query_map(params![domain_id, start_date, end_date], |row| {
        Ok(XpEvent {
            id: row.get(0)?,
            domain_id: row.get(1)?,
            source_type: row.get(2)?,
            source_id: row.get(3)?,
            xp_amount: row.get(4)?,
            ai_scored: row.get::<_, i64>(5)? != 0,
            ai_reasoning: row.get(6)?,
            created_at: row.get(7)?,
        })
    }).map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())?;

    Ok(events)
}

#[tauri::command]
pub fn claim_recovery_bonus(state: State<'_, DbState>, domain_id: String, source_id: String, xp_amount: i64) -> Result<Domain, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    let exists: i64 = conn.query_row(
        "SELECT COUNT(*) FROM xp_events WHERE source_type = 'bonus' AND source_id = ?1",
        params![source_id],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;

    if exists > 0 {
        return get_domain_by_id(&conn, &domain_id);
    }

    let event_id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO xp_events (id, domain_id, source_type, source_id, xp_amount, ai_scored, ai_reasoning, created_at)
         VALUES (?1, ?2, 'bonus', ?3, ?4, 0, ?5, ?6)",
        params![event_id, domain_id, source_id, xp_amount, Some("Recovery bonus".to_string()), now],
    ).map_err(|e| e.to_string())?;

    conn.execute(
        "UPDATE domains SET xp_total = xp_total + ?1 WHERE id = ?2",
        params![xp_amount, domain_id],
    ).map_err(|e| e.to_string())?;

    let total_xp: i64 = conn.query_row(
        "SELECT xp_total FROM domains WHERE id = ?1",
        params![domain_id],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;
    let level = xp_to_level(total_xp);
    conn.execute(
        "UPDATE domains SET level = ?1 WHERE id = ?2",
        params![level, domain_id],
    ).map_err(|e| e.to_string())?;

    get_domain_by_id(&conn, &domain_id)
}

```

Do NOT delete the `xp_to_level` function itself yet — `update_domain_xp` (Task 3) still calls it. It becomes safe to remove once Task 3 also removes `update_domain_xp`.

- [ ] **Step 3: Delete `get_daily_xp` and the `DailyXp` struct**

Delete lines 4611-4643 (the `// ─── Analytics ───` comment stays — it also introduces `TaskStats`, which is unrelated and must survive):

```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct DailyXp {
    pub date: String,
    pub domain_id: String,
    pub xp: i64,
}

#[tauri::command]
pub fn get_daily_xp(state: State<'_, DbState>, days: i64) -> Result<Vec<DailyXp>, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    let start = chrono::Utc::now()
        .checked_sub_signed(chrono::Duration::days(days))
        .map(|d| d.format("%Y-%m-%d").to_string())
        .unwrap_or_default();

    let mut stmt = conn.prepare(
        "SELECT substr(created_at, 1, 10) as date, domain_id, SUM(xp_amount) as xp FROM xp_events WHERE date >= ?1 GROUP BY date, domain_id ORDER BY date ASC"
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map(params![start], |row| {
        Ok(DailyXp {
            date: row.get(0)?,
            domain_id: row.get(1)?,
            xp: row.get(2)?,
        })
    }).map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())?;

    Ok(rows)
}

```

- [ ] **Step 4: Remove `xp_events` from `load_export_payload`**

Delete this block (currently lines 1284-1301, immediately before `let mut app_state = read_app_state_row(conn)?;`):

```rust
    let xp_events = {
        let mut stmt = conn.prepare(
            "SELECT id, domain_id, source_type, source_id, xp_amount, ai_scored, ai_reasoning, created_at FROM xp_events ORDER BY created_at DESC"
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], |row| {
            Ok(XpEvent {
                id: row.get(0)?,
                domain_id: row.get(1)?,
                source_type: row.get(2)?,
                source_id: row.get(3)?,
                xp_amount: row.get(4)?,
                ai_scored: row.get::<_, i64>(5)? != 0,
                ai_reasoning: row.get(6)?,
                created_at: row.get(7)?,
            })
        }).map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
    };

```

Then find the `ExportPayload { ... }` struct literal later in the same function and remove the `xp_events,` field from it.

- [ ] **Step 5: Remove `xp_events` from `import_payload_into_db`**

In the delete-batch (around line 2022), remove this line:

```sql
        DELETE FROM xp_events;
```

Then delete this whole loop (currently lines 2201-2216, immediately before the achievements loop removed in Task 1):

```rust
    for xp_event in payload.xp_events {
        tx.execute(
            "INSERT INTO xp_events (id, domain_id, source_type, source_id, xp_amount, ai_scored, ai_reasoning, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                xp_event.id,
                xp_event.domain_id,
                xp_event.source_type,
                xp_event.source_id,
                xp_event.xp_amount,
                xp_event.ai_scored as i64,
                xp_event.ai_reasoning,
                xp_event.created_at
            ],
        ).map_err(|e| e.to_string())?;
    }

```

- [ ] **Step 6: Remove `xp_events` from `ExportPayload` and `ImportPayload`**

In `ExportPayload`, remove:
```rust
    xp_events: Vec<XpEvent>,
```

In `ImportPayload`, remove:
```rust
    #[serde(default)]
    xp_events: Vec<XpEvent>,
```

- [ ] **Step 7: Remove the xp_events line from `reset_all_data`**

In `reset_all_data`'s `execute_batch` (around line 4694), remove this line:

```sql
        DELETE FROM xp_events;
```

- [ ] **Step 8: Remove the dead XP cleanup block in `undo_habit_log`**

In `undo_habit_log`, delete this block (currently lines 3952-3967 — it is already unreachable dead code, since `record_habit_day` always writes `xp_awarded = 0`, so `log.xp_awarded > 0` can never be true):

```rust
    if log.xp_awarded > 0 {
        conn.execute(
            "DELETE FROM xp_events
             WHERE id IN (
                SELECT id
                FROM xp_events
                WHERE source_type = 'habit'
                  AND source_id = ?1
                  AND xp_amount = ?2
                  AND created_at = ?3
                ORDER BY created_at DESC
                LIMIT 1
             )",
            params![habit_id, log.xp_awarded, log.created_at.clone()],
        ).map_err(|e| e.to_string())?;
    }

```

- [ ] **Step 9: Clean up `delete_domain`'s linked-data guard**

In `delete_domain` (lines 2476-2501), remove the `xp_events` count query:

```rust
    let xp_events: i64 = conn.query_row("SELECT COUNT(*) FROM xp_events WHERE domain_id = ?1", params![id], |row| row.get(0)).map_err(|e| e.to_string())?;
```

And update the guard condition and error message from:

```rust
    if tasks + habits + goals + xp_events + notes + inbox_items + templates > 0 {
        return Err(format!(
            "Domain still has linked data (tasks: {tasks}, habits: {habits}, goals: {goals}, xp: {xp_events}, notes: {notes}, inbox: {inbox_items}, templates: {templates}). Move or clear that data before deleting the domain."
        ));
    }
```

to:

```rust
    if tasks + habits + goals + notes + inbox_items + templates > 0 {
        return Err(format!(
            "Domain still has linked data (tasks: {tasks}, habits: {habits}, goals: {goals}, notes: {notes}, inbox: {inbox_items}, templates: {templates}). Move or clear that data before deleting the domain."
        ));
    }
```

- [ ] **Step 10: Verify it compiles**

Run: `cd "C:\Users\isc\Desktop\Projects\Life OS\src-tauri" && cargo check`
Expected: still fails (same `.achievements`/`.xp_events` references in `build_backup_counts`/`preview_from_export_payload`/`BackupCounts` as before, plus now also `xp_to_level` reported as dead code via a warning, not an error — warnings are fine at this stage). Confirm no NEW error classes appeared beyond what Task 1 already left outstanding.

- [ ] **Step 11: Commit**

```bash
git add src-tauri/src/commands.rs
git commit -m "feat: remove XP event commands, structs, and table usage from Rust backend"
```

---

### Task 3: Remove `Domain.xp_total`/`.level`

**Files:**
- Modify: `src-tauri/src/commands.rs`

This is the highest-risk task in the plan — `Domain` rows are built positionally (`row.get(N)` by index), so every one of the 7 call sites below must have its column list AND its index numbers updated together, consistently. Work through every site in this task; do not skip any or the crate won't compile (a missing site is caught by `cargo check`, but a site edited *inconsistently* — e.g. column list updated but indices not — could compile while silently reading the wrong column into the wrong field, so follow each replacement exactly as given).

- [ ] **Step 1: Remove `xp_to_level` and the `update_domain_xp` command**

Delete lines 2503-2537:

```rust
#[tauri::command]
pub fn update_domain_xp(state: State<'_, DbState>, domain_id: String, xp_delta: i64) -> Result<Domain, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE domains SET xp_total = xp_total + ?1, updated_at = ?2 WHERE id = ?3",
        params![xp_delta, now, domain_id],
    ).map_err(|e| e.to_string())?;

    // Recalculate level (based on XP thresholds)
    let xp_total: i64 = conn.query_row(
        "SELECT xp_total FROM domains WHERE id = ?1",
        params![domain_id],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;

    let level = xp_to_level(xp_total);
    conn.execute(
        "UPDATE domains SET level = ?1, updated_at = ?2 WHERE id = ?3",
        params![level, now, domain_id],
    ).map_err(|e| e.to_string())?;

    get_domain_by_id(&conn, &domain_id)
}

fn xp_to_level(xp: i64) -> i64 {
    let thresholds = [0, 500, 1200, 2500, 4500, 7500, 12000, 20000, 35000, 60000];
    let mut level = 1i64;
    for threshold in &thresholds {
        if xp >= *threshold {
            level += 1;
        }
    }
    level.min(10)
}

```

- [ ] **Step 2: Remove `xp_total`/`level` from the `Domain` struct**

Change (lines 17-35):

```rust
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Domain {
    pub id: String,
    pub name: String,
    pub icon: String,
    pub color: String,
    #[serde(default)]
    pub created_at: String,
    #[serde(default)]
    pub updated_at: String,
    #[serde(default)]
    pub deleted_at: Option<String>,
    pub xp_total: i64,
    pub level: i64,
    pub streak_current: i64,
    pub streak_longest: i64,
    pub streak_freeze_tokens: i64,
    pub last_activity_date: Option<String>,
}
```

to:

```rust
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Domain {
    pub id: String,
    pub name: String,
    pub icon: String,
    pub color: String,
    #[serde(default)]
    pub created_at: String,
    #[serde(default)]
    pub updated_at: String,
    #[serde(default)]
    pub deleted_at: Option<String>,
    pub streak_current: i64,
    pub streak_longest: i64,
    pub streak_freeze_tokens: i64,
    pub last_activity_date: Option<String>,
}
```

- [ ] **Step 3: `load_export_payload`'s domains block**

Change (currently lines 1115-1137):

```rust
    let domains = {
        let mut stmt = conn.prepare(
            "SELECT id, name, icon, color, created_at, updated_at, deleted_at, xp_total, level, streak_current, streak_longest, streak_freeze_tokens, last_activity_date FROM domains"
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], |row| {
            Ok(Domain {
                id: row.get(0)?,
                name: row.get(1)?,
                icon: row.get(2)?,
                color: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
                deleted_at: row.get(6)?,
                xp_total: row.get(7)?,
                level: row.get(8)?,
                streak_current: row.get(9)?,
                streak_longest: row.get(10)?,
                streak_freeze_tokens: row.get(11)?,
                last_activity_date: row.get(12)?,
            })
        }).map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
    };
```

to:

```rust
    let domains = {
        let mut stmt = conn.prepare(
            "SELECT id, name, icon, color, created_at, updated_at, deleted_at, streak_current, streak_longest, streak_freeze_tokens, last_activity_date FROM domains"
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], |row| {
            Ok(Domain {
                id: row.get(0)?,
                name: row.get(1)?,
                icon: row.get(2)?,
                color: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
                deleted_at: row.get(6)?,
                streak_current: row.get(7)?,
                streak_longest: row.get(8)?,
                streak_freeze_tokens: row.get(9)?,
                last_activity_date: row.get(10)?,
            })
        }).map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
    };
```

- [ ] **Step 4: `load_sync_payload`'s domains block**

Change (currently lines 1378-1400):

```rust
    let domains = {
        let mut stmt = conn.prepare(
            "SELECT id, name, icon, color, created_at, updated_at, deleted_at, xp_total, level, streak_current, streak_longest, streak_freeze_tokens, last_activity_date FROM domains ORDER BY updated_at DESC"
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], |row| {
            Ok(Domain {
                id: row.get(0)?,
                name: row.get(1)?,
                icon: row.get(2)?,
                color: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
                deleted_at: row.get(6)?,
                xp_total: row.get(7)?,
                level: row.get(8)?,
                streak_current: row.get(9)?,
                streak_longest: row.get(10)?,
                streak_freeze_tokens: row.get(11)?,
                last_activity_date: row.get(12)?,
            })
        }).map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
    };
```

to:

```rust
    let domains = {
        let mut stmt = conn.prepare(
            "SELECT id, name, icon, color, created_at, updated_at, deleted_at, streak_current, streak_longest, streak_freeze_tokens, last_activity_date FROM domains ORDER BY updated_at DESC"
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], |row| {
            Ok(Domain {
                id: row.get(0)?,
                name: row.get(1)?,
                icon: row.get(2)?,
                color: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
                deleted_at: row.get(6)?,
                streak_current: row.get(7)?,
                streak_longest: row.get(8)?,
                streak_freeze_tokens: row.get(9)?,
                last_activity_date: row.get(10)?,
            })
        }).map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
    };
```

Note this block is functionally identical in shape to Step 3's edit (same column list, same struct literal) — it's a separate function (`load_sync_payload` vs `load_export_payload`) with its own copy of this query, so both need the edit independently.

- [ ] **Step 5: `import_sync_payload_into_db`'s domains INSERT**

Change (currently lines 1488-1506):

```rust
        tx.execute(
            "INSERT INTO domains (id, name, icon, color, created_at, updated_at, deleted_at, xp_total, level, streak_current, streak_longest, streak_freeze_tokens, last_activity_date)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
            params![
                domain.id,
                domain.name,
                domain.icon,
                domain.color,
                created_at,
                updated_at,
                domain.deleted_at,
                domain.xp_total,
                domain.level,
                domain.streak_current,
                domain.streak_longest,
                domain.streak_freeze_tokens,
                domain.last_activity_date,
            ],
        ).map_err(|e| e.to_string())?;
```

to:

```rust
        tx.execute(
            "INSERT INTO domains (id, name, icon, color, created_at, updated_at, deleted_at, streak_current, streak_longest, streak_freeze_tokens, last_activity_date)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                domain.id,
                domain.name,
                domain.icon,
                domain.color,
                created_at,
                updated_at,
                domain.deleted_at,
                domain.streak_current,
                domain.streak_longest,
                domain.streak_freeze_tokens,
                domain.last_activity_date,
            ],
        ).map_err(|e| e.to_string())?;
```

Note: this INSERT writes into the `domains` table's `xp_total`/`level` SQL columns nothing at all now — SQLite will fall back to each column's `DEFAULT` (`0` and `1` respectively, per the schema in `db.rs`), which is correct and harmless (the columns stay inert, per the design spec).

- [ ] **Step 6: `import_payload_into_db`'s domains INSERT**

Change (currently lines 2041-2060):

```rust
        tx.execute(
            "INSERT INTO domains (id, name, icon, color, created_at, updated_at, deleted_at, xp_total, level, streak_current, streak_longest, streak_freeze_tokens, last_activity_date)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
            params![
                domain.id,
                domain.name,
                domain.icon,
                domain.color,
                created_at,
                if domain.updated_at.trim().is_empty() { created_at.clone() } else { domain.updated_at },
                domain.deleted_at,
                domain.xp_total,
                domain.level,
                domain.streak_current,
                domain.streak_longest,
                domain.streak_freeze_tokens,
                domain.last_activity_date
            ],
        ).map_err(|e| e.to_string())?;
```

to:

```rust
        tx.execute(
            "INSERT INTO domains (id, name, icon, color, created_at, updated_at, deleted_at, streak_current, streak_longest, streak_freeze_tokens, last_activity_date)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                domain.id,
                domain.name,
                domain.icon,
                domain.color,
                created_at,
                if domain.updated_at.trim().is_empty() { created_at.clone() } else { domain.updated_at },
                domain.deleted_at,
                domain.streak_current,
                domain.streak_longest,
                domain.streak_freeze_tokens,
                domain.last_activity_date
            ],
        ).map_err(|e| e.to_string())?;
```

- [ ] **Step 7: `get_domains` command**

Change (currently lines 2385-2414):

```rust
pub fn get_domains(state: State<'_, DbState>) -> Result<Vec<Domain>, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    let mut stmt = conn.prepare(
        "SELECT id, name, icon, color, created_at, updated_at, deleted_at, xp_total, level, streak_current, streak_longest, streak_freeze_tokens, last_activity_date
         FROM domains
         WHERE deleted_at IS NULL"
    ).map_err(|e| e.to_string())?;

    let domains = stmt.query_map([], |row| {
        Ok(Domain {
            id: row.get(0)?,
            name: row.get(1)?,
            icon: row.get(2)?,
            color: row.get(3)?,
            created_at: row.get(4)?,
            updated_at: row.get(5)?,
            deleted_at: row.get(6)?,
            xp_total: row.get(7)?,
            level: row.get(8)?,
            streak_current: row.get(9)?,
            streak_longest: row.get(10)?,
            streak_freeze_tokens: row.get(11)?,
            last_activity_date: row.get(12)?,
        })
    }).map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())?;

    Ok(domains)
}
```

to:

```rust
pub fn get_domains(state: State<'_, DbState>) -> Result<Vec<Domain>, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    let mut stmt = conn.prepare(
        "SELECT id, name, icon, color, created_at, updated_at, deleted_at, streak_current, streak_longest, streak_freeze_tokens, last_activity_date
         FROM domains
         WHERE deleted_at IS NULL"
    ).map_err(|e| e.to_string())?;

    let domains = stmt.query_map([], |row| {
        Ok(Domain {
            id: row.get(0)?,
            name: row.get(1)?,
            icon: row.get(2)?,
            color: row.get(3)?,
            created_at: row.get(4)?,
            updated_at: row.get(5)?,
            deleted_at: row.get(6)?,
            streak_current: row.get(7)?,
            streak_longest: row.get(8)?,
            streak_freeze_tokens: row.get(9)?,
            last_activity_date: row.get(10)?,
        })
    }).map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())?;

    Ok(domains)
}
```

- [ ] **Step 8: `create_domain` command**

Change (currently lines 2442-2446):

```rust
    conn.execute(
        "INSERT INTO domains (id, name, icon, color, created_at, updated_at, deleted_at, xp_total, level, streak_current, streak_longest, streak_freeze_tokens, last_activity_date)
         VALUES (?1, ?2, ?3, ?4, ?5, ?5, NULL, 0, 1, 0, 0, 0, NULL)",
        params![id, name, icon, color, now],
    ).map_err(|e| e.to_string())?;
```

to:

```rust
    conn.execute(
        "INSERT INTO domains (id, name, icon, color, created_at, updated_at, deleted_at, streak_current, streak_longest, streak_freeze_tokens, last_activity_date)
         VALUES (?1, ?2, ?3, ?4, ?5, ?5, NULL, 0, 0, 0, NULL)",
        params![id, name, icon, color, now],
    ).map_err(|e| e.to_string())?;
```

(The `xp_total`/`level` columns are no longer written at all here either — same reasoning as Step 5, they fall back to their schema defaults.)

- [ ] **Step 9: `get_domain_by_id` helper**

Change (currently lines 2539-2559):

```rust
fn get_domain_by_id(conn: &Connection, domain_id: &str) -> Result<Domain, String> {
    conn.query_row(
        "SELECT id, name, icon, color, created_at, updated_at, deleted_at, xp_total, level, streak_current, streak_longest, streak_freeze_tokens, last_activity_date FROM domains WHERE id = ?1",
        params![domain_id],
        |row| Ok(Domain {
            id: row.get(0)?,
            name: row.get(1)?,
            icon: row.get(2)?,
            color: row.get(3)?,
            created_at: row.get(4)?,
            updated_at: row.get(5)?,
            deleted_at: row.get(6)?,
            xp_total: row.get(7)?,
            level: row.get(8)?,
            streak_current: row.get(9)?,
            streak_longest: row.get(10)?,
            streak_freeze_tokens: row.get(11)?,
            last_activity_date: row.get(12)?,
        })
    ).map_err(|e| e.to_string())
}
```

to:

```rust
fn get_domain_by_id(conn: &Connection, domain_id: &str) -> Result<Domain, String> {
    conn.query_row(
        "SELECT id, name, icon, color, created_at, updated_at, deleted_at, streak_current, streak_longest, streak_freeze_tokens, last_activity_date FROM domains WHERE id = ?1",
        params![domain_id],
        |row| Ok(Domain {
            id: row.get(0)?,
            name: row.get(1)?,
            icon: row.get(2)?,
            color: row.get(3)?,
            created_at: row.get(4)?,
            updated_at: row.get(5)?,
            deleted_at: row.get(6)?,
            streak_current: row.get(7)?,
            streak_longest: row.get(8)?,
            streak_freeze_tokens: row.get(9)?,
            last_activity_date: row.get(10)?,
        })
    ).map_err(|e| e.to_string())
}
```

- [ ] **Step 10: Verify it compiles**

Run: `cd "C:\Users\isc\Desktop\Projects\Life OS\src-tauri" && cargo check`
Expected: the only remaining errors should be the `BackupCounts`/`ExportPayload`/`ImportPayload` `.xp_events`/`.achievements` field errors carried over from Tasks 1-2 (fixed next, in Task 4). If `cargo check` reports anything about `Domain`, `xp_total`, or `level` specifically, one of the 7 sites above was missed or edited inconsistently — find it and fix it before moving on.

- [ ] **Step 11: Commit**

```bash
git add src-tauri/src/commands.rs
git commit -m "feat: remove xp_total/level from the Domain struct and all call sites"
```

---

### Task 4: Remove remaining XP/achievement fields from backup, export/import, and calendar

**Files:**
- Modify: `src-tauri/src/commands.rs`

- [ ] **Step 1: `BackupCounts`**

Change (currently lines 574-588):

```rust
pub struct BackupCounts {
    pub domains: usize,
    pub tasks: usize,
    pub habits: usize,
    pub habit_logs: usize,
    pub goals: usize,
    pub xp_events: usize,
    pub achievements: usize,
    pub notes: usize,
    pub inbox_items: usize,
    pub task_templates: usize,
    pub focus_sessions: usize,
    pub focus_timer_drafts: usize,
    pub task_friction_logs: usize,
}
```

to:

```rust
pub struct BackupCounts {
    pub domains: usize,
    pub tasks: usize,
    pub habits: usize,
    pub habit_logs: usize,
    pub goals: usize,
    pub notes: usize,
    pub inbox_items: usize,
    pub task_templates: usize,
    pub focus_sessions: usize,
    pub focus_timer_drafts: usize,
    pub task_friction_logs: usize,
}
```

- [ ] **Step 2: `build_backup_counts` and `preview_from_export_payload`**

Find `fn build_backup_counts` (reads from `ImportPayload`) and remove its two lines populating `xp_events`/`achievements` on the `BackupCounts` literal it constructs (`payload.xp_events.len()` and `payload.achievements.len()`).

Find `fn preview_from_export_payload` (reads from `ExportPayload`) and remove the same two fields from the `BackupCounts` literal it constructs (`payload.xp_events.len()` and `payload.achievements.len()`).

- [ ] **Step 3: `CalendarDay` struct and `get_calendar_data`**

Change the struct (currently lines 5766-5772):

```rust
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CalendarDay {
    pub date: String,
    pub tasks: Vec<CalendarTaskSummary>,
    pub habits_logged: Vec<CalendarHabitSummary>,
    pub xp_earned: i64,
}
```

to:

```rust
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CalendarDay {
    pub date: String,
    pub tasks: Vec<CalendarTaskSummary>,
    pub habits_logged: Vec<CalendarHabitSummary>,
}
```

In `get_calendar_data`, remove the XP query block (currently lines 5828-5839):

```rust
    // Collect XP earned per day
    let mut xp_stmt = conn.prepare(
        "SELECT substr(created_at, 1, 10) as day, SUM(xp_amount) FROM xp_events WHERE created_at >= ?1 AND created_at < ?2 GROUP BY day"
    ).map_err(|e| e.to_string())?;
    let mut xp_by_date: std::collections::HashMap<String, i64> = std::collections::HashMap::new();
    let xp_rows = xp_stmt.query_map(params![start, end], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
    }).map_err(|e| e.to_string())?;
    for row in xp_rows {
        let (date, xp) = row.map_err(|e| e.to_string())?;
        xp_by_date.insert(date, xp);
    }

```

And in the loop building `result` at the bottom of the function, change:

```rust
        result.push(CalendarDay {
            tasks: tasks_by_date.remove(&date).unwrap_or_default(),
            habits_logged: habits_by_date.remove(&date).unwrap_or_default(),
            xp_earned: xp_by_date.remove(&date).unwrap_or(0),
            date,
        });
```

to:

```rust
        result.push(CalendarDay {
            tasks: tasks_by_date.remove(&date).unwrap_or_default(),
            habits_logged: habits_by_date.remove(&date).unwrap_or_default(),
            date,
        });
```

- [ ] **Step 4: Verify it compiles**

Run: `cd "C:\Users\isc\Desktop\Projects\Life OS\src-tauri" && cargo check`
Expected: compiles with no errors. There will be a `warning: function 'xp_to_level' is never used` — that's expected here (Task 3 removed its only two callers but the function body itself was already deleted in Task 3 Step 1, so this warning should NOT appear; if it does, it means Task 3 Step 1 wasn't fully applied — go back and check).

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/commands.rs
git commit -m "feat: remove remaining XP/achievement fields from backups, sync, and calendar"
```

---

### Task 5: Deregister the removed commands from `lib.rs`

**Files:**
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Remove the 7 command registrations**

In the `tauri::generate_handler![...]` list, remove these 7 lines:

```rust
            commands::update_domain_xp,
```
(from immediately after `commands::update_domain_profile,`)

```rust
            commands::get_xp_events,
            commands::get_xp_events_by_domain_and_range,
            commands::claim_recovery_bonus,
            commands::get_achievements,
            commands::unlock_achievement,
```
(this contiguous block, from immediately after `commands::restore_goal,`)

```rust
            commands::get_daily_xp,
```
(from immediately after `commands::set_sync_cursor,`)

Every other line in the list (including `commands::update_domain_streak`, `commands::use_streak_freeze`, `commands::update_momentum`, `commands::get_calendar_data`) stays untouched.

- [ ] **Step 2: Verify it builds**

Run: `cd "C:\Users\isc\Desktop\Projects\Life OS\src-tauri" && cargo build`
Expected: builds with no errors.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat: deregister removed XP and achievement commands"
```

---

### Task 6: Desktop Rust final verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full Rust test suite**

Run: `cd "C:\Users\isc\Desktop\Projects\Life OS\src-tauri" && cargo test`
Expected: all existing tests pass (credentials, debug_log, credential_migration — none of these touch XP/achievements, so none should be affected).

- [ ] **Step 2: Run a full release-profile-free build**

Run: `cd "C:\Users\isc\Desktop\Projects\Life OS\src-tauri" && cargo build`
Expected: builds cleanly. Skim the warning list — there should be no new warnings about unused `Domain`/`Task`/`Habit` fields or unused imports introduced by this plan (a stray unused `use` after deleting a struct is the most likely leftover; remove it if present).

---

## Desktop (React/TypeScript)

### Task 7: Delete the XP scoring engines and their tests

**Files:**
- Delete: `src/lib/xp-engine.ts`
- Delete: `src/lib/ai-xp.ts`
- Delete: `src/lib/__tests__/xp-engine.test.ts`

- [ ] **Step 1: Delete the three files**

```bash
git rm src/lib/xp-engine.ts src/lib/ai-xp.ts src/lib/__tests__/xp-engine.test.ts
```

- [ ] **Step 2: Verify nothing else imports them**

Run: `cd "C:\Users\isc\Desktop\Projects\Life OS" && grep -rn "xp-engine\|ai-xp" src/ --include="*.ts" --include="*.tsx"`
Expected: no output. (If something is found, it will be one of the files Tasks 8-13 handle — note it and continue; it'll be resolved by the end of Task 13.)

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: remove the rule-based and AI-based XP scoring engines"
```

---

### Task 8: Delete achievement logic, display, toast, and their tests

**Files:**
- Delete: `src/lib/achievement-checker.ts`
- Delete: `src/lib/achievement-display.ts`
- Delete: `src/components/gamification/AchievementToast.tsx`
- Delete: `src/lib/__tests__/achievement-checker.test.ts`

- [ ] **Step 1: Delete the four files**

```bash
git rm src/lib/achievement-checker.ts src/lib/achievement-display.ts src/components/gamification/AchievementToast.tsx src/lib/__tests__/achievement-checker.test.ts
```

- [ ] **Step 2: Commit**

```bash
git commit -m "feat: remove achievement trigger logic, display mapping, and toast"
```

(Import errors from `post-action.ts`, `Analytics.tsx` still referencing these are expected and fixed in Tasks 9-13 — `npm run build` isn't run again until Task 18.)

---

### Task 9: Delete the level-up ceremony and its `domain-utils.ts` dependency

**Files:**
- Delete: `src/components/gamification/LevelUpCeremony.tsx`
- Modify: `src/lib/domain-utils.ts`

- [ ] **Step 1: Delete the component**

```bash
git rm src/components/gamification/LevelUpCeremony.tsx
```

- [ ] **Step 2: Remove `getLevelTitle` and the `LEVEL_TITLES` import from `domain-utils.ts`**

Change the import line (line 2):

```typescript
import { DOMAIN_META, LEVEL_TITLES, type Domain, type DomainId } from './types';
```

to:

```typescript
import { DOMAIN_META, type Domain, type DomainId } from './types';
```

Delete this function (currently lines 141-143):

```typescript
export function getLevelTitle(level: number): string {
  return LEVEL_TITLES[level] ?? LEVEL_TITLES[10];
}

```

- [ ] **Step 3: Commit**

```bash
git add src/lib/domain-utils.ts
git commit -m "feat: remove the level-up ceremony and getLevelTitle"
```

---

### Task 10: Strip `post-action.ts` down to momentum only

**Files:**
- Modify: `src/lib/post-action.ts`

- [ ] **Step 1: Rewrite the file**

Replace the full contents of `src/lib/post-action.ts` with:

```typescript
/**
 * post-action.ts
 *
 * Momentum recalculation, derived from recent task/habit completion activity.
 * Plain module (no React) — safe to call from Zustand stores via getState().
 */

import { calcMomentum } from './momentum';
import { useAppStore } from '../store/useAppStore';
import { useTaskStore } from '../store/useTaskStore';
import { useHabitStore } from '../store/useHabitStore';
import type { Task, HabitLog } from './types';
import type { DayActivity } from './momentum';

export async function recalculateMomentum(
  tasks?: Task[],
  logs?: HabitLog[],
): Promise<void> {
  try {
    const allTasks = tasks ?? useTaskStore.getState().tasks;
    const allLogs = logs ?? useHabitStore.getState().logs;
    await _calcAndSaveMomentum(allTasks, allLogs);
  } catch (err) {
    console.error('[post-action] momentum recalc error:', err);
  }
}

async function _calcAndSaveMomentum(tasks: Task[], logs: HabitLog[]): Promise<void> {
  const today = new Date();
  const last7: DayActivity[] = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);

    const tasksCompleted = tasks.filter(
      (t) => t.status === 'done' && t.completed_at?.slice(0, 10) === dateStr
    ).length;

    const habitsCompleted = logs.filter((l) => l.completed_date === dateStr).length;

    const mitCompleted = tasks.some(
      (t) => t.is_mit && t.status === 'done' && t.completed_at?.slice(0, 10) === dateStr
    );

    last7.push({ date: dateStr, tasksCompleted, habitsCompleted, mitCompleted });
  }

  const rawScore = calcMomentum(last7);

  // MIT failure cost: if yesterday's MIT task was not completed, apply an extra -5 point penalty.
  // This makes MIT meaningful — not completing the most important task has real consequences.
  const yesterday = last7[1];
  const yesterdayHadMit = tasks.some((t) => t.is_mit); // there was a MIT set
  const yesterdayMitDone = yesterday?.mitCompleted ?? false;
  const mitFailurePenalty = (yesterdayHadMit && !yesterdayMitDone) ? 5 : 0;

  // If the user completed anything today, never drop below amber (15).
  const todayHasActivity =
    (last7[0].tasksCompleted ?? 0) > 0 ||
    (last7[0].habitsCompleted ?? 0) > 0 ||
    (last7[0].mitCompleted ?? false);
  const score = todayHasActivity
    ? Math.max(rawScore - mitFailurePenalty, 15)
    : Math.max(rawScore - mitFailurePenalty, 0);

  await useAppStore.getState().updateMomentum(score);
}
```

This removes `runPostAction` (never called from anywhere; its entire job was level-up detection, achievement checks, and an XP-events fetch) along with its now-unreachable imports (`db`, `getAchievementsToUnlock`, `useDomainStore`, `useGoalStore`, `DomainId`, `XpEvent`). `recalculateMomentum` and `_calcAndSaveMomentum` are otherwise byte-for-byte unchanged.

- [ ] **Step 2: Verify no other file imports `runPostAction`**

Run: `cd "C:\Users\isc\Desktop\Projects\Life OS" && grep -rn "runPostAction" src/`
Expected: no output (it was already unused before this change, per the design spec's findings).

- [ ] **Step 3: Commit**

```bash
git add src/lib/post-action.ts
git commit -m "feat: strip post-action.ts to momentum recalculation only"
```

---

### Task 11: Strip `useAppStore.ts`

**Files:**
- Modify: `src/store/useAppStore.ts`

- [ ] **Step 1: Rewrite the file**

Replace the full contents of `src/store/useAppStore.ts` with:

```typescript
import { create } from 'zustand';
import type { AppStateRow } from '../lib/types';
import type { MomentumState } from '../lib/momentum';
import { getMomentumState } from '../lib/momentum';
import { db } from '../lib/db';

interface AppStore {
  appState: AppStateRow | null;
  momentumState: MomentumState;
  isLoading: boolean;

  // Actions
  loadAppState: () => Promise<void>;
  updateMomentum: (score: number) => Promise<void>;
  setMitTask: (taskId: string | null) => Promise<void>;
  saveApiKey: (key: string) => Promise<void>;
  resetData: () => Promise<void>;
}

export const useAppStore = create<AppStore>((set, get) => ({
  appState: null,
  momentumState: 'normal',
  isLoading: false,

  loadAppState: async () => {
    try {
      const appState = await db.getAppState();
      set({ appState, momentumState: getMomentumState(appState.momentum_score) });
    } catch (err) {
      console.error('Failed to load app state:', err);
    }
  },

  updateMomentum: async (score) => {
    try {
      await db.updateMomentum(score);
      set((state) => ({
        appState: state.appState ? { ...state.appState, momentum_score: score } : state.appState,
        momentumState: getMomentumState(score),
      }));
    } catch (err) {
      console.error('Failed to update momentum:', err);
    }
  },

  setMitTask: async (taskId) => {
    try {
      await db.setMitTask(taskId);
      set((state) => ({
        appState: state.appState ? { ...state.appState, current_mit_task_id: taskId } : state.appState,
      }));
    } catch (err) {
      console.error('Failed to set MIT:', err);
    }
  },

  saveApiKey: async (key) => {
    try {
      await db.saveApiKey(key);
      set((state) => ({
        appState: state.appState ? { ...state.appState, api_key: key } : state.appState,
      }));
    } catch (err) {
      console.error('Failed to save API key:', err);
    }
  },

  resetData: async () => {
    try {
      await db.resetAllData();
      await get().loadAppState();
    } catch (err) {
      console.error('Failed to reset data:', err);
    }
  },
}));
```

This removes the `Achievement` import, `LevelUpEvent` interface, `achievements`/`pendingUnlocks`/`levelUpEvent` state, and `loadAchievements`/`unlockAchievement`/`dismissUnlock`/`triggerLevelUp`/`dismissLevelUp` actions (including the `loadAchievements()` call inside `resetData`). Note the rewritten file above already omits the now-unused `DomainId` import — `LevelUpEvent` (deleted) was its only reference point in this file.

- [ ] **Step 2: Verify it compiles**

Run: `cd "C:\Users\isc\Desktop\Projects\Life OS" && npx tsc --noEmit`
Expected: errors from every other file still referencing `useAppStore`'s removed fields/actions (`Analytics.tsx`'s `achievements` destructure, `Settings.tsx`'s `loadAchievements` destructure, `App.tsx` if it renders `LevelUpCeremony`/`AchievementToast` — check for this specifically, since the design spec found neither is currently rendered, but confirm) — these are expected and fixed in Tasks 12-15. If `tsc` reports `DomainId` as an unused import in this file, remove it.

- [ ] **Step 3: Commit**

```bash
git add src/store/useAppStore.ts
git commit -m "feat: strip achievement and level-up state from useAppStore"
```

---

### Task 12: Strip `types.ts`

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Remove `Domain.xp_total`/`.level`**

Change (lines 3-17):

```typescript
export interface Domain {
  id: DomainId;
  name: string;
  icon: string;
  color: string;
  created_at: string;
  updated_at?: string;
  deleted_at?: string | null;
  xp_total: number;
  level: number;
  streak_current: number;
  streak_longest: number;
  streak_freeze_tokens: number;
  last_activity_date: string | null;
}
```

to:

```typescript
export interface Domain {
  id: DomainId;
  name: string;
  icon: string;
  color: string;
  created_at: string;
  updated_at?: string;
  deleted_at?: string | null;
  streak_current: number;
  streak_longest: number;
  streak_freeze_tokens: number;
  last_activity_date: string | null;
}
```

- [ ] **Step 2: Remove `XpEvent` and `Achievement`**

Delete (currently lines 258-276):

```typescript
export interface XpEvent {
  id: string;
  domain_id: DomainId;
  source_type: 'task' | 'habit' | 'achievement' | 'bonus';
  source_id: string;
  xp_amount: number;
  ai_scored: boolean;
  ai_reasoning: string | null;
  created_at: string;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlocked_at: string | null;
}

```

- [ ] **Step 3: Remove `BackupCounts.xp_events`/`.achievements`**

Change (currently lines 362-376):

```typescript
export interface BackupCounts {
  domains: number;
  tasks: number;
  habits: number;
  habit_logs: number;
  goals: number;
  xp_events: number;
  achievements: number;
  notes: number;
  inbox_items: number;
  task_templates: number;
  focus_sessions: number;
  focus_timer_drafts: number;
  task_friction_logs: number;
}
```

to:

```typescript
export interface BackupCounts {
  domains: number;
  tasks: number;
  habits: number;
  habit_logs: number;
  goals: number;
  notes: number;
  inbox_items: number;
  task_templates: number;
  focus_sessions: number;
  focus_timer_drafts: number;
  task_friction_logs: number;
}
```

- [ ] **Step 4: Remove `LEVEL_TITLES` and `XP_THRESHOLDS`**

Delete (currently lines 586-599):

```typescript
export const LEVEL_TITLES: Record<number, string> = {
  1: 'Initiate',
  2: 'Scout',
  3: 'Operator',
  4: 'Specialist',
  5: 'Strategist',
  6: 'Lead',
  7: 'Director',
  8: 'Master',
  9: 'Elite',
  10: 'Legend',
};

export const XP_THRESHOLDS = [0, 500, 1200, 2500, 4500, 7500, 12000, 20000, 35000, 60000];

```

- [ ] **Step 5: Remove `DailyXp`**

Find and delete the `DailyXp` interface (around lines 566-570):

```typescript
export interface DailyXp {
  date: string;
  domain_id: string;
  xp: number;
}

```

- [ ] **Step 6: Remove `CalendarDay.xp_earned`**

Change (currently lines 657-662):

```typescript
export interface CalendarDay {
  date: string;
  tasks: CalendarTaskSummary[];
  habits_logged: CalendarHabitSummary[];
  xp_earned: number;
}
```

to:

```typescript
export interface CalendarDay {
  date: string;
  tasks: CalendarTaskSummary[];
  habits_logged: CalendarHabitSummary[];
}
```

- [ ] **Step 7: Leave `Task.xp_value`/`.xp_awarded`, `Habit.xp_per_completion`, `HabitLog.xp_awarded` untouched**

Do not remove these four fields — they mirror inert Rust columns that still exist and still round-trip through the API, per the design spec.

- [ ] **Step 8: Verify it compiles**

Run: `cd "C:\Users\isc\Desktop\Projects\Life OS" && npx tsc --noEmit`
Expected: fewer errors than after Task 11 (fields that no longer exist on `Domain`/`CalendarDay` will surface in whichever files still reference them — `db.ts`, `Analytics.tsx`, `useCalendarStore.test.ts` — all fixed in the remaining tasks).

- [ ] **Step 9: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: remove XP/level/achievement types"
```

---

### Task 13: Strip `db.ts`

**Files:**
- Modify: `src/lib/db.ts`

- [ ] **Step 1: Remove the now-unused type imports**

In the `import type { ... } from './types';` block, remove `XpEvent`, `Achievement`, and `DailyXp` from the list (leave every other imported type as-is).

- [ ] **Step 2: Remove `updateDomainXp`**

Change (lines 42-43):

```typescript
  updateDomainXp: (domain_id: string, xp_delta: number) =>
    withSyncMutation(() => invoke<Domain>('update_domain_xp', { domainId: domain_id, xpDelta: xp_delta }), 'domain:xp'),
```

to nothing (delete these two lines; keep `updateDomainStreak` immediately after untouched).

- [ ] **Step 3: Remove the XP Events and Achievements sections**

Delete (currently lines 142-151):

```typescript
  // ─── XP Events ─────────────────────────────────────────────────────────────
  getXpEvents: (limit = 20) => invoke<XpEvent[]>('get_xp_events', { limit }),
  getXpEventsByDomainAndRange: (domain_id: string, start_date: string, end_date: string) =>
    invoke<XpEvent[]>('get_xp_events_by_domain_and_range', { domainId: domain_id, startDate: start_date, endDate: end_date }),
  claimRecoveryBonus: (domain_id: string, source_id: string, xp_amount: number) =>
    invoke<Domain>('claim_recovery_bonus', { domainId: domain_id, sourceId: source_id, xpAmount: xp_amount }),

  // ─── Achievements ──────────────────────────────────────────────────────────
  getAchievements: () => invoke<Achievement[]>('get_achievements'),
  unlockAchievement: (id: string) => invoke<Achievement>('unlock_achievement', { id }),

```

- [ ] **Step 4: Remove `getDailyXp`**

Change (line 195):

```typescript
  getDailyXp: (days: number) => invoke<DailyXp[]>('get_daily_xp', { days }),
```

to nothing (delete this line; keep `getTaskStats` immediately after untouched).

- [ ] **Step 5: Verify it compiles**

Run: `cd "C:\Users\isc\Desktop\Projects\Life OS" && npx tsc --noEmit`
Expected: remaining errors should now be limited to `Analytics.tsx` and `Settings.tsx` (fixed next) and `useCalendarStore.test.ts` (fixed after that).

- [ ] **Step 6: Commit**

```bash
git add src/lib/db.ts
git commit -m "feat: remove XP/achievement typed wrappers from db.ts"
```

---

### Task 14: Strip `Analytics.tsx`

**Files:**
- Modify: `src/pages/Analytics.tsx`

- [ ] **Step 1: Remove the `achievement-display` import**

Delete line 16:

```typescript
import { getAchievementDisplay } from '../lib/achievement-display';
```

- [ ] **Step 2: Remove the `AchievementTile` component**

Delete the full component (currently lines 51-115, from the `// ── Achievement tile ──` comment through `AchievementTile.displayName = 'AchievementTile';`):

```typescript
// ── Achievement tile ─────────────────────────────────────────────────────────
const AchievementTile: React.FC<{
  icon: string;
  title: string;
  description: string;
  unlocked: boolean;
  unlockedAt: string | null;
}> = React.memo(({ icon, title, description, unlocked, unlockedAt }) => (
  <div
    className="card"
    style={{
      padding: 'var(--space-2) var(--space-3)',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 'var(--space-3)',
      opacity: unlocked ? 1 : 0.35,
      borderColor: unlocked ? 'var(--color-border)' : 'var(--color-surface-hover)',
    }}
  >
    <div style={{
      flexShrink: 0,
      width: 32,
      height: 32,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)',
      letterSpacing: 0.5,
      color: unlocked ? 'var(--color-text)' : 'var(--color-text-muted)',
      background: unlocked ? 'var(--color-surface-hover)' : 'var(--color-bg)',
      border: `1px solid ${unlocked ? 'var(--color-border)' : 'var(--color-surface-hover)'}`,
    }}>
      {icon}
    </div>
    <div style={{ minWidth: 0 }}>
      <div style={{
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--text-sm)', fontWeight: 'var(--font-weight-regular)',
        letterSpacing: 1.5,
        textTransform: 'uppercase',
        color: unlocked ? 'var(--color-warning)' : 'var(--color-text-muted)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {title}
      </div>
      <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-muted)', marginTop: 2 }}>
        {description}
      </div>
      {unlocked && unlockedAt && (
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-muted)', marginTop: 2 }}>
          {formatDateDisplay(unlockedAt)}
        </div>
      )}
    </div>
    {unlocked && (
      <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-weight-regular)', color: 'var(--color-warning)', flexShrink: 0, marginTop: 2 }}>★</span>
    )}
  </div>
));

AchievementTile.displayName = 'AchievementTile';

```

(`formatDateDisplay` is used elsewhere in this file too — keep its import.)

- [ ] **Step 3: Remove the `achievements` destructure**

Find `const { achievements } = useAppStore();` (around line 126) and delete it. If `useAppStore()` is called elsewhere in this file for other fields, leave those calls alone — this specific destructure line is the only thing to remove.

- [ ] **Step 4: Remove `unlockedCount`**

Delete (currently line 401):

```typescript
  const unlockedCount = achievements.filter((a) => a.unlocked).length;
```

- [ ] **Step 5: Remove the achievement gallery card**

Delete the full card (currently lines 834-865, from the `{/* Achievement gallery */}` comment through its closing `</div>`, immediately before the component's final closing `</div>\n  );`):

```typescript
      {/* Achievement gallery */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">ACHIEVEMENTS</span>
          <span className="card-meta">
            <span style={{ color: 'var(--color-warning)' }}>{unlockedCount}</span>/{achievements.length} UNLOCKED
          </span>
        </div>
        <div className="card-body">
          {achievements.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">NO ACHIEVEMENTS LOADED</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
              {achievements.map((a) => {
                const display = getAchievementDisplay(a, domains);
                return (
                  <AchievementTile
                    key={a.id}
                    icon={a.icon}
                    title={display.title}
                    description={display.description}
                    unlocked={a.unlocked}
                    unlockedAt={a.unlocked_at}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

```

Leave the surrounding structure (the card before it, and the component's closing `</div>` / `);`) intact — only this one card's markup is removed.

- [ ] **Step 6: Verify it compiles**

Run: `cd "C:\Users\isc\Desktop\Projects\Life OS" && npx tsc --noEmit`
Expected: no more errors from `Analytics.tsx`. Remaining errors limited to `Settings.tsx` and `useCalendarStore.test.ts`.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Analytics.tsx
git commit -m "feat: remove achievement gallery from Analytics"
```

---

### Task 15: Strip `Settings.tsx`

**Files:**
- Modify: `src/pages/Settings.tsx`

- [ ] **Step 1: Remove the `loadAchievements` destructure**

Change (line 97):

```typescript
  const { appState, saveApiKey, resetData, loadAppState, loadAchievements } = useAppStore();
```

to:

```typescript
  const { appState, saveApiKey, resetData, loadAppState } = useAppStore();
```

- [ ] **Step 2: Remove the `loadAchievements()` call from startup hydration**

In the `Promise.all([...])` block (around line 245), remove this line:

```typescript
      loadAchievements(),
```

- [ ] **Step 3: Leave the AI API key section untouched**

Per the design spec, the "AI Assist" API key storage/UI stays — its only current consumer (`ai-xp.ts`) is gone, but the key itself is generic AI infrastructure that was separately given OS-keychain protection, and removing that capability isn't part of this removal.

- [ ] **Step 4: Verify it compiles**

Run: `cd "C:\Users\isc\Desktop\Projects\Life OS" && npx tsc --noEmit`
Expected: no more errors from `Settings.tsx`. Remaining errors limited to `useCalendarStore.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Settings.tsx
git commit -m "feat: remove loadAchievements call from Settings startup hydration"
```

---

### Task 16: Fix `useCalendarStore.test.ts`

**Files:**
- Modify: `src/store/__tests__/useCalendarStore.test.ts`

- [ ] **Step 1: Remove `xp_earned` from the mock factory**

Change (lines 8-16):

```typescript
function makeCalendarDay(date: string, overrides: Partial<CalendarDay> = {}): CalendarDay {
  return {
    date,
    tasks: [],
    habits_logged: [],
    xp_earned: 0,
    ...overrides,
  };
}
```

to:

```typescript
function makeCalendarDay(date: string, overrides: Partial<CalendarDay> = {}): CalendarDay {
  return {
    date,
    tasks: [],
    habits_logged: [],
    ...overrides,
  };
}
```

- [ ] **Step 2: Remove `xp_earned` from test fixtures and assertions**

Run: `cd "C:\Users\isc\Desktop\Projects\Life OS" && grep -n "xp_earned" src/store/__tests__/useCalendarStore.test.ts`

For each remaining match: if it's a `makeCalendarDay('...', { xp_earned: N })` call, remove the `xp_earned: N` override entirely (the day object no longer has that field, so passing it is now a type error). If it's an assertion like `expect(dayData(...)?.xp_earned).toBe(...)`, delete that assertion line (there is no replacement — the field is gone).

- [ ] **Step 3: Verify it compiles and passes**

Run: `cd "C:\Users\isc\Desktop\Projects\Life OS" && npx tsc --noEmit && npm test`
Expected: no type errors anywhere in the project; all tests pass (including the two `xp-engine`/`achievement-checker` test files no longer existing — Vitest simply won't discover them, which is correct).

- [ ] **Step 4: Commit**

```bash
git add src/store/__tests__/useCalendarStore.test.ts
git commit -m "test: remove xp_earned from calendar store test fixtures"
```

---

### Task 17: Strip XP/level-up/achievement CSS

**Files:**
- Modify: `src/styles/globals.css`

- [ ] **Step 1: Remove the `.xp-bar-track`/`.xp-bar-fill` selector fragments**

Change (currently lines 1172-1187):

```css
/* ── PROGRESS BAR ──────────────────────────────────────────────────────────── */
.progress-track,
.xp-bar-track {
  background: var(--color-surface-elevated);
  border-radius: var(--radius-full);
  height: 4px;
  overflow: hidden;
}
.progress-fill,
.xp-bar-fill {
  height: 100%;
  border-radius: var(--radius-full);
  background: var(--domain-primary, var(--color-accent));
  transition: width var(--motion-slow);
}
```

to:

```css
/* ── PROGRESS BAR ──────────────────────────────────────────────────────────── */
.progress-track {
  background: var(--color-surface-elevated);
  border-radius: var(--radius-full);
  height: 4px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  border-radius: var(--radius-full);
  background: var(--domain-primary, var(--color-accent));
  transition: width var(--motion-slow);
}
```

(The rule bodies are untouched — only the `.xp-bar-track`/`.xp-bar-fill` comma-selector fragments are removed, since `.progress-track`/`.progress-fill` are real, used elsewhere.)

- [ ] **Step 2: Remove the LEVEL UP CARD block**

Delete the full block (currently lines 1253-1318, from the `/* ── LEVEL UP CARD ... ── */` comment through the closing `}` of `.level-up-subtitle`):

```css
/* ── LEVEL UP CARD (shrunk from full-screen ceremony to a centered card) ───── */
.level-up-overlay {
  position: fixed;
  inset: 0;
  z-index: 9998;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(4,5,8,0.55);
}
.level-up-shell {
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 28px 40px;
  text-align: center;
  background: var(--color-surface);
  border: 1px solid var(--domain-primary, var(--color-accent));
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  min-width: 320px;
}
.level-up-hud,
.level-up-grid {
  width: 100%;
  display: flex;
  justify-content: space-between;
  gap: 16px;
  font-family: var(--font-sans);
  font-size: var(--text-2xs);
  font-weight: var(--font-weight-medium);
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
  text-transform: uppercase;
}
.level-up-kicker {
  font-family: var(--font-sans);
  font-weight: var(--font-weight-semibold);
  font-size: var(--text-sm);
  letter-spacing: 0.08em;
  color: var(--color-text-muted);
  text-transform: uppercase;
}
.level-up-rank {
  font-family: var(--font-sans);
  font-weight: var(--font-weight-bold);
  font-size: var(--text-2xl);
  letter-spacing: -0.02em;
  color: var(--domain-bright, var(--color-accent));
  line-height: 1;
}
.level-up-title {
  font-family: var(--font-sans);
  font-weight: var(--font-weight-bold);
  font-size: var(--text-xl);
  color: var(--color-text);
}
.level-up-subtitle {
  font-family: var(--font-sans);
  font-size: var(--text-xs);
  font-weight: var(--font-weight-regular);
  color: var(--color-text-muted);
}

```

- [ ] **Step 3: Remove the ACHIEVEMENT TOAST block**

Delete the full block (currently lines 1320-1377, from the `/* ── ACHIEVEMENT TOAST ── */` comment through the closing `}` of `.achievement-toast-copy`):

```css
/* ── ACHIEVEMENT TOAST ─────────────────────────────────────────────────────── */
.achievement-toast-wrap {
  animation: toastIn var(--motion-base) both;
}
.achievement-toast {
  position: relative;
  display: flex;
  gap: 14px;
  align-items: stretch;
  padding: 12px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--elevation-2);
  background: var(--color-surface);
}
.achievement-toast::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  border-radius: var(--radius-full) 0 0 var(--radius-full);
  background: var(--color-accent);
}
.achievement-toast-icon {
  min-width: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text);
  font-size: var(--text-sm);
  font-weight: var(--font-weight-regular);
}
.achievement-toast-kicker {
  font-family: var(--font-sans);
  font-weight: var(--font-weight-semibold);
  font-size: var(--text-2xs);
  letter-spacing: 0.06em;
  color: var(--color-text-muted);
  text-transform: uppercase;
}
.achievement-toast-title {
  font-family: var(--font-sans);
  font-weight: var(--font-weight-bold);
  font-size: var(--text-md);
  color: var(--color-accent);
}
.achievement-toast-copy {
  font-family: var(--font-sans);
  font-size: var(--text-xs);
  font-weight: var(--font-weight-regular);
  color: var(--color-text-muted);
  margin-top: 4px;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/styles/globals.css
git commit -m "feat: remove XP bar, level-up, and achievement toast CSS"
```

---

### Task 18: Desktop frontend final verification

**Files:** none (verification only)

- [ ] **Step 1: Confirm no leftover references anywhere**

Run: `cd "C:\Users\isc\Desktop\Projects\Life OS" && grep -rniE "xp-engine|ai-xp|achievement-checker|achievement-display|AchievementToast|LevelUpCeremony|getLevelTitle|LEVEL_TITLES|XP_THRESHOLDS|runPostAction" src/`
Expected: no output.

- [ ] **Step 2: Run the full test suite**

Run: `cd "C:\Users\isc\Desktop\Projects\Life OS" && npm test`
Expected: all tests pass.

- [ ] **Step 3: Run the full typecheck + production build**

Run: `cd "C:\Users\isc\Desktop\Projects\Life OS" && npm run build`
Expected: `tsc && vite build` completes with no type errors. The pre-existing bundle-size/CSS-optimizer warnings (unrelated to this work, noted in the debug-log sub-project's verification) may still appear — that's expected and not a regression.

---

## Mobile (Flutter)

### Task 19: Remove XP/level display from mobile screens

**Files:**
- Modify: `lib/features/domains/presentation/domains_screen.dart`
- Modify: `lib/features/domains/presentation/domain_detail_screen.dart`
- Modify: `lib/features/overview/presentation/overview_screen.dart`

No achievements feature exists on mobile — nothing to remove there. The Drift schema (`LocalDomains.xpTotal`/`.level` columns) and sync JSON serialization (`_domainJson`/`_domainCompanionFromJson` in `app_database.dart`) are untouched — same "inert, no migration" reasoning as desktop's DB. Only display code changes.

- [ ] **Step 1: `domains_screen.dart` — drop the LEVEL segment and XP signal row**

Change (currently line 134):

```dart
                                    '${domain.id.toUpperCase()} | LEVEL ${domain.level} | STREAK ${domain.streakCurrent}D',
```

to:

```dart
                                    '${domain.id.toUpperCase()} | STREAK ${domain.streakCurrent}D',
```

Then remove this `_SignalRow` (currently lines 162-165):

```dart
                        _SignalRow(
                          label: 'XP total',
                          value: '${domain.xpTotal}',
                        ),
                        const SizedBox(height: LifeOsTheme.space2),
```

(Remove the whole 5-line block including the trailing `SizedBox` spacer, so the `_SignalRow` before it flows directly into the `Wrap`/button row that follows — check the surrounding spacing still reads correctly; if removing this block leaves a double `SizedBox` in a row, remove the duplicate.)

- [ ] **Step 2: `domain_detail_screen.dart` — drop the Level and XP total stat cards**

Change (currently lines 81-87):

```dart
                _StatCard(label: 'Open', value: '${openTasks.length}'),
                _StatCard(label: 'Done this week', value: '$doneThisWeek'),
                _StatCard(label: 'Overdue', value: '$overdueCount'),
                _StatCard(label: 'Level', value: '${domain.level}'),
                _StatCard(label: 'Streak', value: '${domain.streakCurrent}D'),
                _StatCard(label: 'XP total', value: '${domain.xpTotal}'),
```

to:

```dart
                _StatCard(label: 'Open', value: '${openTasks.length}'),
                _StatCard(label: 'Done this week', value: '$doneThisWeek'),
                _StatCard(label: 'Overdue', value: '$overdueCount'),
                _StatCard(label: 'Streak', value: '${domain.streakCurrent}D'),
```

- [ ] **Step 3: `overview_screen.dart` — drop the LEVEL segment**

Change (currently line 234):

```dart
                            'LEVEL ${domain.level}  |  STREAK ${domain.streakCurrent}D',
```

to:

```dart
                            'STREAK ${domain.streakCurrent}D',
```

- [ ] **Step 4: Verify it compiles**

Run: `cd "C:\Users\isc\Desktop\Projects\life-os-mobile" && flutter analyze`
Expected: no new issues (the same single pre-existing `use_super_parameters` info-lint on `AppDatabase.forTesting`, unrelated to this change, may still appear).

- [ ] **Step 5: Commit**

```bash
git add lib/features/domains/presentation/domains_screen.dart lib/features/domains/presentation/domain_detail_screen.dart lib/features/overview/presentation/overview_screen.dart
git commit -m "feat: remove XP/level display from domain screens"
```

---

### Task 20: Mobile final verification

**Files:** none (verification only)

- [ ] **Step 1: Run static analysis**

Run: `cd "C:\Users\isc\Desktop\Projects\life-os-mobile" && flutter analyze`
Expected: clean (or only the known pre-existing unrelated lint).

- [ ] **Step 2: Run the full test suite**

Run: `cd "C:\Users\isc\Desktop\Projects\life-os-mobile" && flutter test`
Expected: all tests pass (none of the 4 existing test files touch domain XP/level).

---

## Documentation

### Task 21: Update `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md` (root, `C:\Users\isc\Desktop\Projects\Life OS\CLAUDE.md`)

- [ ] **Step 1: Update the components directory comment**

Find the line listing `gamification/` directory contents (currently mentions `XPBar, StreakFlame, AchievementToast, LevelUpCeremony`) and change it to reflect only what remains: `StreakFlame`.

- [ ] **Step 2: Update the `lib/` file-tree comment**

Remove the `xp-engine.ts`, `ai-xp.ts`, `achievement-checker.ts` lines. Update the `post-action.ts` line's description to reflect its new, momentum-only purpose (was: "Post-completion: XP, level-up, achievements, momentum" — change to describe momentum recalculation only).

- [ ] **Step 3: Remove the `--pip-amber` "XP values" comment**

Find the color token comment mentioning `--pip-amber` and "XP values, warnings" — update to remove the "XP values" part, keeping whatever else that token is still used for (warnings).

- [ ] **Step 4: Update the typography note mentioning "level titles"**

Find and remove the level-titles mention from the typography section.

- [ ] **Step 5: Update the Sidebar description**

Find the Sidebar component description mentioning "domain XP blocks, achievements count, rank footer" and remove those specific claims (this was already stale relative to the actual `Sidebar.tsx` implementation, which only shows `StreakFlame` — fix it to match reality).

- [ ] **Step 6: Remove CSS class docs**

Remove the `.xp-bar-track`/`.xp-bar-fill` class documentation. Remove `.level-up-overlay` from wherever it's mentioned in the two "Animation Rules" blocks (leave every other animation rule in those blocks untouched). Remove any `.xp-float`/`achievement-toast` mentions in the same areas.

- [ ] **Step 7: Update the database schema section**

In the `domains` table schema shown in `CLAUDE.md`, remove the `xp_total`/`level` column lines (the actual SQLite schema keeps these columns per this plan — only the *documentation* is being corrected to describe the new, reduced `Domain` struct shape the app actually reads/writes going forward). Remove the entire `xp_events` table schema block and the entire `achievements` table schema block. Remove the `xp_events(...)` index mention from the index list.

- [ ] **Step 8: Update the Tauri commands list**

Remove `get_xp_events`, `get_xp_events_by_domain_and_range`, `claim_recovery_bonus`, `get_achievements`, `unlock_achievement`, `update_domain_xp`, `get_daily_xp` from wherever they're listed. Update the `complete_task` comment (currently "awards XP, checks achievements") and `log_habit` comment (currently "awards XP, checks streak") to drop the XP/achievement claims — `complete_task` only updates status and streak bookkeeping; `log_habit` only checks streak. Update the `get_calendar_data` comment (currently "tasks + habits + XP grouped by date") to remove "+ XP".

- [ ] **Step 9: Remove the XP ENGINE section**

Delete the entire `## XP ENGINE` section (both the rule-based and AI-based subsections).

- [ ] **Step 10: Trim the GAMIFICATION RULES section**

Delete the Level System table. Delete the Achievement Triggers pseudocode array and its surrounding prose (including the "On unlock: show `<AchievementToast>`..." line). Delete the "Habit XP" subsection (base XP, streak bonus — both XP-specific). Keep the Streak Rules subsection entirely as-is (freeze tokens, streak increment logic — none of it is XP-related).

- [ ] **Step 11: Remove the AI XP fallback bullet**

Find and remove the "AI XP scoring failures silently fall back to rule-based (no error shown to user)" bullet from the Error Handling section.

- [ ] **Step 12: Leave the Phase Build Order changelog untouched**

Per the design spec, the completed Phase 10 entry ("Achievement system + Level-up ceremony") is a historical record, not a description of current behavior — do not edit it.

- [ ] **Step 13: Update the Test File Locations block**

Remove the `xp-engine.test.ts` and `achievement-checker.test.ts` lines. (The `XPBar.test.tsx` reference and the "XP float" comment on `CompletionButton.test.tsx` were already stale/inaccurate before this plan — per the design spec, pre-existing staleness unrelated to XP is out of scope, but since these two ARE XP-related, remove them too: `XPBar.test.tsx` doesn't exist and never did, and `CompletionButton.test.tsx`'s real content has no XP material to test.)

- [ ] **Step 14: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: remove XP/level/achievement documentation"
```
