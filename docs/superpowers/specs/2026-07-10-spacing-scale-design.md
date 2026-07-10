# Life OS — Consistent Spacing Scale

Status: Approved (brainstorming), pending implementation plan.
Scope: Desktop app (`Life OS/`) and mobile app (`life-os-mobile/`), both in the same overall effort — desktop first (establishes the scale and sweep methodology), mobile ported after.

## 1. Why

The app's layout/margin spacing has never been governed by a real scale. A `--gap-xs/sm/md/lg` (4/8/12/20px) token set exists in `tokens.css` but is **never actually referenced anywhere in the codebase** (confirmed via `grep -rn "var(--gap-" src/styles/` — zero hits) — it was defined once and abandoned. In practice, every padding/margin/gap value across both apps is a raw, independently-chosen pixel number: desktop's `globals.css` alone has dozens of distinct raw values (`10px`, `14px`, `9px`, `8px`, `6px`, `5px`, `4px`, `32px`, `28px`, `40px`, `20px`, `12px`, `18px`, `22px`...), and nearly every page `.tsx` file has its own scattered inline `marginTop`/`marginBottom`/`padding` numbers (2, 3, 4, 6, 8, 12...) with no relationship to each other. Mobile has the same problem with no scale at all — every `EdgeInsets` value in `lib/` is an independent literal (3, 4, 6, 7, 8, 10, 12, 14, 16, 18, 24...). This is what reads as "some of them are too close and inconsistent."

## 2. Validated direction

