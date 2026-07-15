use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use tauri::Manager;
use tauri::State;
use std::collections::{BTreeSet, HashMap};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use uuid::Uuid;
use chrono::{DateTime, Datelike, Duration, NaiveDate, Utc};
use crate::credentials;

pub struct DbState(pub Mutex<Connection>);

// ─── Types ────────────────────────────────────────────────────────────────────

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

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateDomainPayload {
    pub name: String,
    pub icon: String,
    pub color: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateDomainProfilePayload {
    pub id: String,
    pub name: Option<String>,
    pub icon: Option<String>,
    pub color: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Task {
    pub id: String,
    pub domain_id: String,
    pub title: String,
    pub description: Option<String>,
    pub priority: String,
    pub energy_level: String,
    pub status: String,
    pub is_mit: bool,
    #[serde(default)]
    pub is_top_three: bool,
    pub xp_value: i64,
    pub xp_awarded: bool,
    pub parent_task_id: Option<String>,
    pub goal_id: Option<String>,
    pub tags: String,
    pub time_estimate_minutes: Option<i64>,
    pub due_date: Option<String>,
    #[serde(default)]
    pub planned_for_date: Option<String>,
    #[serde(default = "default_task_kind")]
    pub task_kind: String,
    #[serde(default)]
    pub scheduled_for: Option<String>,
    #[serde(default)]
    pub recurring_template_id: Option<String>,
    pub completed_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    #[serde(default)]
    pub deleted_at: Option<String>,
    pub attachments: String,
    #[serde(default)]
    pub recurrence_type: Option<String>,
    #[serde(default)]
    pub recurrence_interval: Option<i64>,
    #[serde(default = "default_json_array")]
    pub recurrence_days: String,
    #[serde(default)]
    pub recurrence_anchor_date: Option<String>,
    #[serde(default)]
    pub recurrence_rule: Option<String>,
    pub time_actual_minutes: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateTaskPayload {
    pub domain_id: String,
    pub title: String,
    pub description: Option<String>,
    pub priority: String,
    pub energy_level: Option<String>,
    pub status: Option<String>,
    pub is_mit: bool,
    #[serde(default)]
    pub is_top_three: bool,
    #[serde(default)]
    pub xp_value: i64,
    pub parent_task_id: Option<String>,
    pub goal_id: Option<String>,
    pub tags: Option<String>,
    pub time_estimate_minutes: Option<i64>,
    pub due_date: Option<String>,
    pub planned_for_date: Option<String>,
    pub task_kind: Option<String>,
    pub scheduled_for: Option<String>,
    pub recurring_template_id: Option<String>,
    pub recurrence_type: Option<String>,
    pub recurrence_interval: Option<i64>,
    pub recurrence_days: Option<String>,
    pub recurrence_anchor_date: Option<String>,
    pub recurrence_rule: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateTaskPayload {
    pub id: String,
    pub domain_id: Option<String>,
    pub title: Option<String>,
    pub description: Option<String>,
    pub priority: Option<String>,
    pub energy_level: Option<String>,
    pub status: Option<String>,
    pub is_mit: Option<bool>,
    pub is_top_three: Option<bool>,
    pub xp_value: Option<i64>,
    pub parent_task_id: Option<String>,
    pub goal_id: Option<String>,
    pub tags: Option<String>,
    pub time_estimate_minutes: Option<i64>,
    pub due_date: Option<String>,
    pub planned_for_date: Option<String>,
    pub task_kind: Option<String>,
    pub scheduled_for: Option<String>,
    pub recurring_template_id: Option<String>,
    pub recurrence_type: Option<String>,
    pub recurrence_interval: Option<i64>,
    pub recurrence_days: Option<String>,
    pub recurrence_anchor_date: Option<String>,
    pub completed_at: Option<String>,
    pub attachments: Option<String>,
    pub recurrence_rule: Option<String>,
    pub time_actual_minutes: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Habit {
    pub id: String,
    pub domain_id: String,
    pub title: String,
    pub description: Option<String>,
    pub frequency: String,
    pub target_days: String,
    pub xp_per_completion: i64,
    #[serde(default = "default_cadence_type")]
    pub cadence_type: String,
    #[serde(default = "default_cadence_days")]
    pub cadence_days: String,
    #[serde(default = "default_cadence_interval_days")]
    pub cadence_interval_days: i64,
    #[serde(default = "default_cadence_weekly_target")]
    pub cadence_weekly_target: i64,
    #[serde(default)]
    pub cadence_anchor_date: Option<String>,
    #[serde(default = "default_target_type")]
    pub target_type: String,
    #[serde(default = "default_target_value")]
    pub target_value: i64,
    #[serde(default)]
    pub minimum_value: Option<i64>,
    #[serde(default)]
    pub unit_label: Option<String>,
    #[serde(default)]
    pub minimum_version: Option<String>,
    #[serde(default = "default_recovery_grace_days")]
    pub recovery_grace_days: i64,
    #[serde(default)]
    pub restart_from_date: Option<String>,
    pub streak_current: i64,
    pub streak_longest: i64,
    pub is_active: bool,
    pub created_at: String,
    #[serde(default)]
    pub updated_at: String,
    #[serde(default)]
    pub deleted_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateHabitPayload {
    pub domain_id: String,
    pub title: String,
    pub description: Option<String>,
    pub frequency: String,
    pub target_days: String,
    #[serde(default)]
    pub xp_per_completion: i64,
    pub cadence_type: Option<String>,
    pub cadence_days: Option<String>,
    pub cadence_interval_days: Option<i64>,
    pub cadence_weekly_target: Option<i64>,
    pub cadence_anchor_date: Option<String>,
    pub target_type: Option<String>,
    pub target_value: Option<i64>,
    pub minimum_value: Option<i64>,
    pub unit_label: Option<String>,
    pub minimum_version: Option<String>,
    pub recovery_grace_days: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateHabitPayload {
    pub id: String,
    pub domain_id: Option<String>,
    pub title: Option<String>,
    pub description: Option<String>,
    pub frequency: Option<String>,
    pub target_days: Option<String>,
    pub xp_per_completion: Option<i64>,
    pub cadence_type: Option<String>,
    pub cadence_days: Option<String>,
    pub cadence_interval_days: Option<i64>,
    pub cadence_weekly_target: Option<i64>,
    pub cadence_anchor_date: Option<String>,
    pub target_type: Option<String>,
    pub target_value: Option<i64>,
    pub minimum_value: Option<i64>,
    pub unit_label: Option<String>,
    pub minimum_version: Option<String>,
    pub recovery_grace_days: Option<i64>,
    pub restart_from_date: Option<String>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HabitLog {
    pub id: String,
    pub habit_id: String,
    pub completed_date: String,
    pub xp_awarded: i64,
    #[serde(default = "default_target_value")]
    pub value_completed: i64,
    #[serde(default = "default_habit_log_status")]
    pub status: String,
    #[serde(default)]
    pub skip_reason: Option<String>,
    pub created_at: String,
    #[serde(default)]
    pub updated_at: String,
    #[serde(default)]
    pub deleted_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FocusTimerDraft {
    pub task_id: String,
    pub planned_minutes: i64,
    pub elapsed_seconds: i64,
    pub distraction_count: i64,
    pub interruption_notes: Option<String>,
    pub reflection: Option<String>,
    pub is_running: bool,
    pub last_started_at: Option<String>,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SaveFocusTimerDraftPayload {
    pub task_id: String,
    pub planned_minutes: i64,
    pub elapsed_seconds: i64,
    pub distraction_count: i64,
    pub interruption_notes: Option<String>,
    pub reflection: Option<String>,
    pub is_running: bool,
    pub last_started_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Goal {
    pub id: String,
    pub domain_id: String,
    pub title: String,
    pub description: Option<String>,
    pub parent_goal_id: Option<String>,
    pub status: String,
    #[serde(default)]
    pub next_action: Option<String>,
    #[serde(default)]
    pub review_date: Option<String>,
    #[serde(default)]
    pub blocked_by: Option<String>,
    #[serde(default = "default_goal_health")]
    pub health: String,
    pub target_date: Option<String>,
    pub progress_percent: i64,
    pub created_at: String,
    pub updated_at: String,
    #[serde(default)]
    pub deleted_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateGoalPayload {
    pub domain_id: String,
    pub title: String,
    pub description: Option<String>,
    pub parent_goal_id: Option<String>,
    pub next_action: Option<String>,
    pub review_date: Option<String>,
    pub blocked_by: Option<String>,
    pub health: Option<String>,
    pub target_date: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateGoalPayload {
    pub id: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub status: Option<String>,
    pub next_action: Option<String>,
    pub review_date: Option<String>,
    pub blocked_by: Option<String>,
    pub health: Option<String>,
    pub target_date: Option<String>,
    pub progress_percent: Option<i64>,
}

fn row_to_goal(row: &rusqlite::Row) -> rusqlite::Result<Goal> {
    Ok(Goal {
        id: row.get(0)?,
        domain_id: row.get(1)?,
        title: row.get(2)?,
        description: row.get(3)?,
        parent_goal_id: row.get(4)?,
        status: row.get(5)?,
        next_action: row.get(6)?,
        review_date: row.get(7)?,
        blocked_by: row.get(8)?,
        health: row.get(9)?,
        target_date: row.get(10)?,
        progress_percent: row.get(11)?,
        created_at: row.get(12)?,
        updated_at: row.get(13)?,
        deleted_at: row.get(14)?,
    })
}

fn row_to_task(row: &rusqlite::Row) -> rusqlite::Result<Task> {
    Ok(Task {
        id: row.get(0)?,
        domain_id: row.get(1)?,
        title: row.get(2)?,
        description: row.get(3)?,
        priority: row.get(4)?,
        energy_level: row.get::<_, Option<String>>(5)?.unwrap_or_else(default_energy_level),
        status: row.get(6)?,
        is_mit: row.get::<_, i64>(7)? != 0,
        is_top_three: row.get::<_, Option<i64>>(8)?.unwrap_or(0) != 0,
        xp_value: row.get::<_, Option<i64>>(9)?.unwrap_or_else(default_xp_value),
        xp_awarded: row.get::<_, Option<i64>>(10)?.unwrap_or(0) != 0,
        parent_task_id: row.get(11)?,
        goal_id: row.get(12)?,
        tags: row.get::<_, Option<String>>(13)?.unwrap_or_else(default_json_array),
        time_estimate_minutes: row.get(14)?,
        due_date: row.get(15)?,
        planned_for_date: row.get(16)?,
        task_kind: row.get::<_, Option<String>>(17)?.unwrap_or_else(default_task_kind),
        scheduled_for: row.get(18)?,
        recurring_template_id: row.get(19)?,
        recurrence_type: row.get(20)?,
        recurrence_interval: row.get(21)?,
        recurrence_days: row.get::<_, Option<String>>(22)?.unwrap_or_else(default_json_array),
        recurrence_anchor_date: row.get(23)?,
        completed_at: row.get(24)?,
        created_at: row.get(25)?,
        updated_at: row.get(26)?,
        deleted_at: row.get(27)?,
        attachments: row.get::<_, Option<String>>(28)?.unwrap_or_else(default_json_array),
        recurrence_rule: row.get(29)?,
        time_actual_minutes: row.get(30)?,
    })
}

fn row_to_habit(row: &rusqlite::Row) -> rusqlite::Result<Habit> {
    Ok(Habit {
        id: row.get(0)?,
        domain_id: row.get(1)?,
        title: row.get(2)?,
        description: row.get(3)?,
        frequency: row.get(4)?,
        target_days: row.get::<_, Option<String>>(5)?.unwrap_or_else(default_cadence_days),
        xp_per_completion: row.get::<_, Option<i64>>(6)?.unwrap_or(15),
        cadence_type: row.get::<_, Option<String>>(7)?.unwrap_or_else(default_cadence_type),
        cadence_days: row.get::<_, Option<String>>(8)?.unwrap_or_else(default_cadence_days),
        cadence_interval_days: row.get::<_, Option<i64>>(9)?.unwrap_or_else(default_cadence_interval_days),
        cadence_weekly_target: row.get::<_, Option<i64>>(10)?.unwrap_or_else(default_cadence_weekly_target),
        cadence_anchor_date: row.get(11)?,
        target_type: row.get::<_, Option<String>>(12)?.unwrap_or_else(default_target_type),
        target_value: row.get::<_, Option<i64>>(13)?.unwrap_or_else(default_target_value),
        minimum_value: row.get(14)?,
        unit_label: row.get(15)?,
        minimum_version: row.get(16)?,
        recovery_grace_days: row.get::<_, Option<i64>>(17)?.unwrap_or_else(default_recovery_grace_days),
        restart_from_date: row.get(18)?,
        streak_current: row.get::<_, Option<i64>>(19)?.unwrap_or(0),
        streak_longest: row.get::<_, Option<i64>>(20)?.unwrap_or(0),
        is_active: row.get::<_, i64>(21)? != 0,
        created_at: row.get(22)?,
        updated_at: row.get::<_, Option<String>>(23)?.unwrap_or_else(|| row.get::<_, String>(22).unwrap_or_default()),
        deleted_at: row.get(24)?,
    })
}

fn row_to_habit_log(row: &rusqlite::Row) -> rusqlite::Result<HabitLog> {
    Ok(HabitLog {
        id: row.get(0)?,
        habit_id: row.get(1)?,
        completed_date: row.get(2)?,
        xp_awarded: row.get::<_, Option<i64>>(3)?.unwrap_or(0),
        value_completed: row.get::<_, Option<i64>>(4)?.unwrap_or_else(default_target_value),
        status: row.get::<_, Option<String>>(5)?.unwrap_or_else(default_habit_log_status),
        skip_reason: row.get(6)?,
        created_at: row.get(7)?,
        updated_at: row.get::<_, Option<String>>(8)?.unwrap_or_else(|| row.get::<_, String>(7).unwrap_or_default()),
        deleted_at: row.get(9)?,
    })
}

fn row_to_focus_timer_draft(row: &rusqlite::Row) -> rusqlite::Result<FocusTimerDraft> {
    Ok(FocusTimerDraft {
        task_id: row.get(0)?,
        planned_minutes: row.get(1)?,
        elapsed_seconds: row.get(2)?,
        distraction_count: row.get(3)?,
        interruption_notes: row.get(4)?,
        reflection: row.get(5)?,
        is_running: row.get::<_, i64>(6)? != 0,
        last_started_at: row.get(7)?,
        updated_at: row.get(8)?,
    })
}

#[derive(Debug, Serialize, Deserialize, Clone)]
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

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Achievement {
    pub id: String,
    pub title: String,
    pub description: String,
    pub icon: String,
    pub unlocked: bool,
    pub unlocked_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppStateRow {
    pub id: i64,
    pub momentum_score: i64,
    pub last_momentum_calc: Option<String>,
    pub current_mit_task_id: Option<String>,
    pub api_key: Option<String>,
    pub onboarding_complete: bool,
    pub last_opened_date: Option<String>,
    pub backup_directory: Option<String>,
    pub auto_backup_enabled: bool,
    pub last_backup_at: Option<String>,
    pub crt_intensity: String,
    pub text_scale: String,
    pub ui_density: String,
    pub sync_enabled: bool,
    pub sync_provider: Option<String>,
    pub sync_supabase_url: Option<String>,
    pub sync_supabase_anon_key: Option<String>,
    pub sync_access_token: Option<String>,
    pub sync_refresh_token: Option<String>,
    pub sync_user_id: Option<String>,
    pub sync_user_email: Option<String>,
    pub sync_last_sync_at: Option<String>,
    pub sync_last_sync_error: Option<String>,
    pub sync_last_pushed_at: Option<String>,
    pub sync_last_pulled_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SyncConfigPayload {
    pub supabase_url: String,
    pub supabase_anon_key: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SyncSessionPayload {
    pub access_token: String,
    pub refresh_token: String,
    pub user_id: String,
    pub user_email: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SyncStatusPayload {
    pub last_sync_at: Option<String>,
    pub last_sync_error: Option<String>,
    pub last_pushed_at: Option<String>,
    pub last_pulled_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SyncQueueItem {
    pub id: String,
    pub entity_type: String,
    pub entity_id: String,
    pub operation_type: String,
    pub payload_json: String,
    pub created_at: String,
    pub retry_count: i64,
    pub last_error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SyncCursor {
    pub entity_type: String,
    pub last_pulled_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct SyncCounts {
    pub domains: i64,
    pub tasks: i64,
    pub habits: i64,
    pub habit_logs: i64,
    pub goals: i64,
    pub notes: i64,
    pub inbox_items: i64,
    pub total: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SyncPayload {
    pub exported_at: String,
    pub app_version: String,
    pub domains: Vec<Domain>,
    pub tasks: Vec<Task>,
    pub habits: Vec<Habit>,
    pub habit_logs: Vec<HabitLog>,
    pub goals: Vec<Goal>,
    pub notes: Vec<Note>,
    pub inbox_items: Vec<InboxItem>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
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

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BackupPreview {
    pub file_path: Option<String>,
    pub file_name: Option<String>,
    pub backup_name: String,
    pub exported_at: Option<String>,
    pub version: Option<String>,
    pub counts: BackupCounts,
    pub compatibility: String,
    pub warnings: Vec<String>,
    pub modified_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BackupHistoryItem {
    pub file_path: String,
    pub file_name: String,
    pub backup_name: String,
    pub exported_at: Option<String>,
    pub version: Option<String>,
    pub modified_at: Option<String>,
    pub last_action: String,
    pub compatibility: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BackupHealthStatus {
    pub backup_directory: String,
    pub auto_backup_enabled: bool,
    pub last_backup_at: Option<String>,
    pub latest_backup: Option<BackupHistoryItem>,
    pub latest_backup_age_hours: Option<i64>,
    pub pending_warnings: Vec<String>,
    pub status_label: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct InboxItem {
    pub id: String,
    pub content: String,
    pub domain_id: Option<String>,
    #[serde(default = "default_inbox_source")]
    pub source_label: String,
    #[serde(default = "default_inbox_suggested_kind")]
    pub suggested_kind: String,
    #[serde(default = "default_inbox_status")]
    pub status: String,
    pub created_at: String,
    pub triaged_at: Option<String>,
    #[serde(default)]
    pub updated_at: String,
    #[serde(default)]
    pub deleted_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateInboxItemPayload {
    pub content: String,
    pub domain_id: Option<String>,
    pub source_label: String,
    pub suggested_kind: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TriageInboxItemPayload {
    pub id: String,
    pub action: String,
    pub domain_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TaskTemplate {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub domain_id: String,
    pub priority: String,
    pub energy_level: String,
    pub is_mit: bool,
    pub tags: String,
    pub time_estimate_minutes: Option<i64>,
    pub recurrence_rule: Option<String>,
    pub source_task_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateTaskTemplatePayload {
    pub title: String,
    pub description: Option<String>,
    pub domain_id: String,
    pub priority: String,
    pub energy_level: Option<String>,
    pub is_mit: bool,
    pub tags: Option<String>,
    pub time_estimate_minutes: Option<i64>,
    pub recurrence_rule: Option<String>,
    pub source_task_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateTaskTemplatePayload {
    pub id: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub domain_id: Option<String>,
    pub priority: Option<String>,
    pub energy_level: Option<String>,
    pub is_mit: Option<bool>,
    pub tags: Option<String>,
    pub time_estimate_minutes: Option<i64>,
    pub recurrence_rule: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ExportPayload {
    exported_at: String,
    version: String,
    domains: Vec<Domain>,
    tasks: Vec<Task>,
    habits: Vec<Habit>,
    habit_logs: Vec<HabitLog>,
    goals: Vec<Goal>,
    xp_events: Vec<XpEvent>,
    achievements: Vec<Achievement>,
    notes: Vec<Note>,
    inbox_items: Vec<InboxItem>,
    task_templates: Vec<TaskTemplate>,
    focus_sessions: Vec<FocusSession>,
    focus_timer_drafts: Vec<FocusTimerDraft>,
    task_friction_logs: Vec<TaskFrictionLog>,
    app_state: AppStateRow,
}

#[derive(Debug, Deserialize, Default)]
struct ImportPayload {
    #[serde(default)]
    exported_at: Option<String>,
    #[serde(default)]
    version: Option<String>,
    #[serde(default)]
    domains: Vec<Domain>,
    #[serde(default)]
    tasks: Vec<ImportTask>,
    #[serde(default)]
    habits: Vec<Habit>,
    #[serde(default)]
    habit_logs: Vec<HabitLog>,
    #[serde(default)]
    goals: Vec<Goal>,
    #[serde(default)]
    xp_events: Vec<XpEvent>,
    #[serde(default)]
    achievements: Vec<Achievement>,
    #[serde(default)]
    notes: Vec<ImportNote>,
    #[serde(default)]
    inbox_items: Vec<InboxItem>,
    #[serde(default)]
    task_templates: Vec<TaskTemplate>,
    #[serde(default)]
    focus_sessions: Vec<FocusSession>,
    #[serde(default)]
    focus_timer_drafts: Vec<FocusTimerDraft>,
    #[serde(default)]
    task_friction_logs: Vec<TaskFrictionLog>,
    app_state: Option<ImportAppState>,
}

#[derive(Debug, Deserialize)]
struct ImportTask {
    id: String,
    domain_id: String,
    title: String,
    description: Option<String>,
    priority: String,
    #[serde(default = "default_energy_level")]
    energy_level: String,
    status: String,
    #[serde(default)]
    is_mit: bool,
    #[serde(default)]
    is_top_three: bool,
    #[serde(default = "default_xp_value")]
    xp_value: i64,
    #[serde(default)]
    xp_awarded: bool,
    parent_task_id: Option<String>,
    goal_id: Option<String>,
    #[serde(default = "default_json_array")]
    tags: String,
    time_estimate_minutes: Option<i64>,
    due_date: Option<String>,
    #[serde(default)]
    planned_for_date: Option<String>,
    #[serde(default = "default_task_kind")]
    task_kind: String,
    #[serde(default)]
    scheduled_for: Option<String>,
    #[serde(default)]
    recurring_template_id: Option<String>,
    #[serde(default)]
    recurrence_type: Option<String>,
    #[serde(default)]
    recurrence_interval: Option<i64>,
    #[serde(default = "default_json_array")]
    recurrence_days: String,
    #[serde(default)]
    recurrence_anchor_date: Option<String>,
    completed_at: Option<String>,
    created_at: String,
    updated_at: String,
    #[serde(default)]
    deleted_at: Option<String>,
    #[serde(default = "default_json_array")]
    attachments: String,
    #[serde(default)]
    recurrence_rule: Option<String>,
    #[serde(default)]
    time_actual_minutes: Option<i64>,
}

#[derive(Debug, Deserialize)]
struct ImportNote {
    id: String,
    domain_id: Option<String>,
    #[serde(default)]
    goal_id: Option<String>,
    title: String,
    #[serde(default)]
    content: String,
    #[serde(default = "default_json_array")]
    tags: String,
    #[serde(default)]
    pinned: bool,
    created_at: String,
    updated_at: String,
    #[serde(default)]
    deleted_at: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ImportAppState {
    #[serde(default = "default_app_state_id")]
    id: i64,
    #[serde(default = "default_momentum_score")]
    momentum_score: i64,
    #[serde(default)]
    last_momentum_calc: Option<String>,
    #[serde(default)]
    current_mit_task_id: Option<String>,
    #[serde(default)]
    api_key: Option<String>,
    #[serde(default)]
    onboarding_complete: bool,
    #[serde(default)]
    last_opened_date: Option<String>,
    #[serde(default)]
    backup_directory: Option<String>,
    #[serde(default)]
    auto_backup_enabled: bool,
    #[serde(default)]
    last_backup_at: Option<String>,
    #[serde(default = "default_crt_intensity")]
    crt_intensity: String,
    #[serde(default = "default_text_scale")]
    text_scale: String,
    #[serde(default = "default_ui_density")]
    ui_density: String,
    #[serde(default)]
    sync_enabled: bool,
    #[serde(default)]
    sync_provider: Option<String>,
    #[serde(default)]
    sync_supabase_url: Option<String>,
    #[serde(default)]
    sync_supabase_anon_key: Option<String>,
    #[serde(default)]
    sync_access_token: Option<String>,
    #[serde(default)]
    sync_refresh_token: Option<String>,
    #[serde(default)]
    sync_user_id: Option<String>,
    #[serde(default)]
    sync_user_email: Option<String>,
    #[serde(default)]
    sync_last_sync_at: Option<String>,
    #[serde(default)]
    sync_last_sync_error: Option<String>,
    #[serde(default)]
    sync_last_pushed_at: Option<String>,
    #[serde(default)]
    sync_last_pulled_at: Option<String>,
}

fn default_json_array() -> String {
    "[]".to_string()
}

fn default_xp_value() -> i64 {
    30
}

fn default_task_kind() -> String {
    "standard".to_string()
}

fn default_app_state_id() -> i64 {
    1
}

fn default_momentum_score() -> i64 {
    50
}

fn default_goal_health() -> String {
    "on_track".to_string()
}

fn default_recovery_grace_days() -> i64 {
    1
}

fn default_habit_log_status() -> String {
    "completed".to_string()
}

fn default_energy_level() -> String {
    "medium".to_string()
}

fn default_cadence_type() -> String {
    "daily".to_string()
}

fn default_cadence_days() -> String {
    "[0,1,2,3,4,5,6]".to_string()
}

fn default_cadence_interval_days() -> i64 {
    1
}

fn default_cadence_weekly_target() -> i64 {
    1
}

fn default_target_type() -> String {
    "checkbox".to_string()
}

fn default_target_value() -> i64 {
    1
}

fn default_inbox_source() -> String {
    "manual".to_string()
}

fn default_inbox_suggested_kind() -> String {
    "generic".to_string()
}

fn default_inbox_status() -> String {
    "pending".to_string()
}

fn default_crt_intensity() -> String {
    "medium".to_string()
}

fn default_text_scale() -> String {
    "normal".to_string()
}

fn default_ui_density() -> String {
    "comfortable".to_string()
}

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
        // Uses a distinct keychain field name from the other test in this module
        // (`api_key_readback` vs. `api_key`) so the two tests don't race on the
        // same OS credential-store entry when cargo runs them in parallel. This
        // is safe because `sql_value` is `None` here, so `migrate_and_read_secret`
        // never touches the SQL column and this field name doesn't need to match
        // an actual `app_state` column.
        let conn = setup_conn();
        credentials::set_secret_in(TEST_SERVICE_NAME, "api_key_readback", "already-migrated").unwrap();

        let result = migrate_and_read_secret(&conn, TEST_SERVICE_NAME, "api_key_readback", None).unwrap();
        assert_eq!(result, Some("already-migrated".to_string()));

        credentials::delete_secret_from(TEST_SERVICE_NAME, "api_key_readback").unwrap();
    }
}

fn task_select_columns() -> &'static str {
    "id, domain_id, title, description, priority, energy_level, status, is_mit, is_top_three, xp_value, xp_awarded, parent_task_id, goal_id, tags, time_estimate_minutes, due_date, planned_for_date, task_kind, scheduled_for, recurring_template_id, recurrence_type, recurrence_interval, recurrence_days, recurrence_anchor_date, completed_at, created_at, updated_at, deleted_at, attachments, recurrence_rule, time_actual_minutes"
}

fn habit_select_columns() -> &'static str {
    "id, domain_id, title, description, frequency, target_days, xp_per_completion, cadence_type, cadence_days, cadence_interval_days, cadence_weekly_target, cadence_anchor_date, target_type, target_value, minimum_value, unit_label, minimum_version, recovery_grace_days, restart_from_date, streak_current, streak_longest, is_active, created_at, updated_at, deleted_at"
}

fn habit_log_select_columns() -> &'static str {
    "id, habit_id, completed_date, xp_awarded, value_completed, status, skip_reason, created_at, updated_at, deleted_at"
}

fn load_export_payload(conn: &Connection) -> Result<ExportPayload, String> {
    sync_habit_streaks(conn)?;

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

    let tasks = {
        let mut stmt = conn.prepare(
            &format!("SELECT {} FROM tasks ORDER BY created_at DESC", task_select_columns())
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], row_to_task).map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
    };

    let habits = {
        let mut stmt = conn.prepare(
            &format!("SELECT {} FROM habits ORDER BY created_at DESC", habit_select_columns())
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], row_to_habit).map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
    };

    let goals = {
        let mut stmt = conn.prepare(
            "SELECT id, domain_id, title, description, parent_goal_id, status, next_action, review_date, blocked_by, health, target_date, progress_percent, created_at, updated_at, deleted_at FROM goals ORDER BY created_at DESC"
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], row_to_goal).map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
    };

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

    let notes = {
        let mut stmt = conn.prepare(
            "SELECT id, domain_id, goal_id, title, content, tags, pinned, created_at, updated_at, deleted_at FROM notes ORDER BY pinned DESC, updated_at DESC"
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], row_to_note).map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
    };

    let inbox_items = {
        let mut stmt = conn.prepare(
            "SELECT id, content, domain_id, source_label, suggested_kind, status, created_at, triaged_at, updated_at, deleted_at FROM inbox_items ORDER BY created_at DESC"
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], row_to_inbox_item).map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
    };

    let task_templates = {
        let mut stmt = conn.prepare(
            "SELECT id, title, description, domain_id, priority, energy_level, is_mit, tags, time_estimate_minutes, recurrence_rule, source_task_id, created_at, updated_at FROM task_templates ORDER BY updated_at DESC"
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], |row| {
            Ok(TaskTemplate {
                id: row.get(0)?,
                title: row.get(1)?,
                description: row.get(2)?,
                domain_id: row.get(3)?,
                priority: row.get(4)?,
                energy_level: row.get::<_, Option<String>>(5)?.unwrap_or_else(|| "medium".to_string()),
                is_mit: row.get::<_, i64>(6)? != 0,
                tags: row.get::<_, Option<String>>(7)?.unwrap_or_else(|| "[]".to_string()),
                time_estimate_minutes: row.get(8)?,
                recurrence_rule: row.get(9)?,
                source_task_id: row.get(10)?,
                created_at: row.get(11)?,
                updated_at: row.get(12)?,
            })
        }).map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
    };

    let focus_sessions = {
        let mut stmt = conn.prepare(
            "SELECT fs.id, fs.task_id, t.title, t.domain_id, fs.planned_minutes, fs.actual_minutes, fs.distraction_count, fs.interruption_notes, fs.reflection, fs.created_at, fs.started_at, fs.ended_at
             FROM focus_sessions fs
             JOIN tasks t ON t.id = fs.task_id
             ORDER BY fs.created_at DESC"
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], |row| {
            Ok(FocusSession {
                id: row.get(0)?,
                task_id: row.get(1)?,
                task_title: row.get(2)?,
                domain_id: row.get(3)?,
                planned_minutes: row.get(4)?,
                actual_minutes: row.get(5)?,
                distraction_count: row.get(6)?,
                interruption_notes: row.get(7)?,
                reflection: row.get(8)?,
                created_at: row.get(9)?,
                started_at: row.get(10)?,
                ended_at: row.get(11)?,
            })
        }).map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
    };

    let focus_timer_drafts = {
        let mut stmt = conn.prepare(
            "SELECT task_id, planned_minutes, elapsed_seconds, distraction_count, interruption_notes, reflection, is_running, last_started_at, updated_at FROM focus_timer_drafts ORDER BY updated_at DESC"
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], row_to_focus_timer_draft).map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
    };

    let task_friction_logs = {
        let mut stmt = conn.prepare(
            "SELECT fl.id, fl.task_id, t.title, t.domain_id, fl.reason, fl.details, fl.action_type, fl.created_at
             FROM task_friction_logs fl
             JOIN tasks t ON t.id = fl.task_id
             ORDER BY fl.created_at DESC"
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], |row| {
            Ok(TaskFrictionLog {
                id: row.get(0)?,
                task_id: row.get(1)?,
                task_title: row.get(2)?,
                domain_id: row.get(3)?,
                reason: row.get(4)?,
                details: row.get(5)?,
                action_type: row.get(6)?,
                created_at: row.get(7)?,
            })
        }).map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
    };

    let habit_logs = {
        let mut stmt = conn.prepare(
            &format!("SELECT {} FROM habit_logs ORDER BY completed_date DESC", habit_log_select_columns())
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], row_to_habit_log).map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
    };

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

    let mut app_state = read_app_state_row(conn)?;
    app_state.api_key = None;

    Ok(ExportPayload {
        exported_at: Utc::now().to_rfc3339(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        domains,
        tasks,
        habits,
        habit_logs,
        goals,
        xp_events,
        achievements,
        notes,
        inbox_items,
        task_templates,
        focus_sessions,
        focus_timer_drafts,
        task_friction_logs,
        app_state,
    })
}

fn read_sync_counts(conn: &Connection) -> Result<SyncCounts, String> {
    let domains = conn.query_row(
        "SELECT COUNT(*) FROM domains WHERE deleted_at IS NULL",
        [],
        |row| row.get::<_, i64>(0),
    ).map_err(|e| e.to_string())?;
    let tasks = conn.query_row(
        "SELECT COUNT(*) FROM tasks WHERE deleted_at IS NULL",
        [],
        |row| row.get::<_, i64>(0),
    ).map_err(|e| e.to_string())?;
    let habits = conn.query_row(
        "SELECT COUNT(*) FROM habits WHERE deleted_at IS NULL",
        [],
        |row| row.get::<_, i64>(0),
    ).map_err(|e| e.to_string())?;
    let habit_logs = conn.query_row(
        "SELECT COUNT(*) FROM habit_logs WHERE deleted_at IS NULL",
        [],
        |row| row.get::<_, i64>(0),
    ).map_err(|e| e.to_string())?;
    let goals = conn.query_row(
        "SELECT COUNT(*) FROM goals WHERE deleted_at IS NULL",
        [],
        |row| row.get::<_, i64>(0),
    ).map_err(|e| e.to_string())?;
    let notes = conn.query_row(
        "SELECT COUNT(*) FROM notes WHERE deleted_at IS NULL",
        [],
        |row| row.get::<_, i64>(0),
    ).map_err(|e| e.to_string())?;
    let inbox_items = conn.query_row(
        "SELECT COUNT(*) FROM inbox_items WHERE deleted_at IS NULL",
        [],
        |row| row.get::<_, i64>(0),
    ).map_err(|e| e.to_string())?;

    Ok(SyncCounts {
        domains,
        tasks,
        habits,
        habit_logs,
        goals,
        notes,
        inbox_items,
        total: domains + tasks + habits + habit_logs + goals + notes + inbox_items,
    })
}

fn load_sync_payload(conn: &Connection) -> Result<SyncPayload, String> {
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

    let tasks = {
        let mut stmt = conn.prepare(
            &format!("SELECT {} FROM tasks ORDER BY updated_at DESC", task_select_columns())
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], row_to_task).map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
    };

    let habits = {
        let mut stmt = conn.prepare(
            &format!("SELECT {} FROM habits ORDER BY updated_at DESC", habit_select_columns())
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], row_to_habit).map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
    };

    let habit_logs = {
        let mut stmt = conn.prepare(
            &format!("SELECT {} FROM habit_logs ORDER BY updated_at DESC", habit_log_select_columns())
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], row_to_habit_log).map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
    };

    let goals = {
        let mut stmt = conn.prepare(
            "SELECT id, domain_id, title, description, parent_goal_id, status, next_action, review_date, blocked_by, health, target_date, progress_percent, created_at, updated_at, deleted_at FROM goals ORDER BY updated_at DESC"
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], row_to_goal).map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
    };

    let notes = {
        let mut stmt = conn.prepare(
            "SELECT id, domain_id, goal_id, title, content, tags, pinned, created_at, updated_at, deleted_at FROM notes ORDER BY updated_at DESC"
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], row_to_note).map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
    };

    let inbox_items = {
        let mut stmt = conn.prepare(
            "SELECT id, content, domain_id, source_label, suggested_kind, status, created_at, triaged_at, updated_at, deleted_at FROM inbox_items ORDER BY updated_at DESC"
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], row_to_inbox_item).map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
    };

    Ok(SyncPayload {
        exported_at: Utc::now().to_rfc3339(),
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        domains,
        tasks,
        habits,
        habit_logs,
        goals,
        notes,
        inbox_items,
    })
}

fn import_sync_payload_into_db(conn: &mut Connection, payload: SyncPayload) -> Result<SyncCounts, String> {
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    tx.execute_batch(
        "
        DELETE FROM habit_logs;
        DELETE FROM tasks;
        DELETE FROM habits;
        DELETE FROM goals;
        DELETE FROM notes;
        DELETE FROM inbox_items;
        DELETE FROM domains;
        ",
    ).map_err(|e| e.to_string())?;

    for domain in payload.domains {
        let created_at = if domain.created_at.trim().is_empty() {
            Utc::now().to_rfc3339()
        } else {
            domain.created_at.clone()
        };
        let updated_at = if domain.updated_at.trim().is_empty() {
            created_at.clone()
        } else {
            domain.updated_at.clone()
        };
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
    }

    for task in payload.tasks {
        tx.execute(
            "INSERT INTO tasks (
                id, domain_id, title, description, priority, energy_level, status, is_mit, is_top_three,
                xp_value, xp_awarded, parent_task_id, goal_id, tags, time_estimate_minutes, due_date,
                planned_for_date, task_kind, scheduled_for, recurring_template_id, recurrence_type,
                recurrence_interval, recurrence_days, recurrence_anchor_date, completed_at, created_at,
                updated_at, deleted_at, attachments, recurrence_rule, time_actual_minutes
             )
             VALUES (
                ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9,
                ?10, ?11, ?12, ?13, ?14, ?15, ?16,
                ?17, ?18, ?19, ?20, ?21,
                ?22, ?23, ?24, ?25, ?26,
                ?27, ?28, ?29, ?30, ?31
             )",
            params![
                task.id,
                task.domain_id,
                task.title,
                task.description,
                task.priority,
                task.energy_level,
                task.status,
                task.is_mit as i64,
                task.is_top_three as i64,
                task.xp_value,
                task.xp_awarded as i64,
                task.parent_task_id,
                task.goal_id,
                task.tags,
                task.time_estimate_minutes,
                task.due_date,
                task.planned_for_date,
                task.task_kind,
                task.scheduled_for,
                task.recurring_template_id,
                task.recurrence_type,
                task.recurrence_interval,
                task.recurrence_days,
                task.recurrence_anchor_date,
                task.completed_at,
                task.created_at,
                task.updated_at,
                task.deleted_at,
                task.attachments,
                task.recurrence_rule,
                task.time_actual_minutes,
            ],
        ).map_err(|e| e.to_string())?;
    }

    for habit in payload.habits {
        tx.execute(
            "INSERT INTO habits (
                id, domain_id, title, description, frequency, target_days, xp_per_completion,
                cadence_type, cadence_days, cadence_interval_days, cadence_weekly_target, cadence_anchor_date,
                target_type, target_value, minimum_value, unit_label, minimum_version, recovery_grace_days,
                restart_from_date, streak_current, streak_longest, is_active, created_at, updated_at, deleted_at
             )
             VALUES (
                ?1, ?2, ?3, ?4, ?5, ?6, ?7,
                ?8, ?9, ?10, ?11, ?12,
                ?13, ?14, ?15, ?16, ?17, ?18,
                ?19, ?20, ?21, ?22, ?23, ?24, ?25
             )",
            params![
                habit.id,
                habit.domain_id,
                habit.title,
                habit.description,
                habit.frequency,
                habit.target_days,
                habit.xp_per_completion,
                habit.cadence_type,
                habit.cadence_days,
                habit.cadence_interval_days,
                habit.cadence_weekly_target,
                habit.cadence_anchor_date,
                habit.target_type,
                habit.target_value,
                habit.minimum_value,
                habit.unit_label,
                habit.minimum_version,
                habit.recovery_grace_days,
                habit.restart_from_date,
                habit.streak_current,
                habit.streak_longest,
                habit.is_active as i64,
                habit.created_at,
                if habit.updated_at.trim().is_empty() { habit.created_at.clone() } else { habit.updated_at },
                habit.deleted_at,
            ],
        ).map_err(|e| e.to_string())?;
    }

    for habit_log in payload.habit_logs {
        tx.execute(
            "INSERT INTO habit_logs (id, habit_id, completed_date, xp_awarded, value_completed, status, skip_reason, created_at, updated_at, deleted_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                habit_log.id,
                habit_log.habit_id,
                habit_log.completed_date,
                habit_log.xp_awarded,
                habit_log.value_completed,
                habit_log.status,
                habit_log.skip_reason,
                habit_log.created_at,
                if habit_log.updated_at.trim().is_empty() { habit_log.created_at.clone() } else { habit_log.updated_at },
                habit_log.deleted_at,
            ],
        ).map_err(|e| e.to_string())?;
    }

    for goal in payload.goals {
        tx.execute(
            "INSERT INTO goals (id, domain_id, title, description, parent_goal_id, status, next_action, review_date, blocked_by, health, target_date, progress_percent, created_at, updated_at, deleted_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
            params![
                goal.id,
                goal.domain_id,
                goal.title,
                goal.description,
                goal.parent_goal_id,
                goal.status,
                goal.next_action,
                goal.review_date,
                goal.blocked_by,
                goal.health,
                goal.target_date,
                goal.progress_percent,
                goal.created_at,
                goal.updated_at,
                goal.deleted_at,
            ],
        ).map_err(|e| e.to_string())?;
    }

    for note in payload.notes {
        tx.execute(
            "INSERT INTO notes (id, domain_id, goal_id, title, content, tags, pinned, created_at, updated_at, deleted_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                note.id,
                note.domain_id,
                note.goal_id,
                note.title,
                note.content,
                note.tags,
                note.pinned as i64,
                note.created_at,
                note.updated_at,
                note.deleted_at,
            ],
        ).map_err(|e| e.to_string())?;
    }

    for item in payload.inbox_items {
        tx.execute(
            "INSERT INTO inbox_items (id, content, domain_id, source_label, suggested_kind, status, created_at, triaged_at, updated_at, deleted_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                item.id,
                item.content,
                item.domain_id,
                item.source_label,
                item.suggested_kind,
                item.status,
                item.created_at,
                item.triaged_at,
                if item.updated_at.trim().is_empty() { item.created_at.clone() } else { item.updated_at },
                item.deleted_at,
            ],
        ).map_err(|e| e.to_string())?;
    }

    tx.commit().map_err(|e| e.to_string())?;
    read_sync_counts(conn)
}

fn version_parts(version: &str) -> Vec<i64> {
    version
        .split('.')
        .map(|part| part.parse::<i64>().unwrap_or(0))
        .collect()
}

fn compare_versions(version: &str, current: &str) -> std::cmp::Ordering {
    let left = version_parts(version);
    let right = version_parts(current);
    let max_len = left.len().max(right.len());
    for index in 0..max_len {
        let left_value = *left.get(index).unwrap_or(&0);
        let right_value = *right.get(index).unwrap_or(&0);
        match left_value.cmp(&right_value) {
            std::cmp::Ordering::Equal => {}
            ordering => return ordering,
        }
    }
    std::cmp::Ordering::Equal
}

fn build_backup_counts(payload: &ImportPayload) -> BackupCounts {
    BackupCounts {
        domains: payload.domains.len(),
        tasks: payload.tasks.len(),
        habits: payload.habits.len(),
        habit_logs: payload.habit_logs.len(),
        goals: payload.goals.len(),
        xp_events: payload.xp_events.len(),
        achievements: payload.achievements.len(),
        notes: payload.notes.len(),
        inbox_items: payload.inbox_items.len(),
        task_templates: payload.task_templates.len(),
        focus_sessions: payload.focus_sessions.len(),
        focus_timer_drafts: payload.focus_timer_drafts.len(),
        task_friction_logs: payload.task_friction_logs.len(),
    }
}

fn backup_name_from_file_name(file_name: &str) -> String {
    let stem = file_name.strip_suffix(".json").unwrap_or(file_name);
    stem.to_string()
}

fn classify_backup_action(file_name: &str) -> String {
    if file_name.starts_with("snapshot-") {
        "snapshot".to_string()
    } else if file_name.starts_with("pre-") || file_name.starts_with("safety-") {
        "safety".to_string()
    } else {
        "backup".to_string()
    }
}

fn system_time_to_rfc3339(time: std::time::SystemTime) -> String {
    DateTime::<Utc>::from(time).to_rfc3339()
}

fn preview_from_payload(
    payload: &ImportPayload,
    file_path: Option<String>,
    file_name: Option<String>,
    modified_at: Option<String>,
) -> BackupPreview {
    let current_version = env!("CARGO_PKG_VERSION");
    let version = payload.version.clone();
    let exported_at = payload.exported_at.clone();
    let compatibility = match version.as_deref() {
        Some(value) => match compare_versions(value, current_version) {
            std::cmp::Ordering::Greater => "newer".to_string(),
            std::cmp::Ordering::Less => "older".to_string(),
            std::cmp::Ordering::Equal => "ok".to_string(),
        },
        None => "unknown".to_string(),
    };
    let mut warnings = Vec::new();
    if version.is_none() {
        warnings.push("Backup version metadata is missing. Import is allowed, but compatibility checks are limited.".to_string());
    } else if compatibility == "newer" {
        warnings.push("This backup was created by a newer Life OS version. Restore may skip fields this app does not understand yet.".to_string());
    } else if compatibility == "older" {
        warnings.push("This backup was created by an older Life OS version. The app will apply migration defaults where needed.".to_string());
    }
    if payload.tasks.is_empty() && payload.habits.is_empty() && payload.goals.is_empty() && payload.notes.is_empty() {
        warnings.push("This backup contains very little planning data. Double-check that you selected the right file.".to_string());
    }
    let backup_name = file_name
        .as_deref()
        .map(backup_name_from_file_name)
        .unwrap_or_else(|| "selected-backup".to_string());

    BackupPreview {
        file_path,
        file_name,
        backup_name,
        exported_at,
        version,
        counts: build_backup_counts(payload),
        compatibility,
        warnings,
        modified_at,
    }
}

fn preview_from_export_payload(
    payload: &ExportPayload,
    file_path: Option<String>,
    file_name: Option<String>,
    modified_at: Option<String>,
) -> BackupPreview {
    let current_version = env!("CARGO_PKG_VERSION");
    let compatibility = match compare_versions(&payload.version, current_version) {
        std::cmp::Ordering::Greater => "newer".to_string(),
        std::cmp::Ordering::Less => "older".to_string(),
        std::cmp::Ordering::Equal => "ok".to_string(),
    };
    let mut warnings = Vec::new();
    if compatibility == "newer" {
        warnings.push("This backup was created by a newer Life OS version. Restore may skip fields this app does not understand yet.".to_string());
    } else if compatibility == "older" {
        warnings.push("This backup was created by an older Life OS version. The app will apply migration defaults where needed.".to_string());
    }

    BackupPreview {
        file_path,
        file_name: file_name.clone(),
        backup_name: file_name
            .as_deref()
            .map(backup_name_from_file_name)
            .unwrap_or_else(|| "selected-backup".to_string()),
        exported_at: Some(payload.exported_at.clone()),
        version: Some(payload.version.clone()),
        counts: BackupCounts {
            domains: payload.domains.len(),
            tasks: payload.tasks.len(),
            habits: payload.habits.len(),
            habit_logs: payload.habit_logs.len(),
            goals: payload.goals.len(),
            xp_events: payload.xp_events.len(),
            achievements: payload.achievements.len(),
            notes: payload.notes.len(),
            inbox_items: payload.inbox_items.len(),
            task_templates: payload.task_templates.len(),
            focus_sessions: payload.focus_sessions.len(),
            focus_timer_drafts: payload.focus_timer_drafts.len(),
            task_friction_logs: payload.task_friction_logs.len(),
        },
        compatibility,
        warnings,
        modified_at,
    }
}

fn parse_backup_preview(data: &str, file_path: Option<String>, modified_at: Option<String>) -> Result<BackupPreview, String> {
    if let Ok(payload) = serde_json::from_str::<ExportPayload>(data) {
        let file_name = file_path
            .as_ref()
            .and_then(|path| PathBuf::from(path).file_name().map(|name| name.to_string_lossy().to_string()));
        return Ok(preview_from_export_payload(&payload, file_path, file_name, modified_at));
    }

    let payload: ImportPayload = serde_json::from_str(data).map_err(|e| format!("Invalid backup file: {}", e))?;
    let file_name = file_path
        .as_ref()
        .and_then(|path| PathBuf::from(path).file_name().map(|name| name.to_string_lossy().to_string()));
    Ok(preview_from_payload(&payload, file_path, file_name, modified_at))
}

fn sanitize_snapshot_name(name: &str) -> String {
    let trimmed = name.trim();
    let mut output = String::new();
    for character in trimmed.chars() {
        if character.is_ascii_alphanumeric() {
            output.push(character.to_ascii_lowercase());
        } else if matches!(character, ' ' | '-' | '_') {
            if !output.ends_with('-') {
                output.push('-');
            }
        }
    }
    output.trim_matches('-').to_string()
}

fn list_backup_files(backup_dir: &PathBuf) -> Result<Vec<(PathBuf, fs::Metadata)>, String> {
    let mut files = Vec::new();
    for entry in fs::read_dir(backup_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.extension().and_then(|ext| ext.to_str()) != Some("json") {
            continue;
        }
        let metadata = entry.metadata().map_err(|e| e.to_string())?;
        files.push((path, metadata));
    }
    Ok(files)
}

fn resolve_backup_directory(app: &tauri::AppHandle, conn: &Connection) -> Result<PathBuf, String> {
    let configured: Option<String> = conn.query_row(
        "SELECT backup_directory FROM app_state WHERE id = 1",
        [],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;

    let path = configured
        .filter(|value| !value.trim().is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(|| {
            app.path()
                .app_data_dir()
                .unwrap_or_else(|_| PathBuf::from("."))
                .join("backups")
        });

    fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    Ok(path)
}

fn write_backup_file(app: &tauri::AppHandle, conn: &Connection, prefix: &str) -> Result<String, String> {
    let backup_dir = resolve_backup_directory(app, conn)?;
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

fn record_restore_history(
    conn: &Connection,
    file_path: &str,
    backup_name: &str,
    action: &str,
    exported_at: Option<&str>,
    version: Option<&str>,
) -> Result<(), String> {
    conn.execute(
        "INSERT INTO restore_history (id, file_path, backup_name, action, source_exported_at, source_version, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            Uuid::new_v4().to_string(),
            file_path,
            backup_name,
            action,
            exported_at,
            version,
            Utc::now().to_rfc3339(),
        ],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

fn find_latest_backup_file(app: &tauri::AppHandle, conn: &Connection) -> Result<PathBuf, String> {
    let backup_dir = resolve_backup_directory(app, conn)?;
    let mut latest: Option<(std::time::SystemTime, PathBuf)> = None;

    for (path, metadata) in list_backup_files(&backup_dir)? {
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

fn import_payload_into_db(conn: &mut Connection, payload: ImportPayload) -> Result<(), String> {
    let preserved = read_app_state_row(conn)?;
    let mut imported_app_state = payload.app_state.unwrap_or(ImportAppState {
        id: 1,
        momentum_score: 50,
        last_momentum_calc: None,
        current_mit_task_id: None,
        api_key: None,
        onboarding_complete: false,
        last_opened_date: None,
        backup_directory: None,
        auto_backup_enabled: false,
        last_backup_at: None,
        crt_intensity: default_crt_intensity(),
        text_scale: default_text_scale(),
        ui_density: default_ui_density(),
        sync_enabled: false,
        sync_provider: None,
        sync_supabase_url: None,
        sync_supabase_anon_key: None,
        sync_access_token: None,
        sync_refresh_token: None,
        sync_user_id: None,
        sync_user_email: None,
        sync_last_sync_at: None,
        sync_last_sync_error: None,
        sync_last_pushed_at: None,
        sync_last_pulled_at: None,
    });

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
    imported_app_state.sync_last_sync_at = preserved.sync_last_sync_at.clone();
    imported_app_state.sync_last_sync_error = preserved.sync_last_sync_error.clone();
    imported_app_state.sync_last_pushed_at = preserved.sync_last_pushed_at.clone();
    imported_app_state.sync_last_pulled_at = preserved.sync_last_pulled_at.clone();

    let tx = conn.transaction().map_err(|e| e.to_string())?;
    tx.execute_batch(
        "
        DELETE FROM sync_queue;
        DELETE FROM sync_cursors;
        DELETE FROM habit_logs;
        DELETE FROM tasks;
        DELETE FROM habits;
        DELETE FROM goals;
        DELETE FROM xp_events;
        DELETE FROM notes;
        DELETE FROM inbox_items;
        DELETE FROM task_templates;
        DELETE FROM focus_sessions;
        DELETE FROM focus_timer_drafts;
        DELETE FROM task_friction_logs;
        DELETE FROM achievements;
        DELETE FROM domains;
        DELETE FROM app_state;
        ",
    ).map_err(|e| e.to_string())?;

    for domain in payload.domains {
        let created_at = if domain.created_at.trim().is_empty() {
            Utc::now().to_rfc3339()
        } else {
            domain.created_at.clone()
        };
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
    }

    for task in payload.tasks {
        tx.execute(
            "INSERT INTO tasks (
                id, domain_id, title, description, priority, energy_level, status, is_mit, is_top_three,
                xp_value, xp_awarded, parent_task_id, goal_id, tags, time_estimate_minutes, due_date,
                planned_for_date, task_kind, scheduled_for, recurring_template_id, recurrence_type,
                recurrence_interval, recurrence_days, recurrence_anchor_date, completed_at, created_at,
                updated_at, deleted_at, attachments, recurrence_rule, time_actual_minutes
             )
             VALUES (
                ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9,
                ?10, ?11, ?12, ?13, ?14, ?15, ?16,
                ?17, ?18, ?19, ?20, ?21,
                ?22, ?23, ?24, ?25, ?26,
                ?27, ?28, ?29, ?30, ?31
             )",
            params![
                task.id,
                task.domain_id,
                task.title,
                task.description,
                task.priority,
                task.energy_level,
                task.status,
                task.is_mit as i64,
                task.is_top_three as i64,
                task.xp_value,
                task.xp_awarded as i64,
                task.parent_task_id,
                task.goal_id,
                task.tags,
                task.time_estimate_minutes,
                task.due_date,
                task.planned_for_date,
                task.task_kind,
                task.scheduled_for,
                task.recurring_template_id,
                task.recurrence_type,
                task.recurrence_interval,
                task.recurrence_days,
                task.recurrence_anchor_date,
                task.completed_at,
                task.created_at,
                task.updated_at,
                task.deleted_at,
                task.attachments,
                task.recurrence_rule,
                task.time_actual_minutes
            ],
        ).map_err(|e| e.to_string())?;
    }

    for habit in payload.habits {
        tx.execute(
            "INSERT INTO habits (
                id, domain_id, title, description, frequency, target_days, xp_per_completion,
                cadence_type, cadence_days, cadence_interval_days, cadence_weekly_target, cadence_anchor_date,
                target_type, target_value, minimum_value, unit_label, minimum_version, recovery_grace_days,
                restart_from_date, streak_current, streak_longest, is_active, created_at, updated_at, deleted_at
             )
             VALUES (
                ?1, ?2, ?3, ?4, ?5, ?6, ?7,
                ?8, ?9, ?10, ?11, ?12,
                ?13, ?14, ?15, ?16, ?17, ?18,
                ?19, ?20, ?21, ?22, ?23, ?24, ?25
             )",
            params![
                habit.id,
                habit.domain_id,
                habit.title,
                habit.description,
                habit.frequency,
                habit.target_days,
                habit.xp_per_completion,
                habit.cadence_type,
                habit.cadence_days,
                habit.cadence_interval_days,
                habit.cadence_weekly_target,
                habit.cadence_anchor_date,
                habit.target_type,
                habit.target_value,
                habit.minimum_value,
                habit.unit_label,
                habit.minimum_version,
                habit.recovery_grace_days,
                habit.restart_from_date,
                habit.streak_current,
                habit.streak_longest,
                habit.is_active as i64,
                habit.created_at,
                if habit.updated_at.trim().is_empty() { habit.created_at.clone() } else { habit.updated_at },
                habit.deleted_at
            ],
        ).map_err(|e| e.to_string())?;
    }

    for habit_log in payload.habit_logs {
        tx.execute(
            "INSERT INTO habit_logs (id, habit_id, completed_date, xp_awarded, value_completed, status, skip_reason, created_at, updated_at, deleted_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                habit_log.id,
                habit_log.habit_id,
                habit_log.completed_date,
                habit_log.xp_awarded,
                habit_log.value_completed,
                habit_log.status,
                habit_log.skip_reason,
                habit_log.created_at,
                if habit_log.updated_at.trim().is_empty() { habit_log.created_at.clone() } else { habit_log.updated_at },
                habit_log.deleted_at
            ],
        ).map_err(|e| e.to_string())?;
    }

    for goal in payload.goals {
        tx.execute(
            "INSERT INTO goals (id, domain_id, title, description, parent_goal_id, status, next_action, review_date, blocked_by, health, target_date, progress_percent, created_at, updated_at, deleted_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
            params![
                goal.id,
                goal.domain_id,
                goal.title,
                goal.description,
                goal.parent_goal_id,
                goal.status,
                goal.next_action,
                goal.review_date,
                goal.blocked_by,
                goal.health,
                goal.target_date,
                goal.progress_percent,
                goal.created_at,
                goal.updated_at,
                goal.deleted_at
            ],
        ).map_err(|e| e.to_string())?;
    }

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

    for note in payload.notes {
        tx.execute(
            "INSERT INTO notes (id, domain_id, goal_id, title, content, tags, pinned, created_at, updated_at, deleted_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                note.id,
                note.domain_id,
                note.goal_id,
                note.title,
                note.content,
                note.tags,
                note.pinned as i64,
                note.created_at,
                note.updated_at,
                note.deleted_at
            ],
        ).map_err(|e| e.to_string())?;
    }

    for item in payload.inbox_items {
        tx.execute(
            "INSERT INTO inbox_items (id, content, domain_id, source_label, suggested_kind, status, created_at, triaged_at, updated_at, deleted_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                item.id,
                item.content,
                item.domain_id,
                item.source_label,
                item.suggested_kind,
                item.status,
                item.created_at,
                item.triaged_at,
                if item.updated_at.trim().is_empty() { item.created_at.clone() } else { item.updated_at },
                item.deleted_at
            ],
        ).map_err(|e| e.to_string())?;
    }

    for template in payload.task_templates {
        tx.execute(
            "INSERT INTO task_templates (id, title, description, domain_id, priority, energy_level, is_mit, tags, time_estimate_minutes, recurrence_rule, source_task_id, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
            params![
                template.id,
                template.title,
                template.description,
                template.domain_id,
                template.priority,
                template.energy_level,
                template.is_mit as i64,
                template.tags,
                template.time_estimate_minutes,
                template.recurrence_rule,
                template.source_task_id,
                template.created_at,
                template.updated_at
            ],
        ).map_err(|e| e.to_string())?;
    }

    for session in payload.focus_sessions {
        tx.execute(
            "INSERT INTO focus_sessions (id, task_id, planned_minutes, actual_minutes, distraction_count, interruption_notes, reflection, created_at, started_at, ended_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                session.id,
                session.task_id,
                session.planned_minutes,
                session.actual_minutes,
                session.distraction_count,
                session.interruption_notes,
                session.reflection,
                session.created_at,
                session.started_at,
                session.ended_at
            ],
        ).map_err(|e| e.to_string())?;
    }

    for draft in payload.focus_timer_drafts {
        tx.execute(
            "INSERT INTO focus_timer_drafts (task_id, planned_minutes, elapsed_seconds, distraction_count, interruption_notes, reflection, is_running, last_started_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                draft.task_id,
                draft.planned_minutes,
                draft.elapsed_seconds,
                draft.distraction_count,
                draft.interruption_notes,
                draft.reflection,
                draft.is_running as i64,
                draft.last_started_at,
                draft.updated_at,
            ],
        ).map_err(|e| e.to_string())?;
    }

    for log in payload.task_friction_logs {
        tx.execute(
            "INSERT INTO task_friction_logs (id, task_id, reason, details, action_type, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                log.id,
                log.task_id,
                log.reason,
                log.details,
                log.action_type,
                log.created_at
            ],
        ).map_err(|e| e.to_string())?;
    }

    tx.execute(
        "INSERT INTO app_state (id, momentum_score, last_momentum_calc, current_mit_task_id, api_key, onboarding_complete, last_opened_date, backup_directory, auto_backup_enabled, last_backup_at, crt_intensity, text_scale, ui_density, sync_enabled, sync_provider, sync_supabase_url, sync_supabase_anon_key, sync_access_token, sync_refresh_token, sync_user_id, sync_user_email, sync_last_sync_at, sync_last_sync_error, sync_last_pushed_at, sync_last_pulled_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25)",
        params![
            imported_app_state.id,
            imported_app_state.momentum_score,
            imported_app_state.last_momentum_calc,
            imported_app_state.current_mit_task_id,
            imported_app_state.api_key,
            imported_app_state.onboarding_complete as i64,
            imported_app_state.last_opened_date,
            imported_app_state.backup_directory,
            imported_app_state.auto_backup_enabled as i64,
            imported_app_state.last_backup_at,
            imported_app_state.crt_intensity,
            imported_app_state.text_scale,
            imported_app_state.ui_density,
            imported_app_state.sync_enabled as i64,
            imported_app_state.sync_provider,
            imported_app_state.sync_supabase_url,
            imported_app_state.sync_supabase_anon_key,
            imported_app_state.sync_access_token,
            imported_app_state.sync_refresh_token,
            imported_app_state.sync_user_id,
            imported_app_state.sync_user_email,
            imported_app_state.sync_last_sync_at,
            imported_app_state.sync_last_sync_error,
            imported_app_state.sync_last_pushed_at,
            imported_app_state.sync_last_pulled_at
        ],
    ).map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;
    sync_habit_streaks(conn)?;
    Ok(())
}

// ─── Domain Commands ──────────────────────────────────────────────────────────

#[tauri::command]
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

fn validate_domain_fields(name: &str, icon: &str, color: &str) -> Result<(), String> {
    if name.trim().is_empty() {
        return Err("Domain name is required".to_string());
    }
    if icon.trim().is_empty() {
        return Err("Domain icon is required".to_string());
    }
    if !color.starts_with('#') || color.len() != 7 {
        return Err("Domain color must be a hex value like #4afa4a".to_string());
    }
    Ok(())
}

#[tauri::command]
pub fn create_domain(
    state: State<'_, DbState>,
    payload: CreateDomainPayload,
) -> Result<Domain, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    let name = payload.name.trim().to_string();
    let icon = payload.icon.trim().to_string();
    let color = payload.color.trim().to_string();
    validate_domain_fields(&name, &icon, &color)?;

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO domains (id, name, icon, color, created_at, updated_at, deleted_at, xp_total, level, streak_current, streak_longest, streak_freeze_tokens, last_activity_date)
         VALUES (?1, ?2, ?3, ?4, ?5, ?5, NULL, 0, 1, 0, 0, 0, NULL)",
        params![id, name, icon, color, now],
    ).map_err(|e| e.to_string())?;

    get_domain_by_id(&conn, &id)
}

#[tauri::command]
pub fn update_domain_profile(
    state: State<'_, DbState>,
    payload: UpdateDomainProfilePayload,
) -> Result<Domain, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    let current = get_domain_by_id(&conn, &payload.id)?;
    let name = payload.name.unwrap_or(current.name).trim().to_string();
    let icon = payload.icon.unwrap_or(current.icon).trim().to_string();
    let color = payload.color.unwrap_or(current.color).trim().to_string();
    validate_domain_fields(&name, &icon, &color)?;

    conn.execute(
        "UPDATE domains
         SET name = ?1,
             icon = ?2,
             color = ?3,
             updated_at = ?4
         WHERE id = ?5",
        params![name, icon, color, Utc::now().to_rfc3339(), payload.id],
    ).map_err(|e| e.to_string())?;

    get_domain_by_id(&conn, &payload.id)
}

#[tauri::command]
pub fn delete_domain(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());

    let tasks: i64 = conn.query_row("SELECT COUNT(*) FROM tasks WHERE domain_id = ?1 AND deleted_at IS NULL", params![id], |row| row.get(0)).map_err(|e| e.to_string())?;
    let habits: i64 = conn.query_row("SELECT COUNT(*) FROM habits WHERE domain_id = ?1 AND deleted_at IS NULL", params![id], |row| row.get(0)).map_err(|e| e.to_string())?;
    let goals: i64 = conn.query_row("SELECT COUNT(*) FROM goals WHERE domain_id = ?1", params![id], |row| row.get(0)).map_err(|e| e.to_string())?;
    let xp_events: i64 = conn.query_row("SELECT COUNT(*) FROM xp_events WHERE domain_id = ?1", params![id], |row| row.get(0)).map_err(|e| e.to_string())?;
    let notes: i64 = conn.query_row("SELECT COUNT(*) FROM notes WHERE domain_id = ?1", params![id], |row| row.get(0)).map_err(|e| e.to_string())?;
    let inbox_items: i64 = conn.query_row("SELECT COUNT(*) FROM inbox_items WHERE domain_id = ?1", params![id], |row| row.get(0)).map_err(|e| e.to_string())?;
    let templates: i64 = conn.query_row("SELECT COUNT(*) FROM task_templates WHERE domain_id = ?1", params![id], |row| row.get(0)).map_err(|e| e.to_string())?;

    if tasks + habits + goals + xp_events + notes + inbox_items + templates > 0 {
        return Err(format!(
            "Domain still has linked data (tasks: {tasks}, habits: {habits}, goals: {goals}, xp: {xp_events}, notes: {notes}, inbox: {inbox_items}, templates: {templates}). Move or clear that data before deleting the domain."
        ));
    }

    let now = Utc::now().to_rfc3339();
    conn.execute("UPDATE domains SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2", params![now, id]).map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE app_state SET onboarding_complete = 0 WHERE id = 1 AND NOT EXISTS (SELECT 1 FROM domains LIMIT 1)",
        [],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

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

fn parse_activity_date(value: &str) -> Option<NaiveDate> {
    let prefix = value.get(0..10)?;
    NaiveDate::parse_from_str(prefix, "%Y-%m-%d").ok()
}

fn compute_streaks_from_dates(dates: &[NaiveDate]) -> (i64, i64, Option<String>) {
    if dates.is_empty() {
        return (0, 0, None);
    }

    let mut longest = 1i64;
    let mut current_run = 1i64;

    for window in dates.windows(2) {
        if window[1] == window[0] + Duration::days(1) {
            current_run += 1;
        } else {
            current_run = 1;
        }
        longest = longest.max(current_run);
    }

    let mut current = 1i64;
    let mut index = dates.len() - 1;
    while index > 0 {
        if dates[index] == dates[index - 1] + Duration::days(1) {
            current += 1;
            index -= 1;
        } else {
            break;
        }
    }

    (
        current,
        longest,
        dates.last().map(|date| date.format("%Y-%m-%d").to_string()),
    )
}

fn recalculate_domain_state(conn: &Connection, domain_id: &str) -> Result<(), String> {
    let now = Utc::now().to_rfc3339();
    let mut activity_dates = BTreeSet::new();

    {
        let mut stmt = conn.prepare(
            "SELECT completed_at FROM tasks WHERE domain_id = ?1 AND status = 'done' AND completed_at IS NOT NULL"
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map(params![domain_id], |row| row.get::<_, String>(0))
            .map_err(|e| e.to_string())?;
        for row in rows {
            let completed_at = row.map_err(|e| e.to_string())?;
            if let Some(date) = parse_activity_date(&completed_at) {
                activity_dates.insert(date);
            }
        }
    }

    {
        let mut stmt = conn.prepare(
            "SELECT hl.completed_date
             FROM habit_logs hl
             JOIN habits h ON h.id = hl.habit_id
             WHERE h.domain_id = ?1 AND hl.status IN ('completed', 'minimum')"
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map(params![domain_id], |row| row.get::<_, String>(0))
            .map_err(|e| e.to_string())?;
        for row in rows {
            let completed_date = row.map_err(|e| e.to_string())?;
            if let Ok(date) = NaiveDate::parse_from_str(&completed_date, "%Y-%m-%d") {
                activity_dates.insert(date);
            }
        }
    }

    let ordered_dates = activity_dates.into_iter().collect::<Vec<_>>();
    let (streak_current, streak_longest, last_activity_date) = compute_streaks_from_dates(&ordered_dates);

    conn.execute(
        "UPDATE domains
         SET streak_current = ?1,
             streak_longest = ?2,
             last_activity_date = ?3,
             updated_at = ?4
         WHERE id = ?5",
        params![streak_current, streak_longest, last_activity_date, now, domain_id],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn update_domain_streak(state: State<'_, DbState>, domain_id: String) -> Result<Domain, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
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
        Some(ref last) if last == &today => {
            // Already recorded today, no change
        }
        Some(ref last) if Some(last.clone()) == yesterday => {
            // Consecutive day — increment streak
            conn.execute(
                "UPDATE domains SET streak_current = streak_current + 1, last_activity_date = ?1,
                 streak_longest = MAX(streak_longest, streak_current + 1), updated_at = ?2 WHERE id = ?3",
                params![today, now, domain_id],
            ).map_err(|e| e.to_string())?;

            // Grant a freeze token at every 7-day streak milestone
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
            // Streak broken or first activity — reset to 1
            conn.execute(
                "UPDATE domains SET streak_current = 1, last_activity_date = ?1, updated_at = ?2 WHERE id = ?3",
                params![today, now, domain_id],
            ).map_err(|e| e.to_string())?;
        }
    }

    get_domain_by_id(&conn, &domain_id)
}

#[tauri::command]
pub fn use_streak_freeze(state: State<'_, DbState>, domain_id: String) -> Result<Domain, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());

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

    get_domain_by_id(&conn, &domain_id)
}

// ─── Task Commands ────────────────────────────────────────────────────────────

fn parse_json_u32_list(value: &str) -> Vec<u32> {
    serde_json::from_str::<Vec<u32>>(value)
        .unwrap_or_default()
        .into_iter()
        .filter(|entry| *entry <= 6)
        .collect()
}

fn parse_task_calendar_date(value: &str) -> Option<NaiveDate> {
    value
        .get(0..10)
        .and_then(|prefix| NaiveDate::parse_from_str(prefix, "%Y-%m-%d").ok())
}

fn add_months(date: NaiveDate, months: i32) -> Option<NaiveDate> {
    let mut year = date.year();
    let mut month_index = date.month0() as i32 + months;
    year += month_index.div_euclid(12);
    month_index = month_index.rem_euclid(12);
    let month = (month_index + 1) as u32;
    let mut day = date.day();
    while day >= 1 {
        if let Some(candidate) = NaiveDate::from_ymd_opt(year, month, day) {
            return Some(candidate);
        }
        day -= 1;
    }
    None
}

fn matches_recurring_template_on_date(template: &Task, anchor: NaiveDate, date: NaiveDate) -> bool {
    if date < anchor {
        return false;
    }

    let recurrence_type = template
        .recurrence_type
        .as_deref()
        .or(template.recurrence_rule.as_deref())
        .unwrap_or("")
        .trim()
        .to_string();
    if recurrence_type.is_empty() || recurrence_type == "none" {
        return false;
    }

    let interval = template.recurrence_interval.unwrap_or(1).max(1);
    match recurrence_type.as_str() {
        "daily" | "interval" => (date - anchor).num_days() % interval == 0,
        "weekly" => {
            let selected_days = parse_json_u32_list(&template.recurrence_days);
            if !selected_days.is_empty() {
                let weekday = date.weekday().num_days_from_sunday();
                if !selected_days.contains(&weekday) {
                    return false;
                }
                let anchor_week_start = anchor - Duration::days(anchor.weekday().num_days_from_sunday() as i64);
                let date_week_start = date - Duration::days(date.weekday().num_days_from_sunday() as i64);
                ((date_week_start - anchor_week_start).num_days() / 7) % interval == 0
            } else {
                (date - anchor).num_days() % (interval * 7) == 0
            }
        }
        "monthly" => {
            let mut cursor = anchor;
            while cursor <= date {
                if cursor == date {
                    return true;
                }
                let Some(next) = add_months(cursor, interval as i32) else {
                    break;
                };
                if next == cursor {
                    break;
                }
                cursor = next;
            }
            false
        }
        "selected_days" | "weekdays" => parse_json_u32_list(&template.recurrence_days)
            .contains(&date.weekday().num_days_from_sunday()),
        _ => false,
    }
}

fn sync_recurring_task_instances(conn: &Connection) -> Result<(), String> {
    let today = Utc::now().date_naive();
    let mut stmt = conn.prepare(
        &format!(
            "SELECT {} FROM tasks
             WHERE task_kind != 'recurring_instance'
               AND (
                 (recurrence_type IS NOT NULL AND TRIM(recurrence_type) != '')
                 OR (recurrence_rule IS NOT NULL AND TRIM(recurrence_rule) != '' AND recurrence_rule != 'none')
               )",
            task_select_columns()
        )
    ).map_err(|e| e.to_string())?;

    let templates = stmt.query_map([], row_to_task)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    for template in templates {
        let anchor = template
            .recurrence_anchor_date
            .as_deref()
            .and_then(parse_task_calendar_date)
            .or_else(|| template.scheduled_for.as_deref().and_then(parse_task_calendar_date))
            .or_else(|| template.due_date.as_deref().and_then(parse_task_calendar_date))
            .or_else(|| parse_task_calendar_date(&template.created_at))
            .unwrap_or(today);

        let latest_existing = conn.query_row(
            "SELECT scheduled_for
             FROM tasks
             WHERE recurring_template_id = ?1
               AND scheduled_for IS NOT NULL
             ORDER BY scheduled_for DESC
             LIMIT 1",
            params![template.id.clone()],
            |row| row.get::<_, String>(0),
        ).ok().and_then(|value| parse_task_calendar_date(&value));

        let earliest_backfill = today - Duration::days(365);
        let mut cursor = latest_existing
            .map(|value| value + Duration::days(1))
            .unwrap_or(anchor.max(earliest_backfill));

        while cursor <= today {
            if matches_recurring_template_on_date(&template, anchor, cursor) {
                let scheduled_for = cursor.format("%Y-%m-%d").to_string();
                let instance_id = Uuid::new_v4().to_string();
                let created_at = Utc::now().to_rfc3339();
                conn.execute(
                    "INSERT OR IGNORE INTO tasks (
                        id, domain_id, title, description, priority, energy_level, status, is_mit, is_top_three,
                        xp_value, xp_awarded, parent_task_id, goal_id, tags, time_estimate_minutes, due_date,
                        planned_for_date, task_kind, scheduled_for, recurring_template_id, recurrence_type,
                        recurrence_interval, recurrence_days, recurrence_anchor_date, completed_at, created_at,
                        updated_at, attachments, recurrence_rule, time_actual_minutes
                     ) VALUES (
                        ?1, ?2, ?3, ?4, ?5, ?6, 'todo', 0, 0,
                        ?7, 0, ?8, ?9, ?10, ?11, ?12,
                        ?13, 'recurring_instance', ?14, ?15, NULL,
                        NULL, '[]', NULL, NULL, ?16,
                        ?16, ?17, NULL, NULL
                     )",
                    params![
                        instance_id,
                        template.domain_id,
                        template.title,
                        template.description,
                        template.priority,
                        template.energy_level,
                        template.xp_value,
                        template.parent_task_id,
                        template.goal_id,
                        template.tags,
                        template.time_estimate_minutes,
                        scheduled_for,
                        scheduled_for,
                        scheduled_for,
                        template.id,
                        created_at,
                        template.attachments,
                    ],
                ).map_err(|e| e.to_string())?;
            }
            cursor += Duration::days(1);
        }
    }

    Ok(())
}

#[tauri::command]
pub fn get_tasks(state: State<'_, DbState>) -> Result<Vec<Task>, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    sync_recurring_task_instances(&conn)?;
    query_tasks(&conn, None)
}

#[tauri::command]
pub fn get_tasks_by_domain(state: State<'_, DbState>, domain_id: String) -> Result<Vec<Task>, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    sync_recurring_task_instances(&conn)?;
    query_tasks(&conn, Some(&domain_id))
}

fn query_tasks(conn: &Connection, domain_id: Option<&str>) -> Result<Vec<Task>, String> {
    let (sql, params_vec): (String, Vec<String>) = if let Some(did) = domain_id {
        (
            format!(
                "SELECT {} FROM tasks WHERE domain_id = ?1 AND deleted_at IS NULL ORDER BY created_at DESC",
                task_select_columns()
            ),
            vec![did.to_string()],
        )
    } else {
        (
            format!("SELECT {} FROM tasks WHERE deleted_at IS NULL ORDER BY created_at DESC", task_select_columns()),
            vec![],
        )
    };

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;

    let tasks = if params_vec.is_empty() {
        stmt.query_map([], row_to_task)
    } else {
        stmt.query_map(params![params_vec[0]], row_to_task)
    }.map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())?;

    Ok(tasks)
}

fn get_task_row(conn: &Connection, task_id: &str) -> Result<Task, String> {
    conn.query_row(
        &format!("SELECT {} FROM tasks WHERE id = ?1", task_select_columns()),
        params![task_id],
        row_to_task,
    ).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_task(state: State<'_, DbState>, payload: CreateTaskPayload) -> Result<Task, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
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

    get_task_row(&conn, &id)
}

#[tauri::command]
pub fn update_task(state: State<'_, DbState>, payload: UpdateTaskPayload) -> Result<Task, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    let now = Utc::now().to_rfc3339();

    if let Some(ref domain_id) = payload.domain_id {
        conn.execute("UPDATE tasks SET domain_id = ?1, updated_at = ?2 WHERE id = ?3", params![domain_id, now, payload.id]).map_err(|e| e.to_string())?;
    }
    if let Some(ref title) = payload.title {
        conn.execute("UPDATE tasks SET title = ?1, updated_at = ?2 WHERE id = ?3", params![title, now, payload.id]).map_err(|e| e.to_string())?;
    }
    if let Some(ref desc) = payload.description {
        conn.execute("UPDATE tasks SET description = ?1, updated_at = ?2 WHERE id = ?3", params![desc, now, payload.id]).map_err(|e| e.to_string())?;
    }
    if let Some(ref priority) = payload.priority {
        conn.execute("UPDATE tasks SET priority = ?1, updated_at = ?2 WHERE id = ?3", params![priority, now, payload.id]).map_err(|e| e.to_string())?;
    }
    if let Some(ref energy_level) = payload.energy_level {
        conn.execute("UPDATE tasks SET energy_level = ?1, updated_at = ?2 WHERE id = ?3", params![energy_level, now, payload.id]).map_err(|e| e.to_string())?;
    }
    if let Some(ref status) = payload.status {
        conn.execute("UPDATE tasks SET status = ?1, updated_at = ?2 WHERE id = ?3", params![status, now, payload.id]).map_err(|e| e.to_string())?;
    }
    if let Some(is_mit) = payload.is_mit {
        conn.execute("UPDATE tasks SET is_mit = ?1, updated_at = ?2 WHERE id = ?3", params![is_mit as i64, now, payload.id]).map_err(|e| e.to_string())?;
    }
    if let Some(is_top_three) = payload.is_top_three {
        conn.execute("UPDATE tasks SET is_top_three = ?1, updated_at = ?2 WHERE id = ?3", params![is_top_three as i64, now, payload.id]).map_err(|e| e.to_string())?;
    }
    if let Some(xp_value) = payload.xp_value {
        conn.execute("UPDATE tasks SET xp_value = ?1, updated_at = ?2 WHERE id = ?3", params![xp_value, now, payload.id]).map_err(|e| e.to_string())?;
    }
    if let Some(ref parent_task_id) = payload.parent_task_id {
        let parent_value: Option<&str> = if parent_task_id.trim().is_empty() { None } else { Some(parent_task_id.as_str()) };
        conn.execute("UPDATE tasks SET parent_task_id = ?1, updated_at = ?2 WHERE id = ?3", params![parent_value, now, payload.id]).map_err(|e| e.to_string())?;
    }
    if let Some(ref goal_id) = payload.goal_id {
        let goal_value: Option<&str> = if goal_id.is_empty() { None } else { Some(goal_id.as_str()) };
        conn.execute("UPDATE tasks SET goal_id = ?1, updated_at = ?2 WHERE id = ?3", params![goal_value, now, payload.id]).map_err(|e| e.to_string())?;
    }
    if let Some(ref tags) = payload.tags {
        conn.execute("UPDATE tasks SET tags = ?1, updated_at = ?2 WHERE id = ?3", params![tags, now, payload.id]).map_err(|e| e.to_string())?;
    }
    if let Some(ref est) = payload.time_estimate_minutes {
        conn.execute("UPDATE tasks SET time_estimate_minutes = ?1, updated_at = ?2 WHERE id = ?3", params![est, now, payload.id]).map_err(|e| e.to_string())?;
    }
    if let Some(ref due) = payload.due_date {
        let due_value: Option<&str> = if due.is_empty() { None } else { Some(due.as_str()) };
        conn.execute("UPDATE tasks SET due_date = ?1, updated_at = ?2 WHERE id = ?3", params![due_value, now, payload.id]).map_err(|e| e.to_string())?;
    }
    if let Some(ref planned_for_date) = payload.planned_for_date {
        let value: Option<&str> = if planned_for_date.trim().is_empty() { None } else { Some(planned_for_date.as_str()) };
        conn.execute("UPDATE tasks SET planned_for_date = ?1, updated_at = ?2 WHERE id = ?3", params![value, now, payload.id]).map_err(|e| e.to_string())?;
    }
    if let Some(ref task_kind) = payload.task_kind {
        let normalized = if task_kind.trim().is_empty() { default_task_kind() } else { task_kind.trim().to_string() };
        conn.execute("UPDATE tasks SET task_kind = ?1, updated_at = ?2 WHERE id = ?3", params![normalized, now, payload.id]).map_err(|e| e.to_string())?;
    }
    if let Some(ref scheduled_for) = payload.scheduled_for {
        let value: Option<&str> = if scheduled_for.trim().is_empty() { None } else { Some(scheduled_for.as_str()) };
        conn.execute("UPDATE tasks SET scheduled_for = ?1, updated_at = ?2 WHERE id = ?3", params![value, now, payload.id]).map_err(|e| e.to_string())?;
    }
    if let Some(ref recurring_template_id) = payload.recurring_template_id {
        let value: Option<&str> = if recurring_template_id.trim().is_empty() { None } else { Some(recurring_template_id.as_str()) };
        conn.execute("UPDATE tasks SET recurring_template_id = ?1, updated_at = ?2 WHERE id = ?3", params![value, now, payload.id]).map_err(|e| e.to_string())?;
    }
    if let Some(ref recurrence_type) = payload.recurrence_type {
        let value: Option<&str> = if recurrence_type.trim().is_empty() { None } else { Some(recurrence_type.as_str()) };
        conn.execute("UPDATE tasks SET recurrence_type = ?1, updated_at = ?2 WHERE id = ?3", params![value, now, payload.id]).map_err(|e| e.to_string())?;
    }
    if let Some(recurrence_interval) = payload.recurrence_interval {
        let normalized: Option<i64> = if recurrence_interval <= 0 { None } else { Some(recurrence_interval) };
        conn.execute("UPDATE tasks SET recurrence_interval = ?1, updated_at = ?2 WHERE id = ?3", params![normalized, now, payload.id]).map_err(|e| e.to_string())?;
    }
    if let Some(ref recurrence_days) = payload.recurrence_days {
        let normalized = if recurrence_days.trim().is_empty() { default_json_array() } else { recurrence_days.trim().to_string() };
        conn.execute("UPDATE tasks SET recurrence_days = ?1, updated_at = ?2 WHERE id = ?3", params![normalized, now, payload.id]).map_err(|e| e.to_string())?;
    }
    if let Some(ref recurrence_anchor_date) = payload.recurrence_anchor_date {
        let value: Option<&str> = if recurrence_anchor_date.trim().is_empty() { None } else { Some(recurrence_anchor_date.as_str()) };
        conn.execute("UPDATE tasks SET recurrence_anchor_date = ?1, updated_at = ?2 WHERE id = ?3", params![value, now, payload.id]).map_err(|e| e.to_string())?;
    }
    if let Some(ref completed) = payload.completed_at {
        let value: Option<&str> = if completed.trim().is_empty() { None } else { Some(completed.as_str()) };
        conn.execute("UPDATE tasks SET completed_at = ?1, updated_at = ?2 WHERE id = ?3", params![value, now, payload.id]).map_err(|e| e.to_string())?;
    }
    if let Some(ref attachments) = payload.attachments {
        let normalized = if attachments.trim().is_empty() { default_json_array() } else { attachments.trim().to_string() };
        conn.execute("UPDATE tasks SET attachments = ?1, updated_at = ?2 WHERE id = ?3", params![normalized, now, payload.id]).map_err(|e| e.to_string())?;
    }
    if let Some(ref rule) = payload.recurrence_rule {
        let rule_val: Option<&str> = if rule.is_empty() { None } else { Some(rule.as_str()) };
        conn.execute("UPDATE tasks SET recurrence_rule = ?1, updated_at = ?2 WHERE id = ?3", params![rule_val, now, payload.id]).map_err(|e| e.to_string())?;
    }
    if let Some(actual) = payload.time_actual_minutes {
        conn.execute("UPDATE tasks SET time_actual_minutes = ?1, updated_at = ?2 WHERE id = ?3", params![actual, now, payload.id]).map_err(|e| e.to_string())?;
    }

    get_task_row(&conn, &payload.id)
}

#[tauri::command]
pub fn delete_task(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE tasks SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2",
        params![now, id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn complete_task(state: State<'_, DbState>, id: String) -> Result<Task, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
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

    // Update domain streak and last_activity_date
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
    get_task_row(&conn, &id)
}

#[tauri::command]
pub fn undo_complete_task(
    state: State<'_, DbState>,
    id: String,
    previous_status: Option<String>,
) -> Result<Task, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    let task = get_task_row(&conn, &id)?;
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

    recalculate_domain_state(&conn, &task.domain_id)?;

    get_task_row(&conn, &task.id)
}

#[tauri::command]
pub fn restore_task(state: State<'_, DbState>, task: Task) -> Result<Task, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    conn.execute(
        "INSERT OR REPLACE INTO tasks (
            id, domain_id, title, description, priority, energy_level, status, is_mit, is_top_three,
            xp_value, xp_awarded, parent_task_id, goal_id, tags, time_estimate_minutes, due_date,
            planned_for_date, task_kind, scheduled_for, recurring_template_id, recurrence_type,
            recurrence_interval, recurrence_days, recurrence_anchor_date, completed_at, created_at,
            updated_at, attachments, recurrence_rule, time_actual_minutes
         ) VALUES (
            ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9,
            ?10, ?11, ?12, ?13, ?14, ?15, ?16,
            ?17, ?18, ?19, ?20, ?21,
            ?22, ?23, ?24, ?25, ?26,
            ?27, ?28, ?29, ?30
         )",
        params![
            task.id,
            task.domain_id,
            task.title,
            task.description,
            task.priority,
            task.energy_level,
            task.status,
            task.is_mit as i64,
            task.is_top_three as i64,
            task.xp_value,
            task.xp_awarded as i64,
            task.parent_task_id,
            task.goal_id,
            task.tags,
            task.time_estimate_minutes,
            task.due_date,
            task.planned_for_date,
            task.task_kind,
            task.scheduled_for,
            task.recurring_template_id,
            task.recurrence_type,
            task.recurrence_interval,
            task.recurrence_days,
            task.recurrence_anchor_date,
            task.completed_at,
            task.created_at,
            task.updated_at,
            task.attachments,
            task.recurrence_rule,
            task.time_actual_minutes,
        ],
    ).map_err(|e| e.to_string())?;

    get_task_row(&conn, &task.id)
}

// ─── Habit Commands ───────────────────────────────────────────────────────────

#[tauri::command]
pub fn get_habits(state: State<'_, DbState>) -> Result<Vec<Habit>, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    sync_habit_streaks(&conn)?;
    let mut stmt = conn.prepare(
        &format!("SELECT {} FROM habits WHERE is_active = 1 AND deleted_at IS NULL", habit_select_columns())
    ).map_err(|e| e.to_string())?;

    let habits = stmt.query_map([], row_to_habit).map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())?;

    Ok(habits)
}

fn parse_target_days(target_days: &str) -> Vec<u32> {
    parse_json_u32_list(target_days)
}

#[derive(Debug, Clone)]
struct HabitLogState {
    status: String,
    value_completed: i64,
}

fn habit_cadence_type(habit: &Habit) -> String {
    let cadence_type = habit.cadence_type.trim();
    if cadence_type.is_empty() {
        habit.frequency.trim().to_string()
    } else {
        cadence_type.to_string()
    }
}

fn habit_cadence_days(habit: &Habit) -> Vec<u32> {
    let primary = if habit.cadence_days.trim().is_empty() {
        habit.target_days.as_str()
    } else {
        habit.cadence_days.as_str()
    };
    parse_target_days(primary)
}

fn habit_anchor_date(habit: &Habit) -> Option<NaiveDate> {
    habit
        .cadence_anchor_date
        .as_deref()
        .and_then(|value| NaiveDate::parse_from_str(value, "%Y-%m-%d").ok())
        .or_else(|| parse_task_calendar_date(&habit.created_at))
}

fn habit_restart_date(habit: &Habit) -> Option<NaiveDate> {
    habit
        .restart_from_date
        .as_deref()
        .and_then(|value| NaiveDate::parse_from_str(value, "%Y-%m-%d").ok())
}

fn habit_week_start(date: NaiveDate) -> NaiveDate {
    date - Duration::days(date.weekday().num_days_from_monday() as i64)
}

fn habit_minimum_threshold(habit: &Habit) -> i64 {
    if let Some(value) = habit.minimum_value {
        return value.max(1);
    }
    if habit.minimum_version.as_ref().map(|value| !value.trim().is_empty()).unwrap_or(false) {
        return 1;
    }
    habit.target_value.max(1)
}

fn habit_completion_counts_for_streak(status: &str) -> bool {
    status == "completed" || status == "minimum"
}

fn habit_is_weekly_count(habit: &Habit) -> bool {
    matches!(habit_cadence_type(habit).as_str(), "weekly" | "weekly_count" | "times_per_week")
        && habit.cadence_weekly_target > 1
}

fn habit_is_due_on(habit: &Habit, date: NaiveDate) -> bool {
    if let Some(restart_date) = habit_restart_date(habit) {
        if date < restart_date {
            return false;
        }
    }

    match habit_cadence_type(habit).as_str() {
        "daily" => true,
        "weekdays" | "selected_days" => {
            let days = habit_cadence_days(habit);
            if days.is_empty() {
                true
            } else {
                days.contains(&date.weekday().num_days_from_sunday())
            }
        }
        "interval" | "every_n_days" => {
            let anchor = habit_anchor_date(habit).unwrap_or(date);
            if date < anchor {
                return false;
            }
            (date - anchor).num_days() % habit.cadence_interval_days.max(1) == 0
        }
        "weekly" | "weekly_count" | "times_per_week" => true,
        _ => {
            let days = habit_cadence_days(habit);
            if days.is_empty() {
                true
            } else {
                days.contains(&date.weekday().num_days_from_sunday())
            }
        }
    }
}

fn get_habit_day_log(conn: &Connection, habit_id: &str, date: NaiveDate) -> Result<Option<HabitLog>, String> {
    let date_str = date.format("%Y-%m-%d").to_string();
    match conn.query_row(
        &format!("SELECT {} FROM habit_logs WHERE habit_id = ?1 AND completed_date = ?2", habit_log_select_columns()),
        params![habit_id, date_str],
        row_to_habit_log,
    ) {
        Ok(value) => Ok(Some(value)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

fn fetch_habit_logs_map(conn: &Connection, habit_id: &str) -> Result<HashMap<NaiveDate, HabitLogState>, String> {
    let mut stmt = conn.prepare(
        "SELECT completed_date, status, value_completed FROM habit_logs WHERE habit_id = ?1"
    ).map_err(|e| e.to_string())?;
    let mut map = HashMap::new();
    let rows = stmt.query_map(params![habit_id], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, i64>(2)?,
        ))
    }).map_err(|e| e.to_string())?;
    for row in rows {
        let (date_str, status, value_completed) = row.map_err(|e| e.to_string())?;
        if let Ok(date) = NaiveDate::parse_from_str(&date_str, "%Y-%m-%d") {
            map.insert(date, HabitLogState { status, value_completed });
        }
    }
    Ok(map)
}

fn fetch_all_habit_logs_bulk(conn: &Connection) -> Result<HashMap<String, HashMap<NaiveDate, HabitLogState>>, String> {
    let mut stmt = conn.prepare(
        "SELECT hl.habit_id, hl.completed_date, hl.status, hl.value_completed
         FROM habit_logs hl
         INNER JOIN habits h ON hl.habit_id = h.id AND h.is_active = 1"
    ).map_err(|e| e.to_string())?;
    let mut all: HashMap<String, HashMap<NaiveDate, HabitLogState>> = HashMap::new();
    let rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, i64>(3)?,
        ))
    }).map_err(|e| e.to_string())?;
    for row in rows {
        let (habit_id, date_str, status, value_completed) = row.map_err(|e| e.to_string())?;
        if let Ok(date) = NaiveDate::parse_from_str(&date_str, "%Y-%m-%d") {
            all.entry(habit_id)
                .or_default()
                .insert(date, HabitLogState { status, value_completed });
        }
    }
    Ok(all)
}

