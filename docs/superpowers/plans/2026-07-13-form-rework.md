# Form Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hand-rolled, inconsistently-styled form markup across the desktop app with shared `FormField`/`TextInput`/`Textarea`/`Select`/`ToggleChip`/`FormSection` components, fixing inconsistent margins, leftover Pip-Boy-era clip-path corners, and uppercase tracked labels.

**Architecture:** New components live in `src/components/shared/form/`. `FormField` wraps a label + optional required-marker + help/error text around whatever input is passed as `children`; error styling is applied via a `data-invalid` attribute + CSS descendant selector so input components never need an `error` prop of their own. `TextInput`/`Textarea`/`Select` are thin wrappers over native elements using the existing `.input` CSS class. `ToggleChip` replaces the three near-duplicate inline button-grid implementations (domain picker, MIT/Top3 toggle, health picker) found across the codebase. `FormSection` groups related fields with a heading and consistent `--space-6` margin before the next section.

**Tech Stack:** React 18 + TypeScript, Tailwind v4, CSS custom properties (`tokens.css`), Vitest + React Testing Library.

---

## Before you start

Every task below references code that was read directly from the current files during planning — if a file has changed since, re-read it and adapt the surrounding context, but the target component API (defined in Task 1) does not change.

**Direct-to-branch work, no worktrees needed** — this project's established convention is committing directly to `main` for this kind of iterative UI work.

**Sed safety note:** most tasks in this plan involve JSX restructuring, not simple value substitution — use the Edit tool with exact before/after blocks as given, not blind find-replace across the file.

---

## Task 1: Create shared form components + CSS

**Files:**
- Create: `src/components/shared/form/FormField.tsx`
- Create: `src/components/shared/form/TextInput.tsx`
- Create: `src/components/shared/form/Textarea.tsx`
- Create: `src/components/shared/form/Select.tsx`
- Create: `src/components/shared/form/ToggleChip.tsx`
- Create: `src/components/shared/form/FormSection.tsx`
- Create: `src/components/shared/form/index.ts`
- Modify: `src/styles/globals.css` (append new CSS section)
- Test: `src/components/shared/form/__tests__/FormField.test.tsx`

- [ ] **Step 1: Write `FormField.tsx`**

```tsx
import React from 'react';

interface FormFieldProps {
  label: string;
  required?: boolean;
  help?: string;
  error?: string;
  children: React.ReactNode;
}

export const FormField: React.FC<FormFieldProps> = ({ label, required, help, error, children }) => {
  return (
    <div className="form-field" data-invalid={error ? 'true' : undefined}>
      <label className="form-field-label">
        {label}
        {required && <span className="form-field-required">*</span>}
      </label>
      {children}
      {error ? (
        <div className="form-field-error">{error}</div>
      ) : help ? (
        <div className="form-field-help">{help}</div>
      ) : null}
    </div>
  );
};
```

- [ ] **Step 2: Write `TextInput.tsx`**

```tsx
import React from 'react';
import { clsx } from 'clsx';

type TextInputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const TextInput = React.forwardRef<HTMLInputElement, TextInputProps>(
  ({ className, ...props }, ref) => {
    return <input ref={ref} className={clsx('input', className)} {...props} />;
  },
);
TextInput.displayName = 'TextInput';
```

- [ ] **Step 3: Write `Textarea.tsx`**

```tsx
import React from 'react';
import { clsx } from 'clsx';

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return <textarea ref={ref} className={clsx('input', className)} {...props} />;
  },
);
Textarea.displayName = 'Textarea';
```

- [ ] **Step 4: Write `Select.tsx`**

```tsx
import React from 'react';
import { clsx } from 'clsx';

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <select ref={ref} className={clsx('input', className)} {...props}>
        {children}
      </select>
    );
  },
);
Select.displayName = 'Select';
```

- [ ] **Step 5: Write `ToggleChip.tsx`**

```tsx
import React from 'react';
import { clsx } from 'clsx';

interface ToggleChipProps {
  active: boolean;
  onClick: () => void;
  domain?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  children: React.ReactNode;
}

export const ToggleChip: React.FC<ToggleChipProps> = ({ active, onClick, domain, style, disabled, children }) => {
  return (
    <button
      type="button"
      data-domain={domain}
      onClick={onClick}
      disabled={disabled}
      className={clsx('toggle-chip', active && 'active')}
      style={style}
    >
      {children}
    </button>
  );
};
```

- [ ] **Step 6: Write `FormSection.tsx`**

```tsx
import React from 'react';

interface FormSectionProps {
  heading?: string;
  description?: string;
  children: React.ReactNode;
}

export const FormSection: React.FC<FormSectionProps> = ({ heading, description, children }) => {
  return (
    <div className="form-section">
      {heading && (
        <div className="form-section-header">
          <div className="form-section-heading">{heading}</div>
          {description && <div className="form-section-description">{description}</div>}
        </div>
      )}
      <div className="form-section-body">{children}</div>
    </div>
  );
};
```

- [ ] **Step 7: Write the barrel export `index.ts`**

```ts
export { FormField } from './FormField';
export { TextInput } from './TextInput';
export { Textarea } from './Textarea';
export { Select } from './Select';
export { ToggleChip } from './ToggleChip';
export { FormSection } from './FormSection';
```

- [ ] **Step 8: Append CSS to `globals.css`**

Find the existing `.input` block (search for `.input {`) and add this new section immediately after the `.input[rows]` line (after `textarea.input, .input[rows] { height: auto; min-height: 80px; resize: vertical; line-height: 1.6; }`):

```css
/* ── FORM COMPONENTS ──────────────────────────────────────────────────────── */
.form-field { display: flex; flex-direction: column; gap: var(--space-1); }
.form-field-label { font-family: var(--font-sans); font-size: var(--text-xs); font-weight: var(--font-weight-regular); color: var(--color-text-muted); }
.form-field-required { color: var(--color-accent); margin-left: 2px; }
.form-field-help { font-family: var(--font-sans); font-size: var(--text-2xs); color: var(--color-text-muted); }
.form-field-error { font-family: var(--font-sans); font-size: var(--text-2xs); color: var(--color-danger); }
.form-field[data-invalid] .input { border-color: var(--color-danger); }

.form-section + .form-section { margin-top: var(--space-6); }
.form-section-header { margin-bottom: var(--space-2); }
.form-section-heading { font-family: var(--font-sans); font-size: var(--text-sm); font-weight: var(--font-weight-semibold); color: var(--color-text); }
.form-section-description { font-family: var(--font-sans); font-size: var(--text-xs); font-weight: var(--font-weight-regular); color: var(--color-text-muted); margin-top: 2px; }
.form-section-body { display: flex; flex-direction: column; gap: var(--space-3); }

.toggle-chip {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: transparent;
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  font-weight: var(--font-weight-regular);
  color: var(--color-text-muted);
  transition: border-color var(--motion-fast), background var(--motion-fast), color var(--motion-fast);
}
.toggle-chip:hover { border-color: var(--color-border-strong); }
.toggle-chip.active {
  border-color: var(--domain-primary, var(--color-accent));
  background: var(--domain-subtle, var(--color-accent-muted));
  color: var(--color-text);
  font-weight: var(--font-weight-semibold);
}
```

- [ ] **Step 9: Write the component test**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FormField } from '../FormField';
import { TextInput } from '../TextInput';

describe('FormField', () => {
  it('renders the label text', () => {
    render(
      <FormField label="Title">
        <TextInput value="" onChange={() => {}} />
      </FormField>,
    );
    expect(screen.getByText('Title')).toBeTruthy();
  });

  it('shows the required marker when required is true', () => {
    render(
      <FormField label="Title" required>
        <TextInput value="" onChange={() => {}} />
      </FormField>,
    );
    expect(screen.getByText('*')).toBeTruthy();
  });

  it('shows help text when provided and no error', () => {
    render(
      <FormField label="Title" help="Some help text">
        <TextInput value="" onChange={() => {}} />
      </FormField>,
    );
    expect(screen.getByText('Some help text')).toBeTruthy();
  });

  it('shows error text instead of help text when both are provided', () => {
    render(
      <FormField label="Title" help="Some help text" error="Title is required">
        <TextInput value="" onChange={() => {}} />
      </FormField>,
    );
    expect(screen.getByText('Title is required')).toBeTruthy();
    expect(screen.queryByText('Some help text')).toBeNull();
  });

  it('sets data-invalid on the wrapper when error is present', () => {
    const { container } = render(
      <FormField label="Title" error="Title is required">
        <TextInput value="" onChange={() => {}} />
      </FormField>,
    );
    expect(container.querySelector('.form-field')?.getAttribute('data-invalid')).toBe('true');
  });
});
```

- [ ] **Step 10: Run the test**

```bash
npm test -- FormField
```
Expected: all 5 tests pass.

- [ ] **Step 11: Verify build**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 12: Commit**

```bash
git add src/components/shared/form/ src/styles/globals.css
git commit -m "feat: add shared FormField/TextInput/Textarea/Select/ToggleChip/FormSection components"
```

---

## Task 2: Rebuild TaskForm.tsx (reference implementation)

**Files:**
- Modify: `src/components/tasks/TaskForm.tsx`

This is the most complex form in the app — domain picker, title/description, priority/energy selects, time estimate, due/start dates, a collapsible advanced section (goal link, recurrence, tags, MIT/Top3 toggles). Every other task in this plan follows the pattern established here.

- [ ] **Step 1: Replace the imports**

Find:
```tsx
import React, { useState } from 'react';
import { useTaskStore } from '../../store/useTaskStore';
import { useGoalStore } from '../../store/useGoalStore';
import { useDomainStore } from '../../store/useDomainStore';
import { containsArabic } from '../../lib/text-utils';
import type { DomainId, EnergyLevel, Priority, RecurrenceType, Task, TaskKind } from '../../lib/types';
import { clsx } from 'clsx';
import { getDefaultDomainId, getDomainLabel, getDomainThemeStyle } from '../../lib/domain-utils';
```
Replace with:
```tsx
import React, { useState } from 'react';
import { useTaskStore } from '../../store/useTaskStore';
import { useGoalStore } from '../../store/useGoalStore';
import { useDomainStore } from '../../store/useDomainStore';
import { containsArabic } from '../../lib/text-utils';
import type { DomainId, EnergyLevel, Priority, RecurrenceType, Task, TaskKind } from '../../lib/types';
import { getDefaultDomainId, getDomainLabel, getDomainThemeStyle } from '../../lib/domain-utils';
import { FormField, FormSection, TextInput, Textarea, Select, ToggleChip } from '../shared/form';
```
(`clsx` is dropped — no longer needed once `ToggleChip` owns its own active-state class logic.)

- [ ] **Step 2: Add a `titleError` state and compute it on submit attempt**

Find:
```tsx
  const [saving, setSaving] = useState(false);
