# Life OS — Project Map

One-page orientation for any new session (human or agent) picking up this project.
Read this first, then jump to the specific file you need.

---

## 1. What This Is

**Life OS** is a personal, gamified productivity system built as **two apps sharing one data model**:

| App | Path | Role |
|---|---|---|
| **Desktop app** | `C:\Users\isc\Desktop\Projects\Life OS` | Primary, full-featured app. Tauri v2 + React. Local-first SQLite. Has the full gamification layer (XP, levels, achievements, momentum) and every feature. |
| **Mobile app** | `C:\Users\isc\Desktop\Projects\life-os-mobile` | Flutter companion app (Android/iOS/desktop via Flutter). Local-first SQLite (Drift). Lighter feature set — no gamification layer yet. Syncs with the desktop app through Supabase. |

Both apps implement the same core domain concepts (Domains, Tasks, Habits, Goals, Notes, Inbox) with matching field names, and both render the same **Pip-Boy 3000 CRT terminal aesthetic** (phosphor green on black, VT323 + Share Tech Mono fonts, angular/no-radius UI).

The product philosophy (read `guide.md` in the desktop repo for the full user-facing version) is:
> A commitment system, not a storage bin. Capture fast, clarify, commit to what's real, keep Today small and believable, review what slips, recover by cutting scope.

Core stack the app is built around: **Domains → Goals → Tasks / Habits → Today (execution) → Weekly Review (recalibration)**.

---

## 2. Important Meta-Note on Docs

`CLAUDE.md` and `AGENTS.md` at the desktop repo root are **near-identical dev rule files** (same content, different target agent name) and describe an **earlier phase** of the project (Phases 1–16). The actual codebase has grown well past that snapshot — it now includes Inbox, Task Templates, Focus Timer, Friction Logging, Weekly Review, Backup/Restore/Recovery Bin, and full Supabase sync, none of which are documented there. Treat `CLAUDE.md`/`AGENTS.md` as **coding-standards / design-system source of truth** (fonts, colors, CSS rules, "what not to do") but **not** as an accurate feature/schema inventory — use this file and the source itself for that.

---

## 3. Desktop App (`Life OS/`)

### Stack
Tauri v2 (Rust backend) · React 19 + TypeScript (strict) · Zustand · Tailwind CSS v4 · Recharts · SQLite via `rusqlite` · Vitest 3 + RTL for tests · `@supabase/supabase-js` for sync.

### Structure
```
src-tauri/src/
  main.rs        entry point
  lib.rs          Tauri app setup / plugin registration
  db.rs           SQLite schema (CREATE TABLE ...) + migrations, ~750 lines
  commands.rs     every #[tauri::command] handler, ~5,800 lines, ~110 commands

src/
  pages/          one file per top-level view (see §5)
  components/     layout/, domains/, tasks/, habits/, gamification/, shared/
  store/          one Zustand store per feature (see below)
  lib/            business logic + typed Tauri wrappers
    db.ts                 typed invoke() wrappers — the ONLY way to call Rust commands
    types.ts               all shared TS interfaces (mirrors db.rs schema exactly)
    xp-engine.ts            rule-based XP calculator
    ai-xp.ts                optional Claude-Haiku XP scorer, falls back to xp-engine
    momentum.ts              7-day weighted momentum score
    achievement-checker.ts   achievement trigger logic
    post-action.ts           orchestrates XP + level-up + achievements + momentum after any completion
    habit-schedule.ts        cadence math (daily/weekdays/interval/weekly-count/etc.)
    task-planning.ts         Today-view task selection/prioritization logic
    weekly-review-date.ts    week boundary calculations
    template-presets.ts      built-in task template kits
    sync/service.ts          Supabase sync engine (see §6)
    sync/events.ts           sync event bus
  styles/          tokens.css (all CSS vars) + globals.css (component classes, CRT effects)
```

### Zustand stores (`src/store/`)
`useTaskStore` `useHabitStore` `useGoalStore` `useDomainStore` `useNoteStore` `useInboxStore`
`useTemplateStore` `useCalendarStore` `useFocusStore` `useTimerStore` `useFrictionStore`
`useAppStore` (app_state singleton, settings, sync status) `useUndoStore` `useErrorStore` `useDebugStore`

Every mutation calls its Tauri command immediately (optimistic UI, no separate "save" step).

### Testing
`npm test` → Vitest. Suites cover `xp-engine`, `momentum`, `achievement-checker`, `habit-schedule`,
`weekly-review-date`, `useTaskStore`, `useNoteStore`, `useCalendarStore`, `XPBar`, `StreakFlame`, `CompletionButton`.

---

## 4. Mobile App (`life-os-mobile/`)

