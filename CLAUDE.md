# CLAUDE.md — Life OS Project Intelligence

This file is the single source of truth for Claude Code working on this project.
Read this entire file before writing any code. Follow every rule here without exception.

---

## WHAT THIS PROJECT IS

**Life OS** — a gamified personal productivity desktop application.
A local-first command center built around 3 identity-based life domains:
- ⚔️ Military
- 🛠️ Builder  
- 🌱 Self

The app helps the user organize their life through gamification, psychology-based
motivation, visual progress tracking, and identity-based habit formation.

**This is a personal tool. It must feel premium, fast, and polished — not like a
prototype. Every decision should favor quality, clarity, and smoothness.**

---

## TECH STACK — NON-NEGOTIABLE

| Layer | Technology | Notes |
|---|---|---|
| Desktop framework | Tauri v2 | Rust backend, WebView2 frontend |
| Frontend | React 18 + TypeScript | Strict mode always |
| Styling | Tailwind CSS v4 + CSS custom properties | Tokens in tokens.css |
| State management | Zustand | One store per domain |
| Database | SQLite via rusqlite (Rust) | All I/O through Tauri commands |
| Charts | Recharts | RadarChart, BarChart, LineChart |
| Fonts | VT323, Share Tech Mono | **Bundled locally as TTF** — NOT Google Fonts |
| Packaging | Tauri bundler (nsis + msi) | Target: Windows .exe |
| Testing | Vitest 3.x + React Testing Library | `npm test` to run |

**Never suggest replacing any of these.** Do not introduce new dependencies
without explaining why and asking for confirmation first.

---

## PROJECT STRUCTURE
```
life-os/
├── src-tauri/
│   ├── src/
│   │   ├── main.rs           # Entry point + window config
│   │   ├── db.rs             # SQLite init + all queries
│   │   ├── commands.rs       # All #[tauri::command] functions
│   │   └── scheduler.rs      # Momentum decay + streak check
│   ├── Cargo.toml
│   └── tauri.conf.json
├── src/
│   ├── assets/
│   │   └── fonts/            # VT323-Regular.ttf, ShareTechMono-Regular.ttf (bundled locally)
│   ├── components/
│   │   ├── layout/           # Sidebar, TopBar, TabBar, FooterBar
│   │   ├── domains/          # DomainCard, DomainView
│   │   ├── tasks/            # TaskItem, TaskList, TaskForm, QuickAddTask
│   │   ├── habits/           # HabitItem, HabitGrid
│   │   ├── goals/            # GoalTree, GoalCard
│   │   ├── analytics/        # All chart components
│   │   ├── gamification/     # StreakFlame
│   │   └── shared/           # CompletionButton, ErrorToast, Modal, Badge
│   ├── pages/
│   │   ├── CommandCenter.tsx
│   │   ├── Today.tsx
│   │   ├── DomainPage.tsx
│   │   ├── Tasks.tsx
│   │   ├── Habits.tsx
│   │   ├── Goals.tsx
│   │   ├── Analytics.tsx
│   │   ├── Settings.tsx
│   │   ├── Notes.tsx         # 2-column editor, auto-save, pin, domain filter
│   │   └── Calendar.tsx      # Monthly grid + day detail panel
│   ├── store/
│   │   ├── useTaskStore.ts
│   │   ├── useHabitStore.ts
│   │   ├── useGoalStore.ts
│   │   ├── useAppStore.ts
│   │   ├── useDomainStore.ts
│   │   ├── useNoteStore.ts   # Notes CRUD + search + selection
│   │   ├── useCalendarStore.ts # Month nav + day data
│   │   └── useErrorStore.ts
│   ├── lib/
│   │   ├── momentum.ts       # Momentum score algorithm
│   │   ├── post-action.ts    # Post-completion: momentum recalculation
│   │   ├── types.ts          # All shared TypeScript interfaces
│   │   └── db.ts             # Typed invoke() wrappers for all Tauri commands
│   ├── test/
│   │   ├── setup.ts          # Vitest global setup (@testing-library/jest-dom)
│   │   └── __mocks__/tauri.ts # Stubs @tauri-apps/api/core invoke()
│   ├── styles/
│   │   ├── globals.css       # @font-face, CRT effects, all component classes
│   │   └── tokens.css        # All CSS custom properties (Pip-Boy palette)
│   └── App.tsx
├── vitest.config.ts          # Test runner config (jsdom, alias for Tauri mock)
├── CLAUDE.md                 # ← this file
├── package.json
└── README.md
```

