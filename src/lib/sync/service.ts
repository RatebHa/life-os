import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { db } from '../db';
import type {
  AppStateRow,
  Domain,
  Goal,
  Habit,
  HabitLog,
  InboxItem,
  Note,
  SyncBootstrapState,
  SyncBootstrapStatus,
  SyncCounts,
  SyncPayload,
  Task,
} from '../types';

type SyncRow = Domain | Task | Habit | HabitLog | Goal | Note | InboxItem;
type SyncTableName = 'domains' | 'tasks' | 'habits' | 'habit_logs' | 'goals' | 'notes' | 'inbox_items';

type RemoteSyncRow<T extends SyncRow> = T & { user_id: string };

interface SyncCredentials {
  url: string;
  anonKey: string;
  accessToken: string;
  refreshToken: string;
  userId: string;
}

const SYNC_TABLES: SyncTableName[] = [
  'domains',
  'tasks',
  'habits',
  'habit_logs',
  'goals',
  'notes',
  'inbox_items',
];

function normalizeStamp(value?: string | null): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function latestRowStamp(row: { updated_at?: string | null; deleted_at?: string | null; created_at?: string | null }): number {
  return Math.max(
    normalizeStamp(row.created_at),
    normalizeStamp(row.updated_at),
    normalizeStamp(row.deleted_at),
  );
}

function habitLogKey(log: HabitLog): string {
  return `${log.habit_id}::${log.completed_date}`;
}

function entityKey<T extends SyncRow>(table: SyncTableName, row: T): string {
  if (table === 'habit_logs') {
    return habitLogKey(row as HabitLog);
  }
  return (row as Domain | Task | Habit | Goal | Note | InboxItem).id;
}

function mergeEntityRows<T extends SyncRow>(table: SyncTableName, localRows: T[], remoteRows: T[]): T[] {
  const merged = new Map<string, T>();

  for (const row of [...localRows, ...remoteRows]) {
    const key = entityKey(table, row);
    const existing = merged.get(key);
    if (!existing || latestRowStamp(row) >= latestRowStamp(existing)) {
      merged.set(key, row);
    }
  }

  return Array.from(merged.values()).sort((left, right) => latestRowStamp(right) - latestRowStamp(left));
}

function countActiveRows<T extends { deleted_at?: string | null }>(rows: T[]): number {
  return rows.filter((row) => !row.deleted_at).length;
}

function countsFromPayload(payload: SyncPayload): SyncCounts {
  const domains = countActiveRows(payload.domains);
  const tasks = countActiveRows(payload.tasks);
  const habits = countActiveRows(payload.habits);
  const habit_logs = countActiveRows(payload.habit_logs);
  const goals = countActiveRows(payload.goals);
  const notes = countActiveRows(payload.notes);
  const inbox_items = countActiveRows(payload.inbox_items);

  return {
    domains,
    tasks,
    habits,
    habit_logs,
    goals,
    notes,
    inbox_items,
    total: domains + tasks + habits + habit_logs + goals + notes + inbox_items,
  };
}

function mergePayloads(localPayload: SyncPayload, remotePayload: SyncPayload): SyncPayload {
  return {
    exported_at: new Date().toISOString(),
    app_version: localPayload.app_version,
    domains: mergeEntityRows('domains', localPayload.domains, remotePayload.domains),
    tasks: mergeEntityRows('tasks', localPayload.tasks, remotePayload.tasks),
    habits: mergeEntityRows('habits', localPayload.habits, remotePayload.habits),
    habit_logs: mergeEntityRows('habit_logs', localPayload.habit_logs, remotePayload.habit_logs),
    goals: mergeEntityRows('goals', localPayload.goals, remotePayload.goals),
    notes: mergeEntityRows('notes', localPayload.notes, remotePayload.notes),
    inbox_items: mergeEntityRows('inbox_items', localPayload.inbox_items, remotePayload.inbox_items),
  };
}

function toRemoteRows<T extends SyncRow>(rows: T[], userId: string): RemoteSyncRow<T>[] {
  return rows.map((row) => ({
    ...row,
    user_id: userId,
  }));
}

function stripUserId<T extends SyncRow>(rows: RemoteSyncRow<T>[]): T[] {
  return rows.map(({ user_id: _userId, ...row }) => row as unknown as T);
}

function buildClient(url: string, anonKey: string): SupabaseClient {
  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

async function ensureAuthedClient(appState: AppStateRow): Promise<{ client: SupabaseClient; session: Session }> {
  const url = appState.sync_supabase_url?.trim();
  const anonKey = appState.sync_supabase_anon_key?.trim();
  const accessToken = appState.sync_access_token?.trim();
  const refreshToken = appState.sync_refresh_token?.trim();

  if (!url || !anonKey) {
    throw new Error('Sync is not configured for this device yet.');
  }
  if (!accessToken || !refreshToken) {
    throw new Error('Sign in to sync before syncing this device.');
  }

  const client = buildClient(url, anonKey);
  const { data, error } = await client.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (error || !data.session) {
    throw new Error(error?.message ?? 'Unable to restore the Supabase session.');
  }

  const refreshedUser = data.session.user;
  await db.saveSyncSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    user_id: refreshedUser.id,
    user_email: refreshedUser.email ?? null,
  });

  return { client, session: data.session };
}

async function loadRemoteRows<T extends SyncRow>(
  client: SupabaseClient,
  table: SyncTableName,
  userId: string,
): Promise<T[]> {
  const { data, error } = await client
    .from(table)
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) {
    throw new Error(`Remote read failed for ${table}: ${error.message}`);
  }

  return stripUserId((data ?? []) as RemoteSyncRow<T>[]);
}

