# Bundle Splitting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the desktop app's single 1.2 MB JS bundle into per-route chunks (via `React.lazy`) and defer `@supabase/supabase-js` until a sync operation actually runs, so cold app boot no longer pays for JS the user may never touch that session.

**Architecture:** Two independent, small changes: (1) convert `App.tsx`'s 12 static page imports to `React.lazy()` with a `<Suspense fallback={null}>` boundary around `<Routes>`, which — as a side effect — isolates `recharts` into the `Analytics` chunk since it's the sole importer; (2) convert `src/lib/sync/service.ts`'s `buildClient()` helper to dynamically `import('@supabase/supabase-js')` internally instead of a top-level static import, deferring that dependency's load until the first actual sync call.

**Tech Stack:** Vite 7 / Rollup (code splitting is automatic on `import()` boundaries — no config changes needed), React 19 (`React.lazy`/`React.Suspense`), TypeScript.

---

### Task 1: Route-based lazy loading in `App.tsx`

**Files:**
- Modify: `src/App.tsx:8-20` (page imports)
- Modify: `src/App.tsx:515-539` (`<Routes>` block)

All 12 page components are exported as named exports (`export const XPage: React.FC = ...`), not default exports, so `React.lazy` needs a `.then()` to reshape the resolved module into `{ default: Component }`.

- [ ] **Step 1: Replace the 12 static page imports with `React.lazy()`**

Find these lines in `src/App.tsx` (currently lines 8-20):

```typescript
import { CommandCenter } from './pages/CommandCenter';
import { TodayPage } from './pages/Today';
import { TasksPage } from './pages/Tasks';
import { HabitsPage } from './pages/Habits';
import { GoalsPage } from './pages/Goals';
import { AnalyticsPage } from './pages/Analytics';
import { DomainPage } from './pages/DomainPage';
import { SettingsPage } from './pages/Settings';
import { NotesPage } from './pages/Notes';
import { CalendarPage } from './pages/Calendar';
import { WeeklyReviewPage } from './pages/WeeklyReview';
import { InboxPage } from './pages/Inbox';
import { TemplatesPage } from './pages/Templates';
```

Replace with:

```typescript
const CommandCenter = React.lazy(() => import('./pages/CommandCenter').then((m) => ({ default: m.CommandCenter })));
const TodayPage = React.lazy(() => import('./pages/Today').then((m) => ({ default: m.TodayPage })));
const TasksPage = React.lazy(() => import('./pages/Tasks').then((m) => ({ default: m.TasksPage })));
const HabitsPage = React.lazy(() => import('./pages/Habits').then((m) => ({ default: m.HabitsPage })));
const GoalsPage = React.lazy(() => import('./pages/Goals').then((m) => ({ default: m.GoalsPage })));
const AnalyticsPage = React.lazy(() => import('./pages/Analytics').then((m) => ({ default: m.AnalyticsPage })));
const DomainPage = React.lazy(() => import('./pages/DomainPage').then((m) => ({ default: m.DomainPage })));
const SettingsPage = React.lazy(() => import('./pages/Settings').then((m) => ({ default: m.SettingsPage })));
const NotesPage = React.lazy(() => import('./pages/Notes').then((m) => ({ default: m.NotesPage })));
const CalendarPage = React.lazy(() => import('./pages/Calendar').then((m) => ({ default: m.CalendarPage })));
const WeeklyReviewPage = React.lazy(() => import('./pages/WeeklyReview').then((m) => ({ default: m.WeeklyReviewPage })));
const InboxPage = React.lazy(() => import('./pages/Inbox').then((m) => ({ default: m.InboxPage })));
const TemplatesPage = React.lazy(() => import('./pages/Templates').then((m) => ({ default: m.TemplatesPage })));
```

This must be placed at module scope (top-level, same place the removed imports were — not inside the `App` component function), since `React.lazy` should only be called once per component, not on every render. `React` is already imported as the default import at the top of `App.tsx` (`import React, { useEffect, useMemo, useRef, useState } from 'react';`), so `React.lazy` is available with no import changes.

- [ ] **Step 2: Wrap the `<Routes>` block in `<React.Suspense fallback={null}>`**

Find this block in `src/App.tsx` (currently lines 515-539):

