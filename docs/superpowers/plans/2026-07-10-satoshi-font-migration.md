# Satoshi Font Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Inter with Satoshi as the UI font on both the desktop (`Life OS/`) and mobile (`life-os-mobile/`) apps.

**Architecture:** Desktop swaps a single variable-font `@font-face` declaration and a one-line CSS custom property; every other desktop file already consumes the font via `var(--font-sans)`, so no other CSS/component file needs a change. Mobile swaps 3 static weight files, updates `pubspec.yaml`'s font registration, and does a mechanical find/replace of `fontFamily: 'Inter'` → `fontFamily: 'Satoshi'` across the one file that hardcodes it 25 times.

**Tech Stack:** CSS `@font-face` (desktop), Flutter font asset registration (mobile).

---

## Before you start — font files are already in place

The four Satoshi TTF files this plan needs have already been downloaded (from Fontshare's official package, with explicit user permission) and copied into both repos:

- `Life OS/src/assets/fonts/Satoshi-Variable.ttf` (127,420 bytes)
- `life-os-mobile/assets/fonts/Satoshi-Regular.ttf` (73,624 bytes)
- `life-os-mobile/assets/fonts/Satoshi-Medium.ttf` (73,888 bytes)
- `life-os-mobile/assets/fonts/Satoshi-Bold.ttf` (73,476 bytes)

The old `Inter-*.ttf` files are still present alongside them — deleting those is part of Task 1 (desktop) and Task 3 (mobile) below, not something already done. Do not re-download anything; the files described above already exist at those exact paths.

All file paths below are relative to the repo named in each task's **Files** section.

---

### Task 1: Desktop — swap the font-face declaration and token

**Files:**
- Modify: `Life OS/src/styles/globals.css:5-13`
- Modify: `Life OS/src/styles/tokens.css:30`
- Delete: `Life OS/src/assets/fonts/Inter-Variable.ttf`

- [ ] **Step 1: Delete the old Inter font file**

```bash
rm "Life OS/src/assets/fonts/Inter-Variable.ttf"
```

- [ ] **Step 2: Update the `@font-face` declaration**

Find (in `Life OS/src/styles/globals.css`):
```css
/* ── LOCAL FONTS ───────────────────────────────────────────────────────────── */
@font-face {
  font-family: 'Inter';
  src: url('../assets/fonts/Inter-Variable.ttf') format('truetype-variations'),
       url('../assets/fonts/Inter-Variable.ttf') format('truetype');
  font-weight: 100 900;
  font-style: normal;
  font-display: block;
}
```
Replace with:
```css
/* ── LOCAL FONTS ───────────────────────────────────────────────────────────── */
@font-face {
  font-family: 'Satoshi';
  src: url('../assets/fonts/Satoshi-Variable.ttf') format('truetype-variations'),
       url('../assets/fonts/Satoshi-Variable.ttf') format('truetype');
  font-weight: 300 900;
  font-style: normal;
  font-display: block;
}
```

Note the `font-weight` range changed from `100 900` to `300 900` — this isn't a copy-paste artifact, it's intentional: Satoshi's variable font only supports weights 300 and up (Inter went as low as 100), so the range must match Satoshi's actual supported axis, not be copied verbatim from the old rule.

- [ ] **Step 3: Update the `--font-sans` token**

Find (in `Life OS/src/styles/tokens.css`):
```css
  --font-sans:   'Inter', system-ui, -apple-system, sans-serif;
```
Replace with:
```css
  --font-sans:   'Satoshi', system-ui, -apple-system, sans-serif;
```

- [ ] **Step 4: Confirm no other file hardcodes 'Inter'**

```bash
cd "Life OS" && grep -rn "'Inter'" src
```
Expected: no output. (Everything else in this codebase consumes the font via `var(--font-sans)`, not a hardcoded font-family string — this was verified during the design phase via a full-codebase grep that found only `globals.css` and `tokens.css` as real hits, with a handful of unrelated `setInterval`/`clearInterval`/`interruption` substring false-positives elsewhere. This step re-confirms that's still true after your edits, not a new investigation.)

- [ ] **Step 5: Verify the build**

```bash
cd "Life OS" && npm run build
```
Expected: `tsc` and `vite build` both complete with no errors (same as any other clean build in this repo — this change touches no TypeScript).

- [ ] **Step 6: Commit**

```bash
cd "Life OS"
git add src/styles/globals.css src/styles/tokens.css src/assets/fonts/
git commit -m "polish: replace Inter with Satoshi as the desktop UI font"
```
(`git add src/assets/fonts/` on the directory stages both changes inside it at once: the deletion of `Inter-Variable.ttf` and the new, currently-untracked `Satoshi-Variable.ttf`.)

---

### Task 2: Desktop — final verification

**Files:** none (verification only)

- [ ] **Step 1: Confirm the font file swap is complete**

```bash
cd "Life OS" && ls src/assets/fonts/
```
Expected: `Satoshi-Variable.ttf` present, `Inter-Variable.ttf` absent.

- [ ] **Step 2: Visual smoke test**

```bash
cd "Life OS" && npm run tauri dev
```
(or `npm run dev` for the Vite-only dev server, whichever is faster to check visually). Confirm:
- Text renders in Satoshi, not a fallback font — Satoshi's lowercase `a` has a distinctive single-story shape and its `g` is single-story too, both visibly different from Inter's more conventional double-story `a`/`g`. If everything looks like a generic system sans-serif, the font failed to load.
- No flash-of-fallback-font on initial load.
- No missing-glyph "tofu" boxes anywhere in the UI you check (Today, Tasks, Habits, Settings pages are enough for a spot check — this codebase's `--font-sans` token cascades everywhere, so there's no per-page risk of missed spots).
- Text at weight 600 (e.g. active nav item labels, section headers) doesn't look obviously too-thin or too-heavy compared to surrounding text — this checks that the variable font's weight axis is being read correctly by the browser engine.

- [ ] **Step 3: Commit anything found broken** (skip if nothing needed fixing)

```bash
cd "Life OS"
git add -A
git commit -m "polish: fix issues found during Satoshi font verification"
```

---

### Task 3: Mobile — swap font asset files and update `pubspec.yaml`

**Files:**
- Modify: `life-os-mobile/pubspec.yaml:59-67`
- Delete: `life-os-mobile/assets/fonts/Inter-Regular.ttf`, `Inter-Medium.ttf`, `Inter-SemiBold.ttf`, `Inter-Bold.ttf`

- [ ] **Step 1: Delete the old Inter font files**

```bash
cd life-os-mobile
rm assets/fonts/Inter-Regular.ttf assets/fonts/Inter-Medium.ttf assets/fonts/Inter-SemiBold.ttf assets/fonts/Inter-Bold.ttf
```

- [ ] **Step 2: Update the font registration**

Find (in `life-os-mobile/pubspec.yaml`):
```yaml
  fonts:
    - family: Inter
      fonts:
        - asset: assets/fonts/Inter-Regular.ttf
          weight: 400
        - asset: assets/fonts/Inter-Medium.ttf
          weight: 500
        - asset: assets/fonts/Inter-SemiBold.ttf
          weight: 600
        - asset: assets/fonts/Inter-Bold.ttf
          weight: 700
```
Replace with:
```yaml
  fonts:
    - family: Satoshi
      fonts:
        - asset: assets/fonts/Satoshi-Regular.ttf
          weight: 400
        - asset: assets/fonts/Satoshi-Medium.ttf
          weight: 500
        - asset: assets/fonts/Satoshi-Bold.ttf
          weight: 700
```

Note there are only 3 weight entries here, not 4 — Satoshi has no static SemiBold(600) file (confirmed during the design phase: Fontshare ships Satoshi in Light/Regular/Medium/Bold/Black, no SemiBold). Task 5 below handles how the 8 places in this codebase that request `FontWeight.w600` are verified/fixed against this narrower set — don't try to solve that here, this task is just the file/registration swap.

- [ ] **Step 3: Fetch packages and verify**

```bash
flutter pub get
flutter analyze
```
Expected: `flutter pub get` completes with no errors (confirms `pubspec.yaml` is valid YAML and the referenced asset paths exist), `flutter analyze` reports no issues (this change doesn't touch any `.dart` file yet, so this is really just confirming nothing broke).

- [ ] **Step 4: Commit**

```bash
git add pubspec.yaml assets/fonts/
git commit -m "polish: register Satoshi font family, remove Inter assets"
```
(`git add assets/fonts/` on the directory stages both the deletion of the 4 `Inter-*.ttf` files and the 3 new, currently-untracked `Satoshi-*.ttf` files in one command.)

---

### Task 4: Mobile — rename `fontFamily: 'Inter'` to `fontFamily: 'Satoshi'`

**Files:**
- Modify: `life-os-mobile/lib/design_system/life_os_theme.dart` (25 occurrences)

Every occurrence of the literal string `fontFamily: 'Inter'` in this file becomes `fontFamily: 'Satoshi'`. This was confirmed during the design phase to be the *only* real font-family reference in the entire mobile `lib/` tree — a full-codebase grep for "Inter" found matches in 4 other files, and every one of them was a false positive (`recurrenceInterval`, `cadenceIntervalDays`, `interval`, `'Interpretation'` — substring matches, not font references). Do not touch any other file.

- [ ] **Step 1: Run the mechanical replace**

```bash
cd life-os-mobile
sed -i "s/fontFamily: 'Inter'/fontFamily: 'Satoshi'/g" lib/design_system/life_os_theme.dart
```

- [ ] **Step 2: Verify the count**

```bash
grep -c "fontFamily: 'Satoshi'" lib/design_system/life_os_theme.dart
grep -c "fontFamily: 'Inter'" lib/design_system/life_os_theme.dart
```
Expected: first command prints `25`, second command prints `0` (or errors with no match, depending on your grep — either way, zero remaining `'Inter'` references).

- [ ] **Step 3: Verify**

```bash
flutter analyze lib/design_system/life_os_theme.dart
```
Expected: no issues.

- [ ] **Step 4: Commit**

```bash
git add lib/design_system/life_os_theme.dart
git commit -m "polish: rename fontFamily references from Inter to Satoshi"
```

---

### Task 5: Mobile — verify and fix weight-600 (SemiBold) rendering

**Files:**
- Modify (conditionally — only if Step 2 below finds a problem): `life-os-mobile/pubspec.yaml`

**Files (context, read-only for this task):**
- `life-os-mobile/lib/design_system/life_os_theme.dart` (8 call sites using `FontWeight.w600`, unchanged by this task)

Since only weights 400/500/700 are registered under the `Satoshi` family (Task 3), Flutter needs to pick one of those to render text that requests `FontWeight.w600`. This step confirms which one it actually picks, since that isn't something to assume — Flutter's nearest-weight matching behavior should favor 700 (Bold) here given the registered set is `{400, 500, 700}`, but this needs eyes-on confirmation, not just a code read.

- [ ] **Step 1: Find a weight-600 UI element to check**

```bash
grep -n "FontWeight.w600" lib/design_system/life_os_theme.dart
```
This lists the 8 places `w600` is used (e.g. nav item labels, section headers). Pick one that's easy to find on screen — the `labelLarge`/`titleMedium`-style text styles used in the sidebar nav or a page section header are good candidates.

- [ ] **Step 2: Run the app and visually compare**

```bash
flutter run -d windows
```
(or `-d chrome` / an attached device — whatever's available). Navigate to a screen with weight-600 text (e.g. the desktop-shell sidebar, where the active nav item's label is `labelLarge` — check `_DesktopNavRow` in `lib/design_system/widgets/desktop_shell.dart` if you need to find a concrete on-screen example) and compare it against nearby weight-500 (Medium) and weight-700 (Bold) text elsewhere on the same screen.

**If the weight-600 text visually matches Bold (700):** good, Flutter's default matching already does the right thing — no code change needed, skip to Step 4.

**If the weight-600 text visually matches Medium (500), or looks like a synthetic/faux-bold (fuzzy-edged, not a clean glyph) rather than either registered weight:** proceed to Step 3 to force the match explicitly.

- [ ] **Step 3 (only if needed): Force weight 600 to resolve to the Bold file**

Find (in `life-os-mobile/pubspec.yaml`):
```yaml
  fonts:
    - family: Satoshi
      fonts:
        - asset: assets/fonts/Satoshi-Regular.ttf
          weight: 400
        - asset: assets/fonts/Satoshi-Medium.ttf
          weight: 500
        - asset: assets/fonts/Satoshi-Bold.ttf
          weight: 700
```
Replace with:
```yaml
  fonts:
    - family: Satoshi
      fonts:
        - asset: assets/fonts/Satoshi-Regular.ttf
          weight: 400
        - asset: assets/fonts/Satoshi-Medium.ttf
          weight: 500
        - asset: assets/fonts/Satoshi-Bold.ttf
          weight: 600
        - asset: assets/fonts/Satoshi-Bold.ttf
          weight: 700
```
This registers the same Bold file under two nominal weights (600 and 700) — a standard Flutter technique for forcing an unavailable weight to resolve to a specific existing file rather than relying on Flutter's own nearest-match heuristic. Then re-run:
```bash
flutter pub get
flutter run -d windows
```
and re-check the same on-screen element from Step 2 to confirm it now renders using the Bold file.

- [ ] **Step 4: Verify**

```bash
flutter analyze
```
Expected: no issues.

- [ ] **Step 5: Commit** (skip if Step 3 wasn't needed and nothing changed)

```bash
git add pubspec.yaml
git commit -m "polish: force weight 600 to resolve to Satoshi Bold"
```

---

### Task 6: Mobile — final verification

**Files:** none (verification only)

- [ ] **Step 1: Static analysis**

```bash
cd life-os-mobile
flutter analyze
```
Expected: no errors.

- [ ] **Step 2: Run the test suite**

```bash
flutter test
```
Expected: all existing tests pass (this app has one smoke test, `test/widget_test.dart` — unaffected by a font change, but confirm it still passes).

- [ ] **Step 3: Confirm no leftover Inter references**

```bash
grep -rn "Inter" lib pubspec.yaml
```
Expected: no output, or only unrelated substring matches you recognize from the design phase (`Interval`, `Interpretation`, etc.) — if you see anything that looks like an actual font reference, stop and investigate before considering this task done.

- [ ] **Step 4: Confirm the old font files are gone**

```bash
ls assets/fonts/
```
Expected: `Satoshi-Regular.ttf`, `Satoshi-Medium.ttf`, `Satoshi-Bold.ttf` present; no `Inter-*.ttf` files remain.

- [ ] **Step 5: Visual smoke test**

```bash
flutter run -d windows
```
(or `-d chrome` / an attached device/emulator). Click through Today, Tasks, Habits, Goals, and a couple of the More-tab screens. Confirm: Satoshi renders throughout (distinctive single-story `a`/`g`, not a generic system sans fallback), no missing-glyph boxes, and the weight-600 spots checked in Task 5 still look right after all the other changes in this plan landed.

- [ ] **Step 6: Commit the verification pass** (skip if nothing needed fixing)

```bash
git add -A
git commit -m "polish: fix stragglers found during Satoshi font verification"
```
