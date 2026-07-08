# Visual Depth & Motion Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add layered elevation (multi-shadow depth), subtle surface gradients, and tasteful motion (hover lift, press feedback, list entrance stagger) on top of the already-shipped flat modern theme, so the desktop app reads as premium/"world-class" rather than flat, without changing colors, typography, or layout.

**Architecture:** New `--elevation-*` tokens are added to `tokens.css` and applied directly inside the existing shared component classes (`.card`, `.btn`, `.modal-content`, etc.) that already cascade to every consumer — the same "change it once, it applies everywhere" mechanism the base theme redesign used. The one genuinely reusable cross-component behavior, staggered list entrance, becomes a real opt-in utility class (`.stagger-in`) since it's applied at 3 different page-level call sites; hover-lift and press-feedback turned out, on inspection, to have no case in this app where a card/button *shouldn't* have them, so those live directly in `.card`'s and `.btn`'s own rules rather than as a separate utility nothing opts out of (see Task 2's note).

**Tech Stack:** React 19 + TypeScript, plain CSS custom properties (no CSS-in-JS), Vitest 3 + RTL.

---

## Before you start

Work happens directly on `main` in `C:\Users\isc\Desktop\Projects\Life OS` (a git repo), matching how the base theme redesign was executed — no worktree/branch isolation per prior user preference. Confirm the working tree is clean (`git status`) before starting; if not, stop and ask rather than mixing in unrelated changes.

---

### Task 1: Add elevation and gradient tokens to `src/styles/tokens.css`

**Files:**
- Modify: `src/styles/tokens.css`

- [ ] **Step 1: Append the new tokens after the existing `--shadow-focus-ring` line**

Find this block (inside `:root`):
```css
  --shadow-focus-ring: 0 0 0 3px rgba(124,108,255,0.35);
```
and add these 4 new lines directly after it, still inside `:root`:
```css
  --shadow-focus-ring: 0 0 0 3px rgba(124,108,255,0.35);

  /* Layered elevation — for surfaces that should read as physically raised (cards, panels, modals, toasts).
     Distinct from --shadow-* above, which stays for flat/small elements (badges, inputs, focus rings). */
  --elevation-1: 0 1px 1px rgba(0,0,0,0.3), 0 4px 10px rgba(0,0,0,0.28), 0 12px 24px -8px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04);
  --elevation-2: 0 2px 2px rgba(0,0,0,0.32), 0 8px 20px rgba(0,0,0,0.32), 0 24px 40px -12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05);
  --elevation-3: 0 4px 4px rgba(0,0,0,0.35), 0 16px 32px rgba(0,0,0,0.4), 0 40px 64px -16px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06);
  --elevation-glow: 0 20px 32px -12px rgba(124,108,255,0.18); /* appended to elevation-2 on hover for interactive cards — not a standalone shadow */
  --surface-gradient: linear-gradient(180deg, color-mix(in srgb, var(--color-surface) 96%, white) 0%, var(--color-surface) 100%);
```

- [ ] **Step 2: Verify the file still parses**

```bash
node -e "const css=require('fs').readFileSync('src/styles/tokens.css','utf8'); const open=(css.match(/\{/g)||[]).length; const close=(css.match(/\}/g)||[]).length; if(open!==close) throw new Error('brace mismatch: '+open+' vs '+close); console.log('OK', open, 'rules');"
```
Expected: `OK <N> rules` with no error (N should be one more than before this change if you're checking, since nothing new opens a brace here — the count should be unchanged, just more declarations inside the existing `:root` block. If the count differs from before, you've introduced a stray brace.)

- [ ] **Step 3: Commit**

```bash
git add src/styles/tokens.css
git commit -m "polish: add layered elevation and surface-gradient tokens"
```

---

### Task 2: Add the stagger-entrance utility and checkPop keyframe to `src/styles/globals.css`

**Files:**
- Modify: `src/styles/globals.css`

This task originally also planned standalone `.lift-on-hover`/`.press-feedback` utility classes (per the design spec's "shared elevation/motion utility layer" approach). Reading the actual component set first (Task 3/4 below) found every card-like component always wants hover-lift and every button always wants press-feedback — there's no opt-out case anywhere in this app. A separate utility class nobody opts out of is just indirection, so that behavior is written directly into `.card`/`.habit-card`/`.stat-card`/`.btn` in Tasks 3-4 instead. `.stagger-in` stays a real utility class here because it genuinely is applied selectively — only 3 specific list containers (Task 9), not baked into a shared base class.

- [ ] **Step 1: Add the new keyframe and the `.stagger-in` utility right after the existing `.streak-pulse` rule**

Find this line (in the `ANIMATIONS` section):
```css
.streak-pulse { animation: softPulse 1.4s var(--motion-slow); }
```
and add the following directly after it:
```css
.streak-pulse { animation: softPulse 1.4s var(--motion-slow); }

/* ── DEPTH & MOTION UTILITIES ──────────────────────────────────────────────── */
@keyframes staggerRise {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes checkPop {
  0%   { transform: scale(0.6); opacity: 0; }
  55%  { transform: scale(1.15); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}

.stagger-in > * {
  animation: staggerRise var(--motion-base) both;
}
.stagger-in > *:nth-child(1) { animation-delay: 0ms; }
.stagger-in > *:nth-child(2) { animation-delay: 40ms; }
.stagger-in > *:nth-child(3) { animation-delay: 80ms; }
.stagger-in > *:nth-child(4) { animation-delay: 120ms; }
.stagger-in > *:nth-child(5) { animation-delay: 160ms; }
.stagger-in > *:nth-child(n+6) { animation-delay: 200ms; }
```

Note: `checkPop` is added here (defined once, alongside the other shared keyframes) even though it's only consumed by `.check-pop` in Task 8 — this keeps all keyframe definitions in one place rather than scattering them next to each individual consumer, matching how every other keyframe in this file is organized.

- [ ] **Step 2: Verify the file still parses**

```bash
node -e "const css=require('fs').readFileSync('src/styles/globals.css','utf8'); const open=(css.match(/\{/g)||[]).length; const close=(css.match(/\}/g)||[]).length; if(open!==close) throw new Error('brace mismatch: '+open+' vs '+close); console.log('OK', open, 'rules');"
```
Expected: `OK <N> rules` with no error.

- [ ] **Step 3: Commit**

```bash
git add src/styles/globals.css
git commit -m "polish: add stagger-in entrance utility and checkPop keyframe"
```

---

### Task 3: Apply elevation + gradient to `.card`, `.habit-card`, `.stat-card`

**Files:**
- Modify: `src/styles/globals.css`

- [ ] **Step 1: Update `.card` and `.card:hover`**

Replace:
```css
.card {
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xs);
  transition: border-color var(--motion-base), box-shadow var(--motion-base);
  position: relative;
  overflow: hidden;
}
.card:hover {
  border-color: var(--color-border-strong);
  box-shadow: var(--shadow-sm);
}
```
with:
```css
.card {
  border: 1px solid var(--color-border);
  background: var(--surface-gradient);
  border-radius: var(--radius-lg);
  box-shadow: var(--elevation-1);
  transition: transform var(--motion-base), border-color var(--motion-base), box-shadow var(--motion-base);
  position: relative;
  overflow: hidden;
}
.card:hover {
  border-color: var(--color-border-strong);
  box-shadow: var(--elevation-2), var(--elevation-glow);
  transform: translateY(-2px);
}
```
(The hover-lift `transform: translateY(-2px)` lives directly in `.card:hover` rather than a separate opt-in utility class — every `<div className="card">` in this app should always lift, there's no call site that needs the base styling without the lift, so a standalone toggle would be indirection with no real use. See Task 2's note for the full reasoning.)

- [ ] **Step 2: Update `.habit-card` and `.habit-card:hover`**

Replace:
```css
.habit-card {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 220px;
  gap: 16px;
  padding: 14px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  transition: border-color var(--motion-base), transform var(--motion-base), background var(--motion-base);
}
```
with:
```css
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

Replace:
```css
.habit-card:hover {
  border-color: color-mix(in srgb, var(--domain-primary, var(--color-accent)) 55%, var(--color-border));
  box-shadow: var(--shadow-sm);
}
```
with:
```css
.habit-card:hover {
  border-color: color-mix(in srgb, var(--domain-primary, var(--color-accent)) 55%, var(--color-border));
  box-shadow: var(--elevation-2), var(--elevation-glow);
  transform: translateY(-2px);
}
```

(`.habit-card` keeps its own hand-written hover rule, rather than switching to `.card`'s pattern, because it already has a domain-tinted border-color transition on hover that `.card` doesn't — this is a deliberate difference, not an inconsistency to fix.)

- [ ] **Step 3: Update `.stat-card` and `.stat-card:hover`**

Replace:
```css
.stat-card {
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 74px;
  gap: 4px;
  text-align: center;
  transition: border-color var(--motion-base), box-shadow var(--motion-base);
}
.stat-card:hover {
  border-color: var(--color-border-strong);
  box-shadow: var(--shadow-sm);
}
```
with:
```css
.stat-card {
  border: 1px solid var(--color-border);
  background: var(--surface-gradient);
  border-radius: var(--radius-lg);
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 74px;
  gap: 4px;
  text-align: center;
  box-shadow: var(--elevation-1);
  transition: transform var(--motion-base), border-color var(--motion-base), box-shadow var(--motion-base);
}
.stat-card:hover {
  border-color: var(--color-border-strong);
  box-shadow: var(--elevation-2);
  transform: translateY(-2px);
}
```
(`.stat-card` gets the lift and elevation-2 on hover but NOT `--elevation-glow` — stat cards aren't usually clickable/interactive the way task/habit cards are, so the accent glow would suggest an affordance that isn't there. Plain elevation increase is enough to signal "this responded to your cursor" without implying it's a button.)

- [ ] **Step 4: Verify the file still parses**

```bash
node -e "const css=require('fs').readFileSync('src/styles/globals.css','utf8'); const open=(css.match(/\{/g)||[]).length; const close=(css.match(/\}/g)||[]).length; if(open!==close) throw new Error('brace mismatch: '+open+' vs '+close); console.log('OK', open, 'rules');"
```

- [ ] **Step 5: Commit**

```bash
git add src/styles/globals.css
git commit -m "polish: apply layered elevation, gradient fill, and hover lift to card/habit-card/stat-card"
```

- [ ] **Step 6 (review-driven fix): stop `.card`'s nested-card shadow clipping and fix sibling shadow occlusion**

Code review of this task found two real problems the original spec didn't anticipate, both because the old near-invisible `--shadow-xs` never made them noticeable:

1. **`.card` has `overflow: hidden`** (needed so `.card-header`'s square corners don't poke past the parent's rounded corners) — but this also clips the box-shadow of anything *nested inside* a `.card` on hover, including the elevation-2 + glow this task just added. This app nests `.card`/`.habit-card` inside another `.card`'s `.card-body` constantly (`Settings.tsx` — Safety Status, Domain Profiles, and several other panels; `Analytics.tsx`'s Domain Breakdown; every single `HabitCard` in `Habits.tsx`, since each domain wrapper is a `.card`). The fix is the standard pattern for this: give `.card-header` its own top-corner radius so it no longer needs the parent's `overflow: hidden` to look right, then drop `overflow: hidden` from `.card` entirely.
2. **Sibling cards in a grid can occlude each other's hover glow** — a lifted card's shadow paints at the same stacking level as later-DOM-order siblings, so the glow gets silently cut off toward one side. Fix: bump `z-index` on hover so a lifted card paints above its neighbors.

Find:
```css
.card {
  border: 1px solid var(--color-border);
  background: var(--surface-gradient);
  border-radius: var(--radius-lg);
  box-shadow: var(--elevation-1);
  transition: transform var(--motion-base), border-color var(--motion-base), box-shadow var(--motion-base);
  position: relative;
  overflow: hidden;
}
.card:hover {
  border-color: var(--color-border-strong);
  box-shadow: var(--elevation-2), var(--elevation-glow);
  transform: translateY(-2px);
}
.card-header {
  min-height: 40px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
```
Replace with:
```css
.card {
  border: 1px solid var(--color-border);
  background: var(--surface-gradient);
  border-radius: var(--radius-lg);
  box-shadow: var(--elevation-1);
  transition: transform var(--motion-base), border-color var(--motion-base), box-shadow var(--motion-base);
  position: relative;
}
.card:hover {
  border-color: var(--color-border-strong);
  box-shadow: var(--elevation-2), var(--elevation-glow);
  transform: translateY(-2px);
  z-index: 1;
}
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
```

Also add `z-index: 1;` to `.habit-card:hover` (right after its `transform: translateY(-2px);` line), and add `position: relative;` to the `.stat-card` base rule plus `z-index: 1;` to `.stat-card:hover` (both needed together — `z-index` has no effect without `position` being something other than `static`, and `.stat-card` didn't have a `position` declared at all before this fix).

Run the brace-balance check again after these edits, then commit:
```bash
git add src/styles/globals.css
git commit -m "polish: fix nested-card shadow clipping and sibling shadow occlusion on hover"
```

This was applied directly (not dispatched as a separate subagent task) since it's a small, well-understood, low-risk CSS fix to a problem the code-quality review just found — see the plan's git history for the actual commit. Task 10's visual smoke test should specifically check a few of the ~103 `.card` usages across the app (not just the ones named above) to confirm nothing else relied on the removed `overflow: hidden` for corner-clipping content other than `.card-header`.

---

### Task 4: Add press feedback and glow to buttons

**Files:**
- Modify: `src/styles/globals.css`

- [ ] **Step 1: Add press feedback to the base `.btn`**

Replace:
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
  transition: border-color var(--motion-fast), color var(--motion-fast), background-color var(--motion-fast), box-shadow var(--motion-fast);
  min-height: calc(34px * var(--panel-scale));
}
.btn:hover:not(:disabled) {
  border-color: var(--color-border-strong);
  color: var(--color-text);
  background: var(--color-surface-hover);
}
.btn:active:not(:disabled) {
  background: var(--color-surface-elevated);
}
```
with:
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
```

(Same reasoning as Task 3's `.card` — every button in this app should feel pressable, so the scale-down on `:active` belongs directly on the base `.btn` class rather than a separate opt-in utility nothing would opt out of.)

- [ ] **Step 2: Add a glow to `.btn-primary` hover**

Replace:
```css
.btn-primary {
  border-color: var(--color-accent);
  color: #fff;
  background: var(--color-accent);
}
.btn-primary:hover:not(:disabled) {
  border-color: var(--color-accent-hover);
  background: var(--color-accent-hover);
  color: #fff;
}
```
with:
```css
.btn-primary {
  border-color: var(--color-accent);
  color: #fff;
  background: var(--color-accent);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.12);
}
.btn-primary:hover:not(:disabled) {
  border-color: var(--color-accent-hover);
  background: var(--color-accent-hover);
  color: #fff;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.16), 0 4px 12px rgba(124,108,255,0.25);
}
```

- [ ] **Step 3: Verify the file still parses**

```bash
node -e "const css=require('fs').readFileSync('src/styles/globals.css','utf8'); const open=(css.match(/\{/g)||[]).length; const close=(css.match(/\}/g)||[]).length; if(open!==close) throw new Error('brace mismatch: '+open+' vs '+close); console.log('OK', open, 'rules');"
```

- [ ] **Step 4: Commit**

```bash
git add src/styles/globals.css
git commit -m "polish: add press feedback and accent glow to buttons"
```

---

### Task 5: Elevate modal and toasts

**Files:**
- Modify: `src/styles/globals.css`

- [ ] **Step 1: `.modal-content` → `--elevation-3`**

Replace:
```css
.modal-content {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  padding: 0;
  min-width: min(440px, 100%);
  max-width: min(580px, 100%);
  width: 100%;
  max-height: 80vh;
  overflow-y: auto;
  animation: modalEnter var(--motion-base) both;
  margin: auto;
}
```
with:
```css
.modal-content {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--elevation-3);
  padding: 0;
  min-width: min(440px, 100%);
  max-width: min(580px, 100%);
  width: 100%;
  max-height: 80vh;
  overflow-y: auto;
  animation: modalEnter var(--motion-base) both;
  margin: auto;
}
```

- [ ] **Step 1b (review-driven fix, from Task 4): give `.modal-body` extra bottom clearance so a primary button's hover glow doesn't get clipped**

Code review of Task 4 found that `.modal-content`'s `overflow-y: auto` clips a `.btn-primary`'s new hover glow (added in Task 4) whenever the button sits near the bottom of a modal — which is exactly where "Create"/"Save" primary CTAs in this app's forms live (`TaskForm.tsx`, `Goals.tsx`, `Habits.tsx`, and others render their primary submit button as the last item in a modal form). `.modal-body`'s existing bottom padding (10px, from `--panel-padding`) is thinner than the glow's blur extent (~16px), so the outer edge of the glow gets cut off. Since this task is already touching `.modal-content`, fix it here rather than as a separate pass.

Find:
```css
.modal-body { padding: var(--panel-padding); }
```
Replace with:
```css
.modal-body { padding: var(--panel-padding); padding-bottom: 20px; }
```

(Overrides just the bottom side on top of the shared `--panel-padding` shorthand — deliberately not changing `--panel-padding` itself, since that token is used broadly across cards/panels where this extra clearance isn't needed.)

- [ ] **Step 2: `.achievement-toast` → `--elevation-2`**

Replace:
```css
.achievement-toast {
  position: relative;
  display: flex;
  gap: 14px;
  align-items: stretch;
  padding: 12px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  background: var(--color-surface);
}
```
with:
```css
.achievement-toast {
  position: relative;
  display: flex;
  gap: 14px;
  align-items: stretch;
  padding: 12px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--elevation-2);
  background: var(--color-surface);
}
```

- [ ] **Step 3: `.undo-toast` → `--elevation-2`**

Replace:
```css
.undo-toast {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
  border: 1px solid var(--color-warning);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-md);
  pointer-events: auto;
}
```
with:
```css
.undo-toast {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
  border: 1px solid var(--color-warning);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--elevation-2);
  pointer-events: auto;
}
```

- [x] **Step 4 (superseded — see the correction below before doing anything): Give the achievement toast's entrance a slight lift, not just a horizontal slide**

This step as originally written asked to add `translateY(4px→0)` to `@keyframes toastIn` (the wrapper's animation), reasoning that `.achievement-toast-wrap` had no vertical component while `.undo-toast` did via `.fade-in`. That reasoning missed something: `AchievementToast.tsx`'s inner `<div className="achievement-toast fade-in">` **already** carries `.fade-in` (the `bootIn` keyframe, its own independent `translateY(4px)→0`) — it was there before this plan started, unrelated to toasts specifically. Adding a second, differently-timed `translateY` on the wrapper on top of that stacks two nested transforms with different durations (180ms wrap vs. 120ms inner), producing an ~8px double-lift that settles in two uneven stages instead of one coherent motion — the opposite of "match `.undo-toast`'s single lift."

**Do not add `translateY` to `toastIn`.** `.achievement-toast-wrap` doesn't need one — the inner element's pre-existing `.fade-in` already provides the lift, exactly like `.undo-toast-stack` (which also has no entrance animation of its own; only its inner `.undo-toast` element does). `toastIn` stays exactly as it already is:
```css
@keyframes toastIn {
  from { transform: translateX(120%); opacity: 0; }
  to   { transform: translateX(0);    opacity: 1; }
}
```
No edit needed for this step — confirm the file already matches the above (it does, unchanged since before this task) and move on to Step 5.

(This was caught and fixed during Task 5's code review, when `.modal-content`/`.achievement-toast`/`.undo-toast` were already being touched — since fixing it required *not* making a change rather than making one, the correction is this doc update, not a separate code diff. `AchievementToast` is currently unmounted anywhere in the app — `pendingUnlocks`/`dismissUnlock` wiring exists in `useAppStore` but no page renders `<AchievementToast />` — so this had zero live user-facing impact, but is worth having correct in the CSS now rather than whenever someone wires the component up later.)

- [ ] **Step 5: Verify the file still parses**

```bash
node -e "const css=require('fs').readFileSync('src/styles/globals.css','utf8'); const open=(css.match(/\{/g)||[]).length; const close=(css.match(/\}/g)||[]).length; if(open!==close) throw new Error('brace mismatch: '+open+' vs '+close); console.log('OK', open, 'rules');"
```

- [ ] **Step 6: Commit**

```bash
git add src/styles/globals.css
git commit -m "polish: elevate modal to the highest layer, toasts to elevation-2, add lift to achievement toast entrance, fix modal-body glow clipping"
```

---

### Task 6: Add subtle background ambiance to the main content area

**Files:**
- Modify: `src/styles/globals.css`

- [ ] **Step 1: Add a faint radial glow to `.app-main`**

Find:
```css
.app-main {
  background: var(--color-bg);
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
  min-height: 0;
  contain: paint;
}
```
Replace with:
```css
.app-main {
  background:
    radial-gradient(ellipse 1200px 600px at 50% -10%, rgba(124,108,255,0.06), transparent 70%),
    var(--color-bg);
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
  min-height: 0;
  contain: paint;
}
```

This is deliberately subtle per the approved design (§3.4 of `docs/superpowers/specs/2026-07-08-visual-depth-polish-design.md`) — it should register as "this doesn't feel flat" without being consciously noticeable. If it reads as too strong once running the app, lower `0.06` to `0.04`; if too weak, raise to `0.08` — don't change the shape/position, just the opacity, and re-verify visually (Task 10, Step 5) after any adjustment.

- [ ] **Step 2: Verify the file still parses**

```bash
node -e "const css=require('fs').readFileSync('src/styles/globals.css','utf8'); const open=(css.match(/\{/g)||[]).length; const close=(css.match(/\}/g)||[]).length; if(open!==close) throw new Error('brace mismatch: '+open+' vs '+close); console.log('OK', open, 'rules');"
```

- [ ] **Step 3: Commit**

```bash
git add src/styles/globals.css
git commit -m "polish: add subtle ambient accent glow to main content background"
```

---

### Task 7: Add a soft glow behind the active sidebar nav item

**Files:**
- Modify: `src/styles/globals.css`

- [ ] **Step 1: Update `.nav-item.active`**

Replace:
```css
.nav-item.active {
  color: var(--color-accent);
  background: var(--color-accent-muted);
  box-shadow: inset 2px 0 0 var(--color-accent);
  font-weight: 600;
}
```
with:
```css
.nav-item.active {
  color: var(--color-accent);
  background: var(--color-accent-muted);
  box-shadow: inset 2px 0 0 var(--color-accent), 0 0 16px -4px rgba(124,108,255,0.35);
  font-weight: 600;
}
```

- [ ] **Step 2: Verify the file still parses**

```bash
node -e "const css=require('fs').readFileSync('src/styles/globals.css','utf8'); const open=(css.match(/\{/g)||[]).length; const close=(css.match(/\}/g)||[]).length; if(open!==close) throw new Error('brace mismatch: '+open+' vs '+close); console.log('OK', open, 'rules');"
```

- [ ] **Step 3: Commit**

```bash
git add src/styles/globals.css
git commit -m "polish: add soft glow behind active sidebar nav item"
```

- [ ] **Step 4 (review-driven fix): tighten the glow so it can't bleed into adjacent rows, and make it respect domain color**

Code review found two real problems with Step 1's value once actually measured against the sidebar's real layout: (1) `Sidebar.tsx` stacks `.nav-item` rows with zero gap (`display: flex; flex-direction: column`, no `gap`, no margin) and `--row-height` is only 34px — `0 0 16px -4px` reaches ~12px beyond the element's edge (blur minus spread), which is over a third of a zero-gap row's height, so the glow visibly bleeds into whichever row sits above/below the active one. Since exactly one nav item is always active whenever the app is open, this isn't a transient hover state like Tasks 3/5's bugs — it's the sidebar's permanent resting state. (2) The glow hardcodes a generic purple regardless of domain, even though `tokens.css` already defines a per-domain `--domain-glow` token (set via the `[data-domain]` attribute `Sidebar.tsx` already puts directly on each domain nav row's `<button>`) that was never actually consumed anywhere — using it here makes an active Military/Self domain row's glow match its own gold/green accent bar instead of clashing with an unrelated purple.

Find:
```css
.nav-item.active {
  color: var(--color-accent);
  background: var(--color-accent-muted);
  box-shadow: inset 2px 0 0 var(--color-accent), 0 0 16px -4px rgba(124,108,255,0.35);
  font-weight: 600;
}
```
Replace with:
```css
.nav-item.active {
  color: var(--color-accent);
  background: var(--color-accent-muted);
  box-shadow: inset 2px 0 0 var(--color-accent), 0 0 8px -5px var(--domain-glow, rgba(124,108,255,0.35));
  font-weight: 600;
}
```

`0 0 8px -5px` reaches only 3px beyond the element's edge (blur 8px minus spread 5px) — small enough to read as a soft edge on the active row without visibly touching a zero-gap neighbor. `var(--domain-glow, rgba(124,108,255,0.35))` resolves to the domain-specific glow color on rows that have `data-domain` set (the domain nav rows), and falls back to the generic accent purple everywhere else (the primary/support nav items, which have no domain).

Run the brace-balance check again, then commit:
```bash
git add src/styles/globals.css
git commit -m "polish: tighten nav-item glow to prevent row bleed, make it respect domain color"
```

---

### Task 8: Give task/habit completion a real "pop" instead of a generic fade-in

**Files:**
- Modify: `src/styles/globals.css`

Investigation for this plan found `.check-pop` already uses the token-based motion system (`var(--motion-fast)`), but it reuses the generic `bootIn` fade+rise keyframe — the same one used for boot-screen list items and page entrances. It doesn't actually read as a "pop" on task/habit completion. `checkPop` (a scale-based bounce keyframe) was already added to `globals.css` in Task 2 for exactly this — this task just points `.check-pop` at it.

The design spec (§3.3) also flagged `LevelUpCeremony` and an "XP-float" moment as possibly having pre-token-system ad-hoc timing. Both were checked while writing this plan: `LevelUpCeremony.tsx`'s enter/exit transition already uses `var(--motion-slow)` for a scale+fade (fixed directly during the base theme redesign, not left over from before it), and no "XP-float" component/class exists anywhere in the codebase to fix — it was never implemented as a separate feature. Neither needs a task here; `.check-pop` above was the only real gap in that part of the spec.

- [ ] **Step 1: Update `.check-pop`**

Find:
```css
.check-pop    { animation: bootIn var(--motion-fast) both; }
```
Replace with:
```css
.check-pop    { animation: checkPop var(--motion-base) both; }
```

(Uses `--motion-base`, not `--motion-fast` — the scale bounce in `checkPop` needs slightly more time to read clearly than the simple fade `bootIn` did; `--motion-fast` would make it feel clipped.)

- [ ] **Step 2: Verify the file still parses**

```bash
node -e "const css=require('fs').readFileSync('src/styles/globals.css','utf8'); const open=(css.match(/\{/g)||[]).length; const close=(css.match(/\}/g)||[]).length; if(open!==close) throw new Error('brace mismatch: '+open+' vs '+close); console.log('OK', open, 'rules');"
```

- [ ] **Step 3: Commit**

```bash
git add src/styles/globals.css
git commit -m "polish: give task/habit completion a real scale-pop instead of a generic fade-in"
```

---

### Task 9: Wire `.stagger-in` onto the three main list views

**Files:**
- Modify: `src/pages/Today.tsx`
- Modify: `src/pages/Tasks.tsx`
- Modify: `src/pages/Habits.tsx`

Each list is already keyed by a stable id (`key={task.id}` / `key={habit.id}`), so React's reconciliation won't remount existing rows on every re-render — only genuinely new rows (or the container's first mount) trigger the `staggerRise` entrance animation. This was verified by reading each file before writing this task; do not add `.stagger-in` to a list that isn't stably keyed without re-checking this assumption first.

- [ ] **Step 1: `src/pages/Today.tsx`** — wrap the Focus Board task list in a `.stagger-in` container. The empty-state branch of the ternary is untouched; only the `.map()` branch gets wrapped, and none of the inner row content changes.

Replace:
```tsx
              ) : boardTasks.map((task) => {
                const goal = task.goal_id ? goals.find((item) => item.id === task.goal_id) : null;
                const topThreeLimitReached = !task.is_top_three && topThreeTasks.length >= 3;
                return (
                  <div key={task.id} data-domain={task.domain_id} className="task-row" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderTop: '1px solid var(--color-surface-hover)', minHeight: 56 }}>
                    <CompletionButton done={false} onComplete={async () => { await handleCompleteTask(task); }} size={15} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, color: 'var(--color-accent)' }}>{task.title}</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                        <span className={`priority-badge-${task.priority}`}>{task.priority}</span>
                        <span style={{ fontSize: 11, color: task.energy_level === 'deep' ? 'var(--color-warning)' : task.energy_level === 'light' ? 'var(--color-info)' : 'var(--color-text-muted)', border: '1px solid var(--color-border)', padding: '1px 5px', letterSpacing: 1, textTransform: 'uppercase' }}>{task.energy_level}</span>
                        <span style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>{formatMinutes(taskEstimatedMinutes(task))}</span>
                        {getTaskRecurrenceLabel(task) && <span style={{ fontSize: 11, color: 'var(--color-info)', textTransform: 'uppercase', letterSpacing: 1 }}>{getTaskRecurrenceLabel(task)}</span>}
                        {goal && <span style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>GOAL: {goal.title}</span>}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                        {taskReasons(task, today).map((reason) => (
                          <span key={`${task.id}-${reason.label}`} style={chipStyle(reason.tone)}>{reason.label}</span>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                        <button className="btn btn-primary btn-sm" onClick={() => handleFocus(task).catch(console.error)}>FOCUS</button>
                        {!task.is_mit && <button className="btn btn-ghost btn-sm" onClick={() => handleSetMit(task.id).catch(console.error)}>MAKE MIT</button>}
                        <button className="btn btn-ghost btn-sm" disabled={topThreeLimitReached} style={task.is_top_three ? { color: 'var(--color-warning)', borderColor: 'var(--color-warning)' } : undefined} onClick={() => handleToggleTopThree(task).catch(console.error)}>{task.is_top_three ? 'REMOVE TOP 3' : 'ADD TOP 3'}</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => handlePlanTask(task, tomorrow).catch(console.error)}>TOMORROW</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => requestTaskBlocked(task)}>BLOCKED</button>
                      </div>
                    </div>
                  </div>
                );
              })}