---

## DESIGN SYSTEM

### Visual Aesthetic
**"PIP-BOY 3000 MK IV"** — Fallout Pip-Boy phosphor CRT terminal aesthetic.
- Phosphor green (`#4afa4a`) on near-black (`#060e06`) only. No light mode, ever.
- CRT scanline overlay via `repeating-linear-gradient` on `.pip-screen::before` (z-index 100).
- Vignette via radial-gradient on `.pip-screen::after` (z-index 101).
- Flicker animation on scanline layer: subtle 8s linear infinite.
- `cursor: crosshair` on all interactive elements. `cursor: text` on inputs only.
- All animations use `step-end` or `linear` timing — never `ease-in-out` (CRT = digital).
- No border-radius anywhere. Angular edges only.
- Information density: CRT terminal feel — not minimal, not cluttered.

### CRITICAL — Local Font Bundling
**Google Fonts `@import` DOES NOT WORK in Tauri production builds** (CSP + no-internet context).
Fonts MUST be served from `src/assets/fonts/` via `@font-face` in globals.css.

Files:
- `src/assets/fonts/VT323-Regular.ttf` — large display font (147KB)
- `src/assets/fonts/ShareTechMono-Regular.ttf` — body mono font (42KB)

Never add a Google Fonts CDN link. Never use `@import url('https://...')` for fonts.

### Color Tokens (defined in tokens.css — use these, NEVER hardcode hex values)
```css
/* Pip-Boy phosphor palette */
--pip:          #4afa4a;   /* primary green */
--pip-bright:   #80ff80;   /* highlights */
--pip-dim:      #1e7a1e;   /* dimmed elements */
--pip-muted:    #2a7a2a;   /* secondary text */
--pip-faint:    #163016;   /* very subtle backgrounds */
--pip-dark:     #060e06;   /* deepest background */
--pip-bg:       #060e06;   /* app background */
--pip-panel:    #0d180d;   /* panel surfaces */
--pip-border:   #2d5c2d;   /* borders */
--pip-elevated: #0f1f0f;   /* elevated surfaces */

/* Accent colors */
--pip-amber:    #c8a020;   /* warnings */
--pip-red:      #ff4040;   /* critical alerts */
--pip-blue:     #40a0ff;   /* informational */

/* Layout dimensions */
--topbar-height:  48px;
--tabbar-height:  36px;
--footer-height:  28px;
--sidebar-width:  200px;

/* Domain colors (set via data-domain attribute) */
/* --domain-primary resolves to domain color, --domain-subtle to bg tint */
/* Military: amber gold | Builder: blue | Self: green */

/* Momentum state colors */
--momentum-peak:   var(--pip-amber);   /* score >= 80 */
--momentum-normal: var(--pip);         /* score >= 30 */
--momentum-amber:  #f59e0b;            /* score >= 15 */
--momentum-red:    var(--pip-red);     /* score <  15 */

/* Backward-compat aliases — DO NOT REMOVE, used throughout codebase */
--bg-base, --bg-panel, --bg-elevated → map to --pip-bg/panel/elevated
--text-primary, --text-muted → map to --pip-bright / --pip-muted
--border-base → maps to --pip-border
--domain-primary, --domain-subtle → domain theming aliases
```