fn habit_week_progress(logs: &HashMap<NaiveDate, HabitLogState>, date: NaiveDate) -> i64 {
    let week_start = habit_week_start(date);
    (0..7)
        .filter_map(|offset| logs.get(&(week_start + Duration::days(offset))))
        .filter(|log| log.status != "skipped")
        .map(|log| log.value_completed.max(0))
        .sum()
}

fn calculate_weekly_target_current_streak(
    logs: &HashMap<NaiveDate, HabitLogState>,
    habit: &Habit,
    as_of: NaiveDate,
    restart_from_date: Option<NaiveDate>,
) -> i64 {
    let target = habit.cadence_weekly_target.max(1);
    let mut week_cursor = habit_week_start(as_of);
    if habit_week_progress(logs, as_of) < target {
        week_cursor -= Duration::days(7);
    }

    let mut streak = 0;
    loop {
        if let Some(restart_date) = restart_from_date {
            if week_cursor + Duration::days(6) < restart_date {
                break;
            }
        }
        let progress = habit_week_progress(logs, week_cursor);
        if progress >= target {
            streak += 1;
            week_cursor -= Duration::days(7);
        } else {
            break;
        }
    }
    streak
}

fn calculate_weekly_target_longest_streak(
    logs: &HashMap<NaiveDate, HabitLogState>,
    habit: &Habit,
    restart_from_date: Option<NaiveDate>,
) -> i64 {
    if logs.is_empty() {
        return 0;
    }

    let target = habit.cadence_weekly_target.max(1);
    let mut cursor = logs.keys().min().copied().unwrap_or_else(|| Utc::now().date_naive());
    if let Some(restart_date) = restart_from_date {
        if restart_date > cursor {
            cursor = restart_date;
        }
    }
    let mut week_cursor = habit_week_start(cursor);
    let end_week = habit_week_start(Utc::now().date_naive());
    let mut longest = 0;
    let mut current = 0;
    while week_cursor <= end_week {
        if habit_week_progress(logs, week_cursor) >= target {
            current += 1;
            longest = longest.max(current);
        } else {
            current = 0;
        }
        week_cursor += Duration::days(7);
    }
    longest
}

