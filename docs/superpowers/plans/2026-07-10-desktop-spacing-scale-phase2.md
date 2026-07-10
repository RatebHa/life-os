# Desktop Spacing Scale — Phase 2 (Per-Page Inline Style Sweep) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sweep every inline React `style={{...}}` spacing declaration (`margin*`, `padding*`, `gap`) across all 21 page/component files to reference the `--space-1/2/3/4/6/8` scale established in Phase 1, closing the gap Phase 1 explicitly deferred.

**Architecture:** Every raw spacing value in scope gets replaced with the nearest scale token, using the exact rounding rule from the design spec (`docs/superpowers/specs/2026-07-10-spacing-scale-design.md`). Because the same handful of values (4, 6, 8, 10, 12, 14, 16...) repeat constantly across each file, this plan uses one `sed` substitution per **unique (property, value) pair per file** rather than hundreds of individual hand-written edits — every substitution was individually verified against the live file content (exact line numbers, full context) before being included here, and every substitution is scoped to a single file (never run globally across the codebase).

**Tech Stack:** `sed` (GNU sed, confirmed available via Git Bash), verified with a word-boundary (`\b`) test to confirm `gap: 1` cannot corrupt `gap: 12`/`gap: 14` in the same file — every numeric pattern below uses `\b` for this reason. Two occurrences (dynamic `paddingLeft` expressions in `Tasks.tsx`) can't be expressed as a `sed` substitution and use a manual `Edit`-style Find/Replace instead, called out explicitly in that file's task.

---

## Before you start — read this once, it applies to every task below

**The scale (from Phase 1, already live in `tokens.css`):** `--space-1`=4px, `--space-2`=8px, `--space-3`=12px, `--space-4`=16px, `--space-6`=24px, `--space-8`=32px.

**The rounding rule** (from the design spec, verified programmatically): nearest scale step, ties round up. Applies to any raw value ≥4px:
```
5→--space-1, 6→--space-2, 7→--space-2, 9→--space-2, 10→--space-3, 11→--space-3, 13→--space-3,
14→--space-4, 15→--space-4, 17→--space-4, 18→--space-4, 19→--space-4,
20→--space-6, 21→--space-6, 22→--space-6, 23→--space-6, 25→--space-6, 26→--space-6, 27→--space-6,
28→--space-8, 29→--space-8, 30→--space-8, 31→--space-8
```
Values already exactly on the scale (4, 8, 12, 16, 24, 32) map to the matching token with no numeric change — just becoming a token reference.