### App Shell Grid Layout
```css
.app-shell {
  display: grid;
  grid-template-rows: 48px 36px 1fr 28px;   /* topbar tabbar main footer */
  grid-template-columns: 200px 1fr;
  grid-template-areas:
    "header  header"
    "tabbar  tabbar"
    "sidebar main"
    "footer  footer";
  height: 100%;    /* NEVER 100vh — breaks Tauri Windows */
  width:  100%;
  overflow: hidden;
}
html, body { height: 100%; overflow: hidden; }  /* NEVER 100vh */
```

### Domain Theming
Set `data-domain="military|builder|self"` on the nearest container.
The `--domain-primary`, `--domain-subtle` CSS vars resolve automatically per domain.
Never hardcode domain hex values directly in components.

### Typography
- `VT323` (`var(--font-display)`) → all headings, domain names, large numbers, momentum score
- `Share Tech Mono` (`var(--font-body)`) → all body text, labels, descriptions, UI copy

Both fonts are loaded via `@font-face` from `src/assets/fonts/`. Font variables are set in tokens.css:
```css
--font-display: 'VT323', monospace;
--font-body: 'Share Tech Mono', monospace;
```

### Layout Components
- **TopBar** (`components/layout/TopBar.tsx`) — brand + live clock + momentum stat + "+ NEW TASK" button + RED ALERT banner
- **TabBar** (`components/layout/TabBar.tsx`) — STAT / TASKS / NOTES / HABITS / GOALS / CAL / DATA tabs
- **Sidebar** (`components/layout/Sidebar.tsx`) — vertical nav, domain list with streak flame, search/quick-capture shortcuts
- **FooterBar** (`components/layout/FooterBar.tsx`) — system status, version, keyboard hints

### CSS Classes (defined in globals.css)
```
.pip-screen          — root app wrapper with CRT scanline + vignette pseudo-elements
.app-shell           — CSS grid layout (4 rows × 2 cols)
.app-topbar          — grid area: header
.pip-tabbar          — grid area: tabbar; .pip-tab + .pip-tab.active
.app-sidebar         — grid area: sidebar
.app-main            — grid area: main; overflow-y: auto
.app-footer          — grid area: footer

.pip-panel           — surface card with border + background
.pip-panel-header    — panel title row
.pip-panel-body      — panel content area
.pip-panel-title     — styled panel heading
.pip-empty           — empty state container; .pip-empty-title

.page-content        — page wrapper with padding
.page-title          — VT323 page heading
.page-subtitle       — muted date/descriptor line
.page-sep            — hr separator

.btn .btn-primary .btn-ghost .btn-danger .btn-sm — buttons
.input               — text/select/textarea inputs
.nav-item .nav-item.active — sidebar nav rows
.priority-badge-{critical|high|medium|low} — task priority chips
.task-row            — task list row with domain border

.check-pop           — checkmark animation on task completion
.red-alert           — pulsing red border (critical momentum state)
.blink               — 1s step-end blink animation
.fade-in             — page entrance (opacity + translateY, 300ms)
.boot-cursor         — blinking terminal cursor block
```

### Animation Rules
- Task completion: `check-pop` on CheckCircle icon
- All timing: `step-end` for digital CRT behavior (no ease curves)
- Boot screen: `bootBlink` staggered dots
- RED ALERT: `.red-alert` pulsing border + blinking banner

### Animation Rules
- Task completion: `check-pop` on CheckCircle2
- Streak increment: `streak-pulse` glow
- RED ALERT: `.red-alert` pulsing red border on affected domain card
- Modal entrance: `modalEnter` (scale + translateY)
- Page entrance: `.fade-in` (opacity + translateY)
- All transitions: `--t-fast` (150ms) to `--t-slow` (350ms). Nothing outside this range.

---

## DATABASE SCHEMA