fn calculate_current_streak_from_map(
    logs: &HashMap<NaiveDate, HabitLogState>,
    habit: &Habit,
    as_of: NaiveDate,
    restart_from_date: Option<NaiveDate>,
    recovery_grace_days: i64,
) -> i64 {
    if habit_is_weekly_count(habit) {
        return calculate_weekly_target_current_streak(logs, habit, as_of, restart_from_date);
    }

    let mut cursor = as_of;
    for _ in 0..366 {
        if habit_is_due_on(habit, cursor) {
            break;
        }
        cursor -= Duration::days(1);
    }

    let mut streak = 0;
    loop {
        if let Some(restart_date) = restart_from_date {
            if cursor < restart_date {
                break;
            }
        }
        if !habit_is_due_on(habit, cursor) {
            cursor -= Duration::days(1);
            continue;
        }
        if let Some(log) = logs.get(&cursor) {
            if habit_completion_counts_for_streak(&log.status) {
                streak += 1;
                cursor -= Duration::days(1);
                continue;
            }
            break;
        }
        if days_between(as_of, cursor) <= recovery_grace_days {
            cursor -= Duration::days(1);
            continue;
        }
        break;
    }
    streak
}

fn calculate_longest_streak_from_map(
    logs: &HashMap<NaiveDate, HabitLogState>,
    habit: &Habit,
    restart_from_date: Option<NaiveDate>,
) -> i64 {
    if habit_is_weekly_count(habit) {
        return calculate_weekly_target_longest_streak(logs, habit, restart_from_date);
    }
    if logs.is_empty() {
        return 0;
    }
    let Some(&first_date) = logs.keys().min() else {
        return 0;
    };
    let mut cursor = first_date;
    if let Some(restart_date) = restart_from_date {
        if restart_date > cursor {
            cursor = restart_date;
        }
    }
    let today = Utc::now().date_naive();
    let mut longest = 0i64;
    let mut current = 0i64;
    while cursor <= today {
        if habit_is_due_on(habit, cursor) {
            if let Some(log) = logs.get(&cursor) {
                if habit_completion_counts_for_streak(&log.status) {
                    current += 1;
                    longest = longest.max(current);
                } else {
                    current = 0;
                }
            } else {
                current = 0;
            }
        }
        cursor += Duration::days(1);
    }
    longest
}

