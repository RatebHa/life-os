# Life OS — Visual Depth & Motion Polish

Status: Approved (brainstorming), pending implementation plan.
Scope: Desktop app (`Life OS/`) first; mobile (`life-os-mobile/`) as a follow-up port once desktop ships, mirroring the sequencing of the base theme redesign this builds on.

## 1. Why

The base theme redesign (see `docs/superpowers/specs/2026-07-05-theme-redesign-design.md`) replaced the Pip-Boy CRT aesthetic with a clean, modern look — but it landed conservatively flat: one surface color, a 1px border, and a shadow scale that's barely visible except on modals. The user's explicit goal now is a step beyond "clean" toward **"world-class" — an app people keep opening because the UI itself feels good to use**, on par with apps like Linear, Notion, and Arc. This spec adds depth (layered shadows, subtle gradients) and motion (hover lift, press feedback, list entrance, refined transition timing) without changing the underlying color palette, typography, or layout established in the base redesign.

## 2. Validated direction

Confirmed via a live visual comparison (three real task-card mockups using the app's actual colors, shown in-browser): the user chose **"B" — refined, subtle depth in the style of Linear/Notion** over both the current flat baseline and a bolder/more dramatic "tactile" treatment with springier motion and stronger glow. This is the governing aesthetic constraint for everything below: restrained, not flashy. Motion should be "rich but tasteful" (confirmed) — real hover lift, press feedback, staggered list entrance, and refined completion/transition moments, but not spring-physics bounce or ambient/parallax effects (that tier was explicitly declined).

## 3. Design

### 3.1 Elevation system (layered shadows + subtle gradient)

Today, `tokens.css` has a flat shadow scale (`--shadow-xs` through `--shadow-lg`, each a single `box-shadow` value) used uniformly regardless of whether an element is meant to read as "raised." This introduces a **new, additional** set of tokens specifically for surfaces that should feel physically raised — cards, panels, modals, dropdowns, toasts. The existing `--shadow-*` scale is kept as-is for small/flat elements (badges, inputs, focus rings) — this is additive, not a replacement.

```css
--elevation-1: 0 1px 1px rgba(0,0,0,0.3), 0 4px 10px rgba(0,0,0,0.28), 0 12px 24px -8px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04);
--elevation-2: 0 2px 2px rgba(0,0,0,0.32), 0 8px 20px rgba(0,0,0,0.32), 0 24px 40px -12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05);
--elevation-3: 0 4px 4px rgba(0,0,0,0.35), 0 16px 32px rgba(0,0,0,0.4), 0 40px 64px -16px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06);
--elevation-glow: 0 20px 32px -12px rgba(124,108,255,0.18); /* appended to elevation-2 on hover for interactive cards */

--surface-gradient: linear-gradient(180deg, color-mix(in srgb, var(--color-surface) 96%, white) 0%, var(--color-surface) 100%);
```

`--elevation-1` = resting state for cards/panels. `--elevation-2` = hover state (cards) or the resting state for toasts/popovers. `--elevation-3` = modals only (the single highest layer in the app, reserved so it always reads as "on top of everything"). This mirrors exactly what was validated in the "B" mockup — nothing new is being invented here, it's the validated CSS made systemic.

### 3.2 Motion utilities (shared, reusable — not hand-tuned per component)

Per the approved "shared elevation/motion utility layer" approach, three new CSS utility classes live in `globals.css` and get applied via `className` wherever needed, rather than duplicating hover/transition logic inside every component's own rule:

```css
.lift-on-hover {
  transition: transform var(--motion-base), box-shadow var(--motion-base), border-color var(--motion-base);
}
.lift-on-hover:hover { transform: translateY(-2px); }

.press-feedback { transition: transform var(--motion-fast); }
.press-feedback:active { transform: scale(0.97); }

.stagger-in > * { animation: staggerRise var(--motion-base) both; }
.stagger-in > *:nth-child(1) { animation-delay: 0ms; }
.stagger-in > *:nth-child(2) { animation-delay: 40ms; }
.stagger-in > *:nth-child(3) { animation-delay: 80ms; }
.stagger-in > *:nth-child(4) { animation-delay: 120ms; }
.stagger-in > *:nth-child(5) { animation-delay: 160ms; }
.stagger-in > *:nth-child(n+6) { animation-delay: 200ms; } /* cap further items at the same delay so long lists don't take forever to finish appearing */

@keyframes staggerRise {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

`.stagger-in` is applied to the *container* of a list (e.g., the task list wrapper on Today/Tasks pages, the habit list wrapper on Habits) — each direct child gets the staggered entrance automatically via the `nth-child` delays, no per-item JS needed.

### 3.3 Component-level application

| Component | Change |
|---|---|
| `.card`, `.habit-card`, `.stat-card` | `--elevation-1` at rest, `--surface-gradient` fill instead of flat color, `.lift-on-hover` → `--elevation-2` + `--elevation-glow` combined on hover |
| `.btn`, especially `.btn-primary` | `.press-feedback`, hover gets a soft accent-tinted glow (`box-shadow: 0 4px 12px rgba(124,108,255,0.25)`) instead of just a border/background swap, plus a subtle inset top-highlight (`inset 0 1px 0 rgba(255,255,255,0.08)`) for a touch of glassy dimensionality |
| `.modal-content` | `--elevation-3` (the one place in the app that uses it — keeps the "this is on top of everything" signal meaningful) |
| `.achievement-toast`, `.undo-toast` | `--elevation-2`, entrance animation gets a slight lift (`translateY` in addition to the existing slide-in) |
| Task/habit list containers (Today, Tasks, Habits pages) | Wrapped in `.stagger-in` so rows cascade in on page load/filter change instead of appearing all at once |
| `CompletionButton` check-pop, `LevelUpCeremony`, XP-float | Motion curves/timing reviewed and adjusted to use `var(--motion-base)`/`var(--motion-slow)` with the existing `cubic-bezier(0.4,0,0.2,1)` easing consistently (some of these were set before the base redesign's motion tokens existed and may still have ad-hoc timing values) — no new visual redesign of these moments, just a timing/easing consistency pass so they feel as considered as everything else |
| `.nav-item.active` (sidebar) | Add a soft background glow behind the existing left accent bar, rather than just the flat bar alone |

### 3.4 Background ambiance

A very faint radial accent-tinted glow (`radial-gradient(ellipse 1200px 600px at 50% -10%, rgba(124,108,255,0.06), transparent 70%)`) anchored near the top of the viewport, applied once to `.app-shell` or `.app-main`, fading to the flat `--color-bg` within the first ~400px of scroll. This is deliberately subtle — barely perceptible at a glance, the kind of detail that registers as "this doesn't feel flat" without anyone being able to point at exactly why. Approved by the user via description (not a separate mockup) — if it reads as too strong or too weak once built, it's a one-line opacity tweak, not a structural change.

### 3.5 Explicitly out of scope

- **Chart (Recharts) visual polish** — gradient fills, smoother animated transitions, better tooltips. Natural phase-2 work, not part of this pass.
- **Icon-chip treatment** — icons in soft-shadowed rounded containers (sidebar domain icons, page headers). Also natural phase-2 work.
- **Spring-physics bounce, parallax, ambient particle effects** — explicitly declined in favor of the restrained Linear/Notion direction (§2).
- **Any color palette, typography, or layout change** — this pass is purely depth/motion on top of the already-approved base redesign; not revisiting colors or type.
- **Sound/haptics** — not applicable to a desktop app in this context.

## 4. Rollout order

Desktop first (all of §3 above, applied through the shared token/utility layer so it cascades to every consumer automatically, same mechanism as the base redesign). Mobile port follows once desktop ships and is verified, translating the elevation/motion system into Flutter `BoxShadow`/`AnimatedContainer`/implicit-animation equivalents — exact mapping to be worked out in the mobile implementation plan, not this spec.

## 5. Risks / things to verify during implementation

- Layered `box-shadow` values are more expensive to paint than a single shadow, especially during `.lift-on-hover` transitions on many simultaneously-visible cards (e.g., a long task list). Verify no jank on a realistic-sized list (50+ items) before calling this done — this is exactly the scenario `CLAUDE.md` already calls out virtual scrolling for.
- `.stagger-in`'s `nth-child` delay approach only works cleanly on a **static** list render; if a list re-renders on every state change (e.g., a filter toggle causing React to re-mount rows), the stagger will unintentionally replay on every render. Needs a quick check against how the existing task/habit list components are keyed before wiring this up broadly.
- `color-mix()` (used in `--surface-gradient`) is already used elsewhere in `tokens.css`/`globals.css` from the base redesign, so no new browser-support risk is introduced.