```
Replace with:
```tsx
  const [saving, setSaving] = useState(false);
  const [titleError, setTitleError] = useState('');
```

Find:
```tsx
  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
```
Replace with:
```tsx
  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) {
      setTitleError('Title is required.');
      return;
    }
    setTitleError('');
    setSaving(true);
```

- [ ] **Step 3: Replace the domain picker**

Find:
```tsx
      {!isEditing && (
        <div>
          <label className="block text-xs text-[var(--color-text-muted)] mb-1.5 tracking-wide uppercase">Domain</label>
          <div className="grid grid-cols-3 gap-2">
            {domains.map((entry) => (
              <button
                key={entry.id}
                type="button"
                data-domain={entry.id}
                onClick={() => setDomain(entry.id)}
                className={clsx(
                  'flex items-center gap-2 px-3 py-2 border text-sm font-semibold transition-all',
                  domain === entry.id
                    ? 'border-[var(--domain-primary)] bg-[var(--domain-bg)] text-[var(--color-text)]'
                    : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)]',
                )}
                style={{ ...getDomainThemeStyle(entry), clipPath: 'polygon(6px 0%, 100% 0%, 100% 100%, 0% 100%, 0% 6px)' }}
              >
                <span>{entry.icon}</span>
                {getDomainLabel(entry.id, domains)}
              </button>
            ))}
          </div>
        </div>
      )}
```
Replace with:
```tsx
      {!isEditing && (
        <FormField label="Domain">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)' }}>
            {domains.map((entry) => (
              <ToggleChip
                key={entry.id}
                active={domain === entry.id}
                onClick={() => setDomain(entry.id)}
                domain={entry.id}
                style={getDomainThemeStyle(entry)}
              >
                <span>{entry.icon}</span>
                {getDomainLabel(entry.id, domains)}
              </ToggleChip>
            ))}
          </div>
        </FormField>
      )}
```

- [ ] **Step 4: Replace the title and description fields**

Find:
```tsx
      <div>
        <label className="block text-xs text-[var(--color-text-muted)] mb-1.5 tracking-wide uppercase">Title *</label>
        <input
          className="input"
          dir="auto"
          placeholder="What needs to move forward?"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          autoFocus
          required
          style={{ fontFamily: titleArabic ? 'var(--font-arabic)' : 'var(--font-sans)' }}
        />
      </div>

      <div>
        <label className="block text-xs text-[var(--color-text-muted)] mb-1.5 tracking-wide uppercase">Description</label>
        <textarea
          className="input min-h-[88px] resize-none"
          dir="auto"
          placeholder="Why does this matter, or what is the next step?"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          style={{ fontFamily: descriptionArabic ? 'var(--font-arabic)' : 'var(--font-sans)' }}
        />
      </div>
```
Replace with:
```tsx
      <FormField label="Title" required error={titleError}>
        <TextInput
          dir="auto"
          placeholder="What needs to move forward?"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          autoFocus
          style={{ fontFamily: titleArabic ? 'var(--font-arabic)' : 'var(--font-sans)' }}
        />
      </FormField>

      <FormField label="Description">
        <Textarea
          dir="auto"
          placeholder="Why does this matter, or what is the next step?"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          style={{ resize: 'none', minHeight: 88, fontFamily: descriptionArabic ? 'var(--font-arabic)' : 'var(--font-sans)' }}
        />
      </FormField>
```

- [ ] **Step 5: Replace priority/energy selects and time estimate**

Find:
```tsx
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-[var(--color-text-muted)] mb-1.5 tracking-wide uppercase">Priority</label>
          <select className="input" value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-[var(--color-text-muted)] mb-1.5 tracking-wide uppercase">Energy</label>
          <select className="input" value={energyLevel} onChange={(event) => setEnergyLevel(event.target.value as EnergyLevel)}>
            <option value="deep">Deep</option>
            <option value="medium">Medium</option>
            <option value="light">Light</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs text-[var(--color-text-muted)] mb-1.5 tracking-wide uppercase">Time Estimate (min)</label>
        <input className="input" type="number" min={0} placeholder="e.g. 45" value={timeEst} onChange={(event) => setTimeEst(event.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-[var(--color-text-muted)] mb-1.5 tracking-wide uppercase">Due Date</label>
          <input className="input" type="date" lang="en-GB" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-[var(--color-text-muted)] mb-1.5 tracking-wide uppercase">Start Date</label>
          <input className="input" type="date" lang="en-GB" value={plannedForDate} onChange={(event) => setPlannedForDate(event.target.value)} />
        </div>
      </div>
```
Replace with:
```tsx
      <FormSection heading="Details">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <FormField label="Priority">
            <Select value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </Select>
          </FormField>
          <FormField label="Energy">
            <Select value={energyLevel} onChange={(event) => setEnergyLevel(event.target.value as EnergyLevel)}>
              <option value="deep">Deep</option>
              <option value="medium">Medium</option>
              <option value="light">Light</option>
            </Select>
          </FormField>
        </div>

        <FormField label="Time Estimate (min)">
          <TextInput type="number" min={0} placeholder="e.g. 45" value={timeEst} onChange={(event) => setTimeEst(event.target.value)} />
        </FormField>
      </FormSection>

      <FormSection heading="Scheduling">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <FormField label="Due Date">
            <TextInput type="date" lang="en-GB" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          </FormField>
          <FormField label="Start Date">
            <TextInput type="date" lang="en-GB" value={plannedForDate} onChange={(event) => setPlannedForDate(event.target.value)} />
          </FormField>
        </div>
      </FormSection>
```

- [ ] **Step 6: Replace the advanced section's goal/recurrence/tags fields and the MIT/Top3 toggles**

Find:
```tsx
        {showAdvanced && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-[var(--color-text-muted)] mb-1.5 tracking-wide uppercase">Goal Link</label>
              <select className="input" value={goalId} onChange={(event) => setGoalId(event.target.value)}>
                <option value="">No goal</option>
                {domainGoals.map((goal) => (
                  <option key={goal.id} value={goal.id}>{goal.title}</option>
                ))}
              </select>
            </div>

            {!isRecurringInstance && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[var(--color-text-muted)] mb-1.5 tracking-wide uppercase">Recurrence</label>
                  <select className="input" value={recurrenceType} onChange={(event) => setRecurrenceType(event.target.value as RecurrenceType | 'none')}>
                    <option value="none">No repeat</option>
                    <option value="daily">Daily</option>
                    <option value="weekdays">Weekdays</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="interval">Every N days</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-[var(--color-text-muted)] mb-1.5 tracking-wide uppercase">Tags</label>
                  <input className="input" dir="auto" placeholder="planning, admin" value={tags} onChange={(event) => setTags(event.target.value)} />
                </div>
              </div>
            )}

            {recurrenceType === 'interval' && !isRecurringInstance && (
              <div>
                <label className="block text-xs text-[var(--color-text-muted)] mb-1.5 tracking-wide uppercase">Repeat Every N Days</label>
                <input className="input" type="number" min={1} value={recurrenceInterval} onChange={(event) => setRecurrenceInterval(event.target.value)} />
              </div>
            )}

            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)', color: 'var(--color-text-muted)' }}>
              MIT and Top 3 usually belong to Today. Set them here only if this task should already land in the daily plan.
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setIsMit((value) => !value)}
                className={clsx(
                  'flex items-center gap-2.5 px-3 py-2 border text-sm font-semibold tracking-wider transition-all w-full',
                  isMit
                    ? 'border-yellow-500 bg-[rgba(234,179,8,0.08)] text-yellow-400'
                    : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)]',
                )}
                style={{ clipPath: 'polygon(6px 0%, 100% 0%, 100% 100%, 0% 100%, 0% 6px)' }}
              >
                <span>{isMit ? '*' : 'o'}</span>
                <span>Most Important Task</span>
              </button>

              <button
                type="button"
                onClick={() => setIsTopThree((value) => !value)}
                className={clsx(
                  'flex items-center gap-2.5 px-3 py-2 border text-sm font-semibold tracking-wider transition-all w-full',
                  isTopThree
                    ? 'border-[var(--color-accent)] bg-[rgba(124,108,255,0.08)] text-[var(--color-text)]'
                    : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)]',
                )}
                style={{ clipPath: 'polygon(6px 0%, 100% 0%, 100% 100%, 0% 100%, 0% 6px)' }}
              >
                <span>{isTopThree ? '[x]' : '[ ]'}</span>
                <span>Top 3</span>
              </button>
            </div>
          </div>
        )}
```
Replace with:
```tsx
        {showAdvanced && (
          <FormSection>
            <FormField label="Goal Link">
              <Select value={goalId} onChange={(event) => setGoalId(event.target.value)}>
                <option value="">No goal</option>
                {domainGoals.map((goal) => (
                  <option key={goal.id} value={goal.id}>{goal.title}</option>
                ))}
              </Select>
            </FormField>

            {!isRecurringInstance && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                <FormField label="Recurrence">
                  <Select value={recurrenceType} onChange={(event) => setRecurrenceType(event.target.value as RecurrenceType | 'none')}>
                    <option value="none">No repeat</option>
                    <option value="daily">Daily</option>
                    <option value="weekdays">Weekdays</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="interval">Every N days</option>
                  </Select>
                </FormField>
                <FormField label="Tags">
                  <TextInput dir="auto" placeholder="planning, admin" value={tags} onChange={(event) => setTags(event.target.value)} />
                </FormField>
              </div>
            )}

            {recurrenceType === 'interval' && !isRecurringInstance && (
              <FormField label="Repeat Every N Days">
                <TextInput type="number" min={1} value={recurrenceInterval} onChange={(event) => setRecurrenceInterval(event.target.value)} />
              </FormField>
            )}

            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)', color: 'var(--color-text-muted)' }}>
              MIT and Top 3 usually belong to Today. Set them here only if this task should already land in the daily plan.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              <ToggleChip active={isMit} onClick={() => setIsMit((value) => !value)}>
                <span>{isMit ? '*' : 'o'}</span>
                <span>Most Important Task</span>
              </ToggleChip>
              <ToggleChip active={isTopThree} onClick={() => setIsTopThree((value) => !value)}>
                <span>{isTopThree ? '[x]' : '[ ]'}</span>
                <span>Top 3</span>
              </ToggleChip>
            </div>
          </FormSection>
        )}