```tsx
        <Routes>
          <Route path="/" element={<Navigate to="/today" replace />} />
          <Route path="/today" element={<TodayPage />} />
          <Route path="/overview" element={<CommandCenter />} />
          <Route path="/command-center" element={<Navigate to="/overview" replace />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/inbox" element={<InboxPage />} />
          <Route path="/habits" element={<HabitsPage />} />
          <Route path="/goals" element={<GoalsPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/domain/:domainId" element={<DomainPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/notes" element={<NotesPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/review" element={<Navigate to="/weekly-review" replace />} />
          <Route
            path="/weekly-review"
            element={(
              <RouteErrorBoundary scope="weekly-review">
                <WeeklyReviewPage />
              </RouteErrorBoundary>
            )}
          />
          <Route path="/templates" element={<TemplatesPage />} />
        </Routes>
```

Replace with (identical `<Route>` elements, just wrapped):

```tsx
        <React.Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<Navigate to="/today" replace />} />
            <Route path="/today" element={<TodayPage />} />
            <Route path="/overview" element={<CommandCenter />} />
            <Route path="/command-center" element={<Navigate to="/overview" replace />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/inbox" element={<InboxPage />} />
            <Route path="/habits" element={<HabitsPage />} />
            <Route path="/goals" element={<GoalsPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/domain/:domainId" element={<DomainPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/notes" element={<NotesPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/review" element={<Navigate to="/weekly-review" replace />} />
            <Route
              path="/weekly-review"
              element={(
                <RouteErrorBoundary scope="weekly-review">
                  <WeeklyReviewPage />
                </RouteErrorBoundary>
              )}
            />
            <Route path="/templates" element={<TemplatesPage />} />
          </Routes>
        </React.Suspense>
```

Only indentation and the added `<React.Suspense>`/`</React.Suspense>` wrapper lines change — every `<Route>` element is byte-for-byte identical to before, just re-indented one level.

- [ ] **Step 3: Typecheck**

Run: `cd "C:\Users\isc\Desktop\Projects\Life OS" && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Build and inspect the chunk output**

Run: `cd "C:\Users\isc\Desktop\Projects\Life OS" && npm run build`
Expected: the build succeeds; the output now lists a separate `.js` chunk per page (e.g. `Analytics-*.js`, `Today-*.js`, `Tasks-*.js`, etc.) instead of one large `index-*.js` bundle containing everything. The `Analytics-*.js` chunk should be visibly larger than sibling page chunks (confirming `recharts` landed there). The "chunks larger than 500 kB" warning should be gone or refer to a much smaller remaining chunk than before.

- [ ] **Step 5: Run the existing test suite**

Run: `cd "C:\Users\isc\Desktop\Projects\Life OS" && npm test`
Expected: all existing tests still pass. `React.lazy`/`Suspense` changes only affect `App.tsx`, which has no direct unit tests in this suite (it's covered by manual/browser verification in Task 3, not Vitest) — no test file should need changes for this step. If any test does fail, read the failure and fix it as part of this task before moving on; do not defer it.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "perf: lazy-load all page routes to split the main JS bundle"
```

---

### Task 2: Defer `@supabase/supabase-js` loading in `service.ts`

**Files:**
- Modify: `src/lib/sync/service.ts:1` (top-of-file import)
- Modify: `src/lib/sync/service.ts:130-138` (`buildClient` function)
- Modify: `src/lib/sync/service.ts:153` (call site inside `ensureAuthedClient`)
- Modify: `src/lib/sync/service.ts:296` (call site inside `syncService.signIn`)

`buildClient` is the only function in this file that references `createClient`. Both of its call sites are already inside `async` functions that `await` other promises, so adding one more `await` in front of the (now-async) `buildClient(...)` call is a same-shape change with no other ripple.

- [ ] **Step 1: Drop the runtime `createClient` import, keep the type-only imports**

Find this line in `src/lib/sync/service.ts` (currently line 1):

```typescript
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
```

Replace with:

```typescript
import type { Session, SupabaseClient } from '@supabase/supabase-js';
```

`Session` and `SupabaseClient` are TypeScript types only — they're erased at compile time and have zero runtime bundle cost, so keeping them as a `import type` doesn't pull in the package. `createClient` is the one runtime value that actually loads the SDK, and it moves to a dynamic import inside `buildClient` in the next step.

