# Desktop Spacing Scale — Phase 1 (Tokens + Shared Surfaces) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the new `--space-1` through `--space-8` (4/8/12/16/24/32px) spacing scale on the desktop app and apply it to every widely-reused shared CSS surface (page layout, cards, nav items, buttons, inputs), so the highest-leverage, most-visible spacing in the app is consistent before the larger per-page inline-style sweep (a separate, follow-up plan).

**Architecture:** `tokens.css` gains the new scale and its two spacing-related composite tokens (`--page-padding`, `--panel-padding`) get corrected to the nearest scale steps. The dead, unreferenced `--gap-xs/sm/md/lg` tokens are deleted outright. `App.tsx`'s `densityMap` (a user-configurable "compact"/"comfortable" density preference that overrides `--page-padding`/`--panel-padding` at runtime) is fixed in the same task, since it's the actual source of truth for those two properties at runtime — fixing only the static token default would be silently overridden by this map and have no visible effect. Then `globals.css`'s shared, widely-reused classes get their raw pixel values converted to token references, split into 4 tasks by CSS section.

**Tech Stack:** CSS custom properties, React inline `style` object (for the one density-map fix in `App.tsx`).

---

## Before you start — scope of this plan

This is Phase 1 of a larger spacing-consistency effort (see `docs/superpowers/specs/2026-07-10-spacing-scale-design.md` for the full design). This plan covers **only**: the new token scale, and the specific shared CSS classes named in the spec's Phase 1 (plus the closely-related `.layout-grid-*` family, which lives in the same "PAGE LAYOUT" CSS section and serves the same "shared reusable layout primitive" role — folding these in is a faithful extension of the spec's "etc." after its named list, not scope creep).

