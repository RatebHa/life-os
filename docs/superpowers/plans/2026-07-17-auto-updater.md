# Auto-Updater Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire Tauri's official updater plugin into Life OS so the app silently checks `RatebHa/life-os`'s GitHub Releases on startup, and let a tag-triggered GitHub Actions workflow build, sign, and publish new releases automatically.

**Architecture:** `tauri-plugin-updater` (Rust) + `@tauri-apps/plugin-updater` (JS) do the actual check/download/install work; a new `src/lib/updater.ts` typed wrapper and `src/store/useUpdaterStore.ts` Zustand store (matching this codebase's existing store-per-concern pattern) expose that as simple state two UI surfaces read from: a small FooterBar indicator (silent by default, appears only when there's something to show) and a manual "Check for Updates" section in Settings. A GitHub Actions workflow using `tauri-apps/tauri-action` builds and publishes signed releases whenever a `v*` tag is pushed.

**Tech Stack:** Tauri v2 plugin system (`tauri-plugin-updater`, `tauri-plugin-process`), Zustand, GitHub Actions, GitHub Releases.

**Prerequisites already done (not part of this plan's tasks):** the GitHub repo `RatebHa/life-os` (public) exists and `origin` is already configured locally; a signing keypair has been generated, its public key is `dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IEE0NkEwNkVEMkZEQjgwMkUKUldRdWdOc3Y3UVpxcElFeDdnTlZnVDlBSk5Sa0RMQlBmbFJjaytsRGxySHhUNkV1MjhMZitrOWoK`, and the private key + (empty) password are already set as the `TAURI_SIGNING_PRIVATE_KEY` / `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` secrets on that repo.

---

### Task 1: Rust plugin dependencies + registration + capabilities

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/capabilities/default.json`

- [ ] **Step 1: Add the two plugin crates**

Find the `[dependencies]` section in `src-tauri/Cargo.toml` (currently):

```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-opener = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
rusqlite = { version = "0.31", features = ["bundled"] }
uuid = { version = "1", features = ["v4"] }
chrono = { version = "0.4", features = ["serde"] }
keyring = "4"
```

Add two lines so it reads:

```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-opener = "2"
tauri-plugin-updater = "2"
tauri-plugin-process = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
rusqlite = { version = "0.31", features = ["bundled"] }
uuid = { version = "1", features = ["v4"] }
chrono = { version = "0.4", features = ["serde"] }
keyring = "4"
```

- [ ] **Step 2: Register both plugins**

Find this in `src-tauri/src/lib.rs`:

```rust
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
```

Replace with:

```rust
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
```

- [ ] **Step 3: Add the updater/process capability permissions**

Find `src-tauri/capabilities/default.json` (currently):

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "opener:default",
    "core:window:allow-close",
    "core:window:allow-minimize",
    "core:window:allow-maximize",
    "core:window:allow-unmaximize",
    "core:window:allow-is-maximized",
    "core:window:allow-start-dragging"
  ]
}
```

Add `"updater:default"` and `"process:allow-restart"` to the `permissions` array:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "opener:default",
    "core:window:allow-close",
    "core:window:allow-minimize",
    "core:window:allow-maximize",
    "core:window:allow-unmaximize",
    "core:window:allow-is-maximized",
    "core:window:allow-start-dragging",
    "updater:default",
    "process:allow-restart"
  ]
}
```

- [ ] **Step 4: Build the Rust crate**

Run: `cd "C:\Users\isc\Desktop\Projects\Life OS\src-tauri" && cargo build`
Expected: clean build (this will take longer than usual the first time, since it's compiling the two new plugin crates and their dependencies). Only the 2 pre-existing unrelated dead-code warnings (`fetch_habit_logs_map`, `get_secret`) should appear.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/src/lib.rs src-tauri/capabilities/default.json
git commit -m "feat: add tauri-plugin-updater and tauri-plugin-process"
```

---

### Task 2: `tauri.conf.json` updater configuration