### Stack
Flutter (Dart) · `flutter_riverpod` (state) · `go_router` (routing) · `drift` + `sqlite3_flutter_libs` (local SQLite, codegen via `build_runner`/`drift_dev`) · `supabase_flutter` + `connectivity_plus` (sync) · custom Pip-Boy theme (`life_os_theme.dart`) using the same bundled VT323 / Share Tech Mono TTFs.

### Structure
```
lib/
  main.dart                bootstraps app
  app/
    app.dart                 root widget / shell wiring
    providers.dart           Riverpod providers: DB instance, sync repo/coordinator,
                              StreamProviders per table (domains, tasks, habits, habit_logs, goals, inbox, notes)
    router.dart              go_router routes — see §5 for the route tree
  design_system/            LifeOsTheme, DesktopShell, PanelCard, PipStatCard, ScreenFrame, route transitions
  data/
    local/app_database.dart   Drift schema — LocalDomains/LocalTasks/LocalHabits/LocalHabitLogs/
                               LocalGoals/LocalNotes/LocalInboxItems (field names mirror desktop types.ts 1:1)
    local/connection/          platform-specific SQLite connection (native vs web)
    remote/supabase_sync_client.dart   Supabase REST/query wrapper
    sync/sync_repository.dart          export/import/merge payload logic (mirrors src/lib/sync/service.ts)
    sync/sync_coordinator.dart         debounced auto-sync: listens to connectivity + local sync-queue depth,
                                       triggers `runAutoSyncIfReady()` 900ms after local changes or on reconnect
  features/<name>/presentation/<name>_screen.dart   one folder per feature (feature-first structure)
```

### Route tree (`app/router.dart`)
Top-level shell tabs: `/overview` `/today` `/tasks` `/habits` `/goals`, plus `/more` which nests:
`inbox` `notes` `review` (weekly review) `calendar` `analytics` `domains` (+ `domains/:domainId`) `settings` `sync` `account`.

### Mobile vs Desktop feature parity
Mobile currently has **no** gamification layer (no XP events, levels, achievements, momentum, streak-freeze) and **no** Task Templates, Focus Timer, or Friction Logging screens yet. It covers Domains, Tasks, Habits (+ logs), Goals, Notes, Inbox, Calendar, Analytics, Weekly Review, Settings, and Sync/Account. Treat it as a lighter "capture + manage + review" companion, not a full mirror.

---

## 5. Feature Map (desktop pages ↔ mobile screens ↔ concept)

| Concept | Desktop (`src/pages/`) | Mobile (`lib/features/*/presentation/`) | Purpose |
|---|---|---|---|
| Orientation | `CommandCenter.tsx` | `overview_screen.dart` | System health, reliability, what needs attention |
| Execution | `Today.tsx` | `today_screen.dart` | MIT, Top 3, focus, daily habit logging |
| Capture | `Inbox.tsx` | `inbox_screen.dart` | Fast capture → triage into Task/Goal/Note/Someday/Delete |
| Tasks | `Tasks.tsx` | `tasks_screen.dart` | Full CRUD, subtasks, due/start dates, recurrence, friction |
| Habits | `Habits.tsx` | `habits_screen.dart` | Cadence, targets, minimum version, skip reasons, streaks |
| Goals | `Goals.tsx` | `goals_screen.dart` | Hierarchical goals, next action, health, review date |
| Notes | `Notes.tsx` | `notes_screen.dart` | Freeform thinking/journaling, pin, domain/goal scoping |
| Calendar | `Calendar.tsx` | `calendar_screen.dart` | Monthly grid, load/pattern inspection |
| Weekly Review | `WeeklyReview.tsx` | `weekly_review_screen.dart` | Weekly recalibration ritual |
| Templates/Kits | `Templates.tsx` | *(not yet in mobile)* | One-click recurring setups (morning reset, deep work block, etc.) |
| Analytics | `Analytics.tsx` | `analytics_screen.dart` | Overload/reliability/imbalance charts |
| Domain detail | `DomainPage.tsx` | `domains_screen.dart` + `domain_detail_screen.dart` | Per-domain (Military/Builder/Self) view |
| Settings | `Settings.tsx` | `settings_screen.dart` | Backups, restore preview, recovery bin, display tuning, domain profiles, export |
| Sync | (inside `Settings.tsx` "SYNC ACCOUNT" panel) | `sync_screen.dart` + `account_screen.dart` | Supabase login + manual/auto sync controls |
| Onboarding | `Onboarding.tsx` | — | First-run flow (desktop only) |

---

## 6. Data Model & Sync Architecture

