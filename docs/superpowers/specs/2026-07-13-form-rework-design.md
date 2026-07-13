# Form Rework — Design Spec

**Goal:** Replace hand-rolled, inconsistent form markup across the desktop app with a small set of shared, properly-styled form components, fixing inconsistent margins/spacing, leftover Pip-Boy-era visual details, and the lack of any shared form building blocks.

## Problem

There is exactly one dedicated form component (`TaskForm.tsx`), but 88 occurrences of `className="input"` spread across 15 files — most forms are hand-rolled per-page rather than built from shared components, so fixing spacing or styling in one form doesn't fix it anywhere else. `TaskForm.tsx` itself mixes two different styling conventions in the same file (Tailwind arbitrary-value classes like `text-[var(--color-text-muted)]` alongside the rest of the app's inline `style={{}}` + CSS-variable convention), still uses a leftover Pip-Boy-era angular-cut-corner effect (`clipPath: 'polygon(6px 0%, 100% 0%, 100% 100%, 0% 100%, 0% 6px)'`) on its buttons, and uses uppercase tracked labels — the same terminal-aesthetic leftovers already removed from the header/sidebar/footer in the layout decluttering pass. Margins between label/input/field/section are ad-hoc per usage (`space-y-4`, `gap-3`, `mb-1.5`, etc.) with no single source of truth.

## Component architecture

New directory: `src/components/shared/form/`

### `FormField.tsx`
Wrapper handling label, required-marker, help text, and error message.

```tsx
interface FormFieldProps {
  label: string;
  required?: boolean;
  help?: string;
  error?: string;
  children: React.ReactNode;
}
```

Renders:
```tsx
<div className="form-field" data-invalid={Boolean(error) || undefined}>
  <label className="form-field-label">
    {label}
    {required && <span className="form-field-required">*</span>}
  </label>
  {children}
  {help && !error && <div className="form-field-help">{help}</div>}
  {error && <div className="form-field-error">{error}</div>}
</div>
```

CSS (`globals.css`):
```css
.form-field { display: flex; flex-direction: column; gap: var(--space-1); }
.form-field-label { font-family: var(--font-sans); font-size: var(--text-xs); font-weight: var(--font-weight-regular); color: var(--color-text-muted); }
.form-field-required { color: var(--color-accent); margin-left: 2px; }
.form-field-help { font-family: var(--font-sans); font-size: var(--text-2xs); color: var(--color-text-muted); }
.form-field-error { font-family: var(--font-sans); font-size: var(--text-2xs); color: var(--color-danger); }
.form-field[data-invalid] .input { border-color: var(--color-danger); }
```

The `data-invalid` attribute on the wrapper, combined with the `.form-field[data-invalid] .input` descendant selector, means `TextInput`/`Textarea`/`Select` don't need an `error` prop of their own — any `.input`-class element inside an invalid `FormField` automatically gets the red border.

### `TextInput.tsx`, `Textarea.tsx`, `Select.tsx`
Thin wrappers forwarding all native props, applying the existing `.input` class (already styled in `globals.css`) plus `border-radius: var(--radius-md)` (replacing any lingering angular-corner styling). No new behavior beyond consistent class application — these exist so call sites import a component instead of remembering to type `className="input"` correctly every time.

### `ToggleChip.tsx`
Replaces ad-hoc button-grid patterns (domain picker, MIT/Top3 toggles, and similar choice-button groups).

```tsx
interface ToggleChipProps {
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  style?: React.CSSProperties; // for domain theming passthrough (getDomainThemeStyle)
  children: React.ReactNode;
}
```

Renders a button styled with `border-radius: var(--radius-md)` (no clip-path), active state using `var(--color-accent)` / `var(--domain-primary)` border+background per existing color conventions, inactive state muted border/text — same visual logic TaskForm already has, just extracted into one reusable component instead of three near-duplicate inline implementations (domain picker, MIT toggle, Top 3 toggle).

### `FormSection.tsx`
Groups related fields under an optional heading with consistent spacing.

```tsx
interface FormSectionProps {
  heading?: string;
  description?: string;
  children: React.ReactNode;
}
```

CSS: `--space-3` gap between fields inside a section (children stack via flex/grid at the call site — `FormSection` itself just provides the heading + `--space-6` margin before the next section, it doesn't dictate the internal field layout since some sections need 1-column and others 2-column grids).

## Visual design

- No `border-radius: var(--radius-md)` change needed on the shared `.input` class itself (already correct) — the fix is removing `clipPath` from buttons/toggles that currently override it.
- Labels: normal case, `--text-xs`, `--font-weight-regular`, `--color-text-muted` — no `uppercase`, no `letter-spacing`.
- Required marker: accent-colored `*`, appended by `FormField`, never baked into the label string.
- Spacing rhythm (all via existing `--space-N` tokens, nothing new introduced):
  - label → input: `--space-1` (4px)
  - field → field within a section: `--space-3` (12px)
  - section → section: `--space-6` (24px)

## Validation & error feedback

- `FormField`'s `error` prop drives both the message display and the red-border styling (via `data-invalid`).
- Validation runs on submit, not live-as-you-type.
- No new validation *rules* are introduced — this spec adds the infrastructure to display errors that already exist conceptually (e.g. TaskForm's required-title check moves from "silently disabled submit button" to "shows an error message on submit attempt"). Forms that don't currently validate anything don't gain new validation requirements as part of this rework.

## Rollout scope

Reference implementation first: **`TaskForm.tsx`** — most complex form (grouped fields, toggle chips, collapsible advanced section, required-field validation). Rebuilt fully using `FormSection` + `FormField` + `TextInput`/`Textarea`/`Select` + `ToggleChip`, replacing every hand-rolled label/input pair and both button-grid implementations (domain picker, MIT/Top3).

Then swept across the remaining files, split by treatment:

**Full `FormSection`/`FormField` treatment** (true multi-field create/edit forms):
- `src/components/tasks/QuickAddTask.tsx`
- `src/components/shared/QuickCapture.tsx`
- `src/components/Onboarding.tsx`
- `src/components/habits/HabitHistoryEditor.tsx`
- `src/pages/Habits.tsx` (habit create/edit)
- `src/pages/Goals.tsx` (goal create/edit)
- `src/pages/Settings.tsx` (each settings group becomes a `FormSection`)
- `src/pages/Notes.tsx` (note metadata fields, if any beyond the freeform editor)
- `src/pages/Templates.tsx` (template create/edit)
- `src/pages/WeeklyReview.tsx` (review input fields)

**`TextInput`/`Textarea`/`Select` only** (single-input utility spots, no `FormField`/`FormSection` wrapping needed):
- `src/components/shared/GlobalSearch.tsx`
- `src/components/shared/FocusTimer.tsx`
- `src/pages/Today.tsx`
- `src/pages/Tasks.tsx` (inline filter inputs, if not already covered by the TaskForm modal)

Each file's exact field-by-field mapping gets worked out at plan-writing time by reading the current implementation — this spec fixes the components and conventions, not a line-by-line diff.

## Out of scope

- No new validation rules beyond what already exists.
- No changes to which forms are modal-based vs inline — presentation container (Modal) is unchanged, only the form content inside it.
- Mobile app (Flutter) — desktop-only.
- No changes to form *data* handling (Zustand store calls, Tauri command wrappers) — purely presentational.