**Files:**
- Modify: `src-tauri/tauri.conf.json`

- [ ] **Step 1: Add the `plugins.updater` block**

Find `src-tauri/tauri.conf.json` (currently ends with the `bundle` block, no top-level `plugins` key):

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Life OS",
  "version": "0.6.0",
  "identifier": "com.lifeos.app",
  "build": {
    "beforeDevCommand": "npm run dev",
    "devUrl": "http://localhost:1420",
    "beforeBuildCommand": "npm run build",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "title": "Life OS",
        "width": 1280,
        "height": 800,
        "minWidth": 1024,
        "minHeight": 700,
        "decorations": false,
        "resizable": true,
        "transparent": false
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": ["nsis", "msi"],
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "windows": {
      "nsis": {
        "installMode": "currentUser"
      }
    }
  }
}
```

Add a `plugins` key (as a new top-level sibling of `bundle`):

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Life OS",
  "version": "0.6.0",
  "identifier": "com.lifeos.app",
  "build": {
    "beforeDevCommand": "npm run dev",
    "devUrl": "http://localhost:1420",
    "beforeBuildCommand": "npm run build",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "title": "Life OS",
        "width": 1280,
        "height": 800,
        "minWidth": 1024,
        "minHeight": 700,
        "decorations": false,
        "resizable": true,
        "transparent": false
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": ["nsis", "msi"],
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "windows": {
      "nsis": {
        "installMode": "currentUser"
      }
    }
  },
  "plugins": {
    "updater": {
      "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IEE0NkEwNkVEMkZEQjgwMkUKUldRdWdOc3Y3UVpxcElFeDdnTlZnVDlBSk5Sa0RMQlBmbFJjaytsRGxySHhUNkV1MjhMZitrOWoK",
      "endpoints": [
        "https://github.com/RatebHa/life-os/releases/latest/download/latest.json"
      ]
    }
  }
}
```

- [ ] **Step 2: Validate the config parses**

Run: `cd "C:\Users\isc\Desktop\Projects\Life OS\src-tauri" && cargo build`
Expected: clean build (Tauri validates `tauri.conf.json` against its schema at build time — a malformed `plugins.updater` block would fail here).

- [ ] **Step 3: Commit**

```bash
git add src-tauri/tauri.conf.json
git commit -m "feat: configure the updater plugin's signing key and release endpoint"
```

---

### Task 3: Frontend dependencies + typed wrapper + Zustand store

**Files:**
- Modify: `package.json`
- Create: `src/lib/updater.ts`
- Create: `src/store/useUpdaterStore.ts`

- [ ] **Step 1: Install the two plugin packages**

Run: `cd "C:\Users\isc\Desktop\Projects\Life OS" && npm install @tauri-apps/plugin-updater @tauri-apps/plugin-process`
Expected: `package.json`'s `dependencies` gains `"@tauri-apps/plugin-updater"` and `"@tauri-apps/plugin-process"` (both `^2.x`, matching the existing `@tauri-apps/plugin-opener` version line), and `package-lock.json` updates.

- [ ] **Step 2: Write the typed wrapper module**

Create `src/lib/updater.ts`:

```typescript
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
```

This mirrors this codebase's existing pattern (`src/lib/db.ts`) of never calling a platform API's raw functions directly from components/stores — everything goes through a small typed module first.

- [ ] **Step 3: Write the Zustand store**

Create `src/store/useUpdaterStore.ts`:

```typescript
import { create } from 'zustand';
import type { Update } from '../lib/updater';
import { checkForUpdate, downloadUpdate, installAndRelaunch } from '../lib/updater';

export type UpdaterStatus = 'idle' | 'checking' | 'up_to_date' | 'available' | 'downloading' | 'ready' | 'error';

interface UpdaterStore {
  status: UpdaterStatus;
  version: string | null;
  error: string | null;
  update: Update | null;

  checkNow: () => Promise<void>;
  download: () => Promise<void>;
  restart: () => Promise<void>;
}

export const useUpdaterStore = create<UpdaterStore>((set, get) => ({
  status: 'idle',
  version: null,
  error: null,
  update: null,

  checkNow: async () => {
    set({ status: 'checking', error: null });
    try {
      const update = await checkForUpdate();
      if (update) {
        set({ status: 'available', version: update.version, update });
      } else {
        set({ status: 'up_to_date', update: null });
      }
    } catch (err) {
      set({ status: 'error', error: err instanceof Error ? err.message : String(err) });
    }
  },

  download: async () => {
    const { update } = get();
    if (!update) return;
    set({ status: 'downloading', error: null });
    try {
      await downloadUpdate(update);
      set({ status: 'ready' });
    } catch (err) {
      set({ status: 'error', error: err instanceof Error ? err.message : String(err) });
    }
  },

  restart: async () => {
    const { update } = get();
    if (!update) return;
    try {
      await installAndRelaunch(update);
    } catch (err) {
      set({ status: 'error', error: err instanceof Error ? err.message : String(err) });
    }
  },
}));
```

`status` starts at `'idle'` (no check has run yet), moves to `'checking'` while `checkNow()` is in flight, then either `'up_to_date'` (nothing to do — the common case) or `'available'` (with `version`/`update` populated). `download()` moves `'available'` → `'downloading'` → `'ready'`. `restart()` calls `install()` then `relaunch()`, which replaces the running process, so there's no `'installing'` state to model — the app exits and relaunches before that would ever be observed.

- [ ] **Step 4: Typecheck**

Run: `cd "C:\Users\isc\Desktop\Projects\Life OS" && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/lib/updater.ts src/store/useUpdaterStore.ts
git commit -m "feat: add updater typed wrapper and Zustand store"
```

---

### Task 4: Background check on app startup

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Import the store**

Find the store imports in `src/App.tsx` (currently includes lines like):

```typescript
import { useDebugStore } from './store/useDebugStore';
import { useUndoStore } from './store/useUndoStore';
```

Add, immediately after:

```typescript
import { useUpdaterStore } from './store/useUpdaterStore';
```

- [ ] **Step 2: Fire a background check once on mount**

Inside the `AppInner` component (the component that also declares `const [booted, setBooted] = useState(false);`), add a new standalone effect. Find any existing simple `useEffect(() => { ... }, []);` in that component (there are several — this one should be its own, independent of the boot-sequence effect and independent of `booted`, so an update check never blocks or depends on data hydration) and add this effect alongside the others, near the top of `AppInner`'s body:

```typescript
  useEffect(() => {
    void useUpdaterStore.getState().checkNow();
  }, []);
```

This runs exactly once, doesn't depend on component state, and never throws into the render tree — `checkNow()` catches its own errors internally and stores them in `status`/`error`, so a failed check (e.g. no network) just leaves the store at `status: 'error'` silently, with nothing shown to the user unless they open Settings.

- [ ] **Step 3: Typecheck**

Run: `cd "C:\Users\isc\Desktop\Projects\Life OS" && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: check for updates once in the background on app startup"
```

---

### Task 5: FooterBar update indicator

**Files:**
- Modify: `src/components/layout/FooterBar.tsx`

- [ ] **Step 1: Rewrite the file**

Find the full current contents of `src/components/layout/FooterBar.tsx`:

```tsx
import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useTimerStore } from '../../store/useTimerStore';
import { formatDateDisplay } from '../../lib/date-format';

export const FooterBar: React.FC = () => {
  const { appState } = useAppStore();
  const activeTaskId = useTimerStore((state) => state.activeTaskId);
  const backupLabel = appState?.last_backup_at ? formatDateDisplay(appState.last_backup_at) : 'NONE';
  const backupDay = appState?.last_backup_at?.slice(0, 10) ?? null;
  const today = new Date().toISOString().slice(0, 10);
  const backupStatus = !backupDay
    ? 'BACKUP NOT RUN'
    : backupDay === today
      ? 'BACKUP READY'
      : `LAST BACKUP: ${backupLabel}`;

  return (
    <div className="footer">
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--color-success)',
              display: 'inline-block',
            }}
          />
          SYSTEM ONLINE
        </span>
      </div>
      <span>{activeTaskId ? 'FOCUS SESSION ACTIVE' : backupStatus}</span>
      <div>[ALT+1:TODAY] [ALT+7:REVIEW] [ALT+8:OVERVIEW] [CTRL+K:SEARCH]</div>
    </div>
  );
};
```

