# Bundle Splitting — Design Spec

**Goal:** Reduce the desktop app's cold-start cost by splitting the single 1.2 MB (330 KB gzipped) JS bundle into per-route chunks, and by deferring `@supabase/supabase-js` until sync actually runs, instead of loading it on every app boot.

## Problem

Every production build of the desktop frontend currently emits one JS entry chunk containing all 12 pages plus every dependency they use, including `recharts` (used only by `Analytics.tsx`) and `@supabase/supabase-js` (used only by `src/lib/sync/service.ts`, but imported eagerly at the top of `App.tsx`). Vite's build already warns that this chunk exceeds its 500 KB threshold. Because Life OS is a Tauri desktop app, this cost is paid in full on every cold launch of the `.exe` — there's no cross-session browser cache to amortize it against, unlike a typical web app.

Separately, `src/store/useTimerStore.ts` already contains a dynamic `import('./useTaskStore')` / `import('./useFocusStore')` — but since both stores are *also* statically imported elsewhere (e.g. directly in `App.tsx`), Vite cannot actually split them into their own chunk; the dynamic import achieves nothing today beyond the extra build warning already visible in `npm run build`'s output. This is a pre-existing, ineffective artifact — not something this work needs to fix, since removing it wouldn't change bundle size (the modules stay in the main chunk either way, as long as they're statically imported elsewhere too).

## Scope

**In scope:**
- Route-based code splitting: all 12 page components imported by `App.tsx` (`CommandCenter`, `TodayPage`, `TasksPage`, `HabitsPage`, `GoalsPage`, `AnalyticsPage`, `DomainPage`, `SettingsPage`, `NotesPage`, `CalendarPage`, `WeeklyReviewPage`, `InboxPage`, `TemplatesPage`) converted from static imports to `React.lazy()`, with the `<Routes>` tree wrapped in `<Suspense fallback={null}>`.
- Deferred loading of `@supabase/supabase-js`: `buildClient()` in `src/lib/sync/service.ts` (the sole function that references `createClient` from that package) converted to dynamically `import()` the package internally, rather than the module having a top-level static import of it.

**Explicitly out of scope:**
- Manual vendor chunking (`rollupOptions.manualChunks` for React/react-dom/react-router-dom/zustand). Rejected: this benefits web apps that reuse cached vendor chunks across page loads within a session or across deployments; a Tauri desktop app has no such cross-launch cache to exploit, so the added `vite.config.ts` complexity isn't worth it here.
- Lazy-loading `recharts` sub-components from within `Analytics.tsx`, or deferring `supabase-js` until an actual sync *action* (vs. just having `Settings` open). Route-level splitting already isolates `recharts` into the `Analytics` chunk for free (it's the sole importer), and the `buildClient()`-level deferral already keeps `supabase-js` out of the critical boot path without needing this finer-grained trigger.
- Fixing the pre-existing, ineffective dynamic `import()` in `useTimerStore.ts` — noted above as dead weight, but out of scope since it doesn't affect bundle size either way.
- Any change to what data loads at boot (Zustand store hydration, `Promise.all` in `App.tsx`'s startup effect) — this work only changes *when JS code* loads, not when *data* loads.

## Design

### Route-based lazy loading

In `src/App.tsx`, each of the 12 `import { XPage } from './pages/X';` static imports becomes:

```typescript
const XPage = React.lazy(() => import('./pages/X').then((m) => ({ default: m.XPage })));
```

(Using `.then((m) => ({ default: m.XPage }))` because these pages are currently named exports, not default exports — `React.lazy` requires a module whose promise resolves to `{ default: Component }`.)

The `<Routes>` block (wherever it currently renders `<Route path="..." element={<XPage />} />` for each page) gets wrapped once:

```tsx
<Suspense fallback={null}>
  <Routes>
    {/* existing <Route> elements, unchanged */}
  </Routes>
</Suspense>
```

`fallback={null}` means React renders nothing extra during the brief chunk-load window rather than a spinner — consistent with the decision that this is normally an imperceptibly fast local-disk read, and a flashed loading state would be more visually distracting than a near-instant blank frame.

No other component in `App.tsx` (layout chrome like `Sidebar`/`TopBar`/`TabBar`/`FooterBar`, or overlays like `Modal`/`GlobalSearch`/`FocusTimer`/`QuickCapture`/`ErrorToast`/`DebugConsole`/`UndoToast`) changes — only the 12 route-level page components are lazified. Layout chrome is present on every page and provides negligible bundle-size benefit from splitting, while adding `Suspense` boundaries around it would risk visible flicker on every render.

### Sync service (`supabase-js`) deferral

In `src/lib/sync/service.ts`, the current top-level import:

```typescript
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
```

keeps `Session`/`SupabaseClient` as type-only imports (erased at compile time, zero runtime cost) but drops the runtime `createClient` value import. `buildClient` becomes:

```typescript
async function buildClient(url: string, anonKey: string): Promise<SupabaseClient> {
  const { createClient } = await import('@supabase/supabase-js');
  // ...existing body, unchanged...
}
```

Its two call sites (inside the session-restore function and inside `signIn`) each add one `await` in front of the existing `buildClient(...)` call — both are already `async` functions awaiting other promises (`client.auth.setSession(...)`, `client.auth.signInWithPassword(...)`), so this is a same-shape, low-risk change. No other function in `service.ts`, and no caller of `syncService` anywhere in the app (`App.tsx`, `Settings.tsx`, etc.), needs to change — `syncService.hasSession(...)` and the rest of its synchronous surface are untouched, since `hasSession` never calls `buildClient`.

## Testing

No new automated tests are added — this is a build-output/loading-behavior change, not new business logic. Verification is:
1. `npm run build` — the "chunks larger than 500 kB" warning for the main entry should be gone (or the main chunk should be meaningfully smaller); the build output should list a separate chunk per page, with the `Analytics` chunk visibly larger than sibling page chunks (confirming `recharts` landed there, not in the main chunk); a separate chunk should contain `supabase-js`, not merged into the main entry.
2. `npm test` — full existing suite must stay green; no test changes anticipated since `React.lazy`/`Suspense` and the `service.ts` signature change don't alter any store or utility function's observable behavior in a synchronous test environment (Vitest's `jsdom` environment resolves dynamic imports synchronously enough that no existing test needs `act()`/`waitFor` additions — this will be confirmed during implementation, and any test that does turn out to need adjustment gets fixed as part of that task, not deferred).
3. Manual verification in the browser/Tauri preview: navigate to every one of the 12 pages at least once (confirming each lazy chunk loads without a console error), and do a full page reload / app restart to confirm the boot sequence and initial route still render correctly with `Suspense` now present in the tree.

## Out of scope (recap)

- Manual vendor chunking via `rollupOptions.manualChunks`.
- Lazy-loading `recharts` sub-components within `Analytics.tsx`.
- Deferring `supabase-js` until an actual sync action rather than at `buildClient()` call time.
- Fixing the pre-existing ineffective dynamic import in `useTimerStore.ts`.
- Any change to data-loading/store-hydration timing.
