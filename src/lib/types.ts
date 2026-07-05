export type DomainId = string;

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

export interface CreateDomainPayload {
  name: string;
  icon: string;
  color: string;
}

export interface UpdateDomainProfilePayload {
  id: DomainId;
  name?: string;
  icon?: string;
  color?: string;
}

export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'archived';
export type EnergyLevel = 'deep' | 'medium' | 'light';
export type TaskKind = 'standard' | 'recurring_template' | 'recurring_instance';
export type RecurrenceType = 'daily' | 'weekly' | 'monthly' | 'interval' | 'selected_days' | 'weekdays';

export interface Task {
  id: string;
  domain_id: DomainId;
  title: string;
  description: string | null;
  priority: Priority;
  status: TaskStatus;
  is_mit: boolean;
  is_top_three: boolean;
  xp_value: number;
  xp_awarded: boolean;
  parent_task_id: string | null;
  goal_id: string | null;
  tags: string; // JSON string array
  time_estimate_minutes: number | null;
  due_date: string | null;
  planned_for_date: string | null;
  task_kind: TaskKind;
  scheduled_for: string | null;
  recurring_template_id: string | null;
  recurrence_type: RecurrenceType | null;
  recurrence_interval: number | null;
  recurrence_days: string;
  recurrence_anchor_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  attachments: string; // JSON string array
  recurrence_rule: string | null; // 'daily' | 'weekly' | 'monthly' | null
  time_actual_minutes: number | null;
  energy_level: EnergyLevel;
}

export interface CreateTaskPayload {
  domain_id: DomainId;
  title: string;
  description?: string;
  priority: Priority;
  status?: TaskStatus;
  is_mit: boolean;
  is_top_three?: boolean;
  parent_task_id?: string;
  goal_id?: string;
  tags?: string;
  time_estimate_minutes?: number;
  due_date?: string;
  planned_for_date?: string;
  task_kind?: TaskKind;
  scheduled_for?: string;
  recurring_template_id?: string;
  recurrence_type?: RecurrenceType;
  recurrence_interval?: number;
  recurrence_days?: string;
  recurrence_anchor_date?: string;
  recurrence_rule?: string;
  energy_level?: EnergyLevel;
}

export interface UpdateTaskPayload {
  id: string;
  domain_id?: DomainId;
  title?: string;
  description?: string;
  priority?: Priority;
  status?: TaskStatus;
  is_mit?: boolean;
  is_top_three?: boolean;
  parent_task_id?: string;
  goal_id?: string;
  tags?: string;
  time_estimate_minutes?: number;
  due_date?: string;
  planned_for_date?: string;
  task_kind?: TaskKind;
  scheduled_for?: string;
  recurring_template_id?: string;
  recurrence_type?: RecurrenceType | '';
  recurrence_interval?: number;
  recurrence_days?: string;
  recurrence_anchor_date?: string;
  completed_at?: string;
  attachments?: string;
  recurrence_rule?: string;
  time_actual_minutes?: number;
  energy_level?: EnergyLevel;
}

export type HabitCadenceType = 'daily' | 'weekdays' | 'selected_days' | 'interval' | 'weekly' | 'weekly_count' | 'times_per_week';
export type HabitTargetType = 'checkbox' | 'count' | 'minutes';