fn days_between(later: NaiveDate, earlier: NaiveDate) -> i64 {
    (later - earlier).num_days()
}

fn sync_habit_streaks(conn: &Connection) -> Result<(), String> {
    let today = Utc::now().date_naive();
    let mut stmt = conn.prepare(
        &format!("SELECT {} FROM habits WHERE is_active = 1", habit_select_columns())
    ).map_err(|e| e.to_string())?;
    let habits = stmt.query_map([], row_to_habit)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    if habits.is_empty() {
        return Ok(());
    }

    let all_logs = fetch_all_habit_logs_bulk(conn)?;
    let empty_map: HashMap<NaiveDate, HabitLogState> = HashMap::new();

    for habit in habits {
        let restart_date = habit_restart_date(&habit);
        let logs = all_logs.get(&habit.id).unwrap_or(&empty_map);
        let streak_current = calculate_current_streak_from_map(logs, &habit, today, restart_date, habit.recovery_grace_days);
        let streak_longest = calculate_longest_streak_from_map(logs, &habit, restart_date);

        conn.execute(
            "UPDATE habits SET streak_current = ?1, streak_longest = ?2 WHERE id = ?3",
            params![streak_current, streak_longest, habit.id],
        ).map_err(|e| e.to_string())?;
    }

    Ok(())
}