### Shared entities
`domains` · `tasks` · `habits` · `habit_logs` · `goals` · `notes` · `inbox_items`
— these are the entities that sync across devices. Full field definitions live in
`src/lib/types.ts` (desktop, TS interfaces) and `lib/data/local/app_database.dart` (mobile, Drift tables) — **keep these two in sync by hand when changing schema.**

Desktop-only entities (not synced, not present on mobile): `xp_events`, `achievements`, `app_state`,
`sync_queue`, `sync_cursors`, `task_templates`, `focus_sessions`, `focus_timer_drafts`,
`task_friction_logs`, `restore_history`.

Every syncable row carries `created_at` / `updated_at` / `deleted_at` (soft delete) — this triple is the basis for conflict resolution.

### How sync works
There is **no realtime channel and no direct desktop↔mobile connection** — Supabase Postgres is the hub, and each app independently pushes/pulls via plain REST (`@supabase/supabase-js` on desktop, `supabase_flutter` on mobile).

1. **Desktop** (`src/lib/sync/service.ts`): `syncNow()` pulls the remote payload, merges it with the local export using **last-write-wins by `latestRowStamp` (max of created/updated/deleted_at)** per row (see `mergeEntityRows`), pushes the merged result back, then imports the merged payload locally. Auth session (access/refresh token) is stored in `app_state` and restored via `client.auth.setSession()` on every sync.
2. **Mobile** (`lib/data/sync/sync_coordinator.dart` + `sync_repository.dart`): a `SyncCoordinator` watches connectivity and the local `sync_queue` depth (reactive Drift stream); on any local change it debounces 900ms then calls `runAutoSyncIfReady()`. Reconnecting after being offline triggers an immediate sync.
3. Supabase schema for the sync tables lives in `supabase/schema.sql`; a one-time `bootstrap_import` edge function (`supabase/functions/bootstrap_import/index.ts`) exists for initial cloud population. Setup steps are in `supabase/README.md`.
4. Row identity for upsert conflict targets: `user_id,id` for most tables, `user_id,habit_id,completed_date` for `habit_logs` (since habit logs are keyed by habit+date, not a synced id).

### Gamification (desktop only)
- **XP**: rule-based (`xp-engine.ts`) always on; optional AI scoring via Claude Haiku (`ai-xp.ts`) falls back silently on any error.
- **Momentum**: 7-day day-weighted score (`momentum.ts`) → states `peak / normal / amber / red_alert`.
- **Levels**: per-domain, 10 tiers, XP thresholds in `types.ts` (`XP_THRESHOLDS`), never decrease.
- **Achievements**: trigger-checked after every task/habit/XP/momentum event (`achievement-checker.ts`).
- **Streaks**: per-domain, freeze tokens earned every 7-day milestone.

All of this is orchestrated centrally by `src/lib/post-action.ts` after any completion event.

---

## 7. Shared Design System — "Pip-Boy 3000 MK IV"

Phosphor green (`#4afa4a`) on near-black, CRT scanline + vignette overlay, no border-radius, `step-end`/`linear` transitions only, VT323 for display text, Share Tech Mono for body text. Both apps bundle the **same two TTF files locally** (never Google Fonts / CDN — required for Tauri's offline CSP and works equally well for Flutter asset bundling).

- Desktop tokens: `src/styles/tokens.css` (CSS custom properties) + `src/styles/globals.css` (component classes, animations).
- Mobile tokens: `lib/design_system/life_os_theme.dart` (Flutter `ThemeData`/color scheme equivalent) + `lib/design_system/widgets/*` (shared Flutter widgets: `PanelCard`, `PipStatCard`, `AdaptivePanelGrid`, `ScreenFrame`, `PipEmptyState`, route transition helpers).

Full color tokens, layout grid, and animation rules are documented in the desktop `CLAUDE.md` — that part of the file is still accurate and should be treated as canonical for both apps.

---

## 8. Where To Go Next

| Need | Go to |
|---|---|
| User-facing philosophy / how to actually use the app | `guide.md` (desktop repo root) |
| Coding standards, design tokens, "what not to do" | `CLAUDE.md` / `AGENTS.md` (desktop repo root) — accurate for style, stale for feature/phase list |
| Full Tauri command list | `src-tauri/src/commands.rs` (grep function names — ~110 commands) |
| Full desktop DB schema | `src-tauri/src/db.rs` |
| Full desktop TS types | `src/lib/types.ts` |
| Full mobile local schema | `lib/data/local/app_database.dart` |
| Mobile routes | `lib/app/router.dart` |
| Sync setup / Supabase schema | `supabase/README.md`, `supabase/schema.sql` |
| This file | `PROJECT_MAP.md` (desktop repo root) — update it when adding a page/screen, a synced entity, or a new store/provider |