All tables created in `db.rs` on first launch via `CREATE TABLE IF NOT EXISTS`.
```sql
-- Domains (seeded with 3 rows on first launch)
CREATE TABLE IF NOT EXISTS domains (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  streak_current INTEGER DEFAULT 0,
  streak_longest INTEGER DEFAULT 0,
  streak_freeze_tokens INTEGER DEFAULT 0,
  last_activity_date TEXT
);

-- Tasks (supports nested via parent_task_id)
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  domain_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'todo',
  is_mit INTEGER DEFAULT 0,
  xp_value INTEGER DEFAULT 30,
  xp_awarded INTEGER DEFAULT 0,
  parent_task_id TEXT,
  goal_id TEXT,
  tags TEXT,               -- JSON array string: '["tag1","tag2"]'
  time_estimate_minutes INTEGER,
  due_date TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  attachments TEXT         -- JSON array of absolute file paths
);

-- Habits (separate concept from tasks)
CREATE TABLE IF NOT EXISTS habits (
  id TEXT PRIMARY KEY,
  domain_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  frequency TEXT NOT NULL DEFAULT 'daily',
  target_days TEXT NOT NULL DEFAULT '[0,1,2,3,4,5,6]', -- JSON array
  xp_per_completion INTEGER DEFAULT 15,
  streak_current INTEGER DEFAULT 0,
  streak_longest INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL
);

-- Habit completion log
CREATE TABLE IF NOT EXISTS habit_logs (
  id TEXT PRIMARY KEY,
  habit_id TEXT NOT NULL,
  completed_date TEXT NOT NULL,  -- ISO date: '2025-03-26'
  xp_awarded INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

-- Goals (hierarchical via parent_goal_id)
CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  domain_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  parent_goal_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  target_date TEXT,
  progress_percent INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Notes (freeform text notes, optionally scoped to a domain)
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  domain_id TEXT,                         -- nullable: global notes have no domain
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',        -- JSON array string
  pinned INTEGER NOT NULL DEFAULT 0,      -- boolean: 1 = pinned to top
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notes_domain  ON notes(domain_id);
CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated_at);

-- App state singleton (always 1 row, id = 1)
CREATE TABLE IF NOT EXISTS app_state (
  id INTEGER PRIMARY KEY DEFAULT 1,
  momentum_score INTEGER DEFAULT 50,
  last_momentum_calc TEXT,
  current_mit_task_id TEXT,
  api_key TEXT,
  onboarding_complete INTEGER DEFAULT 0,
  last_opened_date TEXT
);
```

**Database rules:**
- All IDs are UUIDs generated by the `uuid` crate in Rust
- All datetimes stored as ISO 8601 strings (`2025-03-26T14:30:00Z`)
- Tags and attachments stored as JSON strings, parsed in the frontend
- All queries go through typed Tauri commands — never raw SQL from the frontend
- Add indexes on: `tasks(domain_id)`, `tasks(status)`, `tasks(due_date)`

---

## TAURI COMMANDS (commands.rs)

Every database operation must have a corresponding `#[tauri::command]` function.
The frontend calls these via the typed wrappers in `lib/db.ts`.

Required commands:
```
// Tasks
get_tasks(domain_id?, status?, parent_task_id?) -> Vec<Task>
get_task(id) -> Task
create_task(task: NewTask) -> Task
update_task(id, updates: TaskUpdate) -> Task
delete_task(id) -> ()
complete_task(id) -> TaskCompletionResult  // updates status, checks streak

// Habits
get_habits(domain_id?) -> Vec<Habit>
create_habit(habit: NewHabit) -> Habit
update_habit(id, updates: HabitUpdate) -> Habit
delete_habit(id) -> ()
log_habit(habit_id, date) -> HabitLogResult  // checks streak

// Goals
get_goals(domain_id?, parent_goal_id?) -> Vec<Goal>
create_goal(goal: NewGoal) -> Goal
update_goal(id, updates: GoalUpdate) -> Goal
delete_goal(id) -> ()

// Domains
get_domains() -> Vec<Domain>
get_domain(id) -> Domain

// Gamification
get_app_state() -> AppState
update_momentum() -> i32  // recalculates and returns new score
set_mit(task_id?) -> ()

// Notes
get_notes(domain_id?) -> Vec<Note>
create_note(payload: CreateNotePayload) -> Note
update_note(payload: UpdateNotePayload) -> Note
delete_note(id) -> ()
search_notes(query) -> Vec<Note>

// Calendar
get_calendar_data(year, month) -> Vec<CalendarDay>  // tasks + habits grouped by date

// Settings
save_api_key(key) -> ()
get_api_key() -> Option<String>
export_data() -> String  // returns full JSON export
```