fn get_habit_row(conn: &Connection, habit_id: &str) -> Result<Habit, String> {
    conn.query_row(
        &format!("SELECT {} FROM habits WHERE id = ?1", habit_select_columns()),
        params![habit_id],
        row_to_habit,
    ).map_err(|e| e.to_string())
}

fn get_habit_log_row(conn: &Connection, habit_id: &str, completed_date: &str) -> Result<HabitLog, String> {
    conn.query_row(
        &format!("SELECT {} FROM habit_logs WHERE habit_id = ?1 AND completed_date = ?2 AND deleted_at IS NULL", habit_log_select_columns()),
        params![habit_id, completed_date],
        row_to_habit_log,
    ).map_err(|e| e.to_string())
}

fn record_habit_day(
    conn: &Connection,
    habit_id: &str,
    completed_date: &str,
    status: &str,
    value_completed: Option<i64>,
    skip_reason: Option<String>,
) -> Result<HabitLog, String> {
    let now = Utc::now().to_rfc3339();
    let habit = get_habit_row(conn, habit_id)?;
    let completed_day = NaiveDate::parse_from_str(completed_date, "%Y-%m-%d").map_err(|e| e.to_string())?;

    if !habit_is_due_on(&habit, completed_day) {
        return Err("Habit is not scheduled for that day".to_string());
    }

    if let Some(restart_date) = habit_restart_date(&habit) {
        if completed_day < restart_date {
            return Err("This habit was restarted after that day".to_string());
        }
    }

    let today = Utc::now().date_naive();
    if status == "skipped" && days_between(today, completed_day) > habit.recovery_grace_days {
        return Err("Skip window has expired for that day".to_string());
    }

    let target_value = habit.target_value.max(1);
    let minimum_threshold = habit_minimum_threshold(&habit);
    let base_increment = match habit.target_type.as_str() {
        "checkbox" => 1,
        _ if status == "minimum" => minimum_threshold,
        _ => value_completed.unwrap_or(1).max(1),
    };
    let existing = get_habit_day_log(conn, habit_id, completed_day)?;

    if status == "skipped" {
        if existing.as_ref().map(|log| log.value_completed > 0).unwrap_or(false) {
            return Err("This habit already has progress for that day".to_string());
        }
        let id = existing.as_ref().map(|log| log.id.clone()).unwrap_or_else(|| Uuid::new_v4().to_string());
        conn.execute(
            "INSERT INTO habit_logs (id, habit_id, completed_date, xp_awarded, value_completed, status, skip_reason, created_at, updated_at, deleted_at)
             VALUES (?1, ?2, ?3, 0, 0, 'skipped', ?4, ?5, ?5, NULL)
             ON CONFLICT(habit_id, completed_date) DO UPDATE SET
                xp_awarded = 0,
                value_completed = 0,
                status = 'skipped',
                skip_reason = excluded.skip_reason,
                updated_at = excluded.updated_at,
                deleted_at = NULL",
            params![id, habit_id, completed_date, skip_reason, now],
        ).map_err(|e| e.to_string())?;
    } else {
        let previous_value = existing.as_ref().map(|log| log.value_completed).unwrap_or(0);
        let updated_value = match habit.target_type.as_str() {
            "checkbox" => 1,
            _ => previous_value + base_increment,
        };
        let resolved_status = if updated_value >= target_value {
            "completed".to_string()
        } else if updated_value >= minimum_threshold && minimum_threshold < target_value {
            "minimum".to_string()
        } else if updated_value > 0 {
            "partial".to_string()
        } else {
            "skipped".to_string()
        };
        let id = existing.as_ref().map(|log| log.id.clone()).unwrap_or_else(|| Uuid::new_v4().to_string());
        conn.execute(
            "INSERT INTO habit_logs (id, habit_id, completed_date, xp_awarded, value_completed, status, skip_reason, created_at, updated_at, deleted_at)
             VALUES (?1, ?2, ?3, 0, ?4, ?5, NULL, ?6, ?6, NULL)
             ON CONFLICT(habit_id, completed_date) DO UPDATE SET
                xp_awarded = 0,
                value_completed = excluded.value_completed,
                status = excluded.status,
                skip_reason = NULL,
                updated_at = excluded.updated_at,
                deleted_at = NULL",
            params![id, habit_id, completed_date, updated_value, resolved_status, now],
        ).map_err(|e| e.to_string())?;
    }

    sync_habit_streaks(conn)?;
    recalculate_domain_state(conn, &habit.domain_id)?;

    get_habit_log_row(conn, habit_id, completed_date)
}

#[tauri::command]
pub fn create_habit(state: State<'_, DbState>, payload: CreateHabitPayload) -> Result<Habit, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
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

    get_habit_row(&conn, &id)
}