Replace with:

```tsx
import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useTimerStore } from '../../store/useTimerStore';
import { useUpdaterStore } from '../../store/useUpdaterStore';
import { formatDateDisplay } from '../../lib/date-format';

export const FooterBar: React.FC = () => {
  const { appState } = useAppStore();
  const activeTaskId = useTimerStore((state) => state.activeTaskId);
  const { status: updateStatus, version: updateVersion, download, restart } = useUpdaterStore();
  const backupLabel = appState?.last_backup_at ? formatDateDisplay(appState.last_backup_at) : 'NONE';
  const backupDay = appState?.last_backup_at?.slice(0, 10) ?? null;
  const today = new Date().toISOString().slice(0, 10);
  const backupStatus = !backupDay
    ? 'BACKUP NOT RUN'
    : backupDay === today
      ? 'BACKUP READY'
      : `LAST BACKUP: ${backupLabel}`;

  return (
    <div className="footer">
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--color-success)',
              display: 'inline-block',
            }}
          />
          SYSTEM ONLINE
        </span>
        {updateStatus === 'available' && (
          <button className="btn btn-ghost btn-sm" onClick={() => void download()}>
            UPDATE {updateVersion} AVAILABLE
          </button>
        )}
        {updateStatus === 'downloading' && <span>DOWNLOADING UPDATE...</span>}
        {updateStatus === 'ready' && (
          <button className="btn btn-primary btn-sm" onClick={() => void restart()}>
            RESTART TO UPDATE
          </button>
        )}
      </div>
      <span>{activeTaskId ? 'FOCUS SESSION ACTIVE' : backupStatus}</span>
      <div>[ALT+1:TODAY] [ALT+7:REVIEW] [ALT+8:OVERVIEW] [CTRL+K:SEARCH]</div>
    </div>
  );
};
```

Only 3 things changed: the new `useUpdaterStore` import, the new destructured values, and the 3 new conditionally-rendered elements added to the left-hand flex group (alongside the existing "SYSTEM ONLINE" indicator). Nothing else in the file changes — when `updateStatus` is `'idle'`, `'checking'`, `'up_to_date'`, or `'error'`, none of the three new blocks render, and the footer looks exactly as it did before this task.

- [ ] **Step 2: Typecheck**

Run: `cd "C:\Users\isc\Desktop\Projects\Life OS" && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/FooterBar.tsx
git commit -m "feat: show an update indicator in the footer bar when available"
```

---

### Task 6: Settings "Updates" section

**Files:**
- Modify: `src/pages/Settings.tsx`

- [ ] **Step 1: Import the store and the version helper**

Find the top-of-file imports in `src/pages/Settings.tsx` (locate the existing store imports — there will be several `import { useXStore } from '../store/useXStore';` lines) and add, alongside them:

```typescript
import { useUpdaterStore } from '../store/useUpdaterStore';
```

Also add, alongside the file's other `@tauri-apps/api` imports if any exist, or as a new import near the top if none do:

```typescript
import { getVersion } from '@tauri-apps/api/app';
```

- [ ] **Step 2: Read updater state and the current app version**

Find the top of the `SettingsPage` component function body (where other store hooks like `const { appState, ... } = useAppStore();` are called) and add:

```typescript
  const { status: updateStatus, version: updateVersion, error: updateError, checkNow, download, restart } = useUpdaterStore();
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);

  useEffect(() => {
    void getVersion().then(setCurrentVersion);
  }, []);
```