Confirmed via a live visual comparison (a realistic "Today" page rendered twice — once with the actual current ad-hoc values, once with a proposed consistent scale applied throughout, using the app's real dark colors): the user chose the consistent-scale version. The chosen implementation approach (of three presented) was **A — token-first mechanical sweep**: establish real scale tokens, fix the shared/reused classes and widgets first since they cascade for free, then systematically sweep every remaining raw spacing value to the nearest scale step. This was chosen over (B) fixing only shared components and leaving page-specific inline spacing alone — which would likely leave most of the actual complaint unfixed, since that's where most of the raw-value scatter lives — and over (C) introducing a new spacing-primitive layout component, which was judged too large an architectural change for what was asked (a spacing *fix*, not a styling-system rewrite); noted as a possible future idea, not part of this work.

## 3. The scale

Six steps, all multiples of 4: **4 / 8 / 12 / 16 / 24 / 32px**.

### Desktop tokens (`src/styles/tokens.css`)

Named `--space-1` through `--space-8`, not `xs/sm/md/lg`, deliberately matching Tailwind v4's own default spacing scale numbers (Tailwind's utility `4` = 16px, `6` = 24px, `8` = 32px, etc. — Tailwind's unit is `0.25rem` = 4px, so utility number × 4px = pixel value). This codebase already mixes custom CSS classes with occasional Tailwind utility classes (e.g. `className="... mb-1.5 ..."` in `TaskForm.tsx`); naming the custom-property scale to mirror Tailwind's own numbers means `--space-4` and Tailwind's `p-4` refer to the same 16px, rather than being two independent, potentially-conflicting scales a future contributor has to reconcile mentally.

```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-6: 24px;
--space-8: 32px;
```

The gap in numbering (no `--space-5` or `--space-7`) is intentional and matches Tailwind's own scale exactly — this is not an oversight to "fill in" later.

The existing `--gap-xs/sm/md/lg` declarations in `tokens.css` are deleted outright (not deprecated/kept-as-aliases) since nothing references them.

### Mobile constants (`lib/design_system/life_os_theme.dart`)

Identical pixel values, matching naming convention so "space4" means the same 16px on both platforms:

```dart
static const double space1 = 4;
static const double space2 = 8;
static const double space3 = 12;
static const double space4 = 16;
static const double space6 = 24;
static const double space8 = 32;
```

## 4. Rollout order and methodology

**Desktop first, mobile second** — same sequencing as the theme redesign and depth-polish work this session. Establishing the exact scale and sweep methodology concretely on desktop first, then porting the identical approach to mobile, is lower-risk than developing both simultaneously.

**Within each app, two phases:**

1. **Shared surfaces first.** Fix the widely-reused CSS classes (`.page-content`, `.page-header`, `.card`, `.card-header`, `.btn`, `.habit-card`, `.task-row`, `.input`, etc.) and mobile's equivalent shared widgets (`PanelCard`, `StatCard`, `_TaskRow`/`_HabitCardRow`, button theme, `ScreenFrame`). These cascade to every page that uses them, so this phase alone measurably improves consistency everywhere before any page-specific work starts.
2. **Systematic per-file sweep.** For every remaining raw pixel spacing value — CSS in `globals.css`, inline `style={{...}}` objects in page `.tsx` files, and `EdgeInsets` literals in Dart widget files — replace it with the token/constant for its nearest scale step.

**Rounding rule:** nearest scale step; exact ties round up. Applies to values ≥4px (values below 4px are out of scope per §5, not swept at all). Verified programmatically, not just by hand:

```
5→4, 6→8, 7→8, 9→8, 10→12, 11→12, 13→12, 14→16, 15→16,
17→16, 18→16, 19→16, 20→24, 21→24, 22→24, 23→24,
25→24, 26→24, 27→24, 28→32, 29→32, 30→32, 31→32
```
(values already exactly on the scale — 4, 8, 12, 16, 24, 32 — are left as references to the matching token, not remapped). For anything larger than 32 — e.g. a hero-section padding of 40px+ — clamp to 32 only if it's clearly meant to be "the largest spacing step"; otherwise treat it as a case-by-case call during the sweep rather than forcing it onto the same 6-step scale as component spacing (this pass covers component/layout rhythm, not necessarily every large one-off hero/marketing-style padding value).

This rule is applied mechanically during the sweep, not renegotiated value-by-value — the point is a consistent, predictable scale, not hand-tuning every instance to what currently "looks right" (that's the ad-hoc process that created the inconsistency in the first place).

## 5. Scope boundaries

**In scope:** layout and component spacing — padding, margin, and `gap` values that establish rhythm between and inside UI elements (page padding, section gaps, card padding, list-row spacing, button padding, form-field spacing, stat-grid gaps, etc.).

**Explicitly out of scope:**
- **Sub-4px "micro-adjustment" values (1–3px).** Things like a badge's `1px` vertical padding (tuned for line-height/optical alignment, not layout rhythm) or a `2px` icon-to-text nudge. Forcing these onto a 4px-minimum scale would be pixel-hunting beyond what was asked, and risks visually breaking fine-tuned details that aren't actually part of the "inconsistent margins" complaint.
- **Styling-mechanism changes.** Each spacing declaration keeps its existing form — a CSS class stays a CSS class, a Tailwind utility class stays a Tailwind utility class. Inline `style={{ marginBottom: 6 }}` objects stay inline styles, but switch to referencing the token as a string rather than a bare number — `style={{ marginBottom: 'var(--space-2)' }}` — since React inline styles accept CSS custom properties as string values directly; no separate parallel JS/TS spacing-constants module is needed just to serve inline styles. This pass changes *values* (and, for inline styles, how they reference those values), not the overall styling *architecture*. No new spacing-primitive component (option C from the brainstorm) is introduced.
- **Non-spacing values.** `border-radius`, `font-size`, `line-height`, colors, shadows, and animation timing are untouched — this is a spacing-only pass, even where a rule that's being edited anyway also has one of these properties nearby.

## 6. Verification

- After each file/task in the sweep, confirm no leftover raw spacing values remain that should have converted (spec-compliance review, matching the pattern established throughout this session's other mechanical passes).
- At the end of each app's pass: a grep sweep across common spacing patterns (`padding:`, `margin`, `gap:` in CSS; `marginTop`/`marginBottom`/`padding` in inline styles; `EdgeInsets` in Dart) to catch stragglers that don't already match a token/constant reference or an explicitly-out-of-scope micro-adjustment value.
- Visual smoke test on both apps: click through the main pages/screens and confirm nothing looks obviously broken (overlapping elements, elements touching edges, excessive whitespace) — this is a spacing pass, so the standard "does `tsc`/`flutter analyze` pass" check verifies correctness but not the actual visual goal; eyes-on confirmation matters here more than for a typical code change.