#[tauri::command]
pub fn update_habit(state: State<'_, DbState>, payload: UpdateHabitPayload) -> Result<Habit, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    let now = Utc::now().to_rfc3339();

    if let Some(domain_id) = payload.domain_id {
        conn.execute("UPDATE habits SET domain_id = ?1 WHERE id = ?2", params![domain_id, payload.id]).map_err(|e| e.to_string())?;
    }
    if let Some(title) = payload.title {
        conn.execute("UPDATE habits SET title = ?1 WHERE id = ?2", params![title, payload.id]).map_err(|e| e.to_string())?;
    }
    if let Some(description) = payload.description {
        conn.execute("UPDATE habits SET description = ?1 WHERE id = ?2", params![description, payload.id]).map_err(|e| e.to_string())?;
    }
    if let Some(frequency) = payload.frequency {
        conn.execute("UPDATE habits SET frequency = ?1 WHERE id = ?2", params![frequency, payload.id]).map_err(|e| e.to_string())?;
    }
    if let Some(target_days) = payload.target_days {
        conn.execute("UPDATE habits SET target_days = ?1 WHERE id = ?2", params![target_days, payload.id]).map_err(|e| e.to_string())?;
    }
    if let Some(xp_per_completion) = payload.xp_per_completion {
        conn.execute("UPDATE habits SET xp_per_completion = ?1 WHERE id = ?2", params![xp_per_completion, payload.id]).map_err(|e| e.to_string())?;
    }
    if let Some(cadence_type) = payload.cadence_type {
        conn.execute("UPDATE habits SET cadence_type = ?1 WHERE id = ?2", params![cadence_type, payload.id]).map_err(|e| e.to_string())?;
    }
    if let Some(cadence_days) = payload.cadence_days {
        conn.execute("UPDATE habits SET cadence_days = ?1 WHERE id = ?2", params![cadence_days, payload.id]).map_err(|e| e.to_string())?;
    }
    if let Some(cadence_interval_days) = payload.cadence_interval_days {
        conn.execute("UPDATE habits SET cadence_interval_days = ?1 WHERE id = ?2", params![cadence_interval_days.max(1), payload.id]).map_err(|e| e.to_string())?;
    }
    if let Some(cadence_weekly_target) = payload.cadence_weekly_target {
        conn.execute("UPDATE habits SET cadence_weekly_target = ?1 WHERE id = ?2", params![cadence_weekly_target.max(1), payload.id]).map_err(|e| e.to_string())?;
    }
    if let Some(cadence_anchor_date) = payload.cadence_anchor_date {
        let normalized: Option<String> = if cadence_anchor_date.trim().is_empty() { None } else { Some(cadence_anchor_date.trim().to_string()) };
        conn.execute("UPDATE habits SET cadence_anchor_date = ?1 WHERE id = ?2", params![normalized, payload.id]).map_err(|e| e.to_string())?;
    }
    if let Some(target_type) = payload.target_type {
        conn.execute("UPDATE habits SET target_type = ?1 WHERE id = ?2", params![target_type, payload.id]).map_err(|e| e.to_string())?;
    }
    if let Some(target_value) = payload.target_value {
        conn.execute("UPDATE habits SET target_value = ?1 WHERE id = ?2", params![target_value.max(1), payload.id]).map_err(|e| e.to_string())?;
    }
    if let Some(minimum_value) = payload.minimum_value {
        let normalized: Option<i64> = if minimum_value <= 0 { None } else { Some(minimum_value) };
        conn.execute("UPDATE habits SET minimum_value = ?1 WHERE id = ?2", params![normalized, payload.id]).map_err(|e| e.to_string())?;
    }
    if let Some(unit_label) = payload.unit_label {
        let normalized: Option<String> = if unit_label.trim().is_empty() { None } else { Some(unit_label.trim().to_string()) };
        conn.execute("UPDATE habits SET unit_label = ?1 WHERE id = ?2", params![normalized, payload.id]).map_err(|e| e.to_string())?;
    }
    if let Some(minimum_version) = payload.minimum_version {
        let normalized: Option<String> = if minimum_version.trim().is_empty() { None } else { Some(minimum_version.trim().to_string()) };
        conn.execute("UPDATE habits SET minimum_version = ?1 WHERE id = ?2", params![normalized, payload.id]).map_err(|e| e.to_string())?;
    }
    if let Some(recovery_grace_days) = payload.recovery_grace_days {
        conn.execute("UPDATE habits SET recovery_grace_days = ?1 WHERE id = ?2", params![recovery_grace_days.max(0), payload.id]).map_err(|e| e.to_string())?;
    }
    if let Some(restart_from_date) = payload.restart_from_date {
        let normalized: Option<String> = if restart_from_date.trim().is_empty() { None } else { Some(restart_from_date.trim().to_string()) };
        conn.execute("UPDATE habits SET restart_from_date = ?1 WHERE id = ?2", params![normalized, payload.id]).map_err(|e| e.to_string())?;
    }
    if let Some(is_active) = payload.is_active {
        conn.execute(
            "UPDATE habits SET is_active = ?1, deleted_at = CASE WHEN ?1 = 1 THEN NULL ELSE deleted_at END WHERE id = ?2",
            params![is_active as i64, payload.id],
        ).map_err(|e| e.to_string())?;
    }
    conn.execute("UPDATE habits SET updated_at = ?1 WHERE id = ?2", params![now, payload.id]).map_err(|e| e.to_string())?;

    sync_habit_streaks(&conn)?;

    get_habit_row(&conn, &payload.id)
}

#[tauri::command]
pub fn log_habit(
    state: State<'_, DbState>,
    habit_id: String,
    completed_date: String,
    value_completed: Option<i64>,
) -> Result<HabitLog, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    record_habit_day(&conn, &habit_id, &completed_date, "completed", value_completed, None)
}

#[tauri::command]
pub fn log_habit_minimum(
    state: State<'_, DbState>,
    habit_id: String,
    completed_date: String,
    value_completed: Option<i64>,
) -> Result<HabitLog, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    record_habit_day(&conn, &habit_id, &completed_date, "minimum", value_completed, None)
}

#[tauri::command]
pub fn skip_habit(state: State<'_, DbState>, habit_id: String, completed_date: String, reason: String) -> Result<HabitLog, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    let normalized_reason = if reason.trim().is_empty() {
        return Err("Skip reason is required".to_string());
    } else {
        Some(reason.trim().to_string())
    };
    record_habit_day(&conn, &habit_id, &completed_date, "skipped", None, normalized_reason)
}

#[tauri::command]
pub fn undo_habit_log(
    state: State<'_, DbState>,
    habit_id: String,
    completed_date: String,
) -> Result<HabitLog, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    let log = get_habit_log_row(&conn, &habit_id, &completed_date)?;
    let habit = get_habit_row(&conn, &habit_id)?;

    conn.execute(
        "UPDATE habit_logs SET deleted_at = ?1, updated_at = ?1 WHERE habit_id = ?2 AND completed_date = ?3",
        params![Utc::now().to_rfc3339(), habit_id.clone(), completed_date],
    ).map_err(|e| e.to_string())?;

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

    sync_habit_streaks(&conn)?;
    recalculate_domain_state(&conn, &habit.domain_id)?;

    Ok(log)
}

#[tauri::command]
pub fn restart_habit(state: State<'_, DbState>, habit_id: String) -> Result<Habit, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    let today = Utc::now().format("%Y-%m-%d").to_string();
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE habits SET restart_from_date = ?1, streak_current = 0, updated_at = ?2 WHERE id = ?3",
        params![today, now, habit_id],
    ).map_err(|e| e.to_string())?;
    sync_habit_streaks(&conn)?;
    get_habit_row(&conn, &habit_id)
}

#[tauri::command]
pub fn get_habit_logs(state: State<'_, DbState>, habit_id: String) -> Result<Vec<HabitLog>, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    let mut stmt = conn.prepare(
        &format!("SELECT {} FROM habit_logs WHERE habit_id = ?1 AND deleted_at IS NULL ORDER BY completed_date DESC", habit_log_select_columns())
    ).map_err(|e| e.to_string())?;

    let logs = stmt.query_map(params![habit_id], row_to_habit_log).map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())?;

    Ok(logs)
}

#[tauri::command]
pub fn get_habit_logs_range(state: State<'_, DbState>, start_date: String, end_date: String) -> Result<Vec<HabitLog>, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    let mut stmt = conn.prepare(
        &format!("SELECT {} FROM habit_logs WHERE completed_date >= ?1 AND completed_date <= ?2 AND deleted_at IS NULL", habit_log_select_columns())
    ).map_err(|e| e.to_string())?;

    let logs = stmt.query_map(params![start_date, end_date], row_to_habit_log).map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())?;

    Ok(logs)
}

#[tauri::command]
pub fn delete_habit(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    let now = Utc::now().to_rfc3339();
    conn.execute("UPDATE habits SET is_active = 0, deleted_at = ?1, updated_at = ?1 WHERE id = ?2", params![now, id]).map_err(|e| e.to_string())?;
    Ok(())
}

// ─── Goal Commands ────────────────────────────────────────────────────────────

#[tauri::command]
pub fn get_goals(state: State<'_, DbState>) -> Result<Vec<Goal>, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    let mut stmt = conn.prepare(
        "SELECT id, domain_id, title, description, parent_goal_id, status, next_action, review_date, blocked_by, health, target_date, progress_percent, created_at, updated_at, deleted_at
         FROM goals
         WHERE deleted_at IS NULL AND status != 'archived'
         ORDER BY created_at DESC"
    ).map_err(|e| e.to_string())?;

    let goals = stmt.query_map([], row_to_goal).map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())?;

    Ok(goals)
}

#[tauri::command]
pub fn get_deleted_goals(state: State<'_, DbState>) -> Result<Vec<Goal>, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    let mut stmt = conn.prepare(
        "SELECT id, domain_id, title, description, parent_goal_id, status, next_action, review_date, blocked_by, health, target_date, progress_percent, created_at, updated_at, deleted_at
         FROM goals
         WHERE deleted_at IS NOT NULL
         ORDER BY deleted_at DESC"
    ).map_err(|e| e.to_string())?;

    let goals = stmt.query_map([], row_to_goal)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(goals)
}

