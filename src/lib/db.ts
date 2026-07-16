import { invoke } from '@tauri-apps/api/core';
import type {
  Domain, Task, CreateTaskPayload, UpdateTaskPayload,
  Habit, CreateHabitPayload, UpdateHabitPayload, HabitLog,
  Goal, CreateGoalPayload, UpdateGoalPayload,
  AppStateRow, TaskStats,
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
import { emitSyncDirty } from './sync/events';

function withSyncMutation<T>(operation: () => Promise<T>, reason?: string): Promise<T> {
  return operation().then((result) => {
    emitSyncDirty(reason);
    return result;
  });
}

// ─── Domains ─────────────────────────────────────────────────────────────────
export const db = {
  getDomains: () => invoke<Domain[]>('get_domains'),
  createDomain: (payload: CreateDomainPayload) =>
    withSyncMutation(() => invoke<Domain>('create_domain', { payload }), 'domain:create'),
  deleteDomain: (id: string) =>
    withSyncMutation(() => invoke<void>('delete_domain', { id }), 'domain:delete'),
  updateDomainProfile: (payload: UpdateDomainProfilePayload) =>
    withSyncMutation(() => invoke<Domain>('update_domain_profile', { payload }), 'domain:update'),
  updateDomainStreak: (domain_id: string) =>
    withSyncMutation(() => invoke<Domain>('update_domain_streak', { domainId: domain_id }), 'domain:streak'),

  // ─── Tasks ─────────────────────────────────────────────────────────────────
  getTasks: () => invoke<Task[]>('get_tasks'),
  getTasksByDomain: (domain_id: string) =>
    invoke<Task[]>('get_tasks_by_domain', { domainId: domain_id }),
  createTask: (payload: CreateTaskPayload) =>
    withSyncMutation(() => invoke<Task>('create_task', { payload }), 'task:create'),
  updateTask: (payload: UpdateTaskPayload) =>
    withSyncMutation(() => invoke<Task>('update_task', { payload }), 'task:update'),
  deleteTask: (id: string) => withSyncMutation(() => invoke<void>('delete_task', { id }), 'task:delete'),
  restoreTask: (task: Task) => withSyncMutation(() => invoke<Task>('restore_task', { task }), 'task:restore'),
  completeTask: async (id: string): Promise<Task> => {
    if (!id || typeof id !== 'string' || id.trim() === '') {
      throw new Error('completeTask: invalid task id');
    }
    try {
      return await withSyncMutation(() => invoke<Task>('complete_task', { id: id.trim() }), 'task:complete');
    } catch (e) {
      console.error('[db] completeTask failed — id:', id, 'error:', e);
      throw e;
    }
  },
  completeFocusSession: (payload: CompleteFocusSessionPayload) => invoke<FocusSession>('complete_focus_session', { payload }),
  undoCompleteTask: (id: string, previous_status?: string | null) =>
    withSyncMutation(() => invoke<Task>('undo_complete_task', { id, previousStatus: previous_status ?? null }), 'task:undo'),
  getFocusSessions: (days?: number) => invoke<FocusSession[]>('get_focus_sessions', { days: days ?? null }),
  getTaskFrictionLogs: (days?: number) => invoke<TaskFrictionLog[]>('get_task_friction_logs', { days: days ?? null }),
  createTaskFrictionLog: (payload: CreateTaskFrictionLogPayload) => invoke<TaskFrictionLog>('create_task_friction_log', { payload }),

  // ─── Habits ────────────────────────────────────────────────────────────────
  getHabits: () => invoke<Habit[]>('get_habits'),
  createHabit: (payload: CreateHabitPayload) =>
    withSyncMutation(() => invoke<Habit>('create_habit', { payload }), 'habit:create'),
  updateHabit: (payload: UpdateHabitPayload) =>
    withSyncMutation(() => invoke<Habit>('update_habit', { payload }), 'habit:update'),
  logHabit: async (habit_id: string, completed_date: string, value_completed?: number): Promise<HabitLog> => {
    if (!habit_id || typeof habit_id !== 'string' || habit_id.trim() === '') {
      throw new Error('logHabit: invalid habit_id');
    }
    try {
      return await withSyncMutation(
        () => invoke<HabitLog>('log_habit', { habitId: habit_id.trim(), completedDate: completed_date, valueCompleted: value_completed ?? null }),
        'habit:log',
      );
    } catch (e) {
      console.error('[db] logHabit failed — habit_id:', habit_id, 'date:', completed_date, 'error:', e);
      throw e;
    }
  },
  logHabitMinimum: async (habit_id: string, completed_date: string, value_completed?: number): Promise<HabitLog> => {
    if (!habit_id || typeof habit_id !== 'string' || habit_id.trim() === '') {
      throw new Error('logHabitMinimum: invalid habit_id');
    }
    try {
      return await withSyncMutation(
        () => invoke<HabitLog>('log_habit_minimum', { habitId: habit_id.trim(), completedDate: completed_date, valueCompleted: value_completed ?? null }),
        'habit:minimum',
      );
    } catch (e) {
      console.error('[db] logHabitMinimum failed â€” habit_id:', habit_id, 'date:', completed_date, 'error:', e);
      throw e;
    }
  },
  skipHabit: async (habit_id: string, completed_date: string, reason: string): Promise<HabitLog> => {
    if (!habit_id || typeof habit_id !== 'string' || habit_id.trim() === '') {
      throw new Error('skipHabit: invalid habit_id');
    }
    try {
      return await withSyncMutation(
        () => invoke<HabitLog>('skip_habit', { habitId: habit_id.trim(), completedDate: completed_date, reason }),
        'habit:skip',
      );
    } catch (e) {
      console.error('[db] skipHabit failed â€” habit_id:', habit_id, 'date:', completed_date, 'error:', e);
      throw e;
    }
  },
  undoHabitLog: (habit_id: string, completed_date: string) =>
    withSyncMutation(() => invoke<HabitLog>('undo_habit_log', { habitId: habit_id, completedDate: completed_date }), 'habit:undo'),
  getHabitLogs: (habit_id: string) =>
    invoke<HabitLog[]>('get_habit_logs', { habitId: habit_id }),
  getHabitLogsRange: (start_date: string, end_date: string) =>
    invoke<HabitLog[]>('get_habit_logs_range', { startDate: start_date, endDate: end_date }),
  restartHabit: (habit_id: string) => withSyncMutation(() => invoke<Habit>('restart_habit', { habitId: habit_id }), 'habit:restart'),
  deleteHabit: (id: string) => withSyncMutation(() => invoke<void>('delete_habit', { id }), 'habit:delete'),

  // ─── Goals ─────────────────────────────────────────────────────────────────
  getGoals: () => invoke<Goal[]>('get_goals'),
  getDeletedGoals: () => invoke<Goal[]>('get_deleted_goals'),
  createGoal: (payload: CreateGoalPayload) =>
    withSyncMutation(() => invoke<Goal>('create_goal', { payload }), 'goal:create'),
  updateGoal: (payload: UpdateGoalPayload) =>
    withSyncMutation(() => invoke<Goal>('update_goal', { payload }), 'goal:update'),
  deleteGoal: (id: string) => withSyncMutation(() => invoke<void>('delete_goal', { id }), 'goal:delete'),
  restoreGoal: (id: string) => withSyncMutation(() => invoke<Goal>('restore_goal', { id }), 'goal:restore'),

  // ─── App State ─────────────────────────────────────────────────────────────
  getAppState: () => invoke<AppStateRow>('get_app_state'),
  updateMomentum: (score: number) => invoke<void>('update_momentum', { score }),
  setMitTask: (task_id: string | null) => invoke<void>('set_mit_task', { taskId: task_id }),
  saveApiKey: (api_key: string) => invoke<void>('save_api_key', { apiKey: api_key }),
  updateBackupSettings: (backup_directory: string | null, auto_backup_enabled: boolean) =>
    invoke<AppStateRow>('update_backup_settings', { backupDirectory: backup_directory, autoBackupEnabled: auto_backup_enabled }),
  updateUiPreferences: (
    crt_intensity: 'low' | 'medium' | 'high',
    text_scale: 'normal' | 'large' | 'xl',
    ui_density: 'compact' | 'comfortable',
  ) => invoke<AppStateRow>('update_ui_preferences', {
    crtIntensity: crt_intensity,
    textScale: text_scale,
    uiDensity: ui_density,
  }),
  createBackup: () => invoke<string>('create_backup'),
  createNamedSnapshot: (name: string) => invoke<string>('create_named_snapshot', { name }),
  backupBeforeRiskyAction: (label: string) => invoke<string>('backup_before_risky_action', { label }),
  importData: (data: string) => invoke<void>('import_data', { data }),
  previewImportData: (data: string) => invoke<BackupPreview>('preview_import_data', { data }),
  restoreLatestBackup: () => invoke<string>('restore_latest_backup'),
  previewLatestBackup: () => invoke<BackupPreview>('preview_latest_backup'),
  listBackups: () => invoke<BackupHistoryItem[]>('list_backups'),
  getBackupHealthStatus: () => invoke<BackupHealthStatus>('get_backup_health_status'),
  updateLastOpened: () => invoke<void>('update_last_opened'),
  completeOnboarding: () => invoke<void>('complete_onboarding'),
  configureSync: (payload: SyncConfigPayload) => invoke<AppStateRow>('configure_sync', { payload }),
  saveSyncSession: (payload: SyncSessionPayload) => invoke<AppStateRow>('save_sync_session', { payload }),
  clearSyncSession: () => invoke<AppStateRow>('clear_sync_session'),
  updateSyncStatus: (payload: SyncStatusPayload) => invoke<AppStateRow>('update_sync_status', { payload }),
  getSyncCounts: () => invoke<SyncCounts>('get_sync_counts'),
  exportSyncPayload: () => invoke<SyncPayload>('export_sync_payload'),
  importSyncPayload: (payload: SyncPayload) => invoke<SyncCounts>('import_sync_payload', { payload }),
  getSyncQueue: () => invoke<SyncQueueItem[]>('get_sync_queue'),
  upsertSyncQueueItem: (item: SyncQueueItem) => invoke<SyncQueueItem>('upsert_sync_queue_item', { item }),
  deleteSyncQueueItem: (id: string) => invoke<void>('delete_sync_queue_item', { id }),
  getSyncCursors: () => invoke<SyncCursor[]>('get_sync_cursors'),
  setSyncCursor: (entity_type: string, last_pulled_at?: string | null) =>
    invoke<void>('set_sync_cursor', { entityType: entity_type, lastPulledAt: last_pulled_at ?? null }),

  // ─── Analytics ─────────────────────────────────────────────────────────────
  getTaskStats: () => invoke<TaskStats>('get_task_stats'),

  // ─── Reset ─────────────────────────────────────────────────────────────────
  resetAllData: () => invoke<void>('reset_all_data'),

  // ─── Notes ───────────────────────────────────────────────────────────────────
  getNotes: (domain_id?: string | null) => invoke<Note[]>('get_notes', { domainId: domain_id ?? null }),
  getDeletedNotes: () => invoke<Note[]>('get_deleted_notes'),
  createNote: (payload: CreateNotePayload) => withSyncMutation(() => invoke<Note>('create_note', { payload }), 'note:create'),
  updateNote: (payload: UpdateNotePayload) => withSyncMutation(() => invoke<Note>('update_note', { payload }), 'note:update'),
  deleteNote: (id: string) => withSyncMutation(() => invoke<void>('delete_note', { id }), 'note:delete'),
  restoreNote: (id: string) => withSyncMutation(() => invoke<Note>('restore_note', { id }), 'note:restore'),
  searchNotes: (query: string) => invoke<Note[]>('search_notes', { query }),
  exportData: () => invoke<string>('export_data'),

  // ─── Inbox ───────────────────────────────────────────────────────────────────
  getInboxItems: (status?: string | null) => invoke<InboxItem[]>('get_inbox_items', { status: status ?? null }),
  getDeletedInboxItems: () => invoke<InboxItem[]>('get_deleted_inbox_items'),
  createInboxItem: (payload: CreateInboxItemPayload) => withSyncMutation(() => invoke<InboxItem>('create_inbox_item', { payload }), 'inbox:create'),
  triageInboxItem: (payload: TriageInboxItemPayload) => withSyncMutation(() => invoke<InboxItem>('triage_inbox_item', { payload }), 'inbox:triage'),
  deleteInboxItem: (id: string) => withSyncMutation(() => invoke<void>('delete_inbox_item', { id }), 'inbox:delete'),
  restoreInboxItem: (id: string) => withSyncMutation(() => invoke<InboxItem>('restore_inbox_item', { id }), 'inbox:restore'),

  // ─── Templates ───────────────────────────────────────────────────────────────
  getTaskTemplates: () => invoke<TaskTemplate[]>('get_task_templates'),
  createTaskTemplate: (payload: CreateTaskTemplatePayload) => invoke<TaskTemplate>('create_task_template', { payload }),
  updateTaskTemplate: (payload: UpdateTaskTemplatePayload) => invoke<TaskTemplate>('update_task_template', { payload }),
  deleteTaskTemplate: (id: string) => invoke<void>('delete_task_template', { id }),
  getFocusTimerDrafts: () => invoke<FocusTimerDraft[]>('get_focus_timer_drafts'),
  saveFocusTimerDraft: (payload: SaveFocusTimerDraftPayload) => invoke<FocusTimerDraft>('save_focus_timer_draft', { payload }),
  clearFocusTimerDraft: (task_id: string) => invoke<void>('clear_focus_timer_draft', { taskId: task_id }),

  // ─── Calendar ────────────────────────────────────────────────────────────────
  getCalendarData: (year: number, month: number) => invoke<CalendarDay[]>('get_calendar_data', { year, month }),

  // ─── Streak Freeze ───────────────────────────────────────────────────────────
  useStreakFreeze: (domain_id: string) => withSyncMutation(() => invoke<Domain>('use_streak_freeze', { domainId: domain_id }), 'domain:streak-freeze'),

  // ─── Debug Log ─────────────────────────────────────────────────────────────
  getDebugLog: (): Promise<DebugEntry[]> =>
    invoke<Array<{ id: string; level: 'info' | 'warn' | 'error'; scope: string; message: string; detail: string | null; created_at: string }>>('get_debug_log')
      .then((rows) => rows.map((row) => ({ ...row, detail: row.detail ?? undefined }))),
  logDebugEntry: (payload: NewDebugEntryPayload) => invoke<void>('log_debug_entry', { payload }),
  clearDebugLog: () => invoke<void>('clear_debug_log'),
};
