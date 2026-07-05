export const LIFE_OS_SYNC_DIRTY_EVENT = 'life-os:sync-dirty';

export function emitSyncDirty(reason = 'mutation'): void {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent(LIFE_OS_SYNC_DIRTY_EVENT, {
      detail: {
        reason,
        at: new Date().toISOString(),
      },
    }),
  );
}