export interface Habit {
  id: string;
  domain_id: DomainId;
  title: string;
  description: string | null;
  frequency: 'daily' | 'weekdays' | 'weekly';
  target_days: string; // JSON number array
  xp_per_completion: number;
  cadence_type: HabitCadenceType;
  cadence_days: string;
  cadence_interval_days: number;
  cadence_weekly_target: number;
  cadence_anchor_date: string | null;
  target_type: HabitTargetType;
  target_value: number;
  minimum_value: number | null;
  unit_label: string | null;
  minimum_version: string | null;
  recovery_grace_days: number;
  restart_from_date: string | null;
  streak_current: number;
  streak_longest: number;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export interface CreateHabitPayload {
  domain_id: DomainId;
  title: string;
  description?: string;
  frequency: 'daily' | 'weekdays' | 'weekly';
  target_days: string;
  cadence_type?: HabitCadenceType;
  cadence_days?: string;
  cadence_interval_days?: number;
  cadence_weekly_target?: number;
  cadence_anchor_date?: string;
  target_type?: HabitTargetType;
  target_value?: number;
  minimum_value?: number;
  unit_label?: string;
  minimum_version?: string;
  recovery_grace_days?: number;
}

export interface UpdateHabitPayload {
  id: string;
  domain_id?: DomainId;
  title?: string;
  description?: string;
  frequency?: 'daily' | 'weekdays' | 'weekly';
  target_days?: string;
  cadence_type?: HabitCadenceType;
  cadence_days?: string;
  cadence_interval_days?: number;
  cadence_weekly_target?: number;
  cadence_anchor_date?: string;
  target_type?: HabitTargetType;
  target_value?: number;
  minimum_value?: number;
  unit_label?: string;
  minimum_version?: string;
  recovery_grace_days?: number;
  restart_from_date?: string;
  is_active?: boolean;
}

export type HabitLogStatus = 'completed' | 'minimum' | 'partial' | 'skipped';

export interface HabitLog {
  id: string;
  habit_id: string;
  completed_date: string;
  xp_awarded: number;
  value_completed: number;
  status: HabitLogStatus;
  skip_reason: string | null;
  created_at: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export interface Goal {
  id: string;
  domain_id: DomainId;
  title: string;
  description: string | null;
  parent_goal_id: string | null;
  status: 'active' | 'completed' | 'archived';
  next_action: string | null;
  review_date: string | null;
  blocked_by: string | null;
  health: GoalHealth;
  target_date: string | null;
  progress_percent: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type GoalHealth = 'on_track' | 'at_risk' | 'stalled';

export interface CreateGoalPayload {
  domain_id: DomainId;
  title: string;
  description?: string;
  parent_goal_id?: string;
  next_action?: string;
  review_date?: string;
  blocked_by?: string;
  health?: GoalHealth;
  target_date?: string;
}

export interface UpdateGoalPayload {
  id: string;
  title?: string;
  description?: string;
  status?: 'active' | 'completed' | 'archived';
  next_action?: string;
  review_date?: string;
  blocked_by?: string;
  health?: GoalHealth;
  target_date?: string;
  progress_percent?: number;
}

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

export interface AppStateRow {
  id: number;
  momentum_score: number;
  last_momentum_calc: string | null;
  current_mit_task_id: string | null;
  api_key: string | null;
  onboarding_complete: boolean;
  last_opened_date: string | null;
  backup_directory: string | null;
  auto_backup_enabled: boolean;
  last_backup_at: string | null;
  crt_intensity: 'low' | 'medium' | 'high';
  text_scale: 'normal' | 'large' | 'xl';
  ui_density: 'compact' | 'comfortable';
  sync_enabled: boolean;
  sync_provider: string | null;
  sync_supabase_url: string | null;
  sync_supabase_anon_key: string | null;
  sync_access_token: string | null;
  sync_refresh_token: string | null;
  sync_user_id: string | null;
  sync_user_email: string | null;
  sync_last_sync_at: string | null;
  sync_last_sync_error: string | null;
  sync_last_pushed_at: string | null;
  sync_last_pulled_at: string | null;
}

export type SyncEntity = 'domain' | 'task' | 'habit' | 'habit_log' | 'goal' | 'note' | 'inbox_item';
export type SyncOperation = 'upsert' | 'delete';
export type SyncBootstrapState = 'remote_empty' | 'local_empty' | 'both_have_data';

export interface SyncConfigPayload {
  supabase_url: string;
  supabase_anon_key: string;
}

export interface SyncSessionPayload {
  access_token: string;
  refresh_token: string;
  user_id: string;
  user_email?: string | null;
}

export interface SyncStatusPayload {
  last_sync_at?: string | null;
  last_sync_error?: string | null;
  last_pushed_at?: string | null;
  last_pulled_at?: string | null;
}

export interface SyncQueueItem {
  id: string;
  entity_type: SyncEntity;
  entity_id: string;
  operation_type: SyncOperation;
  payload_json: string;
  created_at: string;
  retry_count: number;
  last_error: string | null;
}

export interface SyncCursor {
  entity_type: SyncEntity;
  last_pulled_at: string | null;
}

export interface SyncCounts {
  domains: number;
  tasks: number;
  habits: number;
  habit_logs: number;
  goals: number;
  notes: number;
  inbox_items: number;
  total: number;
}

export interface SyncBootstrapStatus {
  local_counts: SyncCounts;
  remote_counts: SyncCounts;
  state: SyncBootstrapState;
}

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

export type BackupCompatibility = 'ok' | 'older' | 'newer' | 'unknown';

export interface BackupPreview {
  file_path: string | null;
  file_name: string | null;
  backup_name: string;
  exported_at: string | null;
  version: string | null;
  counts: BackupCounts;
  compatibility: BackupCompatibility;
  warnings: string[];
  modified_at: string | null;
}

export interface BackupHistoryItem {
  file_path: string;
  file_name: string;
  backup_name: string;
  exported_at: string | null;
  version: string | null;
  modified_at: string | null;
  last_action: 'backup' | 'snapshot' | 'safety' | 'restore';
  compatibility: BackupCompatibility;
}

export interface BackupHealthStatus {
  backup_directory: string;
  auto_backup_enabled: boolean;
  last_backup_at: string | null;
  latest_backup: BackupHistoryItem | null;
  latest_backup_age_hours: number | null;
  pending_warnings: string[];
  status_label: 'healthy' | 'warning' | 'critical';
}

export type InboxSource = 'quick_capture' | 'review' | 'note' | 'manual';
export type InboxStatus = 'pending' | 'someday' | 'triaged';
export type InboxSuggestedKind = 'generic' | 'task' | 'goal' | 'note';

export interface InboxItem {
  id: string;
  content: string;
  domain_id: DomainId | null;
  source_label: InboxSource;
  suggested_kind: InboxSuggestedKind;
  status: InboxStatus;
  created_at: string;
  triaged_at: string | null;
  updated_at?: string;
  deleted_at?: string | null;
}

export interface CreateInboxItemPayload {
  content: string;
  domain_id?: DomainId | null;
  source_label: InboxSource;
  suggested_kind?: InboxSuggestedKind;
}

export type InboxTriageAction = 'task' | 'goal' | 'note' | 'someday' | 'delete';

export interface TriageInboxItemPayload {
  id: string;
  action: InboxTriageAction;
  domain_id?: DomainId | null;
}

export interface TaskTemplate {
  id: string;
  title: string;
  description: string | null;
  domain_id: DomainId;
  priority: Priority;
  is_mit: boolean;
  tags: string;
  time_estimate_minutes: number | null;
  recurrence_rule: string | null;
  energy_level: EnergyLevel;
  source_task_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTaskTemplatePayload {
  title: string;
  description?: string;
  domain_id: DomainId;
  priority: Priority;
  is_mit: boolean;
  tags?: string;
  time_estimate_minutes?: number;
  recurrence_rule?: string;
  energy_level?: EnergyLevel;
  source_task_id?: string;
}

export interface UpdateTaskTemplatePayload {
  id: string;
  title?: string;
  description?: string;
  domain_id?: DomainId;
  priority?: Priority;
  is_mit?: boolean;
  tags?: string;
  time_estimate_minutes?: number;
  recurrence_rule?: string;
  energy_level?: EnergyLevel;
}

export interface FocusSession {
  id: string;
  task_id: string;
  task_title: string;
  domain_id: DomainId;
  planned_minutes: number;
  actual_minutes: number;
  distraction_count: number;
  interruption_notes: string | null;
  reflection: string | null;
  created_at: string;
  started_at: string;
  ended_at: string;
}

export interface FocusTimerDraft {
  task_id: string;
  planned_minutes: number;
  elapsed_seconds: number;
  distraction_count: number;
  interruption_notes: string | null;
  reflection: string | null;
  is_running: boolean;
  last_started_at: string | null;
  updated_at: string;
}

export interface SaveFocusTimerDraftPayload {
  task_id: string;
  planned_minutes: number;
  elapsed_seconds: number;
  distraction_count: number;
  interruption_notes?: string;
  reflection?: string;
  is_running: boolean;
  last_started_at?: string | null;
}

export type TaskFrictionReason =
  | 'unclear'
  | 'too_big'
  | 'low_energy'
  | 'overloaded'
  | 'blocked'
  | 'avoidance'
  | 'interrupted'
  | 'priority_shift';

export type TaskFrictionAction = 'deferred' | 'blocked' | 'stalled' | 'logged';

export interface TaskFrictionLog {
  id: string;
  task_id: string;
  task_title: string;
  domain_id: DomainId;
  reason: TaskFrictionReason;
  details: string | null;
  action_type: TaskFrictionAction;
  created_at: string;
}

export interface CreateTaskFrictionLogPayload {
  task_id: string;
  reason: TaskFrictionReason;
  details?: string;
  action_type: TaskFrictionAction;
}

export interface CompleteFocusSessionPayload {
  task_id: string;
  planned_minutes: number;
  actual_minutes: number;
  distraction_count: number;
  interruption_notes?: string;
  reflection?: string;
  started_at: string;
  ended_at: string;
}

export interface DailyXp {
  date: string;
  domain_id: DomainId;
  xp: number;
}

export interface TaskStats {
  total: number;
  completed: number;
  by_domain: { domain_id: DomainId; total: number; completed: number }[];
}

export type MomentumState = 'peak' | 'normal' | 'amber' | 'red_alert';

export const DOMAIN_META = {
  military: { label: 'Military', icon: '[M]', color: '#C8A96E', accent: '#8B0000' },
  builder:  { label: 'Builder',  icon: '[B]', color: '#4A9EFF', accent: '#00D4AA' },
  self:     { label: 'Self',     icon: '[+]', color: '#7EC87A', accent: '#A78BFA' },
};

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

// Notes
export interface Note {
  id: string;
  domain_id: DomainId | null;
  goal_id: string | null;
  title: string;
  content: string;
  tags: string; // JSON array string
  pinned: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface SyncPayload {
  exported_at: string;
  app_version: string;
  domains: Domain[];
  tasks: Task[];
  habits: Habit[];
  habit_logs: HabitLog[];
  goals: Goal[];
  notes: Note[];
  inbox_items: InboxItem[];
}
export interface CreateNotePayload {
  domain_id?: DomainId | null | '';
  goal_id?: string | null;
  title: string;
  content?: string;
  tags?: string;
  pinned?: boolean;
}
export interface UpdateNotePayload {
  id: string;
  domain_id?: DomainId | null | '';
  goal_id?: string | null | '';
  title?: string;
  content?: string;
  tags?: string;
  pinned?: boolean;
}

// Calendar
export interface CalendarTaskSummary {
  id: string;
  title: string;
  priority: Priority;
  status: TaskStatus;
  domain_id: DomainId;
}
export interface CalendarHabitSummary {
  habit_id: string;
  title: string;
  domain_id: DomainId;
}
export interface CalendarDay {
  date: string;
  tasks: CalendarTaskSummary[];
  habits_logged: CalendarHabitSummary[];
  xp_earned: number;
}