- [ ] **Step 2: Make `buildClient` async and dynamically import `createClient`**

Find this function in `src/lib/sync/service.ts` (currently lines 130-138):

```typescript
function buildClient(url: string, anonKey: string): SupabaseClient {
  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
```

Replace with:

```typescript
async function buildClient(url: string, anonKey: string): Promise<SupabaseClient> {
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
```

- [ ] **Step 3: Add `await` at the first call site (`ensureAuthedClient`)**

Find this line in `src/lib/sync/service.ts` (currently line 153, inside `async function ensureAuthedClient`):

```typescript
  const client = buildClient(url, anonKey);
```

Replace with:

```typescript
  const client = await buildClient(url, anonKey);
```

- [ ] **Step 4: Add `await` at the second call site (`syncService.signIn`)**

Find this line in `src/lib/sync/service.ts` (currently line 296, inside `async signIn(...)` on the `syncService` object):

```typescript
    const client = buildClient(configured.sync_supabase_url ?? options.url, configured.sync_supabase_anon_key ?? options.anonKey);
```

Replace with:

```typescript
    const client = await buildClient(configured.sync_supabase_url ?? options.url, configured.sync_supabase_anon_key ?? options.anonKey);
```

- [ ] **Step 5: Typecheck**

Run: `cd "C:\Users\isc\Desktop\Projects\Life OS" && npx tsc --noEmit`
Expected: no errors. (If TypeScript reports `buildClient`'s two callers as needing `await` in some form other than what's shown above — e.g. if either surrounding function isn't actually `async` — stop and re-read that function's full signature before proceeding; the plan's assumption is that both are already `async`, verified during the design phase.)

- [ ] **Step 6: Build and inspect the chunk output**

Run: `cd "C:\Users\isc\Desktop\Projects\Life OS" && npm run build`
Expected: the build output now includes a separate chunk containing `@supabase/supabase-js` (its name will include something like `supabase` in the generated filename, or it will appear as a distinct chunk not merged into the main entry — inspect the file list and sizes to confirm `supabase-js`'s ~100+ KB isn't part of the smallest/earliest-loading chunk anymore).

- [ ] **Step 7: Run the existing test suite**

Run: `cd "C:\Users\isc\Desktop\Projects\Life OS" && npm test`
Expected: all existing tests still pass. `service.ts` has no direct unit test file in the current suite (sync logic is exercised at the Rust/store layer, not `syncService` itself), so no test file should need changes. If any test does fail, read the failure and fix it as part of this task before moving on.

- [ ] **Step 8: Commit**

```bash
git add src/lib/sync/service.ts
git commit -m "perf: defer supabase-js loading until a sync operation actually runs"
```

---

### Task 3: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full typecheck + production build**

Run: `cd "C:\Users\isc\Desktop\Projects\Life OS" && npm run build`
Expected: `tsc && vite build` completes cleanly. Confirm in the output that: (a) there is no "chunks larger than 500 kB" warning for the main entry chunk (or, if one remains, it should be meaningfully smaller than the pre-change 1,207 KB), (b) there are separate chunk files for each of the 12 pages, (c) the `Analytics` chunk is visibly larger than sibling page chunks (confirms `recharts` isolation), (d) a distinct chunk exists containing `@supabase/supabase-js` rather than it being merged into the main entry.

- [ ] **Step 2: Full test suite**

Run: `cd "C:\Users\isc\Desktop\Projects\Life OS" && npm test`
Expected: all tests pass, matching the full pre-change suite count plus no new failures (this plan adds no new test files).

- [ ] **Step 3: Manual verification in the browser/Tauri preview**

Start the dev server preview and, in order: load the app fresh (confirm the boot sequence completes and the initial `/today` route renders with no console errors), then navigate to every one of the 12 routes at least once via the sidebar/tab navigation (`/today`, `/overview`, `/tasks`, `/inbox`, `/habits`, `/goals`, `/analytics`, a `/domain/:domainId` link, `/settings`, `/notes`, `/calendar`, `/review` → `/weekly-review`, `/templates`), confirming each one renders its content with no console errors and no visible flash-of-blank-content longer than a normal page transition. Take a screenshot after landing on `/analytics` (the page most likely to reveal a `recharts`-related chunk-loading issue, since it's the one being pulled out of the main bundle) as evidence the split didn't break chart rendering.

---