(`useState`/`useEffect` are already imported in this file's top-of-file `import React, { useEffect, useMemo, useRef, useState } from 'react';` line — no import changes needed for this step.)

- [ ] **Step 3: Add the "Updates" card**

Find this point in `src/pages/Settings.tsx` — immediately after the closing `</div>` of the "SAFETY STATUS" card and immediately before the "SYNC ACCOUNT" card opens (the boundary currently reads, abbreviated):

```tsx
          </div>
        </div>
      </div>

      <div className="card">
        <PanelHeader
          title="SYNC ACCOUNT"
```

Insert a new card between them, so it reads:

```tsx
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 'var(--space-3)' }}>
        <PanelHeader
          title="UPDATES"
          right={<span style={rowLabelStyle}>{currentVersion ? `v${currentVersion}` : '...'}</span>}
        />
        <div className="card-body" style={{ display: 'grid', gap: 'var(--space-3)' }}>
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)', color: 'var(--color-text-muted)' }}>
            {updateStatus === 'idle' && 'No check has run yet this session.'}
            {updateStatus === 'checking' && 'Checking for a newer version...'}
            {updateStatus === 'up_to_date' && 'You are running the latest version.'}
            {updateStatus === 'available' && `Version ${updateVersion} is available.`}
            {updateStatus === 'downloading' && 'Downloading the update...'}
            {updateStatus === 'ready' && 'Update downloaded. Restart to install it.'}
            {updateStatus === 'error' && `Could not check for updates: ${updateError ?? 'unknown error'}`}
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <button className="btn btn-ghost" onClick={() => void checkNow()} disabled={updateStatus === 'checking' || updateStatus === 'downloading'}>
              {updateStatus === 'checking' ? 'CHECKING...' : 'CHECK FOR UPDATES'}
            </button>
            {updateStatus === 'available' && (
              <button className="btn btn-primary" onClick={() => void download()}>
                DOWNLOAD UPDATE
              </button>
            )}
            {updateStatus === 'ready' && (
              <button className="btn btn-primary" onClick={() => void restart()}>
                RESTART TO UPDATE
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <PanelHeader
          title="SYNC ACCOUNT"
```

`rowLabelStyle` is already defined and used elsewhere in this file (visible in the existing "SAFETY STATUS" card's `right={<span style={{ ...rowLabelStyle, ... }}>...}`), so no new style constant is needed.

- [ ] **Step 4: Typecheck**

Run: `cd "C:\Users\isc\Desktop\Projects\Life OS" && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Settings.tsx
git commit -m "feat: add a manual Check for Updates section to Settings"
```

---

### Task 7: GitHub Actions release workflow

**Files:**
- Create: `.github/workflows/release.yml`

- [ ] **Step 1: Write the workflow**

Create `.github/workflows/release.yml`:

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    permissions:
      contents: write
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable

      - name: Install frontend dependencies
        run: npm ci

      - uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
        with:
          tagName: ${{ github.ref_name }}
          releaseName: 'Life OS ${{ github.ref_name }}'
          releaseBody: 'See the assets below to download and install this version.'
          releaseDraft: true
          prerelease: false
```

`GITHUB_TOKEN` is automatically provided by GitHub Actions for every workflow run — it doesn't need to be created as a repo secret, only referenced. `TAURI_SIGNING_PRIVATE_KEY`/`TAURI_SIGNING_PRIVATE_KEY_PASSWORD` are already set as repo secrets (see this plan's Prerequisites). `releaseDraft: true` means each run creates a **draft** release — visible only to the repo owner until manually published, giving a chance to review the built artifacts before they become publicly downloadable (and, critically, before the updater's `latest.json` manifest becomes live — Tauri's updater only reads the *published*, not draft, `releases/latest` endpoint).

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "ci: add tag-triggered release workflow using tauri-action"
```

(This step only commits the workflow file locally — pushing it, and any subsequent tag push to actually trigger a release, happens in Task 8's final verification, where it's called out explicitly before it happens.)

---

### Task 8: Document the release process in CLAUDE.md

**Files:**
- Modify: `CLAUDE.md` (root)

- [ ] **Step 1: Add a "Releases & Auto-Update" section**

Find the `## BUILD & PACKAGING` section in `CLAUDE.md` (root) and add a new section immediately after it (before whatever section currently follows):

```markdown
## RELEASES & AUTO-UPDATE

The app checks `https://github.com/RatebHa/life-os/releases/latest/download/latest.json` for updates automatically on startup (silent, no interruption if there's nothing new), and via a manual "Check for Updates" button in Settings. Updates are signed — see `src-tauri/tauri.conf.json`'s `plugins.updater.pubkey`.

**Cutting a release:**
1. Bump `"version"` in `src-tauri/tauri.conf.json` (and `src-tauri/Cargo.toml`'s `[package] version` and `package.json`'s `"version"`, so all three stay in sync).
2. Commit the version bump.
3. `git tag v0.7.0` (matching the new version, prefixed with `v`).
4. `git push origin main --tags`.
5. GitHub Actions (`.github/workflows/release.yml`) builds, signs, and creates a **draft** GitHub Release with the installers and update manifest attached.
6. Review the draft release on GitHub, then publish it. Only once published does the updater's endpoint see it as the latest version.

The signing keypair's private half lives only in this repo's GitHub Actions secrets (`TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`) — it is never committed. Losing it means old installs can no longer verify new signed updates; a new keypair would need generating and every install would need one final manual reinstall to pick up the new public key.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document the release-cutting process"
```

---

### Task 9: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full Rust build**

Run: `cd "C:\Users\isc\Desktop\Projects\Life OS\src-tauri" && cargo build`
Expected: clean build, only the 2 pre-existing unrelated warnings.

- [ ] **Step 2: Full frontend typecheck + build**

Run: `cd "C:\Users\isc\Desktop\Projects\Life OS" && npm run build`
Expected: `tsc && vite build` completes with no type errors. Pre-existing bundle/CSS warnings noted in prior sub-projects may still appear — expected, not a regression.

- [ ] **Step 3: Full test suite**

Run: `cd "C:\Users\isc\Desktop\Projects\Life OS" && npm test`
Expected: all existing tests pass — this plan adds no new test files (no new business logic to test; this is glue between Tauri's plugin and GitHub's infrastructure, verified by the build/manual steps instead).

- [ ] **Step 4: Push everything to `RatebHa/life-os`**

Run: `cd "C:\Users\isc\Desktop\Projects\Life OS" && git push origin main`
This pushes all 8 prior tasks' commits (Rust plugin wiring, `tauri.conf.json`, frontend store/UI, the release workflow, and the CLAUDE.md docs) to the already-connected `origin` remote. State clearly to the user what's being pushed (commit count/summary) before running this, even though the repo itself and its remote were already set up with prior authorization — this is a distinct, separate push of new content.

- [ ] **Step 5: Verify the GitHub Actions workflow is syntactically valid**

Run: `gh workflow view release.yml --repo RatebHa/life-os 2>&1` (after Step 4's push, so the workflow file exists on GitHub).
Expected: GitHub recognizes the workflow (it will show as present, even though it hasn't run yet since no tag has been pushed). If this errors, re-check `.github/workflows/release.yml`'s YAML syntax.

- [ ] **Step 6: Do NOT cut a real release as part of this task**

Per the design spec's testing section, an actual end-to-end release/update dry run (pushing a `v*` tag, watching the Actions run complete, installing an old build and confirming it detects/downloads/installs the new one) is a manual verification step for the user to run whenever they're ready to test it live — not something to trigger automatically as part of finishing this plan, since it publishes a real GitHub Release. Report the plan as complete once Steps 1-5 pass, and note this final live-test step separately as something the user can do on their own schedule (documented already in Task 8's CLAUDE.md addition).

---