```
with:
```tsx
              ) : (
                <div className="stagger-in">
                  {boardTasks.map((task) => {
                const goal = task.goal_id ? goals.find((item) => item.id === task.goal_id) : null;
                const topThreeLimitReached = !task.is_top_three && topThreeTasks.length >= 3;
                return (
                  <div key={task.id} data-domain={task.domain_id} className="task-row" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderTop: '1px solid var(--color-surface-hover)', minHeight: 56 }}>
                    <CompletionButton done={false} onComplete={async () => { await handleCompleteTask(task); }} size={15} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, color: 'var(--color-accent)' }}>{task.title}</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                        <span className={`priority-badge-${task.priority}`}>{task.priority}</span>
                        <span style={{ fontSize: 11, color: task.energy_level === 'deep' ? 'var(--color-warning)' : task.energy_level === 'light' ? 'var(--color-info)' : 'var(--color-text-muted)', border: '1px solid var(--color-border)', padding: '1px 5px', letterSpacing: 1, textTransform: 'uppercase' }}>{task.energy_level}</span>
                        <span style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>{formatMinutes(taskEstimatedMinutes(task))}</span>
                        {getTaskRecurrenceLabel(task) && <span style={{ fontSize: 11, color: 'var(--color-info)', textTransform: 'uppercase', letterSpacing: 1 }}>{getTaskRecurrenceLabel(task)}</span>}
                        {goal && <span style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>GOAL: {goal.title}</span>}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                        {taskReasons(task, today).map((reason) => (
                          <span key={`${task.id}-${reason.label}`} style={chipStyle(reason.tone)}>{reason.label}</span>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                        <button className="btn btn-primary btn-sm" onClick={() => handleFocus(task).catch(console.error)}>FOCUS</button>
                        {!task.is_mit && <button className="btn btn-ghost btn-sm" onClick={() => handleSetMit(task.id).catch(console.error)}>MAKE MIT</button>}
                        <button className="btn btn-ghost btn-sm" disabled={topThreeLimitReached} style={task.is_top_three ? { color: 'var(--color-warning)', borderColor: 'var(--color-warning)' } : undefined} onClick={() => handleToggleTopThree(task).catch(console.error)}>{task.is_top_three ? 'REMOVE TOP 3' : 'ADD TOP 3'}</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => handlePlanTask(task, tomorrow).catch(console.error)}>TOMORROW</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => requestTaskBlocked(task)}>BLOCKED</button>
                      </div>
                    </div>
                  </div>
                );
              })}
                </div>
              )}