async function loadRemotePayload(appState: AppStateRow): Promise<SyncPayload> {
  const { client, session } = await ensureAuthedClient(appState);
  const userId = session.user.id;

  const [
    domains,
    tasks,
    habits,
    habit_logs,
    goals,
    notes,
    inbox_items,
  ] = await Promise.all([
    loadRemoteRows<Domain>(client, 'domains', userId),
    loadRemoteRows<Task>(client, 'tasks', userId),
    loadRemoteRows<Habit>(client, 'habits', userId),
    loadRemoteRows<HabitLog>(client, 'habit_logs', userId),
    loadRemoteRows<Goal>(client, 'goals', userId),
    loadRemoteRows<Note>(client, 'notes', userId),
    loadRemoteRows<InboxItem>(client, 'inbox_items', userId),
  ]);

  return {
    exported_at: new Date().toISOString(),
    app_version: appState.sync_provider ?? 'desktop',
    domains,
    tasks,
    habits,
    habit_logs,
    goals,
    notes,
    inbox_items,
  };
}

async function pushTable<T extends SyncRow>(
  client: SupabaseClient,
  table: SyncTableName,
  userId: string,
  rows: T[],
): Promise<void> {
  if (rows.length === 0) return;
  const remoteRows = toRemoteRows(rows, userId);
  const onConflict = table === 'habit_logs' ? 'user_id,habit_id,completed_date' : 'user_id,id';
  const { error } = await client.from(table).upsert(remoteRows, { onConflict });
  if (error) {
    throw new Error(`Remote write failed for ${table}: ${error.message}`);
  }
}

async function pushPayload(appState: AppStateRow, payload: SyncPayload): Promise<void> {
  const { client, session } = await ensureAuthedClient(appState);
  const userId = session.user.id;

  await Promise.all([
    pushTable(client, 'domains', userId, payload.domains),
    pushTable(client, 'tasks', userId, payload.tasks),
    pushTable(client, 'habits', userId, payload.habits),
    pushTable(client, 'habit_logs', userId, payload.habit_logs),
    pushTable(client, 'goals', userId, payload.goals),
    pushTable(client, 'notes', userId, payload.notes),
    pushTable(client, 'inbox_items', userId, payload.inbox_items),
  ]);
}

async function markSyncComplete(timestamp: string): Promise<void> {
  for (const entityType of SYNC_TABLES) {
    await db.setSyncCursor(entityType.slice(0, -1), timestamp);
  }
  await db.updateSyncStatus({
    last_sync_at: timestamp,
    last_sync_error: null,
    last_pushed_at: timestamp,
    last_pulled_at: timestamp,
  });
}

async function markSyncFailure(error: unknown): Promise<void> {
  await db.updateSyncStatus({
    last_sync_error: error instanceof Error ? error.message : String(error),
  });
}

export const syncService = {
  hasSession(appState: AppStateRow | null): boolean {
    return Boolean(
      appState?.sync_supabase_url
      && appState?.sync_supabase_anon_key
      && appState?.sync_access_token
      && appState?.sync_refresh_token
      && appState?.sync_user_id,
    );
  },

  async signIn(options: {
    url: string;
    anonKey: string;
    email: string;
    password: string;
  }): Promise<AppStateRow> {
    const configured = await db.configureSync({
      supabase_url: options.url,
      supabase_anon_key: options.anonKey,
    });
    const client = buildClient(configured.sync_supabase_url ?? options.url, configured.sync_supabase_anon_key ?? options.anonKey);
    const { data, error } = await client.auth.signInWithPassword({
      email: options.email.trim(),
      password: options.password,
    });
    if (error || !data.session) {
      throw new Error(error?.message ?? 'Unable to sign in to Supabase.');
    }
    return db.saveSyncSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      user_id: data.session.user.id,
      user_email: data.session.user.email ?? null,
    });
  },

  async signOut(): Promise<AppStateRow> {
    return db.clearSyncSession();
  },

  async getBootstrapStatus(appState: AppStateRow): Promise<SyncBootstrapStatus> {
    const [local_counts, remotePayload] = await Promise.all([
      db.getSyncCounts(),
      loadRemotePayload(appState),
    ]);
    const remote_counts = countsFromPayload(remotePayload);
    const state: SyncBootstrapState = remote_counts.total === 0
      ? 'remote_empty'
      : local_counts.total === 0
        ? 'local_empty'
        : 'both_have_data';

    return {
      local_counts,
      remote_counts,
      state,
    };
  },

  async uploadThisDevice(appState: AppStateRow): Promise<SyncCounts> {
    const payload = await db.exportSyncPayload();
    await pushPayload(appState, payload);
    const timestamp = new Date().toISOString();
    await markSyncComplete(timestamp);
    return countsFromPayload(payload);
  },

  async replaceLocalWithCloud(appState: AppStateRow): Promise<SyncCounts> {
    const remotePayload = await loadRemotePayload(appState);
    const counts = await db.importSyncPayload(remotePayload);
    const timestamp = new Date().toISOString();
    await markSyncComplete(timestamp);
    return counts;
  },

  async syncNow(appState: AppStateRow): Promise<SyncCounts> {
    try {
      const [localPayload, remotePayload] = await Promise.all([
        db.exportSyncPayload(),
        loadRemotePayload(appState),
      ]);
      const mergedPayload = mergePayloads(localPayload, remotePayload);
      await pushPayload(appState, mergedPayload);
      const counts = await db.importSyncPayload(mergedPayload);
      const timestamp = new Date().toISOString();
      await markSyncComplete(timestamp);
      return counts;
    } catch (error) {
      await markSyncFailure(error);
      throw error;
    }
  },
};