#[tauri::command]
pub fn create_goal(state: State<'_, DbState>, payload: CreateGoalPayload) -> Result<Goal, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
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
pub fn update_goal(state: State<'_, DbState>, payload: UpdateGoalPayload) -> Result<Goal, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
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
pub fn delete_goal(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE goals SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2",
        params![now, id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn restore_goal(state: State<'_, DbState>, id: String) -> Result<Goal, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE goals SET deleted_at = NULL, updated_at = ?1 WHERE id = ?2",
        params![now, id],
    ).map_err(|e| e.to_string())?;
    conn.query_row(
        "SELECT id, domain_id, title, description, parent_goal_id, status, next_action, review_date, blocked_by, health, target_date, progress_percent, created_at, updated_at, deleted_at FROM goals WHERE id = ?1",
        params![id],
        row_to_goal,
    ).map_err(|e| e.to_string())
}

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

// ─── App State ────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn get_app_state(state: State<'_, DbState>) -> Result<AppStateRow, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    read_app_state_row(&conn)
}

#[tauri::command]
pub fn update_momentum(state: State<'_, DbState>, score: i64) -> Result<(), String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    let now = Utc::now().to_rfc3339();
    // UPSERT: creates the singleton row if it doesn't exist yet
    conn.execute(
        "INSERT INTO app_state (id, momentum_score, last_momentum_calc, onboarding_complete)
         VALUES (1, ?1, ?2, 0)
         ON CONFLICT(id) DO UPDATE SET momentum_score = ?1, last_momentum_calc = ?2",
        params![score, now],
    ).map_err(|e| format!("update_momentum DB error: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn set_mit_task(state: State<'_, DbState>, task_id: Option<String>) -> Result<(), String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    let _ = conn.execute("INSERT OR IGNORE INTO app_state (id, momentum_score, onboarding_complete) VALUES (1, 50, 0)", []);
    conn.execute(
        "UPDATE app_state SET current_mit_task_id = ?1 WHERE id = 1",
        params![task_id],
    ).map_err(|e| e.to_string())?;
    // Also clear old MIT flags and set new one
    conn.execute("UPDATE tasks SET is_mit = 0", []).map_err(|e| e.to_string())?;
    if let Some(ref id) = task_id.as_ref().filter(|s| !s.is_empty()) {
        conn.execute("UPDATE tasks SET is_mit = 1 WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    }
    Ok(())
}

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

#[tauri::command]
pub fn update_backup_settings(
    state: State<'_, DbState>,
    backup_directory: Option<String>,
    auto_backup_enabled: bool,
) -> Result<AppStateRow, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    let _ = conn.execute("INSERT OR IGNORE INTO app_state (id, momentum_score, onboarding_complete) VALUES (1, 50, 0)", []);
    let normalized = backup_directory
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());

    if let Some(ref path) = normalized {
        fs::create_dir_all(path).map_err(|e| e.to_string())?;
    }

    conn.execute(
        "UPDATE app_state SET backup_directory = ?1, auto_backup_enabled = ?2 WHERE id = 1",
        params![normalized, auto_backup_enabled as i64],
    ).map_err(|e| e.to_string())?;

    read_app_state_row(&conn)
}

#[tauri::command]
pub fn update_ui_preferences(
    state: State<'_, DbState>,
    crt_intensity: String,
    text_scale: String,
    ui_density: String,
) -> Result<AppStateRow, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    let _ = conn.execute("INSERT OR IGNORE INTO app_state (id, momentum_score, onboarding_complete) VALUES (1, 50, 0)", []);

    let normalized_crt = match crt_intensity.trim() {
        "low" => "low",
        "high" => "high",
        _ => "medium",
    };
    let normalized_scale = match text_scale.trim() {
        "large" => "large",
        "xl" => "xl",
        _ => "normal",
    };
    let normalized_density = match ui_density.trim() {
        "compact" => "compact",
        _ => "comfortable",
    };

    conn.execute(
        "UPDATE app_state SET crt_intensity = ?1, text_scale = ?2, ui_density = ?3 WHERE id = 1",
        params![normalized_crt, normalized_scale, normalized_density],
    ).map_err(|e| e.to_string())?;

    read_app_state_row(&conn)
}

#[tauri::command]
pub fn update_last_opened(state: State<'_, DbState>) -> Result<(), String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    let today = Utc::now().format("%Y-%m-%d").to_string();
    let _ = conn.execute("INSERT OR IGNORE INTO app_state (id, momentum_score, onboarding_complete) VALUES (1, 50, 0)", []);
    conn.execute(
        "UPDATE app_state SET last_opened_date = ?1 WHERE id = 1",
        params![today],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn complete_onboarding(state: State<'_, DbState>) -> Result<(), String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    let domain_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM domains", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;
    if domain_count <= 0 {
        return Err("Create at least one domain before entering the system.".to_string());
    }
    conn.execute(
        "UPDATE app_state SET onboarding_complete = 1 WHERE id = 1",
        [],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn configure_sync(state: State<'_, DbState>, payload: SyncConfigPayload) -> Result<AppStateRow, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
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
    read_app_state_row(&conn)
}

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

#[tauri::command]
pub fn update_sync_status(state: State<'_, DbState>, payload: SyncStatusPayload) -> Result<AppStateRow, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    let _ = conn.execute("INSERT OR IGNORE INTO app_state (id, momentum_score, onboarding_complete) VALUES (1, 50, 0)", []);
    conn.execute(
        "UPDATE app_state
         SET sync_last_sync_at = ?1,
             sync_last_sync_error = ?2,
             sync_last_pushed_at = ?3,
             sync_last_pulled_at = ?4
         WHERE id = 1",
        params![
            payload.last_sync_at,
            payload.last_sync_error,
            payload.last_pushed_at,
            payload.last_pulled_at,
        ],
    ).map_err(|e| e.to_string())?;
    read_app_state_row(&conn)
}

#[tauri::command]
pub fn get_sync_counts(state: State<'_, DbState>) -> Result<SyncCounts, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    read_sync_counts(&conn)
}

#[tauri::command]
pub fn export_sync_payload(state: State<'_, DbState>) -> Result<SyncPayload, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    load_sync_payload(&conn)
}

#[tauri::command]
pub fn import_sync_payload(state: State<'_, DbState>, payload: SyncPayload) -> Result<SyncCounts, String> {
    let mut conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    import_sync_payload_into_db(&mut conn, payload)
}

#[tauri::command]
pub fn get_sync_queue(state: State<'_, DbState>) -> Result<Vec<SyncQueueItem>, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    let mut stmt = conn.prepare(
        "SELECT id, entity_type, entity_id, operation_type, payload_json, created_at, retry_count, last_error
         FROM sync_queue
         ORDER BY created_at ASC"
    ).map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| {
        Ok(SyncQueueItem {
            id: row.get(0)?,
            entity_type: row.get(1)?,
            entity_id: row.get(2)?,
            operation_type: row.get(3)?,
            payload_json: row.get(4)?,
            created_at: row.get(5)?,
            retry_count: row.get(6)?,
            last_error: row.get(7)?,
        })
    }).map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn upsert_sync_queue_item(state: State<'_, DbState>, item: SyncQueueItem) -> Result<SyncQueueItem, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    conn.execute(
        "INSERT INTO sync_queue (id, entity_type, entity_id, operation_type, payload_json, created_at, retry_count, last_error)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT(id) DO UPDATE SET
            entity_type = excluded.entity_type,
            entity_id = excluded.entity_id,
            operation_type = excluded.operation_type,
            payload_json = excluded.payload_json,
            created_at = excluded.created_at,
            retry_count = excluded.retry_count,
            last_error = excluded.last_error",
        params![
            item.id,
            item.entity_type,
            item.entity_id,
            item.operation_type,
            item.payload_json,
            item.created_at,
            item.retry_count,
            item.last_error,
        ],
    ).map_err(|e| e.to_string())?;
    Ok(item)
}

#[tauri::command]
pub fn delete_sync_queue_item(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    conn.execute("DELETE FROM sync_queue WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_sync_cursors(state: State<'_, DbState>) -> Result<Vec<SyncCursor>, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    let mut stmt = conn.prepare(
        "SELECT entity_type, last_pulled_at FROM sync_cursors ORDER BY entity_type ASC"
    ).map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| {
        Ok(SyncCursor {
            entity_type: row.get(0)?,
            last_pulled_at: row.get(1)?,
        })
    }).map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_sync_cursor(state: State<'_, DbState>, entity_type: String, last_pulled_at: Option<String>) -> Result<(), String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    conn.execute(
        "INSERT INTO sync_cursors (entity_type, last_pulled_at)
         VALUES (?1, ?2)
         ON CONFLICT(entity_type) DO UPDATE SET last_pulled_at = excluded.last_pulled_at",
        params![entity_type, last_pulled_at],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

// ─── Analytics ────────────────────────────────────────────────────────────────

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

#[derive(Debug, Serialize, Deserialize)]
pub struct TaskStats {
    pub total: i64,
    pub completed: i64,
    pub by_domain: Vec<DomainTaskCount>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DomainTaskCount {
    pub domain_id: String,
    pub total: i64,
    pub completed: i64,
}

#[tauri::command]
pub fn get_task_stats(state: State<'_, DbState>) -> Result<TaskStats, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());

    let total: i64 = conn.query_row("SELECT COUNT(*) FROM tasks WHERE status != 'archived'", [], |r| r.get(0)).map_err(|e| e.to_string())?;
    let completed: i64 = conn.query_row("SELECT COUNT(*) FROM tasks WHERE status = 'done'", [], |r| r.get(0)).map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare(
        "SELECT domain_id, COUNT(*) as total, SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as completed FROM tasks WHERE status != 'archived' GROUP BY domain_id"
    ).map_err(|e| e.to_string())?;

    let by_domain = stmt.query_map([], |row| {
        Ok(DomainTaskCount {
            domain_id: row.get(0)?,
            total: row.get(1)?,
            completed: row.get(2)?,
        })
    }).map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())?;

    Ok(TaskStats { total, completed, by_domain })
}

// ─── Reset ────────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn reset_all_data(state: State<'_, DbState>) -> Result<(), String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    conn.execute_batch("
        DELETE FROM domains;
        DELETE FROM tasks;
        DELETE FROM habits;
        DELETE FROM habit_logs;
        DELETE FROM goals;
        DELETE FROM xp_events;
        DELETE FROM notes;
        DELETE FROM inbox_items;
        DELETE FROM task_templates;
        DELETE FROM focus_sessions;
        DELETE FROM focus_timer_drafts;
        DELETE FROM task_friction_logs;
        UPDATE achievements SET unlocked = 0, unlocked_at = NULL;
        UPDATE app_state SET momentum_score = 50, current_mit_task_id = NULL, last_momentum_calc = NULL, onboarding_complete = 0;
    ").map_err(|e| e.to_string())?;
    Ok(())
}

// ─── Inbox Types / Commands ────────────────────────────────────────────────────

fn row_to_inbox_item(row: &rusqlite::Row) -> rusqlite::Result<InboxItem> {
    Ok(InboxItem {
        id: row.get(0)?,
        content: row.get(1)?,
        domain_id: row.get(2)?,
        source_label: row.get::<_, Option<String>>(3)?.unwrap_or_else(default_inbox_source),
        suggested_kind: row.get::<_, Option<String>>(4)?.unwrap_or_else(default_inbox_suggested_kind),
        status: row.get::<_, Option<String>>(5)?.unwrap_or_else(default_inbox_status),
        created_at: row.get(6)?,
        triaged_at: row.get(7)?,
        updated_at: row.get::<_, Option<String>>(8)?.unwrap_or_else(|| row.get::<_, String>(6).unwrap_or_default()),
        deleted_at: row.get(9)?,
    })
}

fn normalize_optional_domain(domain_id: Option<String>) -> Option<String> {
    domain_id.and_then(|value| {
        let trimmed = value.trim().to_string();
        if trimmed.is_empty() { None } else { Some(trimmed) }
    })
}

fn split_capture_text(content: &str) -> (String, String) {
    let trimmed = content.trim();
    let mut lines = trimmed.lines().map(str::trim).filter(|line| !line.is_empty());
    let title = lines.next().unwrap_or(trimmed).to_string();
    let rest = lines.collect::<Vec<_>>().join("\n");
    (title, rest)
}

#[tauri::command]
pub fn get_inbox_items(state: State<'_, DbState>, status: Option<String>) -> Result<Vec<InboxItem>, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    let items = if let Some(status_value) = status {
        let mut stmt = conn.prepare(
            "SELECT id, content, domain_id, source_label, suggested_kind, status, created_at, triaged_at, updated_at, deleted_at
             FROM inbox_items
             WHERE deleted_at IS NULL AND status = ?1
             ORDER BY created_at DESC"
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map(params![status_value], row_to_inbox_item)
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        rows
    } else {
        let mut stmt = conn.prepare(
            "SELECT id, content, domain_id, source_label, suggested_kind, status, created_at, triaged_at, updated_at, deleted_at
             FROM inbox_items
             WHERE deleted_at IS NULL
             ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'someday' THEN 1 ELSE 2 END, created_at DESC"
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], row_to_inbox_item)
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        rows
    };
    Ok(items)
}

#[tauri::command]
pub fn get_deleted_inbox_items(state: State<'_, DbState>) -> Result<Vec<InboxItem>, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    let mut stmt = conn.prepare(
        "SELECT id, content, domain_id, source_label, suggested_kind, status, created_at, triaged_at, updated_at, deleted_at
         FROM inbox_items
         WHERE deleted_at IS NOT NULL
         ORDER BY deleted_at DESC"
    ).map_err(|e| e.to_string())?;

    let items = stmt.query_map([], row_to_inbox_item)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(items)
}

#[tauri::command]
pub fn create_inbox_item(state: State<'_, DbState>, payload: CreateInboxItemPayload) -> Result<InboxItem, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    let trimmed = payload.content.trim();
    if trimmed.is_empty() {
        return Err("Inbox capture cannot be empty".to_string());
    }

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let suggested_kind = payload.suggested_kind.unwrap_or_else(default_inbox_suggested_kind);
    let domain_id = normalize_optional_domain(payload.domain_id);
    conn.execute(
        "INSERT INTO inbox_items (id, content, domain_id, source_label, suggested_kind, status, created_at, triaged_at, updated_at, deleted_at)
         VALUES (?1, ?2, ?3, ?4, ?5, 'pending', ?6, NULL, ?6, NULL)",
        params![id, trimmed, domain_id, payload.source_label, suggested_kind, now],
    ).map_err(|e| e.to_string())?;
    conn.query_row(
        "SELECT id, content, domain_id, source_label, suggested_kind, status, created_at, triaged_at, updated_at, deleted_at FROM inbox_items WHERE id = ?1",
        params![id],
        row_to_inbox_item,
    ).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn triage_inbox_item(state: State<'_, DbState>, payload: TriageInboxItemPayload) -> Result<InboxItem, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    let existing = conn.query_row(
        "SELECT id, content, domain_id, source_label, suggested_kind, status, created_at, triaged_at, updated_at, deleted_at
         FROM inbox_items
         WHERE id = ?1 AND deleted_at IS NULL",
        params![payload.id.clone()],
        row_to_inbox_item,
    ).map_err(|e| e.to_string())?;

    let domain_id = normalize_optional_domain(payload.domain_id).or(existing.domain_id.clone());
    let now = Utc::now().to_rfc3339();
    let source_tag = existing.source_label.replace('_', "-");
    let capture_tags = serde_json::to_string(&vec!["inbox".to_string(), format!("source:{source_tag}")]).map_err(|e| e.to_string())?;

    match payload.action.as_str() {
        "task" => {
            let task_id = Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO tasks (id, domain_id, title, description, priority, energy_level, status, is_mit, xp_value, xp_awarded, parent_task_id, goal_id, tags, time_estimate_minutes, due_date, completed_at, created_at, updated_at, attachments)
                 VALUES (?1, ?2, ?3, ?4, 'medium', 'medium', 'todo', 0, 30, 0, NULL, NULL, ?5, NULL, NULL, NULL, ?6, ?6, '[]')",
                params![
                    task_id,
                    domain_id.clone().unwrap_or_else(|| "self".to_string()),
                    existing.content.trim(),
                    Option::<String>::None,
                    capture_tags,
                    now,
                ],
            ).map_err(|e| e.to_string())?;
            conn.execute(
                "UPDATE inbox_items SET domain_id = ?1, status = 'triaged', triaged_at = ?2, updated_at = ?2 WHERE id = ?3",
                params![domain_id, now, existing.id],
            ).map_err(|e| e.to_string())?;
        }
        "goal" => {
            let goal_id = Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO goals (id, domain_id, title, description, parent_goal_id, status, next_action, review_date, blocked_by, health, target_date, progress_percent, created_at, updated_at)
                 VALUES (?1, ?2, ?3, NULL, NULL, 'active', NULL, NULL, NULL, 'on_track', NULL, 0, ?4, ?4)",
                params![
                    goal_id,
                    domain_id.clone().unwrap_or_else(|| "self".to_string()),
                    existing.content.trim(),
                    now,
                ],
            ).map_err(|e| e.to_string())?;
            conn.execute(
                "UPDATE inbox_items SET domain_id = ?1, status = 'triaged', triaged_at = ?2, updated_at = ?2 WHERE id = ?3",
                params![domain_id, now, existing.id],
            ).map_err(|e| e.to_string())?;
        }
        "note" => {
            let note_id = Uuid::new_v4().to_string();
            let (title, rest) = split_capture_text(&existing.content);
            let content = if rest.trim().is_empty() { existing.content.clone() } else { rest };
            conn.execute(
                "INSERT INTO notes (id, domain_id, goal_id, title, content, tags, pinned, created_at, updated_at)
                 VALUES (?1, ?2, NULL, ?3, ?4, ?5, 0, ?6, ?6)",
                params![
                    note_id,
                    domain_id.clone(),
                    title,
                    content,
                    capture_tags,
                    now,
                ],
            ).map_err(|e| e.to_string())?;
            conn.execute(
                "UPDATE inbox_items SET domain_id = ?1, status = 'triaged', triaged_at = ?2, updated_at = ?2 WHERE id = ?3",
                params![domain_id, now, existing.id],
            ).map_err(|e| e.to_string())?;
        }
        "someday" => {
            conn.execute(
                "UPDATE inbox_items SET domain_id = ?1, status = 'someday', triaged_at = ?2, updated_at = ?2 WHERE id = ?3",
                params![domain_id, now, existing.id],
            ).map_err(|e| e.to_string())?;
        }
        "delete" => {
            conn.execute(
                "UPDATE inbox_items SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2",
                params![now.clone(), existing.id],
            ).map_err(|e| e.to_string())?;
            return Ok(InboxItem {
                updated_at: now.clone(),
                deleted_at: Some(now),
                ..existing
            });
        }
        _ => return Err("Unsupported inbox triage action".to_string()),
    }

    conn.query_row(
        "SELECT id, content, domain_id, source_label, suggested_kind, status, created_at, triaged_at, updated_at, deleted_at FROM inbox_items WHERE id = ?1",
        params![payload.id],
        row_to_inbox_item,
    ).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_inbox_item(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    conn.execute(
        "UPDATE inbox_items SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2",
        params![Utc::now().to_rfc3339(), id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn restore_inbox_item(state: State<'_, DbState>, id: String) -> Result<InboxItem, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    conn.execute(
        "UPDATE inbox_items SET deleted_at = NULL, updated_at = ?1 WHERE id = ?2",
        params![Utc::now().to_rfc3339(), id.clone()],
    ).map_err(|e| e.to_string())?;
    conn.query_row(
        "SELECT id, content, domain_id, source_label, suggested_kind, status, created_at, triaged_at, updated_at, deleted_at FROM inbox_items WHERE id = ?1",
        params![id],
        row_to_inbox_item,
    ).map_err(|e| e.to_string())
}

fn row_to_task_template(row: &rusqlite::Row) -> rusqlite::Result<TaskTemplate> {
    Ok(TaskTemplate {
        id: row.get(0)?,
        title: row.get(1)?,
        description: row.get(2)?,
        domain_id: row.get(3)?,
        priority: row.get(4)?,
        energy_level: row.get::<_, Option<String>>(5)?.unwrap_or_else(default_energy_level),
        is_mit: row.get::<_, i64>(6)? != 0,
        tags: row.get::<_, Option<String>>(7)?.unwrap_or_else(|| "[]".to_string()),
        time_estimate_minutes: row.get(8)?,
        recurrence_rule: row.get(9)?,
        source_task_id: row.get(10)?,
        created_at: row.get(11)?,
        updated_at: row.get(12)?,
    })
}

#[tauri::command]
pub fn get_task_templates(state: State<'_, DbState>) -> Result<Vec<TaskTemplate>, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    let mut stmt = conn.prepare(
        "SELECT id, title, description, domain_id, priority, energy_level, is_mit, tags, time_estimate_minutes, recurrence_rule, source_task_id, created_at, updated_at FROM task_templates ORDER BY updated_at DESC"
    ).map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], row_to_task_template)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(rows)
}

#[tauri::command]
pub fn create_task_template(state: State<'_, DbState>, payload: CreateTaskTemplatePayload) -> Result<TaskTemplate, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    if payload.title.trim().is_empty() {
        return Err("Template title cannot be empty".to_string());
    }
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO task_templates (id, title, description, domain_id, priority, energy_level, is_mit, tags, time_estimate_minutes, recurrence_rule, source_task_id, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?12)",
        params![
            id,
            payload.title.trim(),
            payload.description,
            payload.domain_id,
            payload.priority,
            payload.energy_level.unwrap_or_else(default_energy_level),
            payload.is_mit as i64,
            payload.tags.unwrap_or_else(|| "[]".to_string()),
            payload.time_estimate_minutes,
            payload.recurrence_rule,
            payload.source_task_id,
            now,
        ],
    ).map_err(|e| e.to_string())?;
    conn.query_row(
        "SELECT id, title, description, domain_id, priority, energy_level, is_mit, tags, time_estimate_minutes, recurrence_rule, source_task_id, created_at, updated_at FROM task_templates WHERE id = ?1",
        params![id],
        row_to_task_template,
    ).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_task_template(state: State<'_, DbState>, payload: UpdateTaskTemplatePayload) -> Result<TaskTemplate, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    let now = Utc::now().to_rfc3339();
    if let Some(title) = payload.title { conn.execute("UPDATE task_templates SET title = ?1, updated_at = ?2 WHERE id = ?3", params![title.trim(), now, payload.id]).map_err(|e| e.to_string())?; }
    if let Some(description) = payload.description { conn.execute("UPDATE task_templates SET description = ?1, updated_at = ?2 WHERE id = ?3", params![description, now, payload.id]).map_err(|e| e.to_string())?; }
    if let Some(domain_id) = payload.domain_id { conn.execute("UPDATE task_templates SET domain_id = ?1, updated_at = ?2 WHERE id = ?3", params![domain_id, now, payload.id]).map_err(|e| e.to_string())?; }
    if let Some(priority) = payload.priority { conn.execute("UPDATE task_templates SET priority = ?1, updated_at = ?2 WHERE id = ?3", params![priority, now, payload.id]).map_err(|e| e.to_string())?; }
    if let Some(energy_level) = payload.energy_level { conn.execute("UPDATE task_templates SET energy_level = ?1, updated_at = ?2 WHERE id = ?3", params![energy_level, now, payload.id]).map_err(|e| e.to_string())?; }
    if let Some(is_mit) = payload.is_mit { conn.execute("UPDATE task_templates SET is_mit = ?1, updated_at = ?2 WHERE id = ?3", params![is_mit as i64, now, payload.id]).map_err(|e| e.to_string())?; }
    if let Some(tags) = payload.tags { conn.execute("UPDATE task_templates SET tags = ?1, updated_at = ?2 WHERE id = ?3", params![tags, now, payload.id]).map_err(|e| e.to_string())?; }
    if let Some(time_estimate_minutes) = payload.time_estimate_minutes { conn.execute("UPDATE task_templates SET time_estimate_minutes = ?1, updated_at = ?2 WHERE id = ?3", params![time_estimate_minutes, now, payload.id]).map_err(|e| e.to_string())?; }
    if let Some(recurrence_rule) = payload.recurrence_rule { conn.execute("UPDATE task_templates SET recurrence_rule = ?1, updated_at = ?2 WHERE id = ?3", params![recurrence_rule, now, payload.id]).map_err(|e| e.to_string())?; }
    conn.query_row(
        "SELECT id, title, description, domain_id, priority, energy_level, is_mit, tags, time_estimate_minutes, recurrence_rule, source_task_id, created_at, updated_at FROM task_templates WHERE id = ?1",
        params![payload.id],
        row_to_task_template,
    ).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_task_template(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    conn.execute("DELETE FROM task_templates WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_focus_sessions(state: State<'_, DbState>, days: Option<i64>) -> Result<Vec<FocusSession>, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    let window_start = days.map(|value| {
        Utc::now()
            .checked_sub_signed(Duration::days(value))
            .unwrap_or_else(Utc::now)
            .to_rfc3339()
    });

    let sessions = if let Some(start) = window_start {
        let mut stmt = conn.prepare(
            "SELECT fs.id, fs.task_id, t.title, t.domain_id, fs.planned_minutes, fs.actual_minutes, fs.distraction_count, fs.interruption_notes, fs.reflection, fs.created_at, fs.started_at, fs.ended_at
             FROM focus_sessions fs
             JOIN tasks t ON t.id = fs.task_id
             WHERE fs.created_at >= ?1
             ORDER BY fs.created_at DESC"
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map(params![start], |row| {
            Ok(FocusSession {
                id: row.get(0)?,
                task_id: row.get(1)?,
                task_title: row.get(2)?,
                domain_id: row.get(3)?,
                planned_minutes: row.get(4)?,
                actual_minutes: row.get(5)?,
                distraction_count: row.get(6)?,
                interruption_notes: row.get(7)?,
                reflection: row.get(8)?,
                created_at: row.get(9)?,
                started_at: row.get(10)?,
                ended_at: row.get(11)?,
            })
        }).map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?
    } else {
        let mut stmt = conn.prepare(
            "SELECT fs.id, fs.task_id, t.title, t.domain_id, fs.planned_minutes, fs.actual_minutes, fs.distraction_count, fs.interruption_notes, fs.reflection, fs.created_at, fs.started_at, fs.ended_at
             FROM focus_sessions fs
             JOIN tasks t ON t.id = fs.task_id
             ORDER BY fs.created_at DESC"
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], |row| {
            Ok(FocusSession {
                id: row.get(0)?,
                task_id: row.get(1)?,
                task_title: row.get(2)?,
                domain_id: row.get(3)?,
                planned_minutes: row.get(4)?,
                actual_minutes: row.get(5)?,
                distraction_count: row.get(6)?,
                interruption_notes: row.get(7)?,
                reflection: row.get(8)?,
                created_at: row.get(9)?,
                started_at: row.get(10)?,
                ended_at: row.get(11)?,
            })
        }).map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?
    };
    Ok(sessions)
}

#[tauri::command]
pub fn get_focus_timer_drafts(state: State<'_, DbState>) -> Result<Vec<FocusTimerDraft>, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    let mut stmt = conn.prepare(
        "SELECT task_id, planned_minutes, elapsed_seconds, distraction_count, interruption_notes, reflection, is_running, last_started_at, updated_at
         FROM focus_timer_drafts
         ORDER BY updated_at DESC"
    ).map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], row_to_focus_timer_draft)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(rows)
}

#[tauri::command]
pub fn save_focus_timer_draft(
    state: State<'_, DbState>,
    payload: SaveFocusTimerDraftPayload,
) -> Result<FocusTimerDraft, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO focus_timer_drafts (
            task_id, planned_minutes, elapsed_seconds, distraction_count, interruption_notes, reflection, is_running, last_started_at, updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
         ON CONFLICT(task_id) DO UPDATE SET
            planned_minutes = excluded.planned_minutes,
            elapsed_seconds = excluded.elapsed_seconds,
            distraction_count = excluded.distraction_count,
            interruption_notes = excluded.interruption_notes,
            reflection = excluded.reflection,
            is_running = excluded.is_running,
            last_started_at = excluded.last_started_at,
            updated_at = excluded.updated_at",
        params![
            payload.task_id,
            payload.planned_minutes.max(1),
            payload.elapsed_seconds.max(0),
            payload.distraction_count.max(0),
            payload.interruption_notes,
            payload.reflection,
            payload.is_running as i64,
            payload.last_started_at,
            now,
        ],
    ).map_err(|e| e.to_string())?;

    conn.query_row(
        "SELECT task_id, planned_minutes, elapsed_seconds, distraction_count, interruption_notes, reflection, is_running, last_started_at, updated_at
         FROM focus_timer_drafts
         WHERE task_id = ?1",
        params![payload.task_id],
        row_to_focus_timer_draft,
    ).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn clear_focus_timer_draft(state: State<'_, DbState>, task_id: String) -> Result<(), String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    conn.execute("DELETE FROM focus_timer_drafts WHERE task_id = ?1", params![task_id]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn complete_focus_session(state: State<'_, DbState>, payload: CompleteFocusSessionPayload) -> Result<FocusSession, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    let session_id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO focus_sessions (id, task_id, planned_minutes, actual_minutes, distraction_count, interruption_notes, reflection, created_at, started_at, ended_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            session_id,
            payload.task_id,
            payload.planned_minutes,
            payload.actual_minutes,
            payload.distraction_count,
            payload.interruption_notes,
            payload.reflection,
            now,
            payload.started_at,
            payload.ended_at
        ],
    ).map_err(|e| e.to_string())?;

    let existing_actual: i64 = conn.query_row(
        "SELECT COALESCE(time_actual_minutes, 0) FROM tasks WHERE id = ?1",
        params![payload.task_id],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE tasks SET time_actual_minutes = ?1, updated_at = ?2 WHERE id = ?3",
        params![existing_actual + payload.actual_minutes, now, payload.task_id],
    ).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM focus_timer_drafts WHERE task_id = ?1", params![payload.task_id.clone()]).map_err(|e| e.to_string())?;

    conn.query_row(
        "SELECT fs.id, fs.task_id, t.title, t.domain_id, fs.planned_minutes, fs.actual_minutes, fs.distraction_count, fs.interruption_notes, fs.reflection, fs.created_at, fs.started_at, fs.ended_at
         FROM focus_sessions fs
         JOIN tasks t ON t.id = fs.task_id
         WHERE fs.id = ?1",
        params![session_id],
        |row| {
            Ok(FocusSession {
                id: row.get(0)?,
                task_id: row.get(1)?,
                task_title: row.get(2)?,
                domain_id: row.get(3)?,
                planned_minutes: row.get(4)?,
                actual_minutes: row.get(5)?,
                distraction_count: row.get(6)?,
                interruption_notes: row.get(7)?,
                reflection: row.get(8)?,
                created_at: row.get(9)?,
                started_at: row.get(10)?,
                ended_at: row.get(11)?,
            })
        }
    ).map_err(|e| e.to_string())
}

// ─── Note Types ───────────────────────────────────────────────────────────────

#[tauri::command]
pub fn get_task_friction_logs(state: State<'_, DbState>, days: Option<i64>) -> Result<Vec<TaskFrictionLog>, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    let window_start = days.map(|value| {
        Utc::now()
            .checked_sub_signed(Duration::days(value))
            .unwrap_or_else(Utc::now)
            .to_rfc3339()
    });

    let logs = if let Some(start) = window_start {
        let mut stmt = conn.prepare(
            "SELECT fl.id, fl.task_id, t.title, t.domain_id, fl.reason, fl.details, fl.action_type, fl.created_at
             FROM task_friction_logs fl
             JOIN tasks t ON t.id = fl.task_id
             WHERE fl.created_at >= ?1
             ORDER BY fl.created_at DESC"
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map(params![start], |row| {
            Ok(TaskFrictionLog {
                id: row.get(0)?,
                task_id: row.get(1)?,
                task_title: row.get(2)?,
                domain_id: row.get(3)?,
                reason: row.get(4)?,
                details: row.get(5)?,
                action_type: row.get(6)?,
                created_at: row.get(7)?,
            })
        }).map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
    } else {
        let mut stmt = conn.prepare(
            "SELECT fl.id, fl.task_id, t.title, t.domain_id, fl.reason, fl.details, fl.action_type, fl.created_at
             FROM task_friction_logs fl
             JOIN tasks t ON t.id = fl.task_id
             ORDER BY fl.created_at DESC"
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], |row| {
            Ok(TaskFrictionLog {
                id: row.get(0)?,
                task_id: row.get(1)?,
                task_title: row.get(2)?,
                domain_id: row.get(3)?,
                reason: row.get(4)?,
                details: row.get(5)?,
                action_type: row.get(6)?,
                created_at: row.get(7)?,
            })
        }).map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?
    };

    Ok(logs)
}

