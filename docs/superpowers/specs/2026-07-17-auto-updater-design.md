# Auto-Updater — Design Spec

**Goal:** Let the user's own machines automatically discover, download, and install new builds of Life OS, without manually rebuilding and reinstalling on each one — using signed GitHub Releases as the update source and a tag-triggered GitHub Actions workflow to publish them.

## Problem

Life OS currently has no distribution or update mechanism at all: it's a fully local git repository (no remote, no CI), built and installed manually via `npm run tauri build`. The user wants to install it on more than one of their own machines and have those installations pick up new builds automatically, rather than manually rebuilding and reinstalling on each one every time a change ships.

## Scope

**In scope:**
- A signing keypair for Tauri's updater (generated once, public key committed, private key handed to the user for storage as a GitHub secret).
- A `tauri-apps/tauri-action`-based GitHub Actions workflow, triggered on pushing a `v*` tag, that builds the Windows installers, signs them, and publishes a GitHub Release with the update manifest (`latest.json`) that Tauri's updater plugin expects.
- Tauri-side wiring: `tauri-plugin-updater` + `tauri-plugin-process` added to the Rust crate and the frontend, capability permissions declared, `tauri.conf.json`'s `plugins.updater` section pointing at the (user-provided) GitHub repo's release manifest URL.
- In-app UX: a silent background check on app startup, a non-intrusive indicator when an update is found (footer bar, not a popup), a user-triggered download-and-relaunch flow, and a manual "Check for Updates" section in Settings showing the current version.

**Explicitly out of scope:**
- Creating the GitHub repository or performing the initial push. The user creates the repo and hands over the URL; any push this work later requires (e.g. to trigger a release) gets explicit confirmation at that specific moment, not blanket pre-approval from this spec.
- Setting the `TAURI_SIGNING_PRIVATE_KEY`/`TAURI_SIGNING_PRIVATE_KEY_PASSWORD` GitHub repo secrets — that requires the user's own GitHub web UI or CLI session; this work generates the keypair and documents what to paste where, but doesn't set the secrets itself.
- macOS/Linux update support. `tauri.conf.json`'s `bundle.targets` is currently `["nsis", "msi"]` (Windows-only) — the updater config and release workflow target Windows only, matching the app's current actual distribution.
- Mobile (Flutter) auto-updates. The mobile app is a separate project with its own distribution story (not addressed by this sub-project); this spec is desktop-only.
- Auto-installing updates without user action. Per the in-app UX design, the app never restarts itself or overwrites a running install without the user clicking to do so.

## Design

### Signing keypair

Run `npx tauri signer generate -w ~/.tauri/life-os-updater.key` once, locally. This produces a private key file (password-protected, the password chosen interactively) and prints a public key string. The public key string is pasted into `tauri.conf.json`'s new `plugins.updater.pubkey` field (safe to commit — it can only *verify* signatures, not create them). The private key file's contents and the chosen password are handed to the user in chat to paste into two new GitHub Actions repo secrets: `TAURI_SIGNING_PRIVATE_KEY` (the file contents) and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. The local `.key` file itself is never committed (added to `.gitignore` if not already covered).

### `tauri.conf.json` changes

A new `plugins.updater` block:

```json
{
  "plugins": {
    "updater": {
      "pubkey": "<the generated public key>",
      "endpoints": [
        "https://github.com/<owner>/<repo>/releases/latest/download/latest.json"
      ]
    }
  }
}
```

`<owner>/<repo>` gets filled in once the user provides the actual GitHub repo URL — this is a placeholder in the design spec only, not left unresolved in the implementation plan (the plan will ask for or wait on the real value before writing this file).

### Rust/Cargo changes

- `src-tauri/Cargo.toml`: add `tauri-plugin-updater = "2"` and `tauri-plugin-process = "2"` to `[dependencies]`.
- `src-tauri/src/lib.rs`: register both plugins via `.plugin(tauri_plugin_updater::Builder::new().build())` and `.plugin(tauri_plugin_process::init())` in the `tauri::Builder` chain, alongside the existing `tauri_plugin_opener::init()` call.
- `src-tauri/capabilities/default.json`: add `"updater:default"` and `"process:allow-restart"` to the existing `permissions` array (which currently has `core:default`, `opener:default`, and the window-control permissions).

### Frontend changes

- `package.json`: add `@tauri-apps/plugin-updater` and `@tauri-apps/plugin-process` (matching the installed `@tauri-apps/api` v2 line).
- A new `src/lib/updater.ts` module wrapping the plugin's `check()`/`Update.downloadAndInstall()` and the process plugin's `relaunch()`, so call sites don't touch the raw plugin APIs directly (matching this codebase's existing pattern of typed wrappers in `lib/db.ts` rather than raw `invoke()` calls elsewhere).
- `App.tsx`'s startup effect gets one more fire-and-forget call: check for an update in the background after the existing boot sequence completes, storing the result (none / available with version info / error) in a small piece of state.
- A new, small footer-bar indicator (in `components/layout/FooterBar.tsx`) that only renders when an update is available — clicking it triggers download, then shows a "Restart to Update" state that calls `relaunch()` when clicked. No indicator, no behavior change, when there's nothing new (the common case).
- `Settings.tsx` gets a new "Updates" section: shows the current app version (already available via `tauri.conf.json`'s `version`, exposed through the existing `@tauri-apps/api` app info call), a "Check for Updates" button that runs the same check on demand, and reflects the same available/downloading/ready-to-restart states as the footer indicator.

### GitHub Actions release workflow

`.github/workflows/release.yml`, triggered on `push: tags: ['v*']`:
1. Checks out the repo, sets up Node.js and the Rust toolchain (mirroring what `npm run tauri build` needs locally).
2. Runs `tauri-apps/tauri-action@v0` with `tagName: ${{ github.ref_name }}`, `releaseName: 'Life OS ${{ github.ref_name }}'`, and the two signing secrets passed as env vars (`TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`).
3. `tauri-action` handles the rest: building the NSIS/MSI installers, signing them, creating a (draft, so the user can review before publishing) GitHub Release with those installers attached plus the auto-generated `latest.json` manifest in the exact shape the updater plugin's `endpoints` URL expects.

Cutting a release becomes: bump `"version"` in `tauri.conf.json`, commit, `git tag v0.7.0`, `git push origin main --tags` (this push, like the initial one, gets explicit confirmation at the time — not blanket-approved here), then publish the resulting draft release on GitHub once CI finishes.

## Testing

No new Vitest/`cargo test` coverage — this sub-project is glue between existing infrastructure (Tauri's updater plugin, GitHub's release/Actions infrastructure) rather than new business logic. Verification is:
1. `cargo build`/`npm run build` after the plugin wiring, confirming the crate and frontend still compile with the new dependencies.
2. A manual, local dry run: publish a *test* tag once the repo exists, confirm the Actions workflow succeeds and produces a real GitHub Release with a working `latest.json`.
3. A manual update-flow test: with an older version installed locally and a newer one published, confirm the app detects it, downloads it, and relaunches into the new version successfully.

## Out of scope (recap)

- GitHub repo creation and any push (confirmed individually, not pre-approved here).
- Setting GitHub Actions secrets (user's manual step).
- macOS/Linux and mobile update support.
- Silent/forced auto-install without a user click.