**Out of scope, never edited:** the literal value `0` (always stays a bare `0`, never gets a token — there's no "zero spacing" token), and any value of `1`, `2`, or `3` (sub-4px "micro-adjustment", per the design spec §5 — these are fine-tuning values like a 1px optical alignment nudge or a 2px badge inset, not layout rhythm, and stay as literal numbers).

**Shorthand string values** (e.g. `padding: '10px 14px'`, two or more space-separated px values): each value is rounded independently through the same table. If one sub-value is in the 1-3px "leave alone" range and another isn't, the in-scope one becomes a token and the out-of-scope one stays a literal px value in the same string — e.g. `'2px 8px'` → `'2px var(--space-2)'`. If **every** sub-value in a shorthand is out of scope (e.g. `'3px 0'`, `'0 3px'`), the whole declaration needs no edit at all — these are called out explicitly per file below so it's clear they were checked, not missed.

**Replacement syntax:** a bare unitless number (`marginBottom: 6`) becomes a quoted string (`marginBottom: 'var(--space-2)'`) — it changes from an unquoted JS number to a quoted string, since a CSS custom property reference can only be a string. A string value (`padding: '6px 10px'`) stays a quoted string, with the px numbers replaced by `var()` calls.

**Values above 32px, and dynamic (non-literal) values:** three occurrences don't fit the scale/rounding rule at all and are explicitly left alone, called out in their file's task rather than silently skipped:
- `Tasks.tsx` — two dynamic `paddingLeft: N + (depth * 26)` expressions (tree-indentation, not static spacing) — handled with a manual Find/Replace for the base value, not a blanket exclusion; see Task 5.
- `GlobalSearch.tsx:197` — `paddingTop: 80` (a fixed overlay's top offset, positioning content below the app's header chrome — a layout-positioning value, not component spacing rhythm; 80 is also more than double the largest scale step, so forcing it onto the scale isn't a reasonable "nearest step" call). Left unchanged.

**Verification per task:** after each file's `sed` commands run, `npm run build` confirms nothing broke, and a `grep` confirms the file's specific substitution count.

All file paths below are relative to `C:\Users\isc\Desktop\Projects\Life OS` unless stated otherwise.

---

### Task 1: `src/pages/Settings.tsx` (12 substitutions)

**Files:**
- Modify: `src/pages/Settings.tsx`

- [ ] **Step 1: Run the substitutions**

```bash
sed -i "s/marginBottom: 12\b/marginBottom: 'var(--space-3)'/g" src/pages/Settings.tsx
sed -i "s/gap: 10\b/gap: 'var(--space-3)'/g" src/pages/Settings.tsx
sed -i "s/gap: 8\b/gap: 'var(--space-2)'/g" src/pages/Settings.tsx
sed -i "s/gap: 4\b/gap: 'var(--space-1)'/g" src/pages/Settings.tsx
sed -i "s/gap: 6\b/gap: 'var(--space-2)'/g" src/pages/Settings.tsx
sed -i "s/gap: 12\b/gap: 'var(--space-3)'/g" src/pages/Settings.tsx
sed -i "s/padding: '10px 12px'/padding: 'var(--space-3) var(--space-3)'/g" src/pages/Settings.tsx
sed -i "s/marginTop: 4\b/marginTop: 'var(--space-1)'/g" src/pages/Settings.tsx
sed -i "s/marginTop: 8\b/marginTop: 'var(--space-2)'/g" src/pages/Settings.tsx
sed -i "s/marginBottom: 4\b/marginBottom: 'var(--space-1)'/g" src/pages/Settings.tsx
sed -i "s/paddingRight: 4\b/paddingRight: 'var(--space-1)'/g" src/pages/Settings.tsx
sed -i "s/padding: '2px 8px'/padding: '2px var(--space-2)'/g" src/pages/Settings.tsx
```

Not edited, confirmed out of scope: `margin: 0` (literal zero, appears 8 times, e.g. line 647), `gap: 2` (line 937, micro-adjustment), `padding: 0` (line 1188, literal zero).

- [ ] **Step 2: Verify**

```bash
grep -c "var(--space-" src/pages/Settings.tsx
```
Expected: a number well above 12 (each of the 12 `sed` commands above fires once per matching occurrence in the file — several values like `gap: 8` repeat many times in this file alone — so the total is not 1:1 with the command count; just confirm it's not 0).

```bash
npm run build
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Settings.tsx
git commit -m "polish: apply spacing scale to Settings.tsx inline styles"
```

---

### Task 2: `src/pages/Today.tsx` (17 substitutions)

**Files:**
- Modify: `src/pages/Today.tsx`

- [ ] **Step 1: Run the substitutions**

```bash
sed -i "s/padding: '2px 6px'/padding: '2px var(--space-2)'/g" src/pages/Today.tsx
sed -i "s/marginBottom: 12\b/marginBottom: 'var(--space-3)'/g" src/pages/Today.tsx
sed -i "s/gap: 10\b/gap: 'var(--space-3)'/g" src/pages/Today.tsx
sed -i "s/gap: 8\b/gap: 'var(--space-2)'/g" src/pages/Today.tsx
sed -i "s/gap: 6\b/gap: 'var(--space-2)'/g" src/pages/Today.tsx
sed -i "s/marginTop: 8\b/marginTop: 'var(--space-2)'/g" src/pages/Today.tsx
sed -i "s/padding: '10px 12px'/padding: 'var(--space-3) var(--space-3)'/g" src/pages/Today.tsx
sed -i "s/marginTop: 4\b/marginTop: 'var(--space-1)'/g" src/pages/Today.tsx
sed -i "s/gap: 14\b/gap: 'var(--space-4)'/g" src/pages/Today.tsx
sed -i "s/gap: 12\b/gap: 'var(--space-3)'/g" src/pages/Today.tsx
sed -i "s/padding: '8px 10px'/padding: 'var(--space-2) var(--space-3)'/g" src/pages/Today.tsx
sed -i "s/padding: '8px 0'/padding: 'var(--space-2) 0'/g" src/pages/Today.tsx
sed -i "s/padding: '12px 14px 0'/padding: 'var(--space-3) var(--space-4) 0'/g" src/pages/Today.tsx
sed -i "s/marginTop: 6\b/marginTop: 'var(--space-2)'/g" src/pages/Today.tsx
sed -i "s/margin: '0 14px 14px'/margin: '0 var(--space-4) var(--space-4)'/g" src/pages/Today.tsx
sed -i "s/padding: '1px 5px'/padding: '1px var(--space-1)'/g" src/pages/Today.tsx
sed -i "s/padding: '12px 14px'/padding: 'var(--space-3) var(--space-4)'/g" src/pages/Today.tsx
```

Not edited, confirmed out of scope: `padding: 0` (literal zero, lines 567/653), `marginTop: 3` (line 779, micro-adjustment).

- [ ] **Step 2: Verify**

```bash
grep -c "var(--space-" src/pages/Today.tsx
npm run build
```
Expected: grep count not 0, build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Today.tsx
git commit -m "polish: apply spacing scale to Today.tsx inline styles"
```

---

### Task 3: `src/pages/Goals.tsx` (17 substitutions)

**Files:**
- Modify: `src/pages/Goals.tsx`

- [ ] **Step 1: Run the substitutions**

```bash
sed -i "s/marginBottom: 6\b/marginBottom: 'var(--space-2)'/g" src/pages/Goals.tsx
sed -i "s/gap: 6\b/gap: 'var(--space-2)'/g" src/pages/Goals.tsx
sed -i "s/paddingTop: 8\b/paddingTop: 'var(--space-2)'/g" src/pages/Goals.tsx
sed -i "s/marginTop: 8\b/marginTop: 'var(--space-2)'/g" src/pages/Goals.tsx
sed -i "s/gap: 8\b/gap: 'var(--space-2)'/g" src/pages/Goals.tsx
sed -i "s/gap: 10\b/gap: 'var(--space-3)'/g" src/pages/Goals.tsx
sed -i "s/padding: '2px 6px'/padding: '2px var(--space-2)'/g" src/pages/Goals.tsx
sed -i "s/padding: '4px 8px'/padding: 'var(--space-1) var(--space-2)'/g" src/pages/Goals.tsx
sed -i "s/padding: '1px 5px'/padding: '1px var(--space-1)'/g" src/pages/Goals.tsx
sed -i "s/marginTop: 4\b/marginTop: 'var(--space-1)'/g" src/pages/Goals.tsx
sed -i "s/paddingTop: 10\b/paddingTop: 'var(--space-3)'/g" src/pages/Goals.tsx
sed -i "s/padding: '8px 12px'/padding: 'var(--space-2) var(--space-3)'/g" src/pages/Goals.tsx
sed -i "s/padding: '10px 10px 12px'/padding: 'var(--space-3) var(--space-3) var(--space-3)'/g" src/pages/Goals.tsx
sed -i "s/marginTop: 6\b/marginTop: 'var(--space-2)'/g" src/pages/Goals.tsx
sed -i "s/marginLeft: 20\b/marginLeft: 'var(--space-6)'/g" src/pages/Goals.tsx
sed -i "s/gap: 4\b/gap: 'var(--space-1)'/g" src/pages/Goals.tsx
sed -i "s/gap: 14\b/gap: 'var(--space-4)'/g" src/pages/Goals.tsx
```

Not edited, confirmed out of scope: `marginTop: 2` (lines 300/319, micro-adjustment), `padding: 0` (lines 308/326, literal zero), `margin: 0` (lines 355/383/405/428, literal zero).

Note: `padding: '2px 6px'` appears 3 times (lines 453, 470, 475) on small icon-action buttons (`btn btn-sm btn-ghost`/`btn-sm btn-danger` with `minHeight: 'auto'`). Unlike the narrower "undo the shadowing override" fix from the previous Phase 1 follow-up (which deliberately left these alone since that fix was specifically about CSS-class shadowing, not a general sweep), this Phase 2 sweep applies the scale mechanically to every in-scope value regardless of the surrounding button's size — the 2px stays as a micro-adjustment (below threshold), but the 6px still converts, consistent with every other `'2px 6px'` occurrence in the codebase (e.g. `Today.tsx`, same pattern).

- [ ] **Step 2: Verify**

```bash
grep -c "var(--space-" src/pages/Goals.tsx
npm run build
```
Expected: grep count not 0, build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Goals.tsx
git commit -m "polish: apply spacing scale to Goals.tsx inline styles"
```

---

### Task 4: `src/pages/Analytics.tsx` (20 substitutions)

**Files:**
- Modify: `src/pages/Analytics.tsx`

- [ ] **Step 1: Run the substitutions**

```bash
sed -i "s/padding: '6px 10px'/padding: 'var(--space-2) var(--space-3)'/g" src/pages/Analytics.tsx
sed -i "s/marginBottom: 4\b/marginBottom: 'var(--space-1)'/g" src/pages/Analytics.tsx
sed -i "s/gap: 6\b/gap: 'var(--space-2)'/g" src/pages/Analytics.tsx
sed -i "s/padding: '8px 12px'/padding: 'var(--space-2) var(--space-3)'/g" src/pages/Analytics.tsx
sed -i "s/gap: 10\b/gap: 'var(--space-3)'/g" src/pages/Analytics.tsx
sed -i "s/gap: 8\b/gap: 'var(--space-2)'/g" src/pages/Analytics.tsx
sed -i "s/padding: '12px 0'/padding: 'var(--space-3) 0'/g" src/pages/Analytics.tsx
sed -i "s/padding: '8px 10px'/padding: 'var(--space-2) var(--space-3)'/g" src/pages/Analytics.tsx
sed -i "s/marginTop: 4\b/marginTop: 'var(--space-1)'/g" src/pages/Analytics.tsx
sed -i "s/marginTop: 12\b/marginTop: 'var(--space-3)'/g" src/pages/Analytics.tsx
sed -i "s/gap: 12\b/gap: 'var(--space-3)'/g" src/pages/Analytics.tsx
sed -i "s/gap: 4\b/gap: 'var(--space-1)'/g" src/pages/Analytics.tsx
sed -i "s/paddingTop: 6\b/paddingTop: 'var(--space-2)'/g" src/pages/Analytics.tsx
sed -i "s/padding: '4px 8px'/padding: 'var(--space-1) var(--space-2)'/g" src/pages/Analytics.tsx
sed -i "s/padding: '10px 12px'/padding: 'var(--space-3) var(--space-3)'/g" src/pages/Analytics.tsx
sed -i "s/marginBottom: 8\b/marginBottom: 'var(--space-2)'/g" src/pages/Analytics.tsx
sed -i "s/padding: '8px 14px'/padding: 'var(--space-2) var(--space-4)'/g" src/pages/Analytics.tsx
sed -i "s/padding: '7px 12px'/padding: 'var(--space-2) var(--space-3)'/g" src/pages/Analytics.tsx
sed -i "s/padding: '8px 0'/padding: 'var(--space-2) 0'/g" src/pages/Analytics.tsx
sed -i "s/padding: '10px 0'/padding: 'var(--space-3) 0'/g" src/pages/Analytics.tsx
```

Not edited, confirmed out of scope: `marginTop: 2` (lines 99/103/109, micro-adjustment), `marginBottom: 2` (lines 585/679, micro-adjustment), `marginTop: 1` (line 733, micro-adjustment).

Note: `padding: '7px 12px'` (line 723) and `padding: '4px 8px'` (lines 559/584) were the two values flagged during research as needing controller review before this plan was written — both resolved by mechanical application of the rounding table (7→`--space-2`, 4→`--space-1`, no exception needed; there was no actual ambiguity, just a first-pass research error that's been corrected here).

- [ ] **Step 2: Verify**

```bash
grep -c "var(--space-" src/pages/Analytics.tsx
npm run build
```
Expected: grep count not 0, build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Analytics.tsx
git commit -m "polish: apply spacing scale to Analytics.tsx inline styles"
```

---

### Task 5: `src/pages/Tasks.tsx` (13 substitutions + 2 manual edits)

**Files:**
- Modify: `src/pages/Tasks.tsx`

- [ ] **Step 1: Run the sed substitutions**

```bash
sed -i "s/gap: 6\b/gap: 'var(--space-2)'/g" src/pages/Tasks.tsx
sed -i "s/gap: 10\b/gap: 'var(--space-3)'/g" src/pages/Tasks.tsx
sed -i "s/gap: 8\b/gap: 'var(--space-2)'/g" src/pages/Tasks.tsx
sed -i "s/padding: '1px 5px'/padding: '1px var(--space-1)'/g" src/pages/Tasks.tsx
sed -i "s/padding: '10px 12px'/padding: 'var(--space-3) var(--space-3)'/g" src/pages/Tasks.tsx
sed -i "s/marginBottom: 12\b/marginBottom: 'var(--space-3)'/g" src/pages/Tasks.tsx
sed -i "s/padding: '6px 12px'/padding: 'var(--space-2) var(--space-3)'/g" src/pages/Tasks.tsx
sed -i "s/padding: '10px 12px 6px'/padding: 'var(--space-3) var(--space-3) var(--space-2)'/g" src/pages/Tasks.tsx
sed -i "s/padding: '0 6px'/padding: '0 var(--space-2)'/g" src/pages/Tasks.tsx
sed -i "s/marginTop: 5\b/marginTop: 'var(--space-1)'/g" src/pages/Tasks.tsx
sed -i "s/gap: 4\b/gap: 'var(--space-1)'/g" src/pages/Tasks.tsx
sed -i "s/gap: 14\b/gap: 'var(--space-4)'/g" src/pages/Tasks.tsx
sed -i "s/gap: 12\b/gap: 'var(--space-3)'/g" src/pages/Tasks.tsx
```

Not edited, confirmed out of scope: `marginTop: 2` (line 313, micro-adjustment), `marginTop: 1` (line 327, micro-adjustment), `padding: 0` (line 321, literal zero).

- [ ] **Step 2: Manually fix the two dynamic `paddingLeft` expressions**

These are tree-indentation formulas (`base + depth * 26`), not static spacing — a `sed` numeric substitution would corrupt the expression, and they can't cleanly become a bare `var(--space-N)` reference since they're added to a runtime-computed offset. The base value gets wrapped in `calc()` inside a template literal instead.

Find (in `src/pages/Tasks.tsx`):
```tsx
              paddingLeft: 12 + (depth * 26),
```
Replace with:
```tsx
              paddingLeft: `calc(var(--space-3) + ${depth * 26}px)`,
```

Find:
```tsx
              <div style={{ padding: '6px 12px', paddingLeft: 38 + (depth * 26), fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
```
Replace with:
```tsx
              <div style={{ padding: 'var(--space-2) var(--space-3)', paddingLeft: 38 + (depth * 26), fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
```
(Note: `paddingLeft: 38 + (depth * 26)` here is left completely unchanged — 38 is above the largest scale step (32) and is a base offset for a *second* tree-indentation level, not a value with an obvious nearest-step mapping; forcing it onto the scale would need a new step this plan doesn't define. Only the `padding: '6px 12px'` on the same line, already handled by the Step 1 sed command, needed a change — this Find/Replace block exists only to show the full line context so the correct line is edited, since the sed command in Step 1 already transformed the `padding` part; if Step 1 already ran, this block's Find text should already show `padding: 'var(--space-2) var(--space-3)'` — check the current state before editing, and skip this second block entirely if Step 1's sed already handled it.)

- [ ] **Step 3: Verify**

```bash
grep -c "var(--space-" src/pages/Tasks.tsx
grep -n "paddingLeft" src/pages/Tasks.tsx
npm run build
```
Expected: grep count not 0; the `paddingLeft` grep shows the `calc(var(--space-3) + ...)` form on one line and the untouched `38 + (depth * 26)` on the other; build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Tasks.tsx
git commit -m "polish: apply spacing scale to Tasks.tsx inline styles"
```

---

### Task 6: `src/pages/Habits.tsx` (11 unique substitutions)

**Files:**
- Modify: `src/pages/Habits.tsx`

- [ ] **Step 1: Run the substitutions**

```bash
sed -i "s/marginBottom: 6\b/marginBottom: 'var(--space-2)'/g" src/pages/Habits.tsx
sed -i "s/gap: 6\b/gap: 'var(--space-2)'/g" src/pages/Habits.tsx
sed -i "s/gap: 8\b/gap: 'var(--space-2)'/g" src/pages/Habits.tsx
sed -i "s/gap: 12\b/gap: 'var(--space-3)'/g" src/pages/Habits.tsx
sed -i "s/gap: 10\b/gap: 'var(--space-3)'/g" src/pages/Habits.tsx
sed -i "s/paddingTop: 10\b/paddingTop: 'var(--space-3)'/g" src/pages/Habits.tsx
sed -i "s/padding: 12\b/padding: 'var(--space-3)'/g" src/pages/Habits.tsx
sed -i "s/padding: '5px 8px'/padding: 'var(--space-1) var(--space-2)'/g" src/pages/Habits.tsx
sed -i "s/padding: '4px 0'/padding: 'var(--space-1) 0'/g" src/pages/Habits.tsx
sed -i "s/marginBottom: 12\b/marginBottom: 'var(--space-3)'/g" src/pages/Habits.tsx
sed -i "s/gap: 14\b/gap: 'var(--space-4)'/g" src/pages/Habits.tsx
```

No out-of-scope values found in this file (no micro-adjustments, no literal zeros in a spacing context).

- [ ] **Step 2: Verify**

```bash
grep -c "var(--space-" src/pages/Habits.tsx
npm run build
```
Expected: grep count not 0, build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Habits.tsx
git commit -m "polish: apply spacing scale to Habits.tsx inline styles"
```

---

### Task 7: `src/pages/WeeklyReview.tsx` (9 unique substitutions)

**Files:**
- Modify: `src/pages/WeeklyReview.tsx`

- [ ] **Step 1: Run the substitutions**

```bash
sed -i "s/gap: 8\b/gap: 'var(--space-2)'/g" src/pages/WeeklyReview.tsx
sed -i "s/marginBottom: 12\b/marginBottom: 'var(--space-3)'/g" src/pages/WeeklyReview.tsx
sed -i "s/padding: '12px 0'/padding: 'var(--space-3) 0'/g" src/pages/WeeklyReview.tsx
sed -i "s/marginTop: 4\b/marginTop: 'var(--space-1)'/g" src/pages/WeeklyReview.tsx
sed -i "s/padding: '8px 10px'/padding: 'var(--space-2) var(--space-3)'/g" src/pages/WeeklyReview.tsx
sed -i "s/gap: 10\b/gap: 'var(--space-3)'/g" src/pages/WeeklyReview.tsx
sed -i "s/padding: '10px 12px'/padding: 'var(--space-3) var(--space-3)'/g" src/pages/WeeklyReview.tsx
sed -i "s/marginTop: 8\b/marginTop: 'var(--space-2)'/g" src/pages/WeeklyReview.tsx
sed -i "s/gap: 4\b/gap: 'var(--space-1)'/g" src/pages/WeeklyReview.tsx
```

No out-of-scope values found in this file.

- [ ] **Step 2: Verify**

```bash
grep -c "var(--space-" src/pages/WeeklyReview.tsx
npm run build
```
Expected: grep count not 0, build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/pages/WeeklyReview.tsx
git commit -m "polish: apply spacing scale to WeeklyReview.tsx inline styles"
```

---

### Task 8: `src/pages/CommandCenter.tsx` (8 substitutions)

**Files:**
- Modify: `src/pages/CommandCenter.tsx`

- [ ] **Step 1: Run the substitutions**

```bash
sed -i "s/gap: 8\b/gap: 'var(--space-2)'/g" src/pages/CommandCenter.tsx
sed -i "s/marginBottom: 12\b/marginBottom: 'var(--space-3)'/g" src/pages/CommandCenter.tsx
sed -i "s/gap: 10\b/gap: 'var(--space-3)'/g" src/pages/CommandCenter.tsx
sed -i "s/padding: 14\b/padding: 'var(--space-4)'/g" src/pages/CommandCenter.tsx
sed -i "s/padding: '10px 12px'/padding: 'var(--space-3) var(--space-3)'/g" src/pages/CommandCenter.tsx
sed -i "s/marginTop: 8\b/marginTop: 'var(--space-2)'/g" src/pages/CommandCenter.tsx
sed -i "s/marginTop: 4\b/marginTop: 'var(--space-1)'/g" src/pages/CommandCenter.tsx
sed -i "s/marginBottom: 8\b/marginBottom: 'var(--space-2)'/g" src/pages/CommandCenter.tsx
```

No out-of-scope values found in this file.

- [ ] **Step 2: Verify**

```bash
grep -c "var(--space-" src/pages/CommandCenter.tsx
npm run build
```
Expected: grep count not 0, build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/pages/CommandCenter.tsx
git commit -m "polish: apply spacing scale to CommandCenter.tsx inline styles"
```

---

### Task 9: `src/pages/Templates.tsx` (8 substitutions)

**Files:**
- Modify: `src/pages/Templates.tsx`

- [ ] **Step 1: Run the substitutions**

```bash
sed -i "s/gap: 12\b/gap: 'var(--space-3)'/g" src/pages/Templates.tsx
sed -i "s/marginBottom: 12\b/marginBottom: 'var(--space-3)'/g" src/pages/Templates.tsx
sed -i "s/padding: '18px 0'/padding: 'var(--space-4) 0'/g" src/pages/Templates.tsx
sed -i "s/gap: 8\b/gap: 'var(--space-2)'/g" src/pages/Templates.tsx
sed -i "s/padding: '14px 0'/padding: 'var(--space-4) 0'/g" src/pages/Templates.tsx
sed -i "s/padding: '8px 10px'/padding: 'var(--space-2) var(--space-3)'/g" src/pages/Templates.tsx
sed -i "s/gap: 10\b/gap: 'var(--space-3)'/g" src/pages/Templates.tsx
sed -i "s/gap: 6\b/gap: 'var(--space-2)'/g" src/pages/Templates.tsx
```

Not edited, confirmed out of scope: `marginTop: 3` (lines 199/274/296, micro-adjustment).

- [ ] **Step 2: Verify**

```bash
grep -c "var(--space-" src/pages/Templates.tsx
npm run build
```
Expected: grep count not 0, build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Templates.tsx
git commit -m "polish: apply spacing scale to Templates.tsx inline styles"
```

---

### Task 10: `src/pages/Calendar.tsx` (9 substitutions)

**Files:**
- Modify: `src/pages/Calendar.tsx`

- [ ] **Step 1: Run the substitutions**

```bash
sed -i "s/gap: 16\b/gap: 'var(--space-4)'/g" src/pages/Calendar.tsx
sed -i "s/marginBottom: 12\b/marginBottom: 'var(--space-3)'/g" src/pages/Calendar.tsx
sed -i "s/marginBottom: 4\b/marginBottom: 'var(--space-1)'/g" src/pages/Calendar.tsx
sed -i "s/padding: 4\b/padding: 'var(--space-1)'/g" src/pages/Calendar.tsx
sed -i "s/marginBottom: 6\b/marginBottom: 'var(--space-2)'/g" src/pages/Calendar.tsx
sed -i "s/gap: 8\b/gap: 'var(--space-2)'/g" src/pages/Calendar.tsx
sed -i "s/padding: '5px 0'/padding: 'var(--space-1) 0'/g" src/pages/Calendar.tsx
sed -i "s/padding: '20px 0'/padding: 'var(--space-6) 0'/g" src/pages/Calendar.tsx
sed -i "s/padding: 30\b/padding: 'var(--space-8)'/g" src/pages/Calendar.tsx
```

Not edited, confirmed out of scope: `gap: 2` (lines 63/75/99/110, micro-adjustment), `padding: '3px 0'` (line 65 — both sub-values out of scope: 3px is a micro-adjustment, 0 is always literal, so nothing to change on this line at all).

- [ ] **Step 2: Verify**

```bash
grep -c "var(--space-" src/pages/Calendar.tsx
npm run build
```
Expected: grep count not 0, build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Calendar.tsx
git commit -m "polish: apply spacing scale to Calendar.tsx inline styles"
```

---

### Task 11: `src/pages/Notes.tsx` (10 substitutions)

**Files:**
- Modify: `src/pages/Notes.tsx`

- [ ] **Step 1: Run the substitutions**

```bash
sed -i "s/padding: '10px 12px 8px'/padding: 'var(--space-3) var(--space-4) var(--space-2)'/g" src/pages/Notes.tsx
sed -i "s/padding: '8px 10px'/padding: 'var(--space-2) var(--space-3)'/g" src/pages/Notes.tsx
sed -i "s/padding: '30px 10px'/padding: 'var(--space-8) var(--space-3)'/g" src/pages/Notes.tsx
sed -i "s/padding: '8px 12px'/padding: 'var(--space-2) var(--space-3)'/g" src/pages/Notes.tsx
sed -i "s/gap: 6\b/gap: 'var(--space-2)'/g" src/pages/Notes.tsx
sed -i "s/padding: '12px 16px 8px'/padding: 'var(--space-3) var(--space-4) var(--space-2)'/g" src/pages/Notes.tsx
sed -i "s/gap: 10\b/gap: 'var(--space-3)'/g" src/pages/Notes.tsx
sed -i "s/padding: '5px 16px'/padding: 'var(--space-1) var(--space-4)'/g" src/pages/Notes.tsx
sed -i "s/padding: '0 6px'/padding: '0 var(--space-2)'/g" src/pages/Notes.tsx
sed -i "s/padding: '14px 18px'/padding: 'var(--space-4) var(--space-4)'/g" src/pages/Notes.tsx
```

Not edited, confirmed out of scope: `gap: 3` (line 214, micro-adjustment), `padding: '0 3px'` (line 261 — both sub-values out of scope, nothing to change).

- [ ] **Step 2: Verify**

```bash
grep -c "var(--space-" src/pages/Notes.tsx
npm run build
```
Expected: grep count not 0, build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Notes.tsx
git commit -m "polish: apply spacing scale to Notes.tsx inline styles"
```

---

### Task 12: `src/pages/Inbox.tsx` (11 unique substitutions)

**Files:**
- Modify: `src/pages/Inbox.tsx`

- [ ] **Step 1: Run the substitutions**

```bash
sed -i "s/gap: 12\b/gap: 'var(--space-3)'/g" src/pages/Inbox.tsx
sed -i "s/gap: 8\b/gap: 'var(--space-2)'/g" src/pages/Inbox.tsx
sed -i "s/marginBottom: 12\b/marginBottom: 'var(--space-3)'/g" src/pages/Inbox.tsx
sed -i "s/padding: '18px 0'/padding: 'var(--space-4) 0'/g" src/pages/Inbox.tsx
sed -i "s/gap: 10\b/gap: 'var(--space-3)'/g" src/pages/Inbox.tsx
sed -i "s/padding: '10px 12px'/padding: 'var(--space-3) var(--space-3)'/g" src/pages/Inbox.tsx
sed -i "s/marginBottom: 6\b/marginBottom: 'var(--space-2)'/g" src/pages/Inbox.tsx
sed -i "s/marginBottom: 10\b/marginBottom: 'var(--space-3)'/g" src/pages/Inbox.tsx
sed -i "s/gap: 6\b/gap: 'var(--space-2)'/g" src/pages/Inbox.tsx
sed -i "s/padding: '8px 10px'/padding: 'var(--space-2) var(--space-3)'/g" src/pages/Inbox.tsx
sed -i "s/marginTop: 8\b/marginTop: 'var(--space-2)'/g" src/pages/Inbox.tsx
```

No out-of-scope values found in this file.

- [ ] **Step 2: Verify**

```bash
grep -c "var(--space-" src/pages/Inbox.tsx
npm run build
```
Expected: grep count not 0, build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Inbox.tsx
git commit -m "polish: apply spacing scale to Inbox.tsx inline styles"
```

---

### Task 13: `src/pages/DomainPage.tsx` (6 substitutions)

**Files:**
- Modify: `src/pages/DomainPage.tsx`

- [ ] **Step 1: Run the substitutions**

```bash
sed -i "s/gap: 4\b/gap: 'var(--space-1)'/g" src/pages/DomainPage.tsx
sed -i "s/gap: 10\b/gap: 'var(--space-3)'/g" src/pages/DomainPage.tsx
sed -i "s/padding: '16px 0'/padding: 'var(--space-4) 0'/g" src/pages/DomainPage.tsx
sed -i "s/padding: '6px 0'/padding: 'var(--space-2) 0'/g" src/pages/DomainPage.tsx
sed -i "s/gap: 8\b/gap: 'var(--space-2)'/g" src/pages/DomainPage.tsx
sed -i "s/padding: '7px 12px'/padding: 'var(--space-2) var(--space-3)'/g" src/pages/DomainPage.tsx
```

Not edited, confirmed out of scope: `padding: 0` (line 51, literal zero).

- [ ] **Step 2: Verify**

```bash
grep -c "var(--space-" src/pages/DomainPage.tsx
npm run build
```
Expected: grep count not 0, build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/pages/DomainPage.tsx
git commit -m "polish: apply spacing scale to DomainPage.tsx inline styles"
```

---

### Task 14: `src/components/layout/Sidebar.tsx` (9 unique substitutions)

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Run the substitutions**

```bash
sed -i "s/padding: '10px 12px 8px'/padding: 'var(--space-3) var(--space-3) var(--space-2)'/g" src/components/layout/Sidebar.tsx
sed -i "s/marginTop: 6\b/marginTop: 'var(--space-2)'/g" src/components/layout/Sidebar.tsx
sed -i "s/padding: '2px 6px'/padding: '2px var(--space-2)'/g" src/components/layout/Sidebar.tsx
sed -i "s/padding: '6px 0'/padding: 'var(--space-2) 0'/g" src/components/layout/Sidebar.tsx
sed -i "s/padding: '0 12px 3px'/padding: '0 var(--space-3) 3px'/g" src/components/layout/Sidebar.tsx
sed -i "s/margin: '3px 12px'/margin: '3px var(--space-3)'/g" src/components/layout/Sidebar.tsx
sed -i "s/padding: '8px 12px'/padding: 'var(--space-2) var(--space-3)'/g" src/components/layout/Sidebar.tsx
sed -i "s/gap: 4\b/gap: 'var(--space-1)'/g" src/components/layout/Sidebar.tsx
sed -i "s/padding: '6px 12px'/padding: 'var(--space-2) var(--space-3)'/g" src/components/layout/Sidebar.tsx
```

Not edited, confirmed out of scope: `marginTop: 2` (line 47, micro-adjustment), `padding: '3px 0'` (lines 102/138 — both sub-values out of scope, nothing to change).

- [ ] **Step 2: Verify**

```bash
grep -c "var(--space-" src/components/layout/Sidebar.tsx
npm run build
```
Expected: grep count not 0, build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "polish: apply spacing scale to Sidebar.tsx inline styles"
```

---

### Task 15: `src/components/layout/TopBar.tsx` (4 unique substitutions)

**Files:**
- Modify: `src/components/layout/TopBar.tsx`

- [ ] **Step 1: Run the substitutions**

```bash
sed -i "s/gap: 12\b/gap: 'var(--space-3)'/g" src/components/layout/TopBar.tsx
sed -i "s/gap: 14\b/gap: 'var(--space-4)'/g" src/components/layout/TopBar.tsx
sed -i "s/padding: '4px 12px'/padding: 'var(--space-1) var(--space-3)'/g" src/components/layout/TopBar.tsx
sed -i "s/padding: '4px 14px'/padding: 'var(--space-1) var(--space-4)'/g" src/components/layout/TopBar.tsx
```

Not edited, confirmed out of scope: `gap: 3` (line 53, micro-adjustment), `gap: 1` (line 121, micro-adjustment — confirmed this doesn't collide with `gap: 12`/`gap: 14` in this file since the sed commands above use `\b` word-boundary matching, verified safe before writing this plan).

- [ ] **Step 2: Verify**

```bash
grep -c "var(--space-" src/components/layout/TopBar.tsx
npm run build
```
Expected: grep count not 0, build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/TopBar.tsx
git commit -m "polish: apply spacing scale to TopBar.tsx inline styles"
```

---

### Task 16: `src/components/layout/TabBar.tsx` (5 unique substitutions)

**Files:**
- Modify: `src/components/layout/TabBar.tsx`

- [ ] **Step 1: Run the substitutions**

```bash
sed -i "s/gap: 12\b/gap: 'var(--space-3)'/g" src/components/layout/TabBar.tsx
sed -i "s/padding: '0 12px'/padding: '0 var(--space-3)'/g" src/components/layout/TabBar.tsx
sed -i "s/paddingRight: 12\b/paddingRight: 'var(--space-3)'/g" src/components/layout/TabBar.tsx
sed -i "s/gap: 8\b/gap: 'var(--space-2)'/g" src/components/layout/TabBar.tsx
sed -i "s/gap: 6\b/gap: 'var(--space-2)'/g" src/components/layout/TabBar.tsx
```

No out-of-scope values found in this file.

- [ ] **Step 2: Verify**

```bash
grep -c "var(--space-" src/components/layout/TabBar.tsx
npm run build
```
Expected: grep count not 0, build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/TabBar.tsx
git commit -m "polish: apply spacing scale to TabBar.tsx inline styles"
```

---

### Task 17: `src/components/layout/FooterBar.tsx` (2 unique substitutions)

**Files:**
- Modify: `src/components/layout/FooterBar.tsx`

- [ ] **Step 1: Run the substitutions**

```bash
sed -i "s/gap: 12\b/gap: 'var(--space-3)'/g" src/components/layout/FooterBar.tsx
sed -i "s/gap: 4\b/gap: 'var(--space-1)'/g" src/components/layout/FooterBar.tsx
```

No out-of-scope values found in this file.

- [ ] **Step 2: Verify**

```bash
grep -c "var(--space-" src/components/layout/FooterBar.tsx
npm run build
```
Expected: grep count not 0, build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/FooterBar.tsx
git commit -m "polish: apply spacing scale to FooterBar.tsx inline styles"
```

---

### Task 18: `src/components/shared/FocusTimer.tsx` (7 unique substitutions)

**Files:**
- Modify: `src/components/shared/FocusTimer.tsx`

- [ ] **Step 1: Run the substitutions**

```bash
sed -i "s/gap: 12\b/gap: 'var(--space-3)'/g" src/components/shared/FocusTimer.tsx
sed -i "s/padding: '10px 14px'/padding: 'var(--space-3) var(--space-4)'/g" src/components/shared/FocusTimer.tsx
sed -i "s/gap: 10\b/gap: 'var(--space-3)'/g" src/components/shared/FocusTimer.tsx
sed -i "s/marginTop: 4\b/marginTop: 'var(--space-1)'/g" src/components/shared/FocusTimer.tsx
sed -i "s/gap: 6\b/gap: 'var(--space-2)'/g" src/components/shared/FocusTimer.tsx
sed -i "s/marginBottom: 6\b/marginBottom: 'var(--space-2)'/g" src/components/shared/FocusTimer.tsx
sed -i "s/gap: 8\b/gap: 'var(--space-2)'/g" src/components/shared/FocusTimer.tsx
```

Not edited, confirmed out of scope: `margin: 0` (line 120, literal zero).

- [ ] **Step 2: Verify**

```bash
grep -c "var(--space-" src/components/shared/FocusTimer.tsx
npm run build
```
Expected: grep count not 0, build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/shared/FocusTimer.tsx
git commit -m "polish: apply spacing scale to FocusTimer.tsx inline styles"
```

---

### Task 19: `src/components/shared/GlobalSearch.tsx` (6 substitutions)

**Files:**
- Modify: `src/components/shared/GlobalSearch.tsx`

- [ ] **Step 1: Run the substitutions**

```bash
sed -i "s/gap: 10\b/gap: 'var(--space-3)'/g" src/components/shared/GlobalSearch.tsx
sed -i "s/padding: '10px 14px'/padding: 'var(--space-3) var(--space-4)'/g" src/components/shared/GlobalSearch.tsx
sed -i "s/padding: '8px 14px'/padding: 'var(--space-2) var(--space-4)'/g" src/components/shared/GlobalSearch.tsx
sed -i "s/padding: '20px 14px'/padding: 'var(--space-6) var(--space-4)'/g" src/components/shared/GlobalSearch.tsx
sed -i "s/padding: '4px 14px'/padding: 'var(--space-1) var(--space-4)'/g" src/components/shared/GlobalSearch.tsx
sed -i "s/gap: 14\b/gap: 'var(--space-4)'/g" src/components/shared/GlobalSearch.tsx
```

Not edited, confirmed out of scope: `padding: 0` (line 214, literal zero), `marginTop: 1` (line 261, micro-adjustment), `paddingTop: 80` (line 197 — a fixed overlay top-offset positioning content below the app header, not component spacing rhythm; more than double the largest scale step, so there's no reasonable "nearest step" — left unchanged per this plan's "Before you start" note).

- [ ] **Step 2: Verify**

```bash
grep -c "var(--space-" src/components/shared/GlobalSearch.tsx
npm run build
```
Expected: grep count not 0, build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/shared/GlobalSearch.tsx
git commit -m "polish: apply spacing scale to GlobalSearch.tsx inline styles"
```

---

### Task 20: `src/components/shared/QuickCapture.tsx` (9 substitutions)

**Files:**
- Modify: `src/components/shared/QuickCapture.tsx`

- [ ] **Step 1: Run the substitutions**

```bash
sed -i "s/padding: '18px 22px'/padding: 'var(--space-4) var(--space-6)'/g" src/components/shared/QuickCapture.tsx
sed -i "s/marginBottom: 14\b/marginBottom: 'var(--space-4)'/g" src/components/shared/QuickCapture.tsx
sed -i "s/gap: 4\b/gap: 'var(--space-1)'/g" src/components/shared/QuickCapture.tsx
sed -i "s/padding: '2px 10px'/padding: '2px var(--space-3)'/g" src/components/shared/QuickCapture.tsx
sed -i "s/gap: 10\b/gap: 'var(--space-3)'/g" src/components/shared/QuickCapture.tsx
sed -i "s/gap: 6\b/gap: 'var(--space-2)'/g" src/components/shared/QuickCapture.tsx
sed -i "s/padding: '3px 8px'/padding: '3px var(--space-2)'/g" src/components/shared/QuickCapture.tsx
sed -i "s/padding: '16px 0'/padding: 'var(--space-4) 0'/g" src/components/shared/QuickCapture.tsx
sed -i "s/gap: 8\b/gap: 'var(--space-2)'/g" src/components/shared/QuickCapture.tsx
```

No out-of-scope values found in this file.

- [ ] **Step 2: Verify**

```bash
grep -c "var(--space-" src/components/shared/QuickCapture.tsx
npm run build
```
Expected: grep count not 0, build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/shared/QuickCapture.tsx
git commit -m "polish: apply spacing scale to QuickCapture.tsx inline styles"
```

---

### Task 21: `src/components/shared/DebugConsole.tsx` (3 unique substitutions)

**Files:**
- Modify: `src/components/shared/DebugConsole.tsx`

- [ ] **Step 1: Run the substitutions**

```bash
sed -i "s/gap: 8\b/gap: 'var(--space-2)'/g" src/components/shared/DebugConsole.tsx
sed -i "s/padding: '8px 10px'/padding: 'var(--space-2) var(--space-3)'/g" src/components/shared/DebugConsole.tsx
sed -i "s/marginTop: 4\b/marginTop: 'var(--space-1)'/g" src/components/shared/DebugConsole.tsx
```

No out-of-scope values found in this file.

- [ ] **Step 2: Verify**

```bash
grep -c "var(--space-" src/components/shared/DebugConsole.tsx
npm run build
```
Expected: grep count not 0, build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/shared/DebugConsole.tsx
git commit -m "polish: apply spacing scale to DebugConsole.tsx inline styles"
```

---

### Task 22: `src/components/shared/RouteErrorBoundary.tsx` (1 substitution)

**Files:**
- Modify: `src/components/shared/RouteErrorBoundary.tsx`

- [ ] **Step 1: Run the substitution**

```bash
sed -i "s/gap: 8\b/gap: 'var(--space-2)'/g" src/components/shared/RouteErrorBoundary.tsx
```

- [ ] **Step 2: Verify**

```bash
grep -c "var(--space-" src/components/shared/RouteErrorBoundary.tsx
npm run build
```
Expected: `1`, build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/shared/RouteErrorBoundary.tsx
git commit -m "polish: apply spacing scale to RouteErrorBoundary.tsx inline styles"
```

---

### Task 23: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Confirm no unconverted in-scope raw values remain**

```bash
grep -rnoE "(margin[a-zA-Z]*|padding[a-zA-Z]*|gap):\s*[4-9]\b|(margin[a-zA-Z]*|padding[a-zA-Z]*|gap):\s*[12][0-9]\b|(margin[a-zA-Z]*|padding[a-zA-Z]*|gap):\s*3[0-2]\b" src/pages src/components
```
This greps for any bare numeric spacing value from 4 to 32 that ISN'T already wrapped in `var(--space-`. Expected: no output, OR only the two intentionally-excluded values documented in this plan (`GlobalSearch.tsx:197`'s `paddingTop: 80` won't match this range-limited pattern anyway since 80 is out of the 4-32 range being checked; `Tasks.tsx`'s `paddingLeft: 38 + (depth * 26)` also won't match since 38 is outside the 4-32 range checked here — if this grep finds anything else, investigate before considering this plan done).

- [ ] **Step 2: Count total token references**

```bash
grep -rc "var(--space-" src/pages src/components | awk -F: '{sum+=$2} END {print sum}'
```
Expected: several hundred (this plan's 197 individual `sed` commands each fire once per matching occurrence in their file — some files repeat the same value 10+ times — and shorthand values produce 2-3 token references per line, so the true total is not 197). This is a sanity check for "not suspiciously low or zero," not an exact target — don't treat a specific number as pass/fail.

- [ ] **Step 3: Build**

```bash
npm run build
```
Expected: `tsc` and `vite build` both complete with no errors.

- [ ] **Step 4: Run the test suite**

```bash
npm test
```
Expected: all existing tests pass.

- [ ] **Step 5: Visual smoke test**

```bash
npm run tauri dev
```
Click through every page touched by this plan: Today, Tasks, Habits, Goals, Analytics, WeeklyReview, CommandCenter, Templates, Calendar, Notes, Inbox, Settings, and a Domain page. Confirm: no visually broken layouts (overlapping text, elements touching edges, collapsed spacing), the sidebar/topbar/tabbar/footerbar chrome still looks correct, and the global search overlay and quick-capture modal still render sensibly.

- [ ] **Step 6: Commit anything found broken** (skip if nothing needed fixing)

```bash
git add -A
git commit -m "polish: fix issues found during spacing scale Phase 2 verification"
```
