use rusqlite::{Connection, Result, params};
use std::path::PathBuf;

pub fn get_db_path(app_handle: &tauri::AppHandle) -> PathBuf {
    use tauri::Manager;
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .expect("Failed to get app data dir");
    std::fs::create_dir_all(&app_dir).expect("Failed to create app data dir");
    app_dir.join("lifeos.db")
}

pub fn init_db(conn: &Connection) -> Result<()> {
    conn.execute_batch("PRAGMA journal_mode=WAL;")?;
    conn.execute_batch("PRAGMA foreign_keys=ON;")?;

    conn.execute_batch("
        CREATE TABLE IF NOT EXISTS domains (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            icon TEXT NOT NULL,
            color TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            deleted_at TEXT,
            xp_total INTEGER DEFAULT 0,
            level INTEGER DEFAULT 1,
            streak_current INTEGER DEFAULT 0,
            streak_longest INTEGER DEFAULT 0,
            streak_freeze_tokens INTEGER DEFAULT 0,
            last_activity_date TEXT
        );

        CREATE TABLE IF NOT EXISTS tasks (
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
            completed_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            deleted_at TEXT,
            attachments TEXT DEFAULT '[]'
        );

        CREATE INDEX IF NOT EXISTS idx_tasks_domain ON tasks(domain_id);
        CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
        CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
        CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
    ")?;

    // Migration: add recurrence_rule column if not present (safe to run on existing DBs)
    let _ = conn.execute("ALTER TABLE tasks ADD COLUMN recurrence_rule TEXT", []);

    conn.execute_batch("

        CREATE TABLE IF NOT EXISTS habits (
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

        CREATE INDEX IF NOT EXISTS idx_habits_domain ON habits(domain_id);

        CREATE TABLE IF NOT EXISTS habit_logs (
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

        CREATE INDEX IF NOT EXISTS idx_habit_logs_habit ON habit_logs(habit_id);
        CREATE INDEX IF NOT EXISTS idx_habit_logs_date ON habit_logs(completed_date);

        CREATE TABLE IF NOT EXISTS goals (
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

        CREATE INDEX IF NOT EXISTS idx_goals_domain ON goals(domain_id);

        CREATE TABLE IF NOT EXISTS xp_events (
            id TEXT PRIMARY KEY,
            domain_id TEXT NOT NULL,
            source_type TEXT NOT NULL,
            source_id TEXT NOT NULL,
            xp_amount INTEGER NOT NULL,
            ai_scored INTEGER NOT NULL DEFAULT 0,
            ai_reasoning TEXT,
            created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_xp_events_domain ON xp_events(domain_id);
        CREATE INDEX IF NOT EXISTS idx_xp_events_created ON xp_events(created_at);

        CREATE TABLE IF NOT EXISTS achievements (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            icon TEXT NOT NULL,
            unlocked INTEGER NOT NULL DEFAULT 0,
            unlocked_at TEXT
        );

        CREATE TABLE IF NOT EXISTS app_state (
            id INTEGER PRIMARY KEY DEFAULT 1,
            momentum_score INTEGER NOT NULL DEFAULT 50,
            last_momentum_calc TEXT,
            current_mit_task_id TEXT,
            api_key TEXT,
            onboarding_complete INTEGER NOT NULL DEFAULT 0,
            last_opened_date TEXT,
            backup_directory TEXT,
            auto_backup_enabled INTEGER NOT NULL DEFAULT 0,
            last_backup_at TEXT,
            crt_intensity TEXT NOT NULL DEFAULT 'medium',
            text_scale TEXT NOT NULL DEFAULT 'normal',
            ui_density TEXT NOT NULL DEFAULT 'comfortable',
            sync_enabled INTEGER NOT NULL DEFAULT 0,
            sync_provider TEXT,
            sync_supabase_url TEXT,
            sync_supabase_anon_key TEXT,
            sync_access_token TEXT,
            sync_refresh_token TEXT,
            sync_user_id TEXT,
            sync_user_email TEXT,
            sync_last_sync_at TEXT,
            sync_last_sync_error TEXT,
            sync_last_pushed_at TEXT,
            sync_last_pulled_at TEXT
        );

        CREATE TABLE IF NOT EXISTS notes (
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
        CREATE INDEX IF NOT EXISTS idx_notes_domain ON notes(domain_id);
        CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated_at);

        CREATE TABLE IF NOT EXISTS inbox_items (
            id TEXT PRIMARY KEY,
            content TEXT NOT NULL,
            domain_id TEXT,
            source_label TEXT NOT NULL DEFAULT 'manual',
            suggested_kind TEXT NOT NULL DEFAULT 'generic',
            status TEXT NOT NULL DEFAULT 'pending',
            created_at TEXT NOT NULL,
            triaged_at TEXT,
            updated_at TEXT NOT NULL,
            deleted_at TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_inbox_created ON inbox_items(created_at);

        CREATE TABLE IF NOT EXISTS sync_queue (
            id TEXT PRIMARY KEY,
            entity_type TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            operation_type TEXT NOT NULL,
            payload_json TEXT NOT NULL,
            created_at TEXT NOT NULL,
            retry_count INTEGER NOT NULL DEFAULT 0,
            last_error TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_sync_queue_created ON sync_queue(created_at);
        CREATE INDEX IF NOT EXISTS idx_sync_queue_entity ON sync_queue(entity_type, entity_id);

        CREATE TABLE IF NOT EXISTS sync_cursors (
            entity_type TEXT PRIMARY KEY,
            last_pulled_at TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_sync_cursors_pulled ON sync_cursors(last_pulled_at);

        CREATE TABLE IF NOT EXISTS task_templates (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            domain_id TEXT NOT NULL,
            priority TEXT NOT NULL DEFAULT 'medium',
            energy_level TEXT NOT NULL DEFAULT 'medium',
            is_mit INTEGER NOT NULL DEFAULT 0,
            tags TEXT NOT NULL DEFAULT '[]',
            time_estimate_minutes INTEGER,
            recurrence_rule TEXT,
            source_task_id TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS focus_sessions (
            id TEXT PRIMARY KEY,
            task_id TEXT NOT NULL,
            planned_minutes INTEGER NOT NULL DEFAULT 25,
            actual_minutes INTEGER NOT NULL DEFAULT 0,
            distraction_count INTEGER NOT NULL DEFAULT 0,
            interruption_notes TEXT,
            reflection TEXT,
            created_at TEXT NOT NULL,
            started_at TEXT NOT NULL,
            ended_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_focus_sessions_task ON focus_sessions(task_id);
        CREATE INDEX IF NOT EXISTS idx_focus_sessions_created ON focus_sessions(created_at);

        CREATE TABLE IF NOT EXISTS focus_timer_drafts (
            task_id TEXT PRIMARY KEY,
            planned_minutes INTEGER NOT NULL DEFAULT 25,
            elapsed_seconds INTEGER NOT NULL DEFAULT 0,
            distraction_count INTEGER NOT NULL DEFAULT 0,
            interruption_notes TEXT,
            reflection TEXT,
            is_running INTEGER NOT NULL DEFAULT 0,
            last_started_at TEXT,
            updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_focus_timer_drafts_updated ON focus_timer_drafts(updated_at);

        CREATE TABLE IF NOT EXISTS task_friction_logs (
            id TEXT PRIMARY KEY,
            task_id TEXT NOT NULL,
            reason TEXT NOT NULL,
            details TEXT,
            action_type TEXT NOT NULL DEFAULT 'logged',
            created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_task_friction_logs_task ON task_friction_logs(task_id);
        CREATE INDEX IF NOT EXISTS idx_task_friction_logs_created ON task_friction_logs(created_at);

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

    seed_initial_data(conn)?;
    run_migrations(conn)?;
    Ok(())
}

/// Safely adds columns that may be missing in databases created before they were introduced.
/// Each ALTER TABLE silently fails if the column already exists — that is intentional.
fn run_migrations(conn: &Connection) -> Result<()> {
    let _ = conn.execute("ALTER TABLE domains ADD COLUMN created_at TEXT", []);
    let _ = conn.execute("ALTER TABLE domains ADD COLUMN updated_at TEXT", []);
    let _ = conn.execute("ALTER TABLE domains ADD COLUMN deleted_at TEXT", []);
    let _ = conn.execute(
        "UPDATE domains
         SET created_at = CASE id
           WHEN 'military' THEN '2026-01-01T00:00:00Z'
           WHEN 'builder' THEN '2026-01-01T00:00:01Z'
           WHEN 'self' THEN '2026-01-01T00:00:02Z'
           ELSE strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
         END
         WHERE created_at IS NULL OR TRIM(created_at) = ''",
        [],
    );
    let _ = conn.execute(
        "UPDATE domains SET updated_at = created_at WHERE updated_at IS NULL OR TRIM(updated_at) = ''",
        [],
    );
    let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_domains_deleted ON domains(deleted_at)", []);
    let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_domains_updated ON domains(updated_at)", []);
    // tasks table — columns added after initial schema
    let _ = conn.execute("ALTER TABLE tasks ADD COLUMN xp_awarded INTEGER NOT NULL DEFAULT 0", []);
    let _ = conn.execute("ALTER TABLE tasks ADD COLUMN attachments TEXT DEFAULT '[]'", []);
    let _ = conn.execute("ALTER TABLE tasks ADD COLUMN time_actual_minutes INTEGER", []);
    let _ = conn.execute("ALTER TABLE tasks ADD COLUMN energy_level TEXT NOT NULL DEFAULT 'medium'", []);
    let _ = conn.execute("ALTER TABLE tasks ADD COLUMN is_top_three INTEGER NOT NULL DEFAULT 0", []);
    let _ = conn.execute("ALTER TABLE tasks ADD COLUMN planned_for_date TEXT", []);
    let _ = conn.execute("ALTER TABLE tasks ADD COLUMN task_kind TEXT NOT NULL DEFAULT 'standard'", []);
    let _ = conn.execute("ALTER TABLE tasks ADD COLUMN scheduled_for TEXT", []);
    let _ = conn.execute("ALTER TABLE tasks ADD COLUMN recurring_template_id TEXT", []);
    let _ = conn.execute("ALTER TABLE tasks ADD COLUMN recurrence_type TEXT", []);
    let _ = conn.execute("ALTER TABLE tasks ADD COLUMN recurrence_interval INTEGER", []);
    let _ = conn.execute("ALTER TABLE tasks ADD COLUMN recurrence_days TEXT DEFAULT '[]'", []);
    let _ = conn.execute("ALTER TABLE tasks ADD COLUMN recurrence_anchor_date TEXT", []);
    let _ = conn.execute("ALTER TABLE tasks ADD COLUMN deleted_at TEXT", []);
    let _ = conn.execute(
        "UPDATE tasks SET energy_level = 'medium' WHERE energy_level IS NULL OR TRIM(energy_level) = ''",
        [],
    );
    let _ = conn.execute(
        "UPDATE tasks SET task_kind = 'standard' WHERE task_kind IS NULL OR TRIM(task_kind) = ''",
        [],
    );
    let _ = conn.execute(
        "UPDATE tasks SET recurrence_days = '[]' WHERE recurrence_days IS NULL OR TRIM(recurrence_days) = ''",
        [],
    );
    let _ = conn.execute(
        "UPDATE tasks
         SET recurrence_type = recurrence_rule
         WHERE recurrence_type IS NULL
           AND recurrence_rule IS NOT NULL
           AND TRIM(recurrence_rule) != ''
           AND recurrence_rule != 'none'",
        [],
    );
    let _ = conn.execute(
        "UPDATE tasks
         SET recurrence_interval = 1
         WHERE recurrence_interval IS NULL
           AND recurrence_type IS NOT NULL
           AND TRIM(recurrence_type) != ''",
        [],
    );
    let _ = conn.execute(
        "UPDATE tasks
         SET recurrence_anchor_date = COALESCE(substr(due_date, 1, 10), substr(created_at, 1, 10))
         WHERE recurrence_anchor_date IS NULL
           AND recurrence_type IS NOT NULL
           AND TRIM(recurrence_type) != ''",
        [],
    );
    let _ = conn.execute(
        "UPDATE tasks
         SET task_kind = 'recurring_template'
         WHERE task_kind = 'standard'
           AND recurrence_type IS NOT NULL
           AND TRIM(recurrence_type) != ''",
        [],
    );
    let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_tasks_planned_for_date ON tasks(planned_for_date)", []);
    let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_tasks_scheduled_for ON tasks(scheduled_for)", []);
    let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_tasks_task_kind ON tasks(task_kind)", []);
    let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_tasks_deleted ON tasks(deleted_at)", []);
    let _ = conn.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_recurring_instance_unique
         ON tasks(recurring_template_id, scheduled_for)
         WHERE recurring_template_id IS NOT NULL AND scheduled_for IS NOT NULL",
        [],
    );

    // habits table — streak columns added after initial schema
    let _ = conn.execute("ALTER TABLE habits ADD COLUMN streak_current INTEGER NOT NULL DEFAULT 0", []);
    let _ = conn.execute("ALTER TABLE habits ADD COLUMN streak_longest INTEGER NOT NULL DEFAULT 0", []);
    let _ = conn.execute("ALTER TABLE habits ADD COLUMN cadence_type TEXT NOT NULL DEFAULT 'daily'", []);
    let _ = conn.execute("ALTER TABLE habits ADD COLUMN cadence_days TEXT NOT NULL DEFAULT '[0,1,2,3,4,5,6]'", []);
    let _ = conn.execute("ALTER TABLE habits ADD COLUMN cadence_interval_days INTEGER NOT NULL DEFAULT 1", []);
    let _ = conn.execute("ALTER TABLE habits ADD COLUMN cadence_weekly_target INTEGER NOT NULL DEFAULT 1", []);
    let _ = conn.execute("ALTER TABLE habits ADD COLUMN cadence_anchor_date TEXT", []);
    let _ = conn.execute("ALTER TABLE habits ADD COLUMN target_type TEXT NOT NULL DEFAULT 'checkbox'", []);
    let _ = conn.execute("ALTER TABLE habits ADD COLUMN target_value INTEGER NOT NULL DEFAULT 1", []);
    let _ = conn.execute("ALTER TABLE habits ADD COLUMN minimum_value INTEGER", []);
    let _ = conn.execute("ALTER TABLE habits ADD COLUMN unit_label TEXT", []);
    let _ = conn.execute("ALTER TABLE habits ADD COLUMN minimum_version TEXT", []);
    let _ = conn.execute("ALTER TABLE habits ADD COLUMN recovery_grace_days INTEGER NOT NULL DEFAULT 1", []);
    let _ = conn.execute("ALTER TABLE habits ADD COLUMN restart_from_date TEXT", []);
    let _ = conn.execute("ALTER TABLE habits ADD COLUMN updated_at TEXT", []);
    let _ = conn.execute("ALTER TABLE habits ADD COLUMN deleted_at TEXT", []);
    let _ = conn.execute(
        "UPDATE habits SET cadence_type = frequency WHERE cadence_type IS NULL OR TRIM(cadence_type) = ''",
        [],
    );
    let _ = conn.execute(
        "UPDATE habits SET cadence_days = target_days WHERE cadence_days IS NULL OR TRIM(cadence_days) = ''",
        [],
    );
    let _ = conn.execute(
        "UPDATE habits SET cadence_interval_days = 1 WHERE cadence_interval_days IS NULL OR cadence_interval_days < 1",
        [],
    );
    let _ = conn.execute(
        "UPDATE habits SET cadence_weekly_target = 1 WHERE cadence_weekly_target IS NULL OR cadence_weekly_target < 1",
        [],
    );
    let _ = conn.execute(
        "UPDATE habits SET target_type = 'checkbox' WHERE target_type IS NULL OR TRIM(target_type) = ''",
        [],
    );
    let _ = conn.execute(
        "UPDATE habits SET target_value = 1 WHERE target_value IS NULL OR target_value < 1",
        [],
    );
    let _ = conn.execute(
        "UPDATE habits SET recovery_grace_days = 1 WHERE recovery_grace_days IS NULL OR recovery_grace_days < 0",
        [],
    );
    let _ = conn.execute(
        "UPDATE habits SET updated_at = created_at WHERE updated_at IS NULL OR TRIM(updated_at) = ''",
        [],
    );
    let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_habits_updated ON habits(updated_at)", []);
    let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_habits_deleted ON habits(deleted_at)", []);

    let _ = conn.execute("ALTER TABLE habit_logs ADD COLUMN value_completed INTEGER NOT NULL DEFAULT 1", []);
    let _ = conn.execute("ALTER TABLE habit_logs ADD COLUMN status TEXT NOT NULL DEFAULT 'completed'", []);
    let _ = conn.execute("ALTER TABLE habit_logs ADD COLUMN skip_reason TEXT", []);
    let _ = conn.execute("ALTER TABLE habit_logs ADD COLUMN updated_at TEXT", []);
    let _ = conn.execute("ALTER TABLE habit_logs ADD COLUMN deleted_at TEXT", []);
    let _ = conn.execute(
        "UPDATE habit_logs SET status = 'completed' WHERE status IS NULL OR TRIM(status) = ''",
        [],
    );
    let _ = conn.execute(
        "UPDATE habit_logs SET value_completed = 1 WHERE value_completed IS NULL OR value_completed < 0",
        [],
    );
    let _ = conn.execute(
        "UPDATE habit_logs SET updated_at = created_at WHERE updated_at IS NULL OR TRIM(updated_at) = ''",
        [],
    );
    let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_habit_logs_updated ON habit_logs(updated_at)", []);
    let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_habit_logs_deleted ON habit_logs(deleted_at)", []);

    // domains table — freeze tokens added after initial schema
    let _ = conn.execute("ALTER TABLE domains ADD COLUMN streak_freeze_tokens INTEGER NOT NULL DEFAULT 0", []);

    // xp_events table — AI scoring columns added after initial schema
    let _ = conn.execute("ALTER TABLE xp_events ADD COLUMN ai_scored INTEGER NOT NULL DEFAULT 0", []);
    let _ = conn.execute("ALTER TABLE xp_events ADD COLUMN ai_reasoning TEXT", []);

    // app_state table — columns added after initial schema
    let _ = conn.execute("ALTER TABLE app_state ADD COLUMN onboarding_complete INTEGER NOT NULL DEFAULT 0", []);
    let _ = conn.execute("ALTER TABLE app_state ADD COLUMN last_opened_date TEXT", []);
    let _ = conn.execute("ALTER TABLE app_state ADD COLUMN api_key TEXT", []);
    let _ = conn.execute("ALTER TABLE app_state ADD COLUMN backup_directory TEXT", []);
    let _ = conn.execute("ALTER TABLE app_state ADD COLUMN auto_backup_enabled INTEGER NOT NULL DEFAULT 0", []);
    let _ = conn.execute("ALTER TABLE app_state ADD COLUMN last_backup_at TEXT", []);
    let _ = conn.execute("ALTER TABLE app_state ADD COLUMN crt_intensity TEXT NOT NULL DEFAULT 'medium'", []);
    let _ = conn.execute("ALTER TABLE app_state ADD COLUMN text_scale TEXT NOT NULL DEFAULT 'normal'", []);
    let _ = conn.execute("ALTER TABLE app_state ADD COLUMN ui_density TEXT NOT NULL DEFAULT 'comfortable'", []);
    let _ = conn.execute("ALTER TABLE app_state ADD COLUMN sync_enabled INTEGER NOT NULL DEFAULT 0", []);
    let _ = conn.execute("ALTER TABLE app_state ADD COLUMN sync_provider TEXT", []);
    let _ = conn.execute("ALTER TABLE app_state ADD COLUMN sync_supabase_url TEXT", []);
    let _ = conn.execute("ALTER TABLE app_state ADD COLUMN sync_supabase_anon_key TEXT", []);
    let _ = conn.execute("ALTER TABLE app_state ADD COLUMN sync_access_token TEXT", []);
    let _ = conn.execute("ALTER TABLE app_state ADD COLUMN sync_refresh_token TEXT", []);
    let _ = conn.execute("ALTER TABLE app_state ADD COLUMN sync_user_id TEXT", []);
    let _ = conn.execute("ALTER TABLE app_state ADD COLUMN sync_user_email TEXT", []);
    let _ = conn.execute("ALTER TABLE app_state ADD COLUMN sync_last_sync_at TEXT", []);
    let _ = conn.execute("ALTER TABLE app_state ADD COLUMN sync_last_sync_error TEXT", []);
    let _ = conn.execute("ALTER TABLE app_state ADD COLUMN sync_last_pushed_at TEXT", []);
    let _ = conn.execute("ALTER TABLE app_state ADD COLUMN sync_last_pulled_at TEXT", []);
    let _ = conn.execute("UPDATE app_state SET crt_intensity = 'medium' WHERE crt_intensity IS NULL OR TRIM(crt_intensity) = ''", []);
    let _ = conn.execute("UPDATE app_state SET text_scale = 'normal' WHERE text_scale IS NULL OR TRIM(text_scale) = ''", []);
    let _ = conn.execute("UPDATE app_state SET ui_density = 'comfortable' WHERE ui_density IS NULL OR TRIM(ui_density) = ''", []);

    // restore_history table
    let _ = conn.execute(
        "CREATE TABLE IF NOT EXISTS restore_history (
            id TEXT PRIMARY KEY,
            file_path TEXT NOT NULL,
            backup_name TEXT NOT NULL,
            action TEXT NOT NULL DEFAULT 'restore',
            source_exported_at TEXT,
            source_version TEXT,
            created_at TEXT NOT NULL
        )",
        [],
    );
    let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_restore_history_created ON restore_history(created_at)", []);

    // notes table
    let _ = conn.execute("ALTER TABLE notes ADD COLUMN goal_id TEXT", []);
    let _ = conn.execute("ALTER TABLE notes ADD COLUMN deleted_at TEXT", []);
    let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_notes_goal ON notes(goal_id)", []);
    let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_notes_deleted ON notes(deleted_at)", []);

    // inbox_items table
    let _ = conn.execute("ALTER TABLE inbox_items ADD COLUMN domain_id TEXT", []);
    let _ = conn.execute("ALTER TABLE inbox_items ADD COLUMN source_label TEXT NOT NULL DEFAULT 'manual'", []);
    let _ = conn.execute("ALTER TABLE inbox_items ADD COLUMN suggested_kind TEXT NOT NULL DEFAULT 'generic'", []);
    let _ = conn.execute("ALTER TABLE inbox_items ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'", []);
    let _ = conn.execute("ALTER TABLE inbox_items ADD COLUMN triaged_at TEXT", []);
    let _ = conn.execute("ALTER TABLE inbox_items ADD COLUMN updated_at TEXT", []);
    let _ = conn.execute("ALTER TABLE inbox_items ADD COLUMN deleted_at TEXT", []);
    let _ = conn.execute(
        "UPDATE inbox_items SET source_label = 'manual' WHERE source_label IS NULL OR TRIM(source_label) = ''",
        [],
    );
    let _ = conn.execute(
        "UPDATE inbox_items SET suggested_kind = 'generic' WHERE suggested_kind IS NULL OR TRIM(suggested_kind) = ''",
        [],
    );
    let _ = conn.execute(
        "UPDATE inbox_items SET status = 'pending' WHERE status IS NULL OR TRIM(status) = ''",
        [],
    );
    let _ = conn.execute(
        "UPDATE inbox_items SET updated_at = COALESCE(triaged_at, created_at) WHERE updated_at IS NULL OR TRIM(updated_at) = ''",
        [],
    );
    let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_inbox_status ON inbox_items(status)", []);
    let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_inbox_created ON inbox_items(created_at)", []);
    let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_inbox_updated ON inbox_items(updated_at)", []);
    let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_inbox_deleted ON inbox_items(deleted_at)", []);

    let _ = conn.execute(
        "CREATE TABLE IF NOT EXISTS sync_queue (
            id TEXT PRIMARY KEY,
            entity_type TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            operation_type TEXT NOT NULL,
            payload_json TEXT NOT NULL,
            created_at TEXT NOT NULL,
            retry_count INTEGER NOT NULL DEFAULT 0,
            last_error TEXT
        )",
        [],
    );
    let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_sync_queue_created ON sync_queue(created_at)", []);
    let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_sync_queue_entity ON sync_queue(entity_type, entity_id)", []);
    let _ = conn.execute(
        "CREATE TABLE IF NOT EXISTS sync_cursors (
            entity_type TEXT PRIMARY KEY,
            last_pulled_at TEXT
        )",
        [],
    );
    let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_sync_cursors_pulled ON sync_cursors(last_pulled_at)", []);

    // task_templates table
    let _ = conn.execute("ALTER TABLE task_templates ADD COLUMN description TEXT", []);
    let _ = conn.execute("ALTER TABLE task_templates ADD COLUMN domain_id TEXT NOT NULL DEFAULT 'self'", []);
    let _ = conn.execute("ALTER TABLE task_templates ADD COLUMN priority TEXT NOT NULL DEFAULT 'medium'", []);
    let _ = conn.execute("ALTER TABLE task_templates ADD COLUMN is_mit INTEGER NOT NULL DEFAULT 0", []);
    let _ = conn.execute("ALTER TABLE task_templates ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'", []);
    let _ = conn.execute("ALTER TABLE task_templates ADD COLUMN time_estimate_minutes INTEGER", []);
    let _ = conn.execute("ALTER TABLE task_templates ADD COLUMN recurrence_rule TEXT", []);
    let _ = conn.execute("ALTER TABLE task_templates ADD COLUMN energy_level TEXT NOT NULL DEFAULT 'medium'", []);
    let _ = conn.execute("ALTER TABLE task_templates ADD COLUMN source_task_id TEXT", []);
    let _ = conn.execute("ALTER TABLE task_templates ADD COLUMN updated_at TEXT", []);
    let _ = conn.execute(
        "UPDATE task_templates SET tags = '[]' WHERE tags IS NULL OR TRIM(tags) = ''",
        [],
    );
    let _ = conn.execute(
        "UPDATE task_templates SET energy_level = 'medium' WHERE energy_level IS NULL OR TRIM(energy_level) = ''",
        [],
    );
    let _ = conn.execute(
        "UPDATE task_templates SET updated_at = created_at WHERE updated_at IS NULL",
        [],
    );
    let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_task_templates_domain ON task_templates(domain_id)", []);
    let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_task_templates_updated ON task_templates(updated_at)", []);
    let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_focus_sessions_task ON focus_sessions(task_id)", []);
    let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_focus_sessions_created ON focus_sessions(created_at)", []);
    let _ = conn.execute(
        "CREATE TABLE IF NOT EXISTS focus_timer_drafts (
            task_id TEXT PRIMARY KEY,
            planned_minutes INTEGER NOT NULL DEFAULT 25,
            elapsed_seconds INTEGER NOT NULL DEFAULT 0,
            distraction_count INTEGER NOT NULL DEFAULT 0,
            interruption_notes TEXT,
            reflection TEXT,
            is_running INTEGER NOT NULL DEFAULT 0,
            last_started_at TEXT,
            updated_at TEXT NOT NULL
        )",
        [],
    );
    let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_focus_timer_drafts_updated ON focus_timer_drafts(updated_at)", []);
    let _ = conn.execute("ALTER TABLE task_friction_logs ADD COLUMN action_type TEXT NOT NULL DEFAULT 'logged'", []);
    let _ = conn.execute(
        "UPDATE task_friction_logs SET action_type = 'logged' WHERE action_type IS NULL OR TRIM(action_type) = ''",
        [],
    );
    let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_task_friction_logs_task ON task_friction_logs(task_id)", []);
    let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_task_friction_logs_created ON task_friction_logs(created_at)", []);

    // goals table - execution fields
    let _ = conn.execute("ALTER TABLE goals ADD COLUMN next_action TEXT", []);
    let _ = conn.execute("ALTER TABLE goals ADD COLUMN review_date TEXT", []);
    let _ = conn.execute("ALTER TABLE goals ADD COLUMN blocked_by TEXT", []);
    let _ = conn.execute("ALTER TABLE goals ADD COLUMN health TEXT NOT NULL DEFAULT 'on_track'", []);
    let _ = conn.execute("ALTER TABLE goals ADD COLUMN deleted_at TEXT", []);
    let _ = conn.execute(
        "UPDATE goals SET health = 'on_track' WHERE health IS NULL OR TRIM(health) = ''",
        [],
    );
    let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_goals_deleted ON goals(deleted_at)", []);

    // Ensure app_state row exists (may be missing if DB was created before seed ran)
    let _ = conn.execute(
        "INSERT OR IGNORE INTO app_state (id, momentum_score, onboarding_complete) VALUES (1, 50, 0)",
        [],
    );
    // Fix momentum_score = 0 (SQLite default) → 50 so fresh users don't see RED ALERT
    let _ = conn.execute(
        "UPDATE app_state SET momentum_score = 50 WHERE id = 1 AND momentum_score = 0",
        [],
    );
    let _ = conn.execute(
        "UPDATE app_state SET onboarding_complete = 0 WHERE id = 1 AND NOT EXISTS (SELECT 1 FROM domains LIMIT 1)",
        [],
    );
    let _ = conn.execute("UPDATE achievements SET title = 'First Win', description = 'Complete your first task.' WHERE id = 'first_blood'", []);
    let _ = conn.execute("UPDATE achievements SET title = 'MIT Streak', description = 'Complete your most important task 5 days in a row.' WHERE id IN ('mit_master', 'mit_streak_5')", []);
    let _ = conn.execute("UPDATE achievements SET title = 'Domain Adept I', description = 'Reach Level 5 in one focus area.' WHERE id = 'warrior'", []);
    let _ = conn.execute("UPDATE achievements SET title = 'Domain Adept II', description = 'Reach Level 5 in two focus areas.' WHERE id = 'architect'", []);
    let _ = conn.execute("UPDATE achievements SET title = 'Domain Adept III', description = 'Reach Level 5 in three focus areas.' WHERE id = 'monk'", []);
    let _ = conn.execute("UPDATE achievements SET title = 'Balanced System', description = 'Keep all active domains within 10% XP of each other.' WHERE id = 'balanced'", []);
    let _ = conn.execute("UPDATE achievements SET title = 'Recovery', description = 'Recover from RED ALERT to 70+ momentum.' WHERE id = 'comeback'", []);
    let _ = conn.execute("UPDATE achievements SET title = 'Range', description = 'Complete work across multiple domains in a single day.' WHERE id = 'triple_threat'", []);

    Ok(())
}

fn seed_initial_data(conn: &Connection) -> Result<()> {
    // Seed domains if not present
    let domain_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM domains",
        [],
        |row| row.get(0),
    )?;

    if false && domain_count == 0 {
        let domains = vec![
            ("military", "Military", "⚔️", "#C8A96E"),
            ("builder", "Builder", "🛠️", "#4A9EFF"),
            ("self", "Self", "🌱", "#7EC87A"),
        ];
        for (id, name, icon, color) in domains {
            conn.execute(
                "INSERT INTO domains (id, name, icon, color) VALUES (?1, ?2, ?3, ?4)",
                params![id, name, icon, color],
            )?;
        }
    }

    // Seed achievements if not present
    let ach_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM achievements",
        [],
        |row| row.get(0),
    )?;

    if ach_count == 0 {
        let achievements = vec![
            ("first_blood", "First Win", "Complete your first task.", "[FB]"),
            ("on_fire", "On Fire", "7-day streak in any domain", "[OF]"),
            ("overdrive", "Overdrive", "Earn 200+ XP in a single day", "[OD]"),
            ("mit_master", "MIT Streak", "Complete your most important task 5 days in a row.", "[CH]"),
            ("warrior", "Domain Adept I", "Reach Level 5 in one focus area.", "[WR]"),
            ("architect", "Domain Adept II", "Reach Level 5 in two focus areas.", "[AR]"),
            ("monk", "Domain Adept III", "Reach Level 5 in three focus areas.", "[MK]"),
            ("balanced", "Balanced System", "Keep all active domains within 10% XP of each other.", "[BL]"),
            ("comeback", "Recovery", "Recover from RED ALERT to 70+ momentum.", "[CB]"),
            ("dawn_operator", "Dawn Operator", "Complete a task before 7am, 5 different days", "[DO]"),
            ("centurion", "Centurion", "Complete 100 tasks total", "[CT]"),
            ("habit_machine", "Habit Machine", "30-day habit streak", "[HM]"),
            ("goal_crusher", "Goal Crusher", "Complete 10 goals", "[GC]"),
            ("deep_work", "Deep Work", "Complete 5 tasks with 90min+ time estimate in a week", "[DW]"),
            ("triple_threat", "Range", "Complete work across multiple domains in a single day.", "[TT]"),
            ("level_10", "Legend", "Reach Level 10 in any domain", "[LG]"),
            ("streak_30", "Ironclad", "30-day streak in any domain", "[IC]"),
            ("xp_10000", "Veteran", "Earn 10,000 total XP", "[VT]"),
            ("all_habits", "Perfect Day", "Complete all habits in a single day", "[PD]"),
            ("mit_streak_5", "MIT Streak", "Complete your most important task 5 days in a row.", "[MM]"),
        ];
        for (id, title, desc, icon) in achievements {
            conn.execute(
                "INSERT INTO achievements (id, title, description, icon) VALUES (?1, ?2, ?3, ?4)",
                params![id, title, desc, icon],
            )?;
        }
    }

    // Seed app_state if not present
    let state_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM app_state",
        [],
        |row| row.get(0),
    )?;

    if state_count == 0 {
        conn.execute(
            "INSERT INTO app_state (id, momentum_score) VALUES (1, 50)",
            [],
        )?;
    }

    Ok(())
}