```

- [ ] **Step 7: Verify no leftover Tailwind arbitrary-value classes or clipPath remain**

```bash
grep -n "text-\[var\|clipPath\|clsx" src/components/tasks/TaskForm.tsx
```
Expected: no output (the `clsx` import was removed in Step 1, and all `text-[var(...)]`/`clipPath` usages were replaced in Steps 3-6).

- [ ] **Step 8: Type-check and build**

```bash
npx tsc --noEmit
npm run build
```
Expected: both clean.

- [ ] **Step 9: Commit**

```bash
git add src/components/tasks/TaskForm.tsx
git commit -m "polish: rebuild TaskForm using shared form components"
```

---

## Task 3: QuickAddTask.tsx

**Files:**
- Modify: `src/components/tasks/QuickAddTask.tsx`

- [ ] **Step 1: Add the import**

Find:
```tsx
import { getDefaultDomainId, getDomainLabel } from '../../lib/domain-utils';
```
Replace with:
```tsx
import { getDefaultDomainId, getDomainLabel } from '../../lib/domain-utils';
import { FormField, TextInput, Select } from '../shared/form';
```

- [ ] **Step 2: Replace the form body**

Find:
```tsx
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          className="input"
          placeholder="What needs to be done?"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          autoFocus
        />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] text-[var(--color-text-muted)] mb-1.5 tracking-wider uppercase">Domain</label>
            <select className="input" value={domainId} onChange={(event) => setDomainId(event.target.value as DomainId)}>
              {domains.map((domain) => (
                <option key={domain.id} value={domain.id}>
                  {domain.icon} {getDomainLabel(domain.id, domains)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-[var(--color-text-muted)] mb-1.5 tracking-wider uppercase">Priority</label>
            <select className="input" value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] text-[var(--color-text-muted)] mb-1.5 tracking-wider uppercase">Time (minutes)</label>
            <input className="input" type="number" placeholder="e.g. 30" value={timeEst} onChange={(event) => setTimeEst(event.target.value)} min="1" />
          </div>

          <div>
            <label className="block text-[11px] text-[var(--color-text-muted)] mb-1.5 tracking-wider uppercase">Most Important</label>
            <button type="button" className={`btn w-full ${isMIT ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setIsMIT((value) => !value)}>
              {isMIT ? '★ MIT' : '☆ Set as MIT'}
            </button>
          </div>
        </div>
```
Replace with:
```tsx
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <FormField label="Title">
          <TextInput
            placeholder="What needs to be done?"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            autoFocus
          />
        </FormField>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <FormField label="Domain">
            <Select value={domainId} onChange={(event) => setDomainId(event.target.value as DomainId)}>
              {domains.map((domain) => (
                <option key={domain.id} value={domain.id}>
                  {domain.icon} {getDomainLabel(domain.id, domains)}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Priority">
            <Select value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </Select>
          </FormField>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <FormField label="Time (minutes)">
            <TextInput type="number" placeholder="e.g. 30" value={timeEst} onChange={(event) => setTimeEst(event.target.value)} min="1" />
          </FormField>

          <FormField label="Most Important">
            <button type="button" className={`btn w-full ${isMIT ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setIsMIT((value) => !value)}>
              {isMIT ? '★ MIT' : '☆ Set as MIT'}
            </button>
          </FormField>
        </div>
```
(The MIT button stays a plain `.btn` toggle, not `ToggleChip` — it's a single standalone action, not part of a `ToggleChip` group, and changing its visual treatment here is out of scope for this pass.)

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/tasks/QuickAddTask.tsx
git commit -m "polish: apply shared form components to QuickAddTask"
```

---

## Task 4: QuickCapture.tsx

**Files:**
- Modify: `src/components/shared/QuickCapture.tsx`

QuickCapture is a single-input capture flow (text + domain picker), not a multi-field form — apply `TextInput` and `ToggleChip` only, no `FormField`/`FormSection` wrapping (this matches the "utility tier" from the design spec, since there's only one real text field and the domain picker is the primary UI, not a secondary field needing a label).

- [ ] **Step 1: Add the import**

Find:
```tsx
import { getDefaultDomainId, getDomainLabel, getDomainThemeStyle } from '../../lib/domain-utils';
```
Replace with:
```tsx
import { getDefaultDomainId, getDomainLabel, getDomainThemeStyle } from '../../lib/domain-utils';
import { TextInput, ToggleChip } from './form';
```

- [ ] **Step 2: Replace the text input**

Find:
```tsx
              <input
                ref={inputRef}
                className="input"
                placeholder={mode === 'task' ? 'WHAT NEEDS TO BE DONE?' : 'NOTE TITLE...'}
                value={text}
                onChange={(event) => setText(event.target.value)}
                style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-weight-regular)', width: '100%' }}
              />
```
Replace with:
```tsx
              <TextInput
                ref={inputRef}
                placeholder={mode === 'task' ? 'WHAT NEEDS TO BE DONE?' : 'NOTE TITLE...'}
                value={text}
                onChange={(event) => setText(event.target.value)}
                style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-weight-regular)', width: '100%' }}
              />
```

- [ ] **Step 3: Replace the domain picker buttons**

Find:
```tsx
              <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                {domains.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    data-domain={entry.id}
                    className={domain === entry.id ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-ghost'}
                    onClick={() => setDomain(entry.id)}
                    style={{ ...getDomainThemeStyle(entry), flex: 1, minWidth: 120, padding: '3px var(--space-2)', fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)' }}
                  >
                    {entry.icon} {getDomainLabel(entry.id, domains).toUpperCase()}
                  </button>
                ))}
              </div>
```
Replace with:
```tsx
              <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                {domains.map((entry) => (
                  <ToggleChip
                    key={entry.id}
                    active={domain === entry.id}
                    onClick={() => setDomain(entry.id)}
                    domain={entry.id}
                    style={{ ...getDomainThemeStyle(entry), flex: 1, minWidth: 120, padding: '3px var(--space-2)', fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)' }}
                  >
                    {entry.icon} {getDomainLabel(entry.id, domains).toUpperCase()}
                  </ToggleChip>
                ))}
              </div>
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/shared/QuickCapture.tsx
git commit -m "polish: apply shared form components to QuickCapture"
```

---

## Task 5: Habits.tsx habit create/edit form

**Files:**
- Modify: `src/pages/Habits.tsx`

- [ ] **Step 1: Add the import**

Find the existing import block's last `import` line (search for `import { clsx } from 'clsx';` or the last domain-utils import near the top of the file) and add after it:
```tsx
import { FormField, FormSection, TextInput, Textarea, Select, ToggleChip } from '../components/shared/form';
```
(Adjust the relative path if the existing imports use a different depth — confirm by checking a sibling import like `getDomainThemeStyle` at the top of the file.)

- [ ] **Step 2: Replace the domain picker**

Find:
```tsx
      <div>
        <label style={{ display: 'block', fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>Domain</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 'var(--space-2)' }}>
          {domains.map((entry) => (
            <button key={entry.id} type="button" data-domain={entry.id} onClick={() => setDomain(entry.id)} className={clsx('btn', domain === entry.id ? 'btn-primary' : 'btn-ghost')} style={{ ...getDomainThemeStyle(entry), padding: 'var(--space-1) var(--space-2)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-weight-regular)' }}>
              {getDomainLabel(entry.id, domains).toUpperCase()}
            </button>
          ))}
        </div>
      </div>
```
Replace with:
```tsx
      <FormField label="Domain">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 'var(--space-2)' }}>
          {domains.map((entry) => (
            <ToggleChip key={entry.id} active={domain === entry.id} onClick={() => setDomain(entry.id)} domain={entry.id} style={getDomainThemeStyle(entry)}>
              {getDomainLabel(entry.id, domains).toUpperCase()}
            </ToggleChip>
          ))}
        </div>
      </FormField>
```

- [ ] **Step 3: Replace the habit name field**

Find:
```tsx
      <div>
        <label style={{ display: 'block', fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>Habit Name *</label>
        <input className="input" dir="auto" value={title} onChange={(event) => setTitle(event.target.value)} autoFocus required placeholder="Read 20 minutes / Train / Write" style={{ fontFamily: titleArabic ? 'var(--font-arabic)' : 'var(--font-sans)' }} />
      </div>
```
Replace with:
```tsx
      <FormField label="Habit Name" required>
        <TextInput dir="auto" value={title} onChange={(event) => setTitle(event.target.value)} autoFocus placeholder="Read 20 minutes / Train / Write" style={{ fontFamily: titleArabic ? 'var(--font-arabic)' : 'var(--font-sans)' }} />
      </FormField>
```
(The `required` HTML attribute is dropped from the `<input>` in favor of the label's visual required marker — native browser validation popups are inconsistent with the rest of the app's styling; the store-level check that already exists elsewhere in the file for empty titles is unaffected.)

- [ ] **Step 4: Replace cadence and target-type selects**

Find:
```tsx
      <div className="layout-grid-two">
        <div>
          <label style={{ display: 'block', fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>Cadence</label>
          <select className="input" value={cadenceType} onChange={(event) => setCadenceType(event.target.value as HabitCadenceType)}>
            <option value="daily">DAILY</option>
            <option value="weekdays">WEEKDAYS</option>
            <option value="selected_days">SELECTED DAYS</option>
            <option value="interval">EVERY N DAYS</option>
            <option value="times_per_week">N TIMES / WEEK</option>
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>Target Type</label>
          <select className="input" value={targetType} onChange={(event) => setTargetType(event.target.value as HabitTargetType)}>
            <option value="checkbox">CHECKBOX</option>
            <option value="count">COUNT</option>
            <option value="minutes">MINUTES</option>
          </select>
        </div>
      </div>
```
Replace with:
```tsx
      <div className="layout-grid-two">
        <FormField label="Cadence">
          <Select value={cadenceType} onChange={(event) => setCadenceType(event.target.value as HabitCadenceType)}>
            <option value="daily">DAILY</option>
            <option value="weekdays">WEEKDAYS</option>
            <option value="selected_days">SELECTED DAYS</option>
            <option value="interval">EVERY N DAYS</option>
            <option value="times_per_week">N TIMES / WEEK</option>
          </Select>
        </FormField>
        <FormField label="Target Type">
          <Select value={targetType} onChange={(event) => setTargetType(event.target.value as HabitTargetType)}>
            <option value="checkbox">CHECKBOX</option>
            <option value="count">COUNT</option>
            <option value="minutes">MINUTES</option>
          </Select>
        </FormField>
      </div>
```

- [ ] **Step 5: Replace the interval/weekly-target number fields**

Find:
```tsx
      {cadenceType === 'interval' && (
        <div>
          <label style={{ display: 'block', fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>Every N Days</label>
          <input className="input" type="number" min={1} value={cadenceIntervalDays} onChange={(event) => setCadenceIntervalDays(parseInt(event.target.value, 10) || 1)} />
        </div>
      )}

      {cadenceType === 'times_per_week' && (
        <div>
          <label style={{ display: 'block', fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>Times Per Week</label>
          <input className="input" type="number" min={1} max={14} value={cadenceWeeklyTarget} onChange={(event) => setCadenceWeeklyTarget(parseInt(event.target.value, 10) || 1)} />
        </div>
      )}
```
Replace with:
```tsx
      {cadenceType === 'interval' && (
        <FormField label="Every N Days">
          <TextInput type="number" min={1} value={cadenceIntervalDays} onChange={(event) => setCadenceIntervalDays(parseInt(event.target.value, 10) || 1)} />
        </FormField>
      )}

      {cadenceType === 'times_per_week' && (
        <FormField label="Times Per Week">
          <TextInput type="number" min={1} max={14} value={cadenceWeeklyTarget} onChange={(event) => setCadenceWeeklyTarget(parseInt(event.target.value, 10) || 1)} />
        </FormField>
      )}
```

- [ ] **Step 6: Replace the target value / minimum value / unit / minimum version fields**

Find:
```tsx
        {targetType !== 'checkbox' && (
          <>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>Target Value</label>
              <input className="input" type="number" min={1} value={targetValue} onChange={(event) => setTargetValue(parseInt(event.target.value, 10) || 1)} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>Minimum Value</label>
              <input className="input" type="number" min={1} value={minimumValue} onChange={(event) => setMinimumValue(parseInt(event.target.value, 10) || 1)} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>Unit</label>
              <input className="input" value={targetType === 'minutes' ? 'min' : unitLabel} onChange={(event) => setUnitLabel(event.target.value)} disabled={targetType === 'minutes'} />
            </div>
          </>
        )}
        <div>
          <label style={{ display: 'block', fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>Minimum Version</label>
          <input className="input" dir="auto" value={minimumVersion} onChange={(event) => setMinimumVersion(event.target.value)} placeholder="Smallest valid version" style={{ fontFamily: minimumArabic ? 'var(--font-arabic)' : 'var(--font-sans)' }} />
        </div>
```
Replace with:
```tsx
        {targetType !== 'checkbox' && (
          <>
            <FormField label="Target Value">
              <TextInput type="number" min={1} value={targetValue} onChange={(event) => setTargetValue(parseInt(event.target.value, 10) || 1)} />
            </FormField>
            <FormField label="Minimum Value">
              <TextInput type="number" min={1} value={minimumValue} onChange={(event) => setMinimumValue(parseInt(event.target.value, 10) || 1)} />
            </FormField>
            <FormField label="Unit">
              <TextInput value={targetType === 'minutes' ? 'min' : unitLabel} onChange={(event) => setUnitLabel(event.target.value)} disabled={targetType === 'minutes'} />
            </FormField>
          </>
        )}
        <FormField label="Minimum Version">
          <TextInput dir="auto" value={minimumVersion} onChange={(event) => setMinimumVersion(event.target.value)} placeholder="Smallest valid version" style={{ fontFamily: minimumArabic ? 'var(--font-arabic)' : 'var(--font-sans)' }} />
        </FormField>
```

- [ ] **Step 7: Replace the advanced section's description, anchor date, and recovery days fields**

Find:
```tsx
            <div>
              <label style={{ display: 'block', fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>Description</label>
              <textarea className="input" dir="auto" value={description} onChange={(event) => setDescription(event.target.value)} rows={2} style={{ resize: 'none', fontFamily: descriptionArabic ? 'var(--font-arabic)' : 'var(--font-sans)' }} placeholder="Why this matters" />
            </div>

            {cadenceType === 'interval' && (
              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>Anchor Date</label>
                <input className="input" type="date" lang="en-GB" value={cadenceAnchorDate} onChange={(event) => setCadenceAnchorDate(event.target.value)} />
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>Recovery Days</label>
              <input className="input" type="number" min={0} max={7} value={recoveryGraceDays} onChange={(event) => setRecoveryGraceDays(parseInt(event.target.value, 10) || 0)} />
            </div>
```
Replace with:
```tsx
            <FormField label="Description">
              <Textarea dir="auto" value={description} onChange={(event) => setDescription(event.target.value)} rows={2} style={{ resize: 'none', fontFamily: descriptionArabic ? 'var(--font-arabic)' : 'var(--font-sans)' }} placeholder="Why this matters" />
            </FormField>

            {cadenceType === 'interval' && (
              <FormField label="Anchor Date">
                <TextInput type="date" lang="en-GB" value={cadenceAnchorDate} onChange={(event) => setCadenceAnchorDate(event.target.value)} />
              </FormField>
            )}

            <FormField label="Recovery Days">
              <TextInput type="number" min={0} max={7} value={recoveryGraceDays} onChange={(event) => setRecoveryGraceDays(parseInt(event.target.value, 10) || 0)} />
            </FormField>
```

- [ ] **Step 8: Replace the "Selected Days" weekday toggle grid**

Find:
```tsx
      {cadenceType === 'selected_days' && (
        <div>
          <label style={{ display: 'block', fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>Selected Days</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(68px, 1fr))', gap: 'var(--space-2)' }}>
            {WEEKDAY_NAMES.map((name, index) => (
              <button key={name} type="button" className={clsx('btn', selectedDays.includes(index) ? 'btn-primary' : 'btn-ghost')} onClick={() => toggleWeekday(index)} style={{ padding: 'var(--space-1) 0' }}>
                {name}
              </button>
            ))}
          </div>
        </div>
      )}
```
Replace with:
```tsx
      {cadenceType === 'selected_days' && (
        <FormField label="Selected Days">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(68px, 1fr))', gap: 'var(--space-2)' }}>
            {WEEKDAY_NAMES.map((name, index) => (
              <ToggleChip key={name} active={selectedDays.includes(index)} onClick={() => toggleWeekday(index)} style={{ padding: 'var(--space-1) 0', justifyContent: 'center' }}>
                {name}
              </ToggleChip>
            ))}
          </div>
        </FormField>
      )}
```

- [ ] **Step 9: Check whether `clsx` is still used elsewhere in the file**

```bash
grep -n "clsx(" src/pages/Habits.tsx
```
If no remaining matches, remove the `import { clsx } from 'clsx';` line. If matches remain (e.g. on habit list rows elsewhere in the page, unrelated to this form), leave the import in place.

- [ ] **Step 10: Type-check**

```bash
npx tsc --noEmit
```
Expected: clean.

- [ ] **Step 11: Commit**

```bash
git add src/pages/Habits.tsx
git commit -m "polish: apply shared form components to Habits create/edit form"
```

---

## Task 6: Goals.tsx goal create/edit form

**Files:**
- Modify: `src/pages/Goals.tsx`

- [ ] **Step 1: Add the import**

Add near the top of the file, alongside the existing `domain-utils` import:
```tsx
import { FormField, TextInput, Textarea, ToggleChip } from '../components/shared/form';
```

- [ ] **Step 2: Replace the domain picker**

Find:
```tsx
      {!parentGoalId && !isEditing && (
        <div>
          <label style={{ display: 'block', fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>
            Domain
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)' }}>
            {domains.map((entry) => (
              <button
                key={entry.id}
                type="button"
                data-domain={entry.id}
                onClick={() => setDomain(entry.id)}
                className={clsx('btn', domain === entry.id ? 'btn-primary' : 'btn-ghost')}
                style={{ ...getDomainThemeStyle(entry), padding: 'var(--space-1) var(--space-2)', fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)' }}
              >
                {getDomainLabel(entry.id, domains).toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      )}
```
Replace with:
```tsx
      {!parentGoalId && !isEditing && (
        <FormField label="Domain">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)' }}>
            {domains.map((entry) => (
              <ToggleChip key={entry.id} active={domain === entry.id} onClick={() => setDomain(entry.id)} domain={entry.id} style={getDomainThemeStyle(entry)}>
                {getDomainLabel(entry.id, domains).toUpperCase()}
              </ToggleChip>
            ))}
          </div>
        </FormField>
      )}
```

- [ ] **Step 3: Replace title, description, and next-action fields**

Find:
```tsx
      <div>
        <label style={{ display: 'block', fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>
          Goal Title *
        </label>
        <input className="input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="WHAT ARE YOU DRIVING TOWARD?" autoFocus required />
      </div>

      <div>
        <label style={{ display: 'block', fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>
          Why It Matters
        </label>
        <textarea className="input" value={description} onChange={(event) => setDescription(event.target.value)} rows={2} style={{ resize: 'none' }} placeholder="WHY DOES THIS GOAL MATTER?" />
      </div>

      <div>
        <label style={{ display: 'block', fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>
          Next Action
        </label>
        <input className="input" value={nextAction} onChange={(event) => setNextAction(event.target.value)} placeholder="WHAT IS THE VERY NEXT CONCRETE MOVE?" />
      </div>
```
Replace with:
```tsx
      <FormField label="Goal Title" required>
        <TextInput value={title} onChange={(event) => setTitle(event.target.value)} placeholder="WHAT ARE YOU DRIVING TOWARD?" autoFocus />
      </FormField>

      <FormField label="Why It Matters">
        <Textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} style={{ resize: 'none' }} placeholder="WHY DOES THIS GOAL MATTER?" />
      </FormField>

      <FormField label="Next Action">
        <TextInput value={nextAction} onChange={(event) => setNextAction(event.target.value)} placeholder="WHAT IS THE VERY NEXT CONCRETE MOVE?" />
      </FormField>
```

- [ ] **Step 4: Replace review/target date fields**

Find:
```tsx
      <div className="grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
        <div>
          <label style={{ display: 'block', fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>
            Review Date
          </label>
          <input className="input" type="date" lang="en-GB" value={reviewDate} onChange={(event) => setReviewDate(event.target.value)} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>
            Target Date
          </label>
          <input className="input" type="date" lang="en-GB" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} />
        </div>
      </div>
```
Replace with:
```tsx
      <div className="grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
        <FormField label="Review Date">
          <TextInput type="date" lang="en-GB" value={reviewDate} onChange={(event) => setReviewDate(event.target.value)} />
        </FormField>
        <FormField label="Target Date">
          <TextInput type="date" lang="en-GB" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} />
        </FormField>
      </div>
```

- [ ] **Step 5: Replace the blocked/stalled reason field and the health toggle group**

Find:
```tsx
      <div>
        <label style={{ display: 'block', fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>
          Blocked / Stalled Reason
        </label>
        <textarea className="input" value={blockedBy} onChange={(event) => setBlockedBy(event.target.value)} rows={2} style={{ resize: 'none' }} placeholder="WHAT IS SLOWING THIS GOAL DOWN?" />
      </div>

      <div>
        <label style={{ display: 'block', fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>
          Health
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)' }}>
          {(['on_track', 'at_risk', 'stalled'] as GoalHealth[]).map((value) => (
            <button
              key={value}
              type="button"
              className={clsx('btn', health === value ? 'btn-primary' : 'btn-ghost')}
              onClick={() => setHealth(value)}
              style={{ padding: 'var(--space-1) var(--space-2)', fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)' }}
            >
```
Replace with:
```tsx
      <FormField label="Blocked / Stalled Reason">
        <Textarea value={blockedBy} onChange={(event) => setBlockedBy(event.target.value)} rows={2} style={{ resize: 'none' }} placeholder="WHAT IS SLOWING THIS GOAL DOWN?" />
      </FormField>

      <FormField label="Health">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)' }}>
          {(['on_track', 'at_risk', 'stalled'] as GoalHealth[]).map((value) => (
            <ToggleChip
              key={value}
              active={health === value}
              onClick={() => setHealth(value)}
              style={{ padding: 'var(--space-1) var(--space-2)', fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)' }}
            >
```

Note: this Step only opens the `ToggleChip` — the closing `</button>` a few lines further down (rendering the health label/icon content) must also change to `</ToggleChip>`. Read the surrounding lines after this match to find that specific closing tag and update it in the same edit.

- [ ] **Step 6: Check whether `clsx` is still used elsewhere in the file**

```bash
grep -n "clsx(" src/pages/Goals.tsx
```
Remove the import only if no matches remain.

- [ ] **Step 7: Type-check**

```bash
npx tsc --noEmit
```
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add src/pages/Goals.tsx
git commit -m "polish: apply shared form components to Goals create/edit form"
```

---

## Task 7: Templates.tsx new-template form

**Files:**
- Modify: `src/pages/Templates.tsx`

- [ ] **Step 1: Add the import**

Add alongside the existing imports:
```tsx
import { FormField, TextInput, Textarea, Select } from '../components/shared/form';
```

- [ ] **Step 2: Replace the domain filter select** (utility tier — `Select` only, no `FormField`)

Find:
```tsx
        <select className="input" style={{ width: 180 }} value={domainFilter} onChange={(event) => setDomainFilter(event.target.value as DomainFilter)}>
```
Replace with:
```tsx
        <Select style={{ width: 180 }} value={domainFilter} onChange={(event) => setDomainFilter(event.target.value as DomainFilter)}>
```
And change the matching closing `</select>` a few lines below to `</Select>`.

- [ ] **Step 3: Replace the new-template form fields**

Find:
```tsx
            <form onSubmit={handleCreateTemplate} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <input className="input" placeholder="Template title" value={title} onChange={(event) => setTitle(event.target.value)} disabled={!hasDomains} />
              <textarea className="input" placeholder="Description" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} style={{ resize: 'none' }} disabled={!hasDomains} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
                <select className="input" value={domainId} onChange={(event) => setDomainId(event.target.value as DomainId)} disabled={!hasDomains}>
                  {domains.map((domain) => (
                    <option key={domain.id} value={domain.id}>{getDomainLabel(domain.id, domains).toUpperCase()}</option>
                  ))}
                </select>
                <select className="input" value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>
                  <option value="low">LOW</option>
                  <option value="medium">MEDIUM</option>
                  <option value="high">HIGH</option>
                  <option value="critical">CRITICAL</option>
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
                <input className="input" type="number" min={0} value={timeEstimate} onChange={(event) => setTimeEstimate(event.target.value)} placeholder="Time estimate" disabled={!hasDomains} />
                <select className="input" value={recurrence} onChange={(event) => setRecurrence(event.target.value)} disabled={!hasDomains}>
                  <option value="none">NO REPEAT</option>
                  <option value="daily">DAILY</option>
                  <option value="weekly">WEEKLY</option>
                  <option value="monthly">MONTHLY</option>
                </select>
              </div>
              <select className="input" value={energyLevel} onChange={(event) => setEnergyLevel(event.target.value as EnergyLevel)} disabled={!hasDomains}>
                <option value="deep">DEEP ENERGY</option>
                <option value="medium">MEDIUM ENERGY</option>
                <option value="light">LIGHT ENERGY</option>
              </select>
```
Replace with:
```tsx
            <form onSubmit={handleCreateTemplate} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <FormField label="Title">
                <TextInput placeholder="Template title" value={title} onChange={(event) => setTitle(event.target.value)} disabled={!hasDomains} />
              </FormField>
              <FormField label="Description">
                <Textarea placeholder="Description" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} style={{ resize: 'none' }} disabled={!hasDomains} />
              </FormField>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
                <FormField label="Domain">
                  <Select value={domainId} onChange={(event) => setDomainId(event.target.value as DomainId)} disabled={!hasDomains}>
                    {domains.map((domain) => (
                      <option key={domain.id} value={domain.id}>{getDomainLabel(domain.id, domains).toUpperCase()}</option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Priority">
                  <Select value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>
                    <option value="low">LOW</option>
                    <option value="medium">MEDIUM</option>
                    <option value="high">HIGH</option>
                    <option value="critical">CRITICAL</option>
                  </Select>
                </FormField>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
                <FormField label="Time Estimate">
                  <TextInput type="number" min={0} value={timeEstimate} onChange={(event) => setTimeEstimate(event.target.value)} placeholder="Time estimate" disabled={!hasDomains} />
                </FormField>
                <FormField label="Recurrence">
                  <Select value={recurrence} onChange={(event) => setRecurrence(event.target.value)} disabled={!hasDomains}>
                    <option value="none">NO REPEAT</option>
                    <option value="daily">DAILY</option>
                    <option value="weekly">WEEKLY</option>
                    <option value="monthly">MONTHLY</option>
                  </Select>
                </FormField>
              </div>
              <FormField label="Energy">
                <Select value={energyLevel} onChange={(event) => setEnergyLevel(event.target.value as EnergyLevel)} disabled={!hasDomains}>
                  <option value="deep">DEEP ENERGY</option>
                  <option value="medium">MEDIUM ENERGY</option>
                  <option value="light">LIGHT ENERGY</option>
                </Select>
              </FormField>
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Templates.tsx
git commit -m "polish: apply shared form components to Templates new-template form"
```

---

## Task 8: Onboarding.tsx

**Files:**
- Modify: `src/components/Onboarding.tsx`

- [ ] **Step 1: Add the import**

Add alongside existing imports:
```tsx
import { FormField, TextInput, ToggleChip } from './shared/form';
```

- [ ] **Step 2: Replace the "Add Domain" fields (step 0)**

Find:
```tsx
                  <input className="input" placeholder="DOMAIN NAME" value={domainName} onChange={(event) => setDomainName(event.target.value)} />
                  <input className="input" placeholder="ICON OR TAG" value={domainIcon} maxLength={8} onChange={(event) => setDomainIcon(event.target.value)} />
                  <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                    <input className="input" value={domainColor} onChange={(event) => setDomainColor(event.target.value)} placeholder="#7C6CFF" style={{ flex: 1 }} />
```
Replace with:
```tsx
                  <FormField label="Domain Name">
                    <TextInput placeholder="DOMAIN NAME" value={domainName} onChange={(event) => setDomainName(event.target.value)} />
                  </FormField>
                  <FormField label="Icon or Tag">
                    <TextInput placeholder="ICON OR TAG" value={domainIcon} maxLength={8} onChange={(event) => setDomainIcon(event.target.value)} />
                  </FormField>
                  <FormField label="Color">
                  <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                    <TextInput value={domainColor} onChange={(event) => setDomainColor(event.target.value)} placeholder="#7C6CFF" style={{ flex: 1 }} />
```
The existing `<input type="color" .../>` swatch immediately after stays as a plain `<input>` (color pickers aren't part of the shared text-input pattern). Close the new `FormField` wrapper by adding one more `</FormField>` after that color-swatch input's existing closing `</div>`.

- [ ] **Step 3: Replace the habit-name field (step 2) and its domain picker**

Find:
```tsx
              <div>
                <label style={{ display: 'block', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>Habit Name</label>
                <input className="input" placeholder="E.G. REVIEW PRIORITIES, WALK, TRAIN, STUDY..." value={habitTitle} onChange={(event) => setHabitTitle(event.target.value)} autoFocus />
              </div>
              <div>
                <label style={{ display: 'block', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>Area</label>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, orderedDomains.length)}, minmax(0, 1fr))`, gap: 'var(--space-2)' }}>
                  {orderedDomains.map((domain) => (
                    <button
                      key={domain.id}
                      type="button"
                      data-domain={domain.id}
                      onClick={() => setHabitDomain(domain.id)}
                      className={habitDomain === domain.id ? 'btn btn-primary' : 'btn btn-ghost'}
                      style={{ ...getDomainThemeStyle(domain), fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)' }}
                    >
                      {getDomainLabel(domain.id, orderedDomains).toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
```
Replace with:
```tsx
              <FormField label="Habit Name">
                <TextInput placeholder="E.G. REVIEW PRIORITIES, WALK, TRAIN, STUDY..." value={habitTitle} onChange={(event) => setHabitTitle(event.target.value)} autoFocus />
              </FormField>
              <FormField label="Area">
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, orderedDomains.length)}, minmax(0, 1fr))`, gap: 'var(--space-2)' }}>
                  {orderedDomains.map((domain) => (
                    <ToggleChip
                      key={domain.id}
                      active={habitDomain === domain.id}
                      onClick={() => setHabitDomain(domain.id)}
                      domain={domain.id}
                      style={{ ...getDomainThemeStyle(domain), fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)' }}
                    >
                      {getDomainLabel(domain.id, orderedDomains).toUpperCase()}
                    </ToggleChip>
                  ))}
                </div>
              </FormField>
```

- [ ] **Step 4: Replace the task-title field (step 3) and its domain picker**

Find:
```tsx
              <div>
                <label style={{ display: 'block', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>Task Title</label>
                <input className="input" placeholder="WHAT MUST MOVE FORWARD?" value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} autoFocus />
              </div>
              <div>
                <label style={{ display: 'block', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>Area</label>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, orderedDomains.length)}, minmax(0, 1fr))`, gap: 'var(--space-2)' }}>
                  {orderedDomains.map((domain) => (
                    <button
                      key={domain.id}
                      type="button"
                      data-domain={domain.id}
                      onClick={() => setTaskDomain(domain.id)}
                      className={taskDomain === domain.id ? 'btn btn-primary' : 'btn btn-ghost'}
                      style={{ ...getDomainThemeStyle(domain), fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)' }}
                    >
                      {getDomainLabel(domain.id, orderedDomains).toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
```
Replace with:
```tsx
              <FormField label="Task Title">
                <TextInput placeholder="WHAT MUST MOVE FORWARD?" value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} autoFocus />
              </FormField>
              <FormField label="Area">
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, orderedDomains.length)}, minmax(0, 1fr))`, gap: 'var(--space-2)' }}>
                  {orderedDomains.map((domain) => (
                    <ToggleChip
                      key={domain.id}
                      active={taskDomain === domain.id}
                      onClick={() => setTaskDomain(domain.id)}
                      domain={domain.id}
                      style={{ ...getDomainThemeStyle(domain), fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)' }}
                    >
                      {getDomainLabel(domain.id, orderedDomains).toUpperCase()}
                    </ToggleChip>
                  ))}
                </div>
              </FormField>
```

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/Onboarding.tsx
git commit -m "polish: apply shared form components to Onboarding wizard fields"
```

---

## Task 9: Settings.tsx — Sync Account fields

**Files:**
- Modify: `src/pages/Settings.tsx`

- [ ] **Step 1: Add the import**

Add alongside existing imports:
```tsx
import { FormField, TextInput, Select } from '../components/shared/form';
```

- [ ] **Step 2: Replace the Sync Account fields**

Find:
```tsx
            <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <span style={rowLabelStyle}>SUPABASE URL</span>
              <input className="input" value={syncUrlInput} onChange={(event) => setSyncUrlInput(event.target.value)} placeholder="https://project.supabase.co" />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <span style={rowLabelStyle}>ANON KEY</span>
              <input className="input" value={syncAnonKeyInput} onChange={(event) => setSyncAnonKeyInput(event.target.value)} placeholder="eyJ..." />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <span style={rowLabelStyle}>EMAIL</span>
              <input className="input" value={syncEmailInput} onChange={(event) => setSyncEmailInput(event.target.value)} placeholder="you@example.com" />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <span style={rowLabelStyle}>PASSWORD</span>
              <input className="input" type="password" value={syncPasswordInput} onChange={(event) => setSyncPasswordInput(event.target.value)} placeholder="Required to connect" />
            </label>
```
Replace with:
```tsx
            <FormField label="Supabase URL">
              <TextInput value={syncUrlInput} onChange={(event) => setSyncUrlInput(event.target.value)} placeholder="https://project.supabase.co" />
            </FormField>
            <FormField label="Anon Key">
              <TextInput value={syncAnonKeyInput} onChange={(event) => setSyncAnonKeyInput(event.target.value)} placeholder="eyJ..." />
            </FormField>
            <FormField label="Email">
              <TextInput value={syncEmailInput} onChange={(event) => setSyncEmailInput(event.target.value)} placeholder="you@example.com" />
            </FormField>
            <FormField label="Password">
              <TextInput type="password" value={syncPasswordInput} onChange={(event) => setSyncPasswordInput(event.target.value)} placeholder="Required to connect" />
            </FormField>
```
(`rowLabelStyle` is Settings.tsx's existing uppercase-tracked label style constant, used elsewhere in the file for non-form display labels too — it is intentionally left as-is everywhere it's used for those non-form purposes; this task only replaces its use inside actual form field labels with `FormField`'s own label styling.)

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```
Expected: clean (other `.input` usages later in the file are untouched until later tasks).

- [ ] **Step 4: Commit**

```bash
git add src/pages/Settings.tsx
git commit -m "polish: apply shared form components to Settings sync account fields"
```

---

## Task 10: Settings.tsx — Backup fields

**Files:**
- Modify: `src/pages/Settings.tsx`

- [ ] **Step 1: Replace the backup folder path field**

Find:
```tsx
          <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <span style={rowLabelStyle}>BACKUP FOLDER PATH</span>
            <input
              className="input"
              value={backupDirectoryInput}
              onChange={(e) => setBackupDirectoryInput(e.target.value)}
              placeholder="C:\\Users\\YourName\\Syncthing\\Life OS"
            />
          </label>
```
Replace with:
```tsx
          <FormField label="Backup Folder Path">
            <TextInput
              value={backupDirectoryInput}
              onChange={(e) => setBackupDirectoryInput(e.target.value)}
              placeholder="C:\\Users\\YourName\\Syncthing\\Life OS"
            />
          </FormField>
```
(The checkbox label immediately after this — "CREATE ONE BACKUP AUTOMATICALLY PER DAY ON APP OPEN" — is left untouched; checkboxes with inline label text aren't part of this component set.)

- [ ] **Step 2: Replace the snapshot name field**

Find:
```tsx
            <input
              className="input"
              value={snapshotName}
              onChange={(e) => setSnapshotName(e.target.value)}
              placeholder="weekly-plan-clean-state"
              style={{ maxWidth: 320 }}
            />
```
Replace with:
```tsx
            <TextInput
              value={snapshotName}
              onChange={(e) => setSnapshotName(e.target.value)}
              placeholder="weekly-plan-clean-state"
              style={{ maxWidth: 320 }}
            />
```
(Utility-tier — no `FormField` wrapper, since this field sits inline next to its "CREATE NAMED SNAPSHOT" button rather than in a standalone labeled position.)

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Settings.tsx
git commit -m "polish: apply shared form components to Settings backup fields"
```

---

## Task 11: Settings.tsx — Display Tuning and Domain Profiles fields

**Files:**
- Modify: `src/pages/Settings.tsx`

- [ ] **Step 1: Replace the Display Tuning selects**

Find:
```tsx
            <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <span style={rowLabelStyle}>TEXT SCALE</span>
              <select className="input" value={textScale} onChange={(e) => setTextScale(e.target.value as 'normal' | 'large' | 'xl')}>
                <option value="normal">NORMAL</option>
                <option value="large">LARGE</option>
                <option value="xl">XL</option>
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <span style={rowLabelStyle}>UI DENSITY</span>
              <select className="input" value={uiDensity} onChange={(e) => setUiDensity(e.target.value as 'compact' | 'comfortable')}>
                <option value="compact">COMPACT</option>
                <option value="comfortable">COMFORTABLE</option>
              </select>
            </label>
```
Replace with:
```tsx
            <FormField label="Text Scale">
              <Select value={textScale} onChange={(e) => setTextScale(e.target.value as 'normal' | 'large' | 'xl')}>
                <option value="normal">NORMAL</option>
                <option value="large">LARGE</option>
                <option value="xl">XL</option>
              </Select>
            </FormField>
            <FormField label="UI Density">
              <Select value={uiDensity} onChange={(e) => setUiDensity(e.target.value as 'compact' | 'comfortable')}>
                <option value="compact">COMPACT</option>
                <option value="comfortable">COMFORTABLE</option>
              </Select>
            </FormField>
```

- [ ] **Step 2: Replace the per-domain draft fields**

Find:
```tsx
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    <span style={rowLabelStyle}>DISPLAY NAME</span>
                    <input className="input" value={domain.name} onChange={(event) => handleDomainDraftChange(domain.id, 'name', event.target.value)} />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    <span style={rowLabelStyle}>ICON</span>
                    <input className="input" value={domain.icon} onChange={(event) => handleDomainDraftChange(domain.id, 'icon', event.target.value)} placeholder="[A] or emoji" maxLength={8} />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    <span style={rowLabelStyle}>COLOR</span>
                    <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                      <input className="input" value={domain.color} onChange={(event) => handleDomainDraftChange(domain.id, 'color', event.target.value)} placeholder="#7C6CFF" style={{ flex: 1 }} />
                      <input type="color" value={isHexColor(domain.color) ? domain.color : '#7C6CFF'} onChange={(event) => handleDomainDraftChange(domain.id, 'color', event.target.value)} style={{ width: 42, height: 42, border: '1px solid var(--color-border)', background: 'var(--color-surface-hover)' }} />
                    </div>
                  </label>
```
Replace with:
```tsx
                  <FormField label="Display Name">
                    <TextInput value={domain.name} onChange={(event) => handleDomainDraftChange(domain.id, 'name', event.target.value)} />
                  </FormField>
                  <FormField label="Icon">
                    <TextInput value={domain.icon} onChange={(event) => handleDomainDraftChange(domain.id, 'icon', event.target.value)} placeholder="[A] or emoji" maxLength={8} />
                  </FormField>
                  <FormField label="Color">
                    <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                      <TextInput value={domain.color} onChange={(event) => handleDomainDraftChange(domain.id, 'color', event.target.value)} placeholder="#7C6CFF" style={{ flex: 1 }} />
                      <input type="color" value={isHexColor(domain.color) ? domain.color : '#7C6CFF'} onChange={(event) => handleDomainDraftChange(domain.id, 'color', event.target.value)} style={{ width: 42, height: 42, border: '1px solid var(--color-border)', background: 'var(--color-surface-hover)' }} />
                    </div>
                  </FormField>
```

- [ ] **Step 3: Replace the "Add Domain" fields**

Find:
```tsx
              <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <span style={rowLabelStyle}>DISPLAY NAME</span>
                <input className="input" value={newDomainDraft.name} onChange={(event) => setNewDomainDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Work, Health, Study..." />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <span style={rowLabelStyle}>ICON</span>
                <input className="input" value={newDomainDraft.icon} onChange={(event) => setNewDomainDraft((current) => ({ ...current, icon: event.target.value }))} maxLength={8} placeholder="[D]" />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <span style={rowLabelStyle}>COLOR</span>
                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                  <input className="input" value={newDomainDraft.color} onChange={(event) => setNewDomainDraft((current) => ({ ...current, color: event.target.value }))} placeholder="#7C6CFF" style={{ flex: 1 }} />
                  <input type="color" value={isHexColor(newDomainDraft.color) ? newDomainDraft.color : '#7C6CFF'} onChange={(event) => setNewDomainDraft((current) => ({ ...current, color: event.target.value }))} style={{ width: 42, height: 42, border: '1px solid var(--color-border)', background: 'var(--color-surface-hover)' }} />
                </div>
              </label>
```
Replace with:
```tsx
              <FormField label="Display Name">
                <TextInput value={newDomainDraft.name} onChange={(event) => setNewDomainDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Work, Health, Study..." />
              </FormField>
              <FormField label="Icon">
                <TextInput value={newDomainDraft.icon} onChange={(event) => setNewDomainDraft((current) => ({ ...current, icon: event.target.value }))} maxLength={8} placeholder="[D]" />
              </FormField>
              <FormField label="Color">
                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                  <TextInput value={newDomainDraft.color} onChange={(event) => setNewDomainDraft((current) => ({ ...current, color: event.target.value }))} placeholder="#7C6CFF" style={{ flex: 1 }} />
                  <input type="color" value={isHexColor(newDomainDraft.color) ? newDomainDraft.color : '#7C6CFF'} onChange={(event) => setNewDomainDraft((current) => ({ ...current, color: event.target.value }))} style={{ width: 42, height: 42, border: '1px solid var(--color-border)', background: 'var(--color-surface-hover)' }} />
                </div>
              </FormField>
```

- [ ] **Step 4: Confirm no remaining raw `className="input"` usages in the file**

```bash
grep -n 'className="input"' src/pages/Settings.tsx
```
Expected: no output (all 15 original occurrences converted across Tasks 9-11). If any remain, they were missed by an earlier task's find/replace — locate and convert them following the same `FormField`+`TextInput`/`Select` pattern used above.

- [ ] **Step 5: Type-check and build**

```bash
npx tsc --noEmit
npm run build
```
Expected: both clean.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Settings.tsx
git commit -m "polish: apply shared form components to Settings display and domain fields"
```

---

## Task 12: HabitHistoryEditor.tsx and FocusTimer.tsx

**Files:**
- Modify: `src/components/habits/HabitHistoryEditor.tsx`
- Modify: `src/components/shared/FocusTimer.tsx`

`HabitHistoryEditor` has one real field (a date picker); its action buttons (COMPLETE, SAVE MINIMUM, SKIP, UNDO LOG) are distinct actions, not toggleable choices, so they stay plain `.btn` buttons — `ToggleChip` doesn't apply here.

- [ ] **Step 1: Add the import to `HabitHistoryEditor.tsx`**

Find:
```tsx
import { HABIT_STATUS_LABELS } from './HabitCard';
import type { Habit, HabitLog } from '../../lib/types';
```
Replace with:
```tsx
import { HABIT_STATUS_LABELS } from './HabitCard';
import { FormField, TextInput } from '../shared/form';
import type { Habit, HabitLog } from '../../lib/types';
```

- [ ] **Step 2: Replace the date field**

Find:
```tsx
          <label className="meta-label" htmlFor="habit-history-date">Date To Adjust</label>
          <input
            id="habit-history-date"
            className="input"
            type="date"
            lang="en-GB"
            min={activationDate}
            max={today}
            value={selectedDate}
            onChange={(event) => onSelectDate(event.target.value)}
          />
```
Replace with:
```tsx
          <FormField label="Date To Adjust">
            <TextInput
              id="habit-history-date"
              type="date"
              lang="en-GB"
              min={activationDate}
              max={today}
              value={selectedDate}
              onChange={(event) => onSelectDate(event.target.value)}
            />
          </FormField>
```

- [ ] **Step 3: Add the import to `FocusTimer.tsx`**

Find:
```tsx
import { Modal } from './Modal';
```
Replace with:
```tsx
import { Modal } from './Modal';
import { FormField, TextInput, Textarea } from './form';
```

- [ ] **Step 4: Replace the Planned Minutes and Interruption Notes fields**

Find:
```tsx
            <div>
              <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-weight-regular)', color: 'var(--color-text)', marginBottom: 'var(--space-2)', textTransform: 'uppercase', letterSpacing: 1 }}>Planned Minutes</label>
              <input
                className="input"
                type="number"
                min={5}
                step={5}
                value={activeDraft.planned_minutes}
                onChange={(event) => { void setPlannedMinutes(parseInt(event.target.value, 10) || 25); }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-weight-regular)', color: 'var(--color-text)', marginBottom: 'var(--space-2)', textTransform: 'uppercase', letterSpacing: 1 }}>Interruption Notes</label>
              <input
                className="input"
                value={activeDraft.interruption_notes ?? ''}
                onChange={(event) => { void setInterruptionNotes(event.target.value); }}
                placeholder="What pulled you away?"
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-weight-regular)', color: 'var(--color-text)', marginBottom: 'var(--space-2)', textTransform: 'uppercase', letterSpacing: 1 }}>Reflection</label>
            <textarea
              className="input"
              rows={4}
              value={activeDraft.reflection ?? ''}
              onChange={(event) => { void setReflection(event.target.value); }}
              placeholder="What moved forward, and what should change next time?"
              style={{ resize: 'none' }}
            />
          </div>
```
Replace with:
```tsx
            <FormField label="Planned Minutes">
              <TextInput
                type="number"
                min={5}
                step={5}
                value={activeDraft.planned_minutes}
                onChange={(event) => { void setPlannedMinutes(parseInt(event.target.value, 10) || 25); }}
              />
            </FormField>
            <FormField label="Interruption Notes">
              <TextInput
                value={activeDraft.interruption_notes ?? ''}
                onChange={(event) => { void setInterruptionNotes(event.target.value); }}
                placeholder="What pulled you away?"
              />
            </FormField>
          </div>

          <FormField label="Reflection">
            <Textarea
              rows={4}
              value={activeDraft.reflection ?? ''}
              onChange={(event) => { void setReflection(event.target.value); }}
              placeholder="What moved forward, and what should change next time?"
              style={{ resize: 'none' }}
            />
          </FormField>
```

- [ ] **Step 5: Type-check both files**

```bash
npx tsc --noEmit
```
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/habits/HabitHistoryEditor.tsx src/components/shared/FocusTimer.tsx
git commit -m "polish: apply shared form components to HabitHistoryEditor and FocusTimer"
```

---

## Task 13: GlobalSearch.tsx and Notes.tsx search bars

**Files:**
- Modify: `src/components/shared/GlobalSearch.tsx`
- Modify: `src/pages/Notes.tsx`

Utility tier — single search input each, `TextInput` only, no `FormField`.

- [ ] **Step 1: Add the import to `GlobalSearch.tsx`**

Find:
```tsx
import { getDomainLabel, getDomainThemeStyle } from '../../lib/domain-utils';
```
Replace with:
```tsx
import { getDomainLabel, getDomainThemeStyle } from '../../lib/domain-utils';
import { TextInput } from './form';
```

- [ ] **Step 2: Replace the search input**

Find:
```tsx
          <input
            ref={inputRef}
            className="input"
            style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-weight-regular)', padding: 0 }}
            placeholder="SEARCH TASKS, GOALS, NOTES, HABITS..."
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelected(0);
            }}
          />
```
Replace with:
```tsx
          <TextInput
            ref={inputRef}
            style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-weight-regular)', padding: 0 }}
            placeholder="SEARCH TASKS, GOALS, NOTES, HABITS..."
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelected(0);
            }}
          />
```

- [ ] **Step 3: Add the import to `Notes.tsx`**

Add alongside existing imports:
```tsx
import { TextInput } from '../components/shared/form';
```

- [ ] **Step 4: Replace the notes search input**

Find:
```tsx
          <input
            className="input"
            placeholder="> SEARCH ENTRIES..."
            value={searchQuery}
            onChange={(e) => setSearch(e.target.value)}
            style={{ height: 28, fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)' }}
          />
```
Replace with:
```tsx
          <TextInput
            placeholder="> SEARCH ENTRIES..."
            value={searchQuery}
            onChange={(e) => setSearch(e.target.value)}
            style={{ height: 28, fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)' }}
          />
```

- [ ] **Step 5: Check for any other remaining `className="input"` usages in `Notes.tsx`**

```bash
grep -n 'className="input"' src/pages/Notes.tsx
```
The design spec's file audit found 4 occurrences in this file; if more remain after Step 4, they are additional note-editing fields (e.g. a title input in the note editor pane) — apply the same `TextInput` replacement (utility tier, no `FormField`, since the note editor is a freeform content area, not a structured multi-field form).

- [ ] **Step 6: Type-check**

```bash
npx tsc --noEmit
```
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/components/shared/GlobalSearch.tsx src/pages/Notes.tsx
git commit -m "polish: apply shared TextInput to GlobalSearch and Notes search bars"
```

---

## Task 14: WeeklyReview.tsx, Today.tsx, and Tasks.tsx utility fields

**Files:**
- Modify: `src/pages/WeeklyReview.tsx`
- Modify: `src/pages/Today.tsx`
- Modify: `src/pages/Tasks.tsx`

Utility tier — standalone textareas/selects embedded in larger pages, not structured multi-field forms. `TextInput`/`Textarea`/`Select` only, no `FormField`/`FormSection` wrapping (each of these already has its own heading/label text elsewhere in the surrounding page layout, established by prior polish passes).

- [ ] **Step 1: Add the import to `WeeklyReview.tsx`**

Add alongside existing imports:
```tsx
import { Textarea } from '../components/shared/form';
```

- [ ] **Step 2: Replace each textarea in `WeeklyReview.tsx`**

Find and replace each of these five, one at a time (they are distinct lines, not a contiguous block):

```tsx
            <textarea className="input" style={{ width: '100%', minHeight: 90, resize: 'vertical' }} placeholder={data.focusSuggestion} value={focusTheme} onChange={(event) => setFocusTheme(event.target.value)} />
```
→
```tsx
            <Textarea style={{ width: '100%', minHeight: 90, resize: 'vertical' }} placeholder={data.focusSuggestion} value={focusTheme} onChange={(event) => setFocusTheme(event.target.value)} />
```

```tsx
            <textarea className="input" style={{ width: '100%', minHeight: 120, resize: 'vertical' }} placeholder="Capture what actually helped this week." value={whatWorked} onChange={(event) => setWhatWorked(event.target.value)} />
```
→
```tsx
            <Textarea style={{ width: '100%', minHeight: 120, resize: 'vertical' }} placeholder="Capture what actually helped this week." value={whatWorked} onChange={(event) => setWhatWorked(event.target.value)} />
```

```tsx
          <textarea className="input" style={{ width: '100%', minHeight: 140, resize: 'vertical' }} placeholder={defaultTopThreeText || '1. [Domain] ...\n2. [Domain] ...\n3. [Domain] ...'} value={topThree} onChange={(event) => setTopThree(event.target.value)} />
```
→
```tsx
          <Textarea style={{ width: '100%', minHeight: 140, resize: 'vertical' }} placeholder={defaultTopThreeText || '1. [Domain] ...\n2. [Domain] ...\n3. [Domain] ...'} value={topThree} onChange={(event) => setTopThree(event.target.value)} />
```

```tsx
            <textarea className="input" style={{ width: '100%', minHeight: 90, resize: 'vertical' }} placeholder="What slipped this week?" value={whatSlipped} onChange={(event) => setWhatSlipped(event.target.value)} />
```
→
```tsx
            <Textarea style={{ width: '100%', minHeight: 90, resize: 'vertical' }} placeholder="What slipped this week?" value={whatSlipped} onChange={(event) => setWhatSlipped(event.target.value)} />
```

```tsx
            <textarea className="input" style={{ width: '100%', minHeight: 90, resize: 'vertical' }} placeholder="Why did it slip?" value={whyItSlipped} onChange={(event) => setWhyItSlipped(event.target.value)} />
```
→
```tsx
            <Textarea style={{ width: '100%', minHeight: 90, resize: 'vertical' }} placeholder="Why did it slip?" value={whyItSlipped} onChange={(event) => setWhyItSlipped(event.target.value)} />
```

- [ ] **Step 3: Replace the friction-details textarea (also present in `WeeklyReview.tsx`)**

Find:
```tsx
            <textarea className="input" rows={3} value={frictionDetails} onChange={(event) => setFrictionDetails(event.target.value)} placeholder="What got in the way?" style={{ resize: 'none' }} />
```
Replace with:
```tsx
            <Textarea rows={3} value={frictionDetails} onChange={(event) => setFrictionDetails(event.target.value)} placeholder="What got in the way?" style={{ resize: 'none' }} />
```

- [ ] **Step 4: Replace the skip-reason textarea (also present in `WeeklyReview.tsx`)**

Find:
```tsx
            <textarea className="input" value={skipReason} onChange={(event) => setSkipReason(event.target.value)} rows={3} placeholder="Low energy, travel, sick, overloaded..." style={{ resize: 'none' }} />
```
Replace with:
```tsx
            <Textarea value={skipReason} onChange={(event) => setSkipReason(event.target.value)} rows={3} placeholder="Low energy, travel, sick, overloaded..." style={{ resize: 'none' }} />
```

- [ ] **Step 5: Add the import to `Today.tsx`**

Add alongside existing imports:
```tsx
import { TextInput, Select } from '../components/shared/form';
```

- [ ] **Step 6: Replace the selects and text field in `Today.tsx`**

Find:
```tsx
                <select className="input" value={String(availableFocusMinutes)} onChange={(event) => setAvailableFocusMinutes(parseInt(event.target.value, 10) || 60)}>
```
Replace with:
```tsx
                <Select value={String(availableFocusMinutes)} onChange={(event) => setAvailableFocusMinutes(parseInt(event.target.value, 10) || 60)}>
```
(update its matching `</select>` closing tag to `</Select>`)

Find:
```tsx
                <select className="input" value={preferredEnergy} onChange={(event) => setPreferredEnergy(event.target.value as EnergyLevel)}>
```
Replace with:
```tsx
                <Select value={preferredEnergy} onChange={(event) => setPreferredEnergy(event.target.value as EnergyLevel)}>
```
(update its matching `</select>` closing tag to `</Select>`)

Find:
```tsx
              <input className="input" value={tomorrowTaskTitle} onChange={(event) => { setTomorrowTaskTitle(event.target.value); if (event.target.value.trim()) setTomorrowCarryTaskId(null); }} placeholder="What must happen tomorrow?" />
```
Replace with:
```tsx
              <TextInput value={tomorrowTaskTitle} onChange={(event) => { setTomorrowTaskTitle(event.target.value); if (event.target.value.trim()) setTomorrowCarryTaskId(null); }} placeholder="What must happen tomorrow?" />
```

- [ ] **Step 7: Add the `Textarea` import to `Today.tsx` and replace its two textareas**

Add to the same import line from Step 5:
```tsx
import { TextInput, Select, Textarea } from '../components/shared/form';
```

Find:
```tsx
            <textarea className="input" rows={3} value={frictionDetails} onChange={(event) => setFrictionDetails(event.target.value)} placeholder="What got in the way?" style={{ resize: 'none' }} />
```
Replace with:
```tsx
            <Textarea rows={3} value={frictionDetails} onChange={(event) => setFrictionDetails(event.target.value)} placeholder="What got in the way?" style={{ resize: 'none' }} />
```

Find:
```tsx
                    <input className="input" type="date" lang="en-GB" value={customStartDate} onChange={(event) => setCustomStartDate(event.target.value)} />
```
Replace with:
```tsx
                    <TextInput type="date" lang="en-GB" value={customStartDate} onChange={(event) => setCustomStartDate(event.target.value)} />
```

- [ ] **Step 8: Add the import to `Tasks.tsx`**

Add alongside existing imports:
```tsx
import { TextInput, Select, Textarea } from '../components/shared/form';
```

- [ ] **Step 9: Replace the filter bar selects and other fields in `Tasks.tsx`**

Find each of these four selects and replace `<select className="input"` with `<Select`, updating the matching `</select>` to `</Select>` for each:
```tsx
          <select className="input" style={{ width: 'auto' }} value={filterDomain} onChange={(event) => setFilterDomain(event.target.value as FilterDomain)}>
```
```tsx
          <select className="input" style={{ width: 'auto' }} value={filterStatus} onChange={(event) => setFilterStatus(event.target.value as FilterStatus)}>
```
```tsx
            <select className="input" style={{ width: 'auto' }} value={filterPriority} onChange={(event) => setFilterPriority(event.target.value as FilterPriority)}>
```
```tsx
            <select className="input" style={{ width: 'auto' }} value={sortBy} onChange={(event) => setSortBy(event.target.value as SortBy)}>
```

Find:
```tsx
                    <input className="input" type="date" lang="en-GB" value={customStartDate} onChange={(event) => setCustomStartDate(event.target.value)} />
```
Replace with:
```tsx
                    <TextInput type="date" lang="en-GB" value={customStartDate} onChange={(event) => setCustomStartDate(event.target.value)} />
```

Find:
```tsx
            <textarea className="input" rows={3} value={frictionDetails} onChange={(event) => setFrictionDetails(event.target.value)} placeholder="What got in the way?" style={{ resize: 'none' }} />
```
Replace with:
```tsx
            <Textarea rows={3} value={frictionDetails} onChange={(event) => setFrictionDetails(event.target.value)} placeholder="What got in the way?" style={{ resize: 'none' }} />
```

- [ ] **Step 10: Type-check all three files**

```bash
npx tsc --noEmit
```
Expected: clean.

- [ ] **Step 11: Commit**

```bash
git add src/pages/WeeklyReview.tsx src/pages/Today.tsx src/pages/Tasks.tsx
git commit -m "polish: apply shared TextInput/Textarea/Select to WeeklyReview, Today, and Tasks utility fields"
```

---

## Task 15: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Confirm no unconverted `.input`/`.btn` form patterns remain outside intentional exceptions**

```bash
grep -rn 'className="input"' src/ --include="*.tsx"
```
Expected: no output, or only in files not covered by this plan's scope (double-check any hit against the file list in Tasks 1-14 before treating it as a real miss — this plan's design spec explicitly scoped out mobile and non-form utility spots that were never using `.input` to begin with).

- [ ] **Step 2: Confirm the new form components are used consistently**

```bash
grep -rl "from '.*shared/form'" src/ --include="*.tsx" | wc -l
```
Expected: at least 14 files (one per task file touched, Task 1's own component files excluded from the count since they don't import from themselves).

- [ ] **Step 3: Static analysis**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Run the test suite**

```bash
npm test
```
Expected: all tests pass, including the new `FormField.test.tsx` tests from Task 1.

- [ ] **Step 5: Production build**

```bash
npm run build
```
Expected: clean build, no new warnings beyond the pre-existing chunk-size notice.

- [ ] **Step 6: Visual smoke test**

Start the dev server (`preview_start` with the existing `life-os-dev` launch config) and click through every form touched by this plan: create/edit a task (TaskForm), quick-add a task, quick-capture, create/edit a habit, create/edit a goal, save a task template, the Onboarding wizard (if reachable without resetting existing data — otherwise verify visually via the source diff), Settings (sync fields, backup fields, display tuning, domain profiles), the focus-session summary modal, global search, and the notes search bar. Confirm: no visually broken layouts, consistent label styling (no more uppercase-tracked labels, no more clip-path corners), consistent spacing between fields, and the required-field asterisk shows correctly on Title fields (TaskForm, Habits, Goals) when submitted empty.

- [ ] **Step 7: Commit anything found broken** (skip if nothing needed fixing)

```bash
git add -A
git commit -m "polish: fix issues found during form rework final verification"
```
