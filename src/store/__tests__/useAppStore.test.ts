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