```

Note the inner content is deliberately left at its original indentation (not re-indented to account for the new wrapping `<div>`) — this is a surgical wrap, not a reformat. JSX doesn't require consistent indentation to be correct. If you want to run a formatter over this block afterward that's fine, but it's not required and shouldn't be treated as part of this step.

- [ ] **Step 2: `src/pages/Tasks.tsx`** — the task list here already has its own dedicated wrapper `<div>` with no className, so this is a one-line change.

Replace:
```tsx
          <div>
            {openRootTasks.map((task) => renderTaskRow(task))}
```
with:
```tsx
          <div className="stagger-in">
            {openRootTasks.map((task) => renderTaskRow(task))}
```

- [ ] **Step 3: `src/pages/Habits.tsx`** — append `stagger-in` to the existing `card-body habit-domain-list` wrapper.

Replace:
```tsx
                <div className="card-body habit-domain-list">
                  {domainHabits.map((habit) => (
```
with:
```tsx
                <div className="card-body habit-domain-list stagger-in">
                  {domainHabits.map((habit) => (
```

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit -p tsconfig.json
```
Expected: no errors (these are pure JSX/className edits, no logic changed).

- [ ] **Step 5: Commit**

```bash
git add src/pages/Today.tsx src/pages/Tasks.tsx src/pages/Habits.tsx
git commit -m "polish: stagger task/habit list entrance on Today, Tasks, and Habits pages"
```

---

### Task 10: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Typecheck**

```bash
npx tsc --noEmit -p tsconfig.json
```
Expected: no errors.

- [ ] **Step 2: Run the full test suite**

```bash
npm test
```
Expected: all 10 suites / 136 tests pass, same as before this plan started (this plan touches no logic, only CSS and className/JSX-structure — if a test fails, something went wrong with a wrap/edit, not the intended change).

- [ ] **Step 3: Confirm every new token/utility is actually referenced somewhere**

```bash
grep -c "var(--elevation-1)\|var(--elevation-2)\|var(--elevation-3)\|var(--elevation-glow)\|var(--surface-gradient)" src/styles/globals.css
grep -n "stagger-in" src/pages/Today.tsx src/pages/Tasks.tsx src/pages/Habits.tsx
grep -n "checkPop" src/styles/globals.css
```
Expected: the first command returns a count of at least 8 (one or more references per `.card`/`.habit-card`/`.stat-card`/`.modal-content`/`.achievement-toast`/`.undo-toast`/`.nav-item.active`... actually `.nav-item.active` doesn't use an elevation token, so expect roughly 8-10), the second shows 3 matches (one per file), the third shows 2 matches (the `@keyframes checkPop` definition plus the `.check-pop` rule that now references it).

- [ ] **Step 4: Production build check**

```bash
npx vite build 2>&1 | tail -15
```
Expected: build succeeds. This exercises the full Tailwind/PostCSS pipeline against every CSS change in this plan at once.

- [ ] **Step 5: Visual smoke test**

Start the dev server and check in a browser:
```bash
npm run dev
```
Walk through: Today page (hover a task card in the Focus Board — confirm it lifts with a visible accent-tinted shadow, and that the board's rows cascade in on page load/refresh), Tasks page (same stagger check), Habits page (same), any modal (confirm it feels "on top" of everything — heaviest shadow in the app), the achievement toast and undo toast if you can trigger them (confirm elevated appearance), completing a task or habit (confirm the checkmark now pops with a visible scale-bounce, not just a fade), the sidebar (confirm the active nav item has a soft glow, not just the flat left bar), and the general background (confirm the faint top-of-viewport glow is present but genuinely subtle — if it's either invisible or distractingly obvious, adjust the `0.06` opacity value from Task 6 and re-check).

Also specifically check for jank: open the Tasks page with a realistically long list (50+ items, create test data if needed) and hover rapidly across several cards in a row — per the design spec's risk note (§5), layered `box-shadow` transitions are more expensive to paint than a single shadow. If you see visible stutter, the fix is to add `will-change: transform, box-shadow;` to `.card`/`.habit-card`/`.stat-card` (not included by default in this plan since it has its own tradeoffs — extra GPU memory per layer — and shouldn't be added speculatively without confirming it's actually needed).

Also specifically check for corner-clipping regressions from Task 3's Step 6 fix (removing `overflow: hidden` from `.card`): visit Settings (Safety Status, Domain Profiles panels), Analytics (Domain Breakdown), and Habits (any domain's habit list) — these are the confirmed nested-card locations. Look for any child content whose square corners now visibly poke past a `.card`'s rounded corners (content other than `.card-header`, which was explicitly fixed). If you find one, give that specific child element its own matching `border-radius` the same way `.card-header` was fixed, rather than re-adding `overflow: hidden` to `.card` (which would silently reintroduce the shadow-clipping bug this fix just closed).

- [ ] **Step 6: Fix anything found in Step 5, then re-verify**

If any visual issue or jank is found, fix it directly (adjust the specific value, don't introduce new mechanisms), re-run Steps 1-4, and commit the fix with a message describing what was adjusted and why.

- [ ] **Step 7: Final commit** (only if Step 6 found something to fix; skip if verification was clean)

```bash
git add -A
git commit -m "polish: fix issues found during final verification"
```
