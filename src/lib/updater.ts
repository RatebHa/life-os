import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export type { Update };

export async function checkForUpdate(): Promise<Update | null> {
  return check();
}

export async function downloadUpdate(update: Update): Promise<void> {
  await update.download();
}

export async function installAndRelaunch(update: Update): Promise<void> {
  await update.install();
  await relaunch();
}