#[tauri::command]
pub fn create_task_friction_log(state: State<'_, DbState>, payload: CreateTaskFrictionLogPayload) -> Result<TaskFrictionLog, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let details = payload.details.and_then(|value| {
        let trimmed = value.trim().to_string();
        if trimmed.is_empty() { None } else { Some(trimmed) }
    });
    let action_type = if payload.action_type.trim().is_empty() {
        "logged".to_string()
    } else {
        payload.action_type.trim().to_string()
    };

    conn.execute(
        "INSERT INTO task_friction_logs (id, task_id, reason, details, action_type, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![id, payload.task_id, payload.reason.trim(), details, action_type, now],
    ).map_err(|e| e.to_string())?;

    conn.query_row(
        "SELECT fl.id, fl.task_id, t.title, t.domain_id, fl.reason, fl.details, fl.action_type, fl.created_at
         FROM task_friction_logs fl
         JOIN tasks t ON t.id = fl.task_id
         WHERE fl.id = ?1",
        params![id],
        |row| {
            Ok(TaskFrictionLog {
                id: row.get(0)?,
                task_id: row.get(1)?,
                task_title: row.get(2)?,
                domain_id: row.get(3)?,
                reason: row.get(4)?,
                details: row.get(5)?,
                action_type: row.get(6)?,
                created_at: row.get(7)?,
            })
        }
    ).map_err(|e| e.to_string())
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Note {
    pub id: String,
    pub domain_id: Option<String>,
    pub goal_id: Option<String>,
    pub title: String,
    pub content: String,
    pub tags: String,
    pub pinned: bool,
    pub created_at: String,
    pub updated_at: String,
    #[serde(default)]
    pub deleted_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateNotePayload {
    pub domain_id: Option<String>,
    pub goal_id: Option<String>,
    pub title: String,
    pub content: Option<String>,
    pub tags: Option<String>,
    pub pinned: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateNotePayload {
    pub id: String,
    pub domain_id: Option<String>,
    pub goal_id: Option<String>,
    pub title: Option<String>,
    pub content: Option<String>,
    pub tags: Option<String>,
    pub pinned: Option<bool>,
}

fn row_to_note(row: &rusqlite::Row) -> rusqlite::Result<Note> {
    Ok(Note {
        id: row.get(0)?,
        domain_id: row.get(1)?,
        goal_id: row.get(2)?,
        title: row.get(3)?,
        content: row.get::<_, Option<String>>(4)?.unwrap_or_default(),
        tags: row.get::<_, Option<String>>(5)?.unwrap_or_else(|| "[]".to_string()),
        pinned: row.get::<_, i64>(6)? != 0,
        created_at: row.get(7)?,
        updated_at: row.get(8)?,
        deleted_at: row.get(9)?,
    })
}

// ─── Note Commands ────────────────────────────────────────────────────────────

#[tauri::command]
pub fn get_notes(state: State<'_, DbState>, domain_id: Option<String>) -> Result<Vec<Note>, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    let notes: Vec<Note> = if let Some(did) = domain_id {
        let mut stmt = conn.prepare(
            "SELECT id, domain_id, goal_id, title, content, tags, pinned, created_at, updated_at, deleted_at
             FROM notes
             WHERE deleted_at IS NULL AND domain_id = ?1
             ORDER BY pinned DESC, updated_at DESC"
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map(params![did], row_to_note)
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        rows
    } else {
        let mut stmt = conn.prepare(
            "SELECT id, domain_id, goal_id, title, content, tags, pinned, created_at, updated_at, deleted_at
             FROM notes
             WHERE deleted_at IS NULL
             ORDER BY pinned DESC, updated_at DESC"
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], row_to_note)
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        rows
    };
    Ok(notes)
}

#[tauri::command]
pub fn get_deleted_notes(state: State<'_, DbState>) -> Result<Vec<Note>, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    let mut stmt = conn.prepare(
        "SELECT id, domain_id, goal_id, title, content, tags, pinned, created_at, updated_at, deleted_at
         FROM notes
         WHERE deleted_at IS NOT NULL
         ORDER BY deleted_at DESC"
    ).map_err(|e| e.to_string())?;
    let notes = stmt.query_map([], row_to_note)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(notes)
}

#[tauri::command]
pub fn create_note(state: State<'_, DbState>, payload: CreateNotePayload) -> Result<Note, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let content = payload.content.unwrap_or_default();
    let tags = payload.tags.unwrap_or_else(|| "[]".to_string());
    let pinned = payload.pinned.unwrap_or(false) as i64;
    conn.execute(
        "INSERT INTO notes (id, domain_id, goal_id, title, content, tags, pinned, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![id, payload.domain_id, payload.goal_id, payload.title, content, tags, pinned, now, now],
    ).map_err(|e| e.to_string())?;
    conn.query_row(
        "SELECT id, domain_id, goal_id, title, content, tags, pinned, created_at, updated_at, deleted_at FROM notes WHERE id = ?1",
        params![id],
        row_to_note,
    ).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_note(state: State<'_, DbState>, payload: UpdateNotePayload) -> Result<Note, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    let now = Utc::now().to_rfc3339();
    if let Some(t) = payload.title        { conn.execute("UPDATE notes SET title = ?1, updated_at = ?2 WHERE id = ?3", params![t, now, payload.id]).map_err(|e| e.to_string())?; }
    if let Some(c) = payload.content      { conn.execute("UPDATE notes SET content = ?1, updated_at = ?2 WHERE id = ?3", params![c, now, payload.id]).map_err(|e| e.to_string())?; }
    if let Some(tg) = payload.tags        { conn.execute("UPDATE notes SET tags = ?1, updated_at = ?2 WHERE id = ?3", params![tg, now, payload.id]).map_err(|e| e.to_string())?; }
    if let Some(p) = payload.pinned       { conn.execute("UPDATE notes SET pinned = ?1, updated_at = ?2 WHERE id = ?3", params![p as i64, now, payload.id]).map_err(|e| e.to_string())?; }
    if let Some(d) = payload.domain_id    {
        let domain_value: Option<String> = if d.is_empty() { None } else { Some(d) };
        conn.execute("UPDATE notes SET domain_id = ?1, updated_at = ?2 WHERE id = ?3", params![domain_value, now, payload.id]).map_err(|e| e.to_string())?;
    }
    if let Some(g) = payload.goal_id      {
        let goal_value: Option<String> = if g.is_empty() { None } else { Some(g) };
        conn.execute("UPDATE notes SET goal_id = ?1, updated_at = ?2 WHERE id = ?3", params![goal_value, now, payload.id]).map_err(|e| e.to_string())?;
    }
    conn.query_row(
        "SELECT id, domain_id, goal_id, title, content, tags, pinned, created_at, updated_at, deleted_at FROM notes WHERE id = ?1",
        params![payload.id],
        row_to_note,
    ).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_note(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE notes SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2",
        params![now, id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn restore_note(state: State<'_, DbState>, id: String) -> Result<Note, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE notes SET deleted_at = NULL, updated_at = ?1 WHERE id = ?2",
        params![now, id.clone()],
    ).map_err(|e| e.to_string())?;
    conn.query_row(
        "SELECT id, domain_id, goal_id, title, content, tags, pinned, created_at, updated_at, deleted_at FROM notes WHERE id = ?1",
        params![id],
        row_to_note,
    ).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn search_notes(state: State<'_, DbState>, query: String) -> Result<Vec<Note>, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    let pattern = format!("%{}%", query.trim());
    let mut stmt = conn.prepare(
        "SELECT id, domain_id, goal_id, title, content, tags, pinned, created_at, updated_at, deleted_at
         FROM notes
         WHERE deleted_at IS NULL AND (title LIKE ?1 OR content LIKE ?1)
         ORDER BY pinned DESC, updated_at DESC"
    ).map_err(|e| e.to_string())?;
    let notes = stmt.query_map(params![pattern], row_to_note)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(notes)
}

#[tauri::command]
pub fn export_data(state: State<'_, DbState>) -> Result<String, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    let payload = load_export_payload(&conn)?;
    serde_json::to_string_pretty(&payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_backup(app: tauri::AppHandle, state: State<'_, DbState>) -> Result<String, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    write_backup_file(&app, &conn, "life-os-backup")
}

#[tauri::command]
pub fn create_named_snapshot(app: tauri::AppHandle, state: State<'_, DbState>, name: String) -> Result<String, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    let normalized = sanitize_snapshot_name(&name);
    if normalized.is_empty() {
        return Err("Snapshot name cannot be empty".to_string());
    }
    write_backup_file(&app, &conn, &format!("snapshot-{normalized}"))
}

#[tauri::command]
pub fn backup_before_risky_action(app: tauri::AppHandle, state: State<'_, DbState>, label: String) -> Result<String, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    let normalized = sanitize_snapshot_name(&label);
    let prefix = if normalized.is_empty() {
        "safety-backup".to_string()
    } else {
        format!("safety-{normalized}")
    };
    write_backup_file(&app, &conn, &prefix)
}

#[tauri::command]
pub fn preview_import_data(data: String) -> Result<BackupPreview, String> {
    parse_backup_preview(&data, None, None)
}

#[tauri::command]
pub fn preview_latest_backup(app: tauri::AppHandle, state: State<'_, DbState>) -> Result<BackupPreview, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    let latest = find_latest_backup_file(&app, &conn)?;
    let data = fs::read_to_string(&latest).map_err(|e| e.to_string())?;
    let modified_at = fs::metadata(&latest)
        .ok()
        .and_then(|metadata| metadata.modified().ok())
        .map(system_time_to_rfc3339);
    parse_backup_preview(
        &data,
        Some(latest.to_string_lossy().to_string()),
        modified_at,
    )
}

#[tauri::command]
pub fn list_backups(app: tauri::AppHandle, state: State<'_, DbState>) -> Result<Vec<BackupHistoryItem>, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    let backup_dir = resolve_backup_directory(&app, &conn)?;
    let mut history = Vec::new();

    for (path, metadata) in list_backup_files(&backup_dir)? {
        let Ok(data) = fs::read_to_string(&path) else {
            continue;
        };
        let modified_at = metadata.modified().ok().map(system_time_to_rfc3339);
        let file_path = path.to_string_lossy().to_string();
        let Ok(preview) = parse_backup_preview(&data, Some(file_path.clone()), modified_at.clone()) else {
            continue;
        };
        history.push(BackupHistoryItem {
            file_path,
            file_name: preview.file_name.unwrap_or_else(|| path.file_name().map(|name| name.to_string_lossy().to_string()).unwrap_or_else(|| "backup.json".to_string())),
            backup_name: preview.backup_name,
            exported_at: preview.exported_at,
            version: preview.version,
            modified_at,
            last_action: classify_backup_action(path.file_name().and_then(|name| name.to_str()).unwrap_or("backup.json")),
            compatibility: preview.compatibility,
        });
    }

    let mut stmt = conn.prepare(
        "SELECT file_path, backup_name, action, source_exported_at, source_version, created_at FROM restore_history ORDER BY created_at DESC LIMIT 25"
    ).map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| {
        let file_path: String = row.get(0)?;
        let file_name = PathBuf::from(&file_path)
            .file_name()
            .map(|name| name.to_string_lossy().to_string())
            .unwrap_or_else(|| file_path.clone());
        let version: Option<String> = row.get(4)?;
        let compatibility = version
            .as_deref()
            .map(|value| match compare_versions(value, env!("CARGO_PKG_VERSION")) {
                std::cmp::Ordering::Greater => "newer".to_string(),
                std::cmp::Ordering::Less => "older".to_string(),
                std::cmp::Ordering::Equal => "ok".to_string(),
            })
            .unwrap_or_else(|| "unknown".to_string());
        Ok(BackupHistoryItem {
            file_path,
            file_name,
            backup_name: row.get(1)?,
            exported_at: row.get(3)?,
            version,
            modified_at: row.get(5)?,
            last_action: row.get(2)?,
            compatibility,
        })
    }).map_err(|e| e.to_string())?;

    for item in rows {
        history.push(item.map_err(|e| e.to_string())?);
    }

    history.sort_by(|left, right| right.modified_at.cmp(&left.modified_at));
    Ok(history)
}

#[tauri::command]
pub fn get_backup_health_status(app: tauri::AppHandle, state: State<'_, DbState>) -> Result<BackupHealthStatus, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    let app_state = read_app_state_row(&conn)?;
    let backup_dir = resolve_backup_directory(&app, &conn)?;
    let mut latest_backup: Option<BackupHistoryItem> = None;

    for (path, metadata) in list_backup_files(&backup_dir)? {
        let Ok(data) = fs::read_to_string(&path) else {
            continue;
        };
        let modified_at = metadata.modified().ok().map(system_time_to_rfc3339);
        let file_path = path.to_string_lossy().to_string();
        let Ok(preview) = parse_backup_preview(&data, Some(file_path.clone()), modified_at.clone()) else {
            continue;
        };
        let file_name = path
            .file_name()
            .map(|name| name.to_string_lossy().to_string())
            .unwrap_or_else(|| "backup.json".to_string());
        let candidate = BackupHistoryItem {
            file_path,
            file_name,
            backup_name: preview.backup_name,
            exported_at: preview.exported_at,
            version: preview.version,
            modified_at: modified_at.clone(),
            last_action: classify_backup_action(path.file_name().and_then(|name| name.to_str()).unwrap_or("backup.json")),
            compatibility: preview.compatibility,
        };

        match &latest_backup {
            Some(existing) if candidate.modified_at <= existing.modified_at => {}
            _ => latest_backup = Some(candidate),
        }
    }

    let latest_backup_age_hours = latest_backup
        .as_ref()
        .and_then(|item| item.modified_at.as_ref())
        .and_then(|value| DateTime::parse_from_rfc3339(value).ok())
        .map(|value| (Utc::now() - value.with_timezone(&Utc)).num_hours());

    let mut pending_warnings = Vec::new();
    if !app_state.auto_backup_enabled {
        pending_warnings.push("Automatic daily backups are disabled.".to_string());
    }
    if latest_backup.is_none() {
        pending_warnings.push("No backup files have been found yet.".to_string());
    } else if let Some(hours) = latest_backup_age_hours {
        if hours >= 72 {
            pending_warnings.push("Your newest backup is older than 72 hours.".to_string());
        } else if hours >= 24 {
            pending_warnings.push("Your newest backup is more than 24 hours old.".to_string());
        }
    }

    let status_label = if latest_backup.is_none() {
        "critical".to_string()
    } else if pending_warnings.is_empty() {
        "healthy".to_string()
    } else {
        "warning".to_string()
    };

    Ok(BackupHealthStatus {
        backup_directory: backup_dir.to_string_lossy().to_string(),
        auto_backup_enabled: app_state.auto_backup_enabled,
        last_backup_at: app_state.last_backup_at,
        latest_backup,
        latest_backup_age_hours,
        pending_warnings,
        status_label,
    })
}

#[tauri::command]
pub fn import_data(app: tauri::AppHandle, state: State<'_, DbState>, data: String) -> Result<(), String> {
    let mut conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    if conn.query_row("SELECT COUNT(*) FROM tasks", [], |row| row.get::<_, i64>(0)).unwrap_or(0) > 0
        || conn.query_row("SELECT COUNT(*) FROM habits", [], |row| row.get::<_, i64>(0)).unwrap_or(0) > 0
        || conn.query_row("SELECT COUNT(*) FROM goals", [], |row| row.get::<_, i64>(0)).unwrap_or(0) > 0
        || conn.query_row("SELECT COUNT(*) FROM notes", [], |row| row.get::<_, i64>(0)).unwrap_or(0) > 0
    {
        let _ = write_backup_file(&app, &conn, "pre-import-backup");
    }

    let preview = parse_backup_preview(&data, None, None)?;
    let payload: ImportPayload = serde_json::from_str(&data).map_err(|e| format!("Invalid backup file: {}", e))?;
    import_payload_into_db(&mut conn, payload)?;
    let file_ref = preview.file_path.as_deref().unwrap_or("manual-import");
    let _ = record_restore_history(
        &conn,
        file_ref,
        &preview.backup_name,
        "restore",
        preview.exported_at.as_deref(),
        preview.version.as_deref(),
    );
    Ok(())
}

#[tauri::command]
pub fn restore_latest_backup(app: tauri::AppHandle, state: State<'_, DbState>) -> Result<String, String> {
    let mut conn = state.0.lock().unwrap_or_else(|e| e.into_inner());
    let latest = find_latest_backup_file(&app, &conn)?;
    let data = fs::read_to_string(&latest).map_err(|e| e.to_string())?;
    let preview = parse_backup_preview(
        &data,
        Some(latest.to_string_lossy().to_string()),
        fs::metadata(&latest).ok().and_then(|metadata| metadata.modified().ok()).map(system_time_to_rfc3339),
    )?;
    let payload: ImportPayload = serde_json::from_str(&data).map_err(|e| format!("Invalid backup file: {}", e))?;
    let _ = write_backup_file(&app, &conn, "pre-restore-backup");
    import_payload_into_db(&mut conn, payload)?;
    let latest_path = latest.to_string_lossy().to_string();
    let _ = record_restore_history(
        &conn,
        &latest_path,
        &preview.backup_name,
        "restore",
        preview.exported_at.as_deref(),
        preview.version.as_deref(),
    );
    Ok(latest_path)
}

// ─── Calendar Types ───────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CalendarTaskSummary {
    pub id: String,
    pub title: String,
    pub priority: String,
    pub status: String,
    pub domain_id: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CalendarHabitSummary {
    pub habit_id: String,
    pub title: String,
    pub domain_id: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CalendarDay {
    pub date: String,
    pub tasks: Vec<CalendarTaskSummary>,
    pub habits_logged: Vec<CalendarHabitSummary>,
    pub xp_earned: i64,
}

// ─── Calendar Command ─────────────────────────────────────────────────────────

#[tauri::command]
pub fn get_calendar_data(state: State<'_, DbState>, year: i32, month: i32) -> Result<Vec<CalendarDay>, String> {
    let conn = state.0.lock().unwrap_or_else(|e| e.into_inner());

    let start = format!("{:04}-{:02}-01", year, month);
    let end = if month == 12 {
        format!("{:04}-01-01", year + 1)
    } else {
        format!("{:04}-{:02}-01", year, month + 1)
    };

    // Collect tasks due or completed in month
    let mut task_stmt = conn.prepare(
        "SELECT id, title, priority, status, domain_id, COALESCE(due_date, created_at) as date_key FROM tasks WHERE (due_date >= ?1 AND due_date < ?2) OR (completed_at >= ?1 AND completed_at < ?2) ORDER BY date_key"
    ).map_err(|e| e.to_string())?;

    let mut tasks_by_date: std::collections::HashMap<String, Vec<CalendarTaskSummary>> = std::collections::HashMap::new();
    let task_rows = task_stmt.query_map(params![start, end], |row| {
        let date_key: String = row.get::<_, String>(5)?;
        let date = date_key[..10].to_string();
        Ok((date, CalendarTaskSummary {
            id: row.get(0)?,
            title: row.get(1)?,
            priority: row.get(2)?,
            status: row.get(3)?,
            domain_id: row.get(4)?,
        }))
    }).map_err(|e| e.to_string())?;
    for row in task_rows {
        let (date, task) = row.map_err(|e| e.to_string())?;
        tasks_by_date.entry(date).or_default().push(task);
    }

    // Collect habit logs in month
    let mut habit_stmt = conn.prepare(
        "SELECT hl.habit_id, h.title, h.domain_id, hl.completed_date FROM habit_logs hl JOIN habits h ON h.id = hl.habit_id WHERE hl.completed_date >= ?1 AND hl.completed_date < ?2"
    ).map_err(|e| e.to_string())?;

    let mut habits_by_date: std::collections::HashMap<String, Vec<CalendarHabitSummary>> = std::collections::HashMap::new();
    let habit_rows = habit_stmt.query_map(params![start, end], |row| {
        let date: String = row.get(3)?;
        Ok((date[..10].to_string(), CalendarHabitSummary {
            habit_id: row.get(0)?,
            title: row.get(1)?,
            domain_id: row.get(2)?,
        }))
    }).map_err(|e| e.to_string())?;
    for row in habit_rows {
        let (date, habit) = row.map_err(|e| e.to_string())?;
        habits_by_date.entry(date).or_default().push(habit);
    }

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

    // Build list of all days in month
    let days_in_month = if month == 12 { 31 } else {
        let next_month_start = chrono::NaiveDate::from_ymd_opt(if month == 12 { year + 1 } else { year }, if month == 12 { 1 } else { (month + 1) as u32 }, 1).unwrap();
        let this_month_start = chrono::NaiveDate::from_ymd_opt(year, month as u32, 1).unwrap();
        (next_month_start - this_month_start).num_days()
    };

    let mut result = Vec::new();
    for day in 1..=days_in_month {
        let date = format!("{:04}-{:02}-{:02}", year, month, day);
        result.push(CalendarDay {
            tasks: tasks_by_date.remove(&date).unwrap_or_default(),
            habits_logged: habits_by_date.remove(&date).unwrap_or_default(),
            xp_earned: xp_by_date.remove(&date).unwrap_or(0),
            date,
        });
    }

    Ok(result)
}
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FocusSession {
    pub id: String,
    pub task_id: String,
    pub task_title: String,
    pub domain_id: String,
    pub planned_minutes: i64,
    pub actual_minutes: i64,
    pub distraction_count: i64,
    pub interruption_notes: Option<String>,
    pub reflection: Option<String>,
    pub created_at: String,
    pub started_at: String,
    pub ended_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CompleteFocusSessionPayload {
    pub task_id: String,
    pub planned_minutes: i64,
    pub actual_minutes: i64,
    pub distraction_count: i64,
    pub interruption_notes: Option<String>,
    pub reflection: Option<String>,
    pub started_at: String,
    pub ended_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TaskFrictionLog {
    pub id: String,
    pub task_id: String,
    pub task_title: String,
    pub domain_id: String,
    pub reason: String,
    pub details: Option<String>,
    pub action_type: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateTaskFrictionLogPayload {
    pub task_id: String,
    pub reason: String,
    pub details: Option<String>,
    pub action_type: String,
}