**Explicitly NOT in this plan** (deferred to follow-up plans, per the spec's own two-phase structure):
- The rest of `globals.css` (modal, achievement toast, undo toast, boot screen, stat card, empty state, badges, skeleton, progress bar, etc.) — none of these were named as "widely-reused shared surfaces" in the spec, and fixing all ~90 spacing declarations in this 1698-line file in one plan would be unreviewable.
- Every page `.tsx` file's inline `style={{ marginTop: ... }}` spacing (Tasks.tsx, Habits.tsx, Goals.tsx, Today.tsx, WeeklyReview.tsx, Settings.tsx, Analytics.tsx, Calendar.tsx, etc.) — this is the spec's Phase 2 ("systematic per-file sweep"), explicitly called out as a separate step.
- The mobile app (`life-os-mobile/`) — the spec calls for desktop first, mobile ported after, once the desktop pattern is proven.

All file paths below are relative to `C:\Users\isc\Desktop\Projects\Life OS` unless stated otherwise.

---

### Task 1: Add the new spacing scale to `tokens.css`, fix `--page-padding`/`--panel-padding`, and fix the density map in `App.tsx`

**Files:**
- Modify: `src/styles/tokens.css:33-37,82-83`
- Modify: `src/App.tsx:77-80`

- [ ] **Step 1: Replace the spacing token block in `tokens.css`**

Find:
```css
  /* Spacing */
  --gap-xs: 4px;
  --gap-sm: 8px;
  --gap-md: 12px;
  --gap-lg: 20px;
```
Replace with:
```css
  /* Spacing — 4/8/12/16/24/32px, numbered to match Tailwind v4's own default
     spacing scale (Tailwind's utility N = N * 4px), so --space-4 and
     Tailwind's `p-4` both mean 16px. The gap in numbering (no --space-5 or
     --space-7) is intentional, not a mistake to "fill in" later. */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
```

This deletes `--gap-xs/sm/md/lg` outright rather than keeping them as deprecated aliases — confirmed via `grep -rn "\-\-gap-" src` (whole desktop `src/` tree, not just `src/styles/`) that nothing anywhere references them; they were defined once and never consumed.

- [ ] **Step 2: Fix `--page-padding` and `--panel-padding`**

Find (in `tokens.css`):
```css
  --page-padding:  18px 22px;
  --panel-padding: 10px 12px;
```
Replace with:
```css
  --page-padding:  16px 24px;
  --panel-padding: 12px 12px;
```
(18→16 and 22→24 per the scale's rounding rule; 10→12, 12 stays 12.)

- [ ] **Step 3: Fix the density map in `App.tsx`**

Find (in `src/App.tsx`):
```tsx
  const densityMap = {
    compact: { page: '14px 16px', panel: '8px 10px', row: '28px' },
    comfortable: { page: '18px 22px', panel: '10px 12px', row: '34px' },
  } as const;
```
Replace with:
```tsx
  const densityMap = {
    compact: { page: '16px 16px', panel: '8px 12px', row: '28px' },
    comfortable: { page: '16px 24px', panel: '12px 12px', row: '34px' },
  } as const;
```

Note what changed and what didn't:
- `compact.page`: `14px 16px` → `16px 16px` (14→16, 16 stays 16 — this collapses what was already a near-symmetric 14/16 pair into an exactly-symmetric 16/16, which is the expected, correct result of snapping both values to the scale independently, not an error to second-guess).
- `compact.panel`: `8px 10px` → `8px 12px` (8 stays 8, 10→12).
- `comfortable.page`/`comfortable.panel`: match the new `--page-padding`/`--panel-padding` defaults from Step 2 exactly — `comfortable` is the default density, so its values and the static token defaults should always match.
- `row` values (`28px`, `34px`) are **unchanged** in both tiers — `--row-height` is a minimum touch-target height (a component dimension), not spacing rhythm between elements, so it's explicitly out of scope per the spec's §5 boundary. Do not touch the `row` values.

This is the one place in this plan that touches a `.tsx` file — it's included here (not deferred to the Phase 2 per-page sweep) because `densityMap` is the runtime source of truth that overrides `--page-padding`/`--panel-padding` via an inline `style` object on every render (see `buildDisplayVariables`, `App.tsx:68-93`) — fixing only the static CSS token default in Step 2 without also fixing this map would have **zero visible effect**, since this map's values always win at runtime.

- [ ] **Step 4: Verify no other file defines a competing density map**

```bash
grep -rn "densityMap\|buildDisplayVariables" src
```
Expected: exactly 4 lines, all in `src/App.tsx` (the function definition, the map definition, the map lookup, and the one call site) — confirming this is the only density-map definition in the codebase and Step 3 covered the complete source of truth.

- [ ] **Step 5: Verify the build**

```bash
npm run build
```
Expected: `tsc` and `vite build` both complete with no errors.

- [ ] **Step 6: Commit**

```bash
git add src/styles/tokens.css src/App.tsx
git commit -m "polish: establish 4/8/12/16/24/32 spacing scale, fix page/panel padding tokens"
```

---

### Task 2: Apply the scale to the Page Layout section of `globals.css`

**Files:**
- Modify: `src/styles/globals.css:221-306`

- [ ] **Step 1: Replace the whole Page Layout section**

Find:
```css
/* ── PAGE LAYOUT ───────────────────────────────────────────────────────────── */
.page-content {
  padding: var(--page-padding);
  display: flex;
  flex-direction: column;
  gap: 18px;
  animation: pageRise var(--motion-base) both;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.page-header-copy {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.page-header-actions {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  flex-wrap: wrap;
}

.layout-grid-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 10px;
}

.layout-grid-split {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(320px, 0.85fr);
  gap: 12px;
  align-items: start;
}

.layout-grid-two {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.layout-grid-three {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.layout-grid-three-tight {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.layout-grid-pairs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.layout-grid-controls {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.layout-grid-domain-form {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 8px;
  align-items: end;
}

.layout-actions-end {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}
```
Replace with:
```css
/* ── PAGE LAYOUT ───────────────────────────────────────────────────────────── */
.page-content {
  padding: var(--page-padding);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  animation: pageRise var(--motion-base) both;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.page-header-copy {
  display: grid;
  gap: var(--space-1);
  min-width: 0;
}

.page-header-actions {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.layout-grid-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: var(--space-3);
}

.layout-grid-split {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(320px, 0.85fr);
  gap: var(--space-3);
  align-items: start;
}

.layout-grid-two {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
}

.layout-grid-three {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-3);
}

.layout-grid-three-tight {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-2);
}

.layout-grid-pairs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
}

.layout-grid-controls {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
}

.layout-grid-domain-form {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: var(--space-2);
  align-items: end;
}

.layout-actions-end {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  flex-wrap: wrap;
}
```

Value changes: `.page-content` 18px→16 (`--space-4`), `.layout-grid-stats` 10px→12 (`--space-3`). Every other value in this section was already exactly on the new scale (16, 12, 8, 4) and only needed to become a token *reference* rather than a raw number — that's still an in-scope, meaningful change even without a numeric shift, since the goal is traceability to the scale, not just correct-looking numbers. Do not touch `.page-sep`'s `margin: 2px 0 0;` if you see it nearby (it's a few lines below this block, outside this Find/Replace range) — 2px is a sub-4px micro-adjustment, explicitly out of scope per the spec.

- [ ] **Step 2: Verify**

```bash
grep -n "gap: [0-9]" src/styles/globals.css | sed -n '1,20p'
```
Expected: none of the matches are within the PAGE LAYOUT section (lines ~221-306) anymore — spot-check by confirming the line numbers reported are outside that range (the remaining matches belong to sections this plan doesn't touch, like NAV ITEMS below `.nav-item`/`.habit-card`, which Task 4 handles, or sections entirely out of scope for this plan).

```bash
npm run build
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/styles/globals.css
git commit -m "polish: apply spacing scale to the Page Layout CSS section"
```

---

### Task 3: Apply the scale to the Card section of `globals.css`

**Files:**
- Modify: `src/styles/globals.css:343-370`

- [ ] **Step 1: Update `.card-header` and `.card-meta`**

Find:
```css
.card-header {
  min-height: 40px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.card-title {
  font-family: var(--font-sans);
  font-weight: 600;
  font-size: 15px;
  color: var(--color-text);
}
.card-meta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-sans);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}
```
Replace with:
```css
.card-header {
  min-height: 40px;
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}
.card-title {
  font-family: var(--font-sans);
  font-weight: 600;
  font-size: 15px;
  color: var(--color-text);
}
.card-meta {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-family: var(--font-sans);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}
```

Value changes: `.card-header` padding `10px 14px` → `12px 16px` (10→12, 14→16); gap `12px` → unchanged value, now a token reference. `.card-meta` gap `6px` → `8px`. `.card-body`'s `padding: var(--panel-padding);` (a few lines below, not shown in this Find block) needs no change here — it already references the token that Task 1 fixed. `min-height: 40px` and `font-size`/`letter-spacing` values are untouched (not spacing).

- [ ] **Step 2: Verify**

```bash
npm run build
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/styles/globals.css
git commit -m "polish: apply spacing scale to the Card CSS section"
```

---

### Task 4: Apply the scale to Nav Items, task/habit rows, and habit cards in `globals.css`

**Files:**
- Modify: `src/styles/globals.css:387-440`

- [ ] **Step 1: Update `.nav-item`, `.habit-domain-list`, and `.habit-card`**

Find:
```css
.nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 12px;
  min-height: var(--row-height);
  color: var(--color-text-muted);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 500;
  border-radius: var(--radius-md);
  transition: color var(--motion-fast), background var(--motion-fast);
  user-select: none;
  width: 100%;
  text-align: left;
  background: transparent;
  border: none;
}
.nav-item:hover { color: var(--color-text); background: var(--color-surface-hover); }
.nav-item.active {
  color: var(--color-accent);
  background: var(--color-accent-muted);
  box-shadow: inset 2px 0 0 var(--color-accent), 0 0 8px -5px var(--domain-glow, rgba(124,108,255,0.35));
  font-weight: 600;
}

.task-row,
.habit-row {
  position: relative;
  border-radius: var(--radius-md);
  transition: background-color var(--motion-fast);
}
.task-row:hover,
.habit-row:hover {
  background: var(--color-surface-hover);
}

.habit-domain-list {
  display: grid;
  gap: 12px;
}

.habit-card {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 220px;
  gap: 16px;
  padding: 14px;
  border: 1px solid var(--color-border);
  background: var(--surface-gradient);
  border-radius: var(--radius-lg);
  box-shadow: var(--elevation-1);
  transition: border-color var(--motion-base), transform var(--motion-base), background var(--motion-base), box-shadow var(--motion-base);
}
```
Replace with:
```css
.nav-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-3);
  min-height: var(--row-height);
  color: var(--color-text-muted);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 500;
  border-radius: var(--radius-md);
  transition: color var(--motion-fast), background var(--motion-fast);
  user-select: none;
  width: 100%;
  text-align: left;
  background: transparent;
  border: none;
}
.nav-item:hover { color: var(--color-text); background: var(--color-surface-hover); }
.nav-item.active {
  color: var(--color-accent);
  background: var(--color-accent-muted);
  box-shadow: inset 2px 0 0 var(--color-accent), 0 0 8px -5px var(--domain-glow, rgba(124,108,255,0.35));
  font-weight: 600;
}

.task-row,
.habit-row {
  position: relative;
  border-radius: var(--radius-md);
  transition: background-color var(--motion-fast);
}
.task-row:hover,
.habit-row:hover {
  background: var(--color-surface-hover);
}

.habit-domain-list {
  display: grid;
  gap: var(--space-3);
}

.habit-card {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 220px;
  gap: var(--space-4);
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  background: var(--surface-gradient);
  border-radius: var(--radius-lg);
  box-shadow: var(--elevation-1);
  transition: border-color var(--motion-base), transform var(--motion-base), background var(--motion-base), box-shadow var(--motion-base);
}
```

Value changes: `.nav-item` padding `5px 12px` → `4px 12px` (5→4, 12 stays); gap `8px` → unchanged value, now a token reference. `.habit-domain-list` gap `12px` → unchanged value, now a token reference. `.habit-card` gap `16px`/padding `14px` → gap unchanged value now a token reference, padding 14→16. `.task-row`/`.habit-row` have no spacing properties on the base rule (their padding is set elsewhere, per-page, in Phase 2 scope) — don't add any, this Find/Replace passes them through unchanged as context only.

- [ ] **Step 2: Verify**

```bash
npm run build
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/styles/globals.css
git commit -m "polish: apply spacing scale to nav items and habit cards"
```

---

### Task 5: Apply the scale to Buttons and Inputs in `globals.css`

**Files:**
- Modify: `src/styles/globals.css:962-994,1025-1037`

- [ ] **Step 1: Update `.btn` and `.btn-sm`**

Find:
```css
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 14px;
  font-family: var(--font-sans);
  font-weight: 600;
  font-size: calc(13px * var(--panel-scale));
  cursor: pointer;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
  background: transparent;
  outline: none;
  white-space: nowrap;
  user-select: none;
  transition: border-color var(--motion-fast), color var(--motion-fast), background-color var(--motion-fast), box-shadow var(--motion-fast), transform var(--motion-fast);
  min-height: calc(34px * var(--panel-scale));
}
.btn:hover:not(:disabled) {
  border-color: var(--color-border-strong);
  color: var(--color-text);
  background: var(--color-surface-hover);
}
.btn:active:not(:disabled) {
  background: var(--color-surface-elevated);
  transform: scale(0.97);
}
.btn:focus-visible { box-shadow: var(--shadow-focus-ring); }
.btn:disabled { opacity: 0.45; cursor: default; }

.btn-sm { padding: 0 10px; font-size: 12px; min-height: 28px; }
```
Replace with:
```css
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: 0 var(--space-4);
  font-family: var(--font-sans);
  font-weight: 600;
  font-size: calc(13px * var(--panel-scale));
  cursor: pointer;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
  background: transparent;
  outline: none;
  white-space: nowrap;
  user-select: none;
  transition: border-color var(--motion-fast), color var(--motion-fast), background-color var(--motion-fast), box-shadow var(--motion-fast), transform var(--motion-fast);
  min-height: calc(34px * var(--panel-scale));
}
.btn:hover:not(:disabled) {
  border-color: var(--color-border-strong);
  color: var(--color-text);
  background: var(--color-surface-hover);
}
.btn:active:not(:disabled) {
  background: var(--color-surface-elevated);
  transform: scale(0.97);
}
.btn:focus-visible { box-shadow: var(--shadow-focus-ring); }
.btn:disabled { opacity: 0.45; cursor: default; }

.btn-sm { padding: 0 var(--space-3); font-size: 12px; min-height: 28px; }
```

Value changes: `.btn` gap `6px` → `8px`; padding `0 14px` → `0 16px`. `.btn-sm` padding `0 10px` → `0 12px`. `min-height` values (`34px`/`28px`, both scaled by `--panel-scale` for the density/text-scale feature) are component-height dimensions, not spacing rhythm — left untouched, matching the `--row-height` reasoning from Task 1.

- [ ] **Step 2: Update `.input`**

Find:
```css
.input {
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-family: var(--font-sans);
  font-size: calc(14px * var(--body-scale));
  padding: 6px 10px;
  min-height: calc(36px * var(--panel-scale));
  outline: none;
  width: 100%;
  transition: border-color var(--motion-fast), box-shadow var(--motion-fast);
}
```
Replace with:
```css
.input {
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-family: var(--font-sans);
  font-size: calc(14px * var(--body-scale));
  padding: var(--space-2) var(--space-3);
  min-height: calc(36px * var(--panel-scale));
  outline: none;
  width: 100%;
  transition: border-color var(--motion-fast), box-shadow var(--motion-fast);
}
```

Value change: padding `6px 10px` → `8px 12px` (6→8, 10→12).

- [ ] **Step 3: Verify**

```bash
npm run build
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/styles/globals.css
git commit -m "polish: apply spacing scale to buttons and inputs"
```

---

### Task 6: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Confirm the old tokens are fully gone**

```bash
grep -rn "\-\-gap-xs\|\-\-gap-sm\|\-\-gap-md\|\-\-gap-lg" src
```
Expected: no output.

- [ ] **Step 2: Confirm the new tokens are defined and referenced**

```bash
grep -c "var(--space-" src/styles/globals.css
```
Expected: a number ≥ 20 (this plan's 5 CSS tasks introduced roughly 22 individual `var(--space-N)` references — an exact count isn't required, just confirm it's not 0 or suspiciously low).

- [ ] **Step 3: Build**

```bash
npm run build
```
Expected: `tsc` and `vite build` both complete with no errors.

- [ ] **Step 4: Run the test suite**

```bash
npm test
```
Expected: all existing tests pass (this plan touches no component logic, only CSS values and one inline `style` object's string values, so no test should be affected — this just confirms nothing broke).

- [ ] **Step 5: Visual smoke test**

```bash
npm run tauri dev
```
(or `npm run dev` for the Vite-only dev server). Confirm on at least Today, Tasks, Habits, and Settings pages:
- Page padding reads as slightly more generous than before but not excessive (16/24px vs the old 18/22px — a subtle change, not a dramatic one).
- Card headers, nav items, buttons, and inputs all still look correctly proportioned — nothing should look broken, overlapping, or touching an edge.
- In Settings, toggle the density setting between "compact" and "comfortable" and confirm both still look reasonable (this exercises the `densityMap` fix from Task 1 specifically — compact should read tighter than comfortable, but neither should look broken).

- [ ] **Step 6: Commit anything found broken** (skip if nothing needed fixing)

```bash
git add -A
git commit -m "polish: fix issues found during spacing scale Phase 1 verification"
```