---

## MOMENTUM ALGORITHM (lib/momentum.ts)
```typescript
// Day weights — today counts most, 7 days ago counts least
const DAY_WEIGHTS = [0.30, 0.25, 0.18, 0.12, 0.08, 0.05, 0.02]

export function calculateMomentum(last7Days: DayActivity[]): number {
  let score = 0
  last7Days.forEach((day, index) => {
    let dayScore = 0
    dayScore += Math.min(day.tasksCompleted * 10, 50)
    dayScore += Math.min(day.habitsCompleted * 8, 32)
    dayScore += day.mitCompleted ? 18 : 0
    score += dayScore * DAY_WEIGHTS[index]
  })
  return Math.round(Math.min(Math.max(score, 0), 100))
}

// Momentum states:
// >= 80  → PEAK    (gold glow)
// >= 30  → NORMAL  (green)
// >= 15  → AMBER   (amber warning glow)
// <  15  → RED_ALERT (pulsing red border + alert banner)
```

Momentum recalculates:
1. On every app open
2. Every hour via Rust scheduler in `scheduler.rs`
3. After every task completion and habit log

---

## GAMIFICATION RULES

### Streak Rules
- Domain streak increments when ≥1 task OR habit completed in that domain that calendar day
- Streak reset check runs on app open — if `last_activity_date < today` and no freeze used, streak resets to 0
- Freeze token: earned at every 7-day streak milestone; protects one missed day
- Display: flame icon + day count, color = domain primary color

---

## CODING STANDARDS

### TypeScript
- Strict mode always (`"strict": true` in tsconfig)
- No `any` types — ever. Use `unknown` and narrow properly.
- All Tauri command return types must be explicitly typed
- Shared types in `src/types/index.ts`

### React
- Functional components only
- `React.memo()` on all list item components: `TaskItem`, `HabitItem`, `GoalCard`, `DomainCard`
- Custom hooks for all business logic — no logic directly in components
- Virtual scrolling via `@tanstack/react-virtual` for any list potentially exceeding 50 items

### State (Zustand)
- One store per feature domain
- Always select the minimum slice needed — never subscribe to whole store
- Every mutation immediately calls its Tauri command (optimistic UI)
- On app launch: hydrate all stores in parallel via `Promise.all()`

### Styling
- Tailwind for layout, spacing, and utilities
- CSS custom properties (tokens.css) for all colors and domain theming
- Domain theming: set `data-domain="military|builder|self"` on the nearest parent container
- Never hardcode hex values in component files
- Minimum interactive target size: 40×40px

### Error Handling
- Every `invoke()` call wrapped in try/catch
- Errors shown in UI (toast notification) — never swallowed silently

### File Conventions
- Components: `PascalCase.tsx`
- Hooks: `useCamelCase.ts`
- Utilities/lib: `kebab-case.ts`
- Stores: `useCamelCaseStore.ts`

---

## BUILD & PACKAGING
```bash
# Development
npm run tauri dev

# Production build (generates .exe)
npm run tauri build

# Output location
src-tauri/target/release/bundle/nsis/   # NSIS installer
src-tauri/target/release/bundle/msi/    # MSI installer
```

tauri.conf.json key settings:
```json
{
  "productName": "Life OS",
  "identifier": "com.lifeos.app",
  "bundle": {
    "targets": ["nsis", "msi"],
    "icon": ["icons/icon.ico", "icons/icon.png"]
  },
  "windows": [{
    "width": 1280,
    "height": 800,
    "minWidth": 1024,
    "minHeight": 700,
    "decorations": true,
    "title": "Life OS"
  }]
}
```

---

## PHASE BUILD ORDER

Always build in this order. Complete and verify each phase before starting the next.

- [x] Phase 1 — Project scaffold, design tokens, app shell (Sidebar + TopBar + routing)
- [x] Phase 2 — SQLite schema + Tauri commands + Zustand stores
- [x] Phase 3 — Command Center dashboard
- [x] Phase 4 — Today View
- [x] Phase 5 — Domain Views (×3, reusable component)
- [x] Phase 6 — Tasks View (full CRUD, nesting, filters)
- [x] Phase 7 — Habits View (CRUD + daily logging + heatmap)
- [x] Phase 8 — Goals View (hierarchy + task linkage)
- [x] Phase 9 — Analytics View (4 charts)
- [x] Phase 10 — Achievement system + Level-up ceremony
- [x] Phase 11 — Settings View
- [x] Phase 12 — Polish pass (Pip-Boy CRT UI overhaul — VT323 fonts, scanlines, vignette, tab bar, footer bar)
- [x] Phase 13 — Notes feature (SQLite table + 5 Rust commands + useNoteStore + 2-col Notes page)
- [x] Phase 14 — Calendar feature (get_calendar_data Rust command + useCalendarStore + monthly grid page)
- [x] Phase 15 — Automated tests (Vitest 3 + RTL: 9 files, 133 tests, all green)
- [x] Phase 16 — Final Tauri build (.exe installer) — v0.3.0

**Update the checkboxes above as phases are completed.**

---

## TESTING

### Setup
- **Framework**: Vitest 3.x + `@testing-library/react` + `jsdom`
- **Run**: `npm test` (single run) | `npm run test:watch` | `npm run test:coverage`
- **Config**: `vitest.config.ts` — aliases `@tauri-apps/api/core` to `src/test/__mocks__/tauri.ts`
- **Tauri mock**: `invoke` is a `vi.fn()` — override per-test with `vi.mocked(invoke).mockResolvedValueOnce(...)`

### Test File Locations
```
src/lib/__tests__/momentum.test.ts          — calcMomentum, state thresholds, labels
src/store/__tests__/useTaskStore.test.ts    — task CRUD, selectors
src/store/__tests__/useNoteStore.test.ts    — note CRUD, search, selection
src/store/__tests__/useCalendarStore.test.ts — month navigation, day lookup
src/components/__tests__/StreakFlame.test.tsx — streak display, sizing
src/components/__tests__/CompletionButton.test.tsx — click, double-click guard
```

### Store Testing Pattern
Zustand stores are ESM singletons. Reset state before each test:
```typescript
beforeEach(() => {
  useTaskStore.setState({ tasks: [], isLoading: false });
  vi.clearAllMocks();
});
```
Do NOT use `vi.resetModules()` with store tests — it breaks the `invoke` mock reference.

### Known Behavior
- Store error-handler tests print to `console.error` (by design — stores log caught errors).
  These appear as `stderr` in test output but are NOT failures.

---

## WHAT NOT TO DO

- Do not use `localStorage` or `sessionStorage` — SQLite only
- Do not write SQL from the frontend — Tauri commands only
- Do not hardcode colors — tokens only
- Do not use class components
- Do not introduce new major dependencies without confirmation
- Do not skip error handling on any `invoke()` call
- Do not build the next phase without confirming the current one compiles
- Do not use `any` in TypeScript
- Do not apply mobile-first design patterns — this is a desktop app
- Do not use `100vh` or `100vw` in CSS — use `100%` instead (Tauri Windows overflow bug)
- Do not use Google Fonts CDN `@import` — fonts must be bundled locally as TTF files
- Do not use `vi.resetModules()` in store tests — breaks the Tauri invoke mock reference
- Do not add border-radius anywhere — the aesthetic is angular / CRT terminal only
- Do not use ease-in-out transitions — use `linear` or `step-end` only (CRT digital behavior)
