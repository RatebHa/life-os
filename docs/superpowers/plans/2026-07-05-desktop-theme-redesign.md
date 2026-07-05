# Desktop Theme Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Pip-Boy CRT visual theme in the desktop app (`Life OS/`) with the modern, clean-SaaS theme defined in `docs/superpowers/specs/2026-07-05-theme-redesign-design.md` — new color/type/shape/motion tokens, CRT effects removed, gamification moments restyled subtly, Pip-prefixed identifiers renamed.

**Architecture:** Both `tokens.css` and `globals.css` are rewritten in full (they are the single source of truth every component already consumes). A small set of components with genuinely structural changes (StreakFlame, LevelUpCeremony, AchievementToast, Sidebar, App.tsx boot/CRT wiring, Settings.tsx, domain colors) are hand-edited. Every other file that references old `--pip*`/`--mil*`/`--bld*`/`--slf*` variable names or Pip-prefixed classNames is fixed by one verified, ordered find-and-replace pass — verified by grep, not assumed.

**Tech Stack:** React 19 + TypeScript, Tailwind v4, Vitest 3 + RTL, plain CSS custom properties (no CSS-in-JS).

---

## Before you start

Neither `Life OS/` nor `life-os-mobile/` is currently a git repository. This plan does NOT initialize git and does NOT include commit steps — ask the user first if they want `git init` run, since that's a decision for them, not something to do silently mid-plan. If they decline, skip every "Commit" step below and just move to the next task.

All file paths below are relative to `C:\Users\isc\Desktop\Projects\Life OS` unless stated otherwise.

---

### Task 1: Rewrite `src/styles/tokens.css` with the new semantic token set

**Files:**
- Modify: `src/styles/tokens.css` (full replacement)

- [ ] **Step 1: Replace the entire file contents**

```css
:root {
  /* Neutral surfaces */
  --color-bg:               #0C0E12;
  --color-surface:          #14171D;
  --color-surface-elevated: #1C2028;
  --color-surface-hover:    #20242C;
  --color-border:           #262B34;
  --color-border-strong:    #3A404C;
  --color-text:             #EDEEF1;
  --color-text-muted:       #9BA1AC;
  --color-text-faint:       #5C636F;

  /* Accent (all primary actions, links, focus, checked states) */
  --color-accent:       #7C6CFF;
  --color-accent-hover:  #8F82FF;
  --color-accent-muted:  rgba(124,108,255,0.15);

  /* Status */
  --color-success: #34D399;
  --color-warning: #F5A524;
  --color-danger:  #F0554E;
  --color-info:    #4A9EFF;

  /* Domain identity base values (sparingly used — left-border stripes, badges, icon tint) */
  --color-domain-military: #D4A73D;
  --color-domain-builder:  #4A90E2;
  --color-domain-self:     #34B27B;

  /* Typography */
  --font-sans:   'Inter', system-ui, -apple-system, sans-serif;
  --font-arabic: 'Noto Naskh Arabic', 'Amiri', 'Segoe UI', Tahoma, sans-serif;

  /* Spacing */
  --gap-xs: 4px;
  --gap-sm: 8px;
  --gap-md: 12px;
  --gap-lg: 20px;

  /* Layout */
  --titlebar-height: 30px;
  --sidebar-width:  200px;
  --topbar-height:  48px;
  --tabbar-height:  36px;
  --footer-height:  28px;

  /* Shape */
  --radius-sm:   6px;
  --radius-md:   8px;
  --radius-lg:   12px;
  --radius-full: 9999px;

  /* Elevation */
  --shadow-xs: 0 1px 2px rgba(0,0,0,0.24);
  --shadow-sm: 0 2px 6px rgba(0,0,0,0.28);
  --shadow-md: 0 8px 24px rgba(0,0,0,0.35);
  --shadow-lg: 0 16px 48px rgba(0,0,0,0.45);
  --shadow-focus-ring: 0 0 0 3px rgba(124,108,255,0.35);

  /* Motion */
  --motion-fast: 120ms cubic-bezier(0.4, 0, 0.2, 1);
  --motion-base: 180ms cubic-bezier(0.4, 0, 0.2, 1);
  --motion-slow: 260ms cubic-bezier(0.4, 0, 0.2, 1);

  /* Momentum state colors — names consumed as-is by src/lib/momentum.ts, only values change */
  --momentum-peak:   var(--color-accent);
  --momentum-normal: var(--color-success);
  --momentum-amber:  var(--color-warning);
  --momentum-red:    var(--color-danger);

  /* Density / text-scale preferences — functional (Settings page), not aesthetic. Unchanged. */
  --body-scale:    1;
  --panel-scale:   1;
  --display-scale: 1;
  --page-padding:  18px 22px;
  --panel-padding: 10px 12px;
  --row-height:    34px;
}

/* Domain aliases for the data-domain attribute mechanism (kept architecturally, only colors change).
   Used for small identity accents — left-border stripes, badges, icon tint — never full-panel treatments. */
[data-domain="military"] {
  --domain-primary: var(--color-domain-military);
  --domain-bright:  var(--color-domain-military);
  --domain-accent:  var(--color-domain-military);
  --domain-dim:     color-mix(in srgb, var(--color-domain-military) 55%, var(--color-bg));
  --domain-bg:      var(--color-bg);
  --domain-subtle:  color-mix(in srgb, var(--color-domain-military) 12%, transparent);
  --domain-glow:    color-mix(in srgb, var(--color-domain-military) 20%, transparent);
}
[data-domain="builder"] {
  --domain-primary: var(--color-domain-builder);
  --domain-bright:  var(--color-domain-builder);
  --domain-accent:  var(--color-domain-builder);
  --domain-dim:     color-mix(in srgb, var(--color-domain-builder) 55%, var(--color-bg));
  --domain-bg:      var(--color-bg);
  --domain-subtle:  color-mix(in srgb, var(--color-domain-builder) 12%, transparent);
  --domain-glow:    color-mix(in srgb, var(--color-domain-builder) 20%, transparent);
}
[data-domain="self"] {
  --domain-primary: var(--color-domain-self);
  --domain-bright:  var(--color-domain-self);
  --domain-accent:  var(--color-domain-self);
  --domain-dim:     color-mix(in srgb, var(--color-domain-self) 55%, var(--color-bg));
  --domain-bg:      var(--color-bg);
  --domain-subtle:  color-mix(in srgb, var(--color-domain-self) 12%, transparent);
  --domain-glow:    color-mix(in srgb, var(--color-domain-self) 20%, transparent);
}
```

This deletes every `--pip*`, `--mil*`, `--bld*`, `--slf*`, `--state-*`, `--clip-*`, `--glow-*`, `--scanline*`, `--vignette*`, `--sweep-opacity`, `--t-fast/base/slow`, and the old flat `--bg-*`/`--text-*`/`--border-*`/`--color-bg-*`/`--color-text-*` backward-compat aliases. Task 3 (mechanical rename) and Task 4 (component hand-edits) update every consumer of those old names — do not run the app between Task 1 and Task 4, it will show broken (unstyled/transparent) UI until the rename pass lands.

- [ ] **Step 2: Confirm the file parses**

Run: `npx tsc --noEmit -p tsconfig.json` is not applicable to CSS — instead just open the dev server later in Task 9 to confirm. For now, visually confirm the file has no unmatched braces by running:

```bash
node -e "const css=require('fs').readFileSync('src/styles/tokens.css','utf8'); const open=(css.match(/\{/g)||[]).length; const close=(css.match(/\}/g)||[]).length; if(open!==close) throw new Error('brace mismatch: '+open+' vs '+close); console.log('OK', open, 'rules');"
```

Expected: `OK <N> rules` with no error.

- [ ] **Step 3: Commit** (skip if git was not initialized per "Before you start")

```bash
git add src/styles/tokens.css
git commit -m "theme: rewrite tokens.css with modern semantic color/type/shape/motion system"
```

---

### Task 2: Rewrite `src/styles/globals.css` — part 1 of 4 (reset, cursor, app shell, tabbar, footer, page layout)

**Files:**
- Modify: `src/styles/globals.css` (full replacement, done across this and the next 3 tasks)

This is one continuous file rewrite split across 4 tasks only so each step stays reviewable. Do not run the app until part 4 is committed — the file will be a mix of old and new class names in between.

- [ ] **Step 1: Replace lines 1–301 of `globals.css` (fonts through footer) with:**

```css
@import "./tokens.css";
@import "tailwindcss";
@source "../";

/* ── LOCAL FONTS ───────────────────────────────────────────────────────────── */
@font-face {
  font-family: 'Inter';
  src: url('../assets/fonts/Inter-Variable.ttf') format('truetype-variations'),
       url('../assets/fonts/Inter-Variable.ttf') format('truetype');
  font-weight: 100 900;
  font-style: normal;
  font-display: block;
}

/* ── RESET ─────────────────────────────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html {
  height: 100%;
  overflow: hidden;
  scrollbar-gutter: stable;
  background: #0C0E12;
}
body {
  height: 100%;
  overflow: hidden;
  background: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-sans);
  font-size: calc(14px * var(--body-scale));
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
#root { height: 100%; overflow: hidden; }

/* ── CURSOR ────────────────────────────────────────────────────────────────── */
* { cursor: default; }
button, [role="button"], .nav-item, .tab, .task-row, .habit-row, select { cursor: pointer; }
input, textarea { cursor: text; }
a { cursor: pointer; }

/* ── SCROLLBARS ────────────────────────────────────────────────────────────── */
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--color-border-strong); border-radius: var(--radius-full); }
::-webkit-scrollbar-thumb:hover { background: var(--color-text-faint); }
::-webkit-scrollbar-corner { background: transparent; }

/* ── SELECTION ─────────────────────────────────────────────────────────────── */
::selection { background: var(--color-accent-muted); color: var(--color-text); }
:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 1px; }

/* ── APP SHELL ─────────────────────────────────────────────────────────────── */
.app-shell {
  display: grid;
  grid-template-rows: var(--titlebar-height) var(--topbar-height) var(--tabbar-height) 1fr var(--footer-height);
  grid-template-columns: var(--sidebar-width) 1fr;
  grid-template-areas:
    "titlebar titlebar"
    "header   header"
    "tabbar   tabbar"
    "sidebar  main"
    "footer   footer";
  height: 100%;
  width: 100%;
  overflow: hidden;
  position: relative;
  isolation: isolate;
  background: var(--color-bg);
}

.app-titlebar {
  grid-area: titlebar;
  background: var(--color-bg);
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  padding: 0 8px 0 12px;
  gap: 8px;
  z-index: 20;
  -webkit-app-region: drag;
  user-select: none;
}
.app-titlebar-drag-region {
  flex: 1;
  height: 100%;
}
.app-titlebar button {
  -webkit-app-region: no-drag;
}

.app-header  { grid-area: header; }
.app-tabbar  { grid-area: tabbar; }
.app-sidebar { grid-area: sidebar; }
.app-main    { grid-area: main; }
.app-footer  { grid-area: footer; }

/* Keep legacy topbar name working */
.app-topbar {
  grid-area: header;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  height: var(--topbar-height);
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 10px;
  z-index: 10;
  transition: border-color var(--motion-base), background var(--motion-base);
}

.app-sidebar {
  background: var(--color-surface);
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
  z-index: 9;
}

.app-sidebar-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
}

.app-sidebar-actions {
  flex-shrink: 0;
  border-top: 1px solid var(--color-border);
  padding: 4px 0;
  background: var(--color-surface);
}

.app-main {
  background: var(--color-bg);
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
  min-height: 0;
  contain: paint;
}

/* ── TAB BAR ───────────────────────────────────────────────────────────────── */
.tabbar {
  grid-area: tabbar;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: stretch;
  padding: 0 8px;
  gap: 0;
  z-index: 9;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: thin;
}
.tab {
  position: relative;
  display: flex;
  align-items: center;
  padding: 0 14px;
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-muted);
  border-bottom: 2px solid transparent;
  transition: color var(--motion-fast), border-color var(--motion-fast);
  user-select: none;
  white-space: nowrap;
}
.tab:hover {
  color: var(--color-text);
  background: var(--color-surface-hover);
}
.tab.active {
  color: var(--color-text);
  border-bottom-color: var(--color-accent);
  font-weight: 600;
}

/* ── FOOTER ────────────────────────────────────────────────────────────────── */
.footer {
  grid-area: footer;
  background: var(--color-surface);
  border-top: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px;
  font-family: var(--font-sans);
  font-size: 11px;
  color: var(--color-text-muted);
  z-index: 10;
}
.footer.critical {
  border-top-color: var(--color-danger);
  color: var(--color-danger);
  animation: softPulse 1.6s var(--motion-slow) infinite;
}

/* ── PAGE LAYOUT ───────────────────────────────────────────────────────────── */
.page-content {
  padding: var(--page-padding);
  display: flex;
  flex-direction: column;
  gap: 18px;
  animation: pageRise var(--motion-base) both;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.page-header-copy {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.page-header-actions {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  flex-wrap: wrap;
}

.layout-grid-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 10px;
}

.layout-grid-split {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(320px, 0.85fr);
  gap: 12px;
  align-items: start;
}

.layout-grid-two {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.layout-grid-three {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.layout-grid-three-tight {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.layout-grid-pairs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.layout-grid-controls {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.layout-grid-domain-form {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 8px;
  align-items: end;
}

.layout-actions-end {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}

/* ── PAGE TITLE ────────────────────────────────────────────────────────────── */
.page-title {
  font-family: var(--font-sans);
  font-weight: 700;
  font-size: calc(26px * var(--display-scale));
  letter-spacing: -0.01em;
  color: var(--color-text);
  line-height: 1.2;
}
.page-subtitle {
  font-family: var(--font-sans);
  font-size: calc(13px * var(--body-scale));
  color: var(--color-text-muted);
}
.page-sep {
  border: none;
  border-top: 1px solid var(--color-border);
  margin: 2px 0 0;
}
```

Note what was deliberately dropped versus the old file: the `.pip-screen` wrapper and its `::before`/`::after` scanline/vignette layers, the `.app-shell::before` sweep animation, the per-domain border/glow overrides on `.app-topbar`/`.tabbar`/`.app-sidebar` (domain identity now shows up only in nav rows and cards, not app-wide chrome), and the domain-tinted `.page-title` override (page titles stay neutral `--color-text` in every domain). `select.input`'s old crosshair override is gone because the base cursor reset now sets `select { cursor: pointer }` directly.

- [ ] **Step 2: Commit** (skip if no git repo)

```bash
git add src/styles/globals.css
git commit -m "theme: globals.css part 1/4 — reset, app shell, tabbar, footer, page layout"
```

---

### Task 3: Rewrite `src/styles/globals.css` — part 2 of 4 (cards, nav, habit cards)

**Files:**
- Modify: `src/styles/globals.css` (append after the content from Task 2)

- [ ] **Step 1: Append the following after `.page-sep`'s closing brace:**

```css
/* ── CARD (formerly .pip-panel) ───────────────────────────────────────────── */
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
.card-title {
  font-family: var(--font-sans);
  font-weight: 600;
  font-size: 15px;
  color: var(--color-text);
}
.card-meta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-sans);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}
.card-body {
  padding: var(--panel-padding);
}

.panel-note {
  font-family: var(--font-sans);
  font-size: 12px;
  color: var(--color-text-muted);
  line-height: 1.55;
}

/* ── PANEL (kept name — pre-existing alias distinct from .card) ───────────── */
.panel { border: 1px solid var(--color-border); background: var(--color-surface); border-radius: var(--radius-lg); }
.panel-elevated { border: 1px solid var(--color-border); background: var(--color-surface-elevated); border-radius: var(--radius-lg); }

/* ── NAV ITEMS ─────────────────────────────────────────────────────────────── */
.nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 12px;
  min-height: var(--row-height);
  color: var(--color-text-muted);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 500;
  border-radius: var(--radius-md);
  transition: color var(--motion-fast), background var(--motion-fast);
  user-select: none;
  width: 100%;
  text-align: left;
  background: transparent;
  border: none;
}
.nav-item:hover { color: var(--color-text); background: var(--color-surface-hover); }
.nav-item.active {
  color: var(--color-accent);
  background: var(--color-accent-muted);
  box-shadow: inset 2px 0 0 var(--color-accent);
  font-weight: 600;
}

.task-row,
.habit-row {
  position: relative;
  border-radius: var(--radius-md);
  transition: background-color var(--motion-fast);
}
.task-row:hover,
.habit-row:hover {
  background: var(--color-surface-hover);
}

.habit-domain-list {
  display: grid;
  gap: 12px;
}

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

.habit-card::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 3px;
  border-radius: var(--radius-full) 0 0 var(--radius-full);
  background: var(--domain-primary, var(--color-accent));
  opacity: 0.75;
}

.habit-card:hover {
  border-color: color-mix(in srgb, var(--domain-primary, var(--color-accent)) 55%, var(--color-border));
  box-shadow: var(--shadow-sm);
}

.habit-card.is-highlighted {
  border-color: var(--color-accent);
  box-shadow: var(--shadow-focus-ring);
}

.habit-card-main {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.habit-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.habit-card-heading {
  display: grid;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.habit-card-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text);
  line-height: 1.3;
  word-break: break-word;
}

.habit-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.habit-chip {
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  padding: 1px 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface-hover);
  font-family: var(--font-sans);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

.habit-chip-muted {
  color: var(--color-text-muted);
}

.habit-chip-good {
  color: var(--color-success);
  border-color: color-mix(in srgb, var(--color-success) 55%, var(--color-border));
  background: color-mix(in srgb, var(--color-success) 12%, transparent);
}

.habit-chip-warning {
  color: var(--color-warning);
  border-color: color-mix(in srgb, var(--color-warning) 55%, var(--color-border));
  background: color-mix(in srgb, var(--color-warning) 12%, transparent);
}

.habit-chip-danger {
  color: var(--color-danger);
  border-color: color-mix(in srgb, var(--color-danger) 55%, var(--color-border));
  background: color-mix(in srgb, var(--color-danger) 12%, transparent);
}

.habit-chip-info {
  color: var(--color-info);
  border-color: color-mix(in srgb, var(--color-info) 55%, var(--color-border));
  background: color-mix(in srgb, var(--color-info) 12%, transparent);
}

.habit-card-window {
  min-width: 148px;
  display: grid;
  gap: 2px;
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-hover);
  text-align: right;
}

.habit-card-window-label,
.habit-card-window-meta,
.habit-card-section-label,
.habit-card-section-note,
.habit-insight-label,
.habit-card-metric-label,
.habit-card-minimum-label,
.habit-card-action-label,
.habit-card-action-note {
  font-family: var(--font-sans);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.habit-card-window-label {
  color: var(--color-text-muted);
}

.habit-card-window-value {
  font-family: var(--font-sans);
  font-weight: 700;
  font-size: 26px;
  letter-spacing: -0.02em;
  line-height: 1;
  color: var(--color-text);
}

.habit-card-window-meta {
  color: var(--color-text-muted);
}

.habit-card-summary {
  display: grid;
  gap: 8px;
}

.habit-card-description {
  font-size: 12px;
  color: var(--color-text-muted);
  line-height: 1.55;
}

.habit-card-minimum {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
  padding-left: 10px;
  border-left: 2px solid var(--color-warning);
  color: var(--color-warning);
  font-size: 12px;
}

.habit-card-minimum-label {
  color: color-mix(in srgb, var(--color-warning) 75%, var(--color-text-muted));
}

.habit-card-guidance {
  padding: 9px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-hover);
  font-size: 11px;
  line-height: 1.55;
  color: var(--color-text-muted);
}

.habit-card-guidance.tone-good {
  border-color: color-mix(in srgb, var(--color-success) 50%, var(--color-border));
  color: var(--color-success);
}

.habit-card-guidance.tone-warning {
  border-color: color-mix(in srgb, var(--color-warning) 50%, var(--color-border));
  color: var(--color-warning);
}

.habit-card-guidance.tone-danger {
  border-color: color-mix(in srgb, var(--color-danger) 50%, var(--color-border));
  color: var(--color-danger);
}

.habit-card-guidance.tone-info {
  border-color: color-mix(in srgb, var(--color-info) 50%, var(--color-border));
  color: var(--color-info);
}

.habit-card-progress,
.habit-card-activity,
.habit-card-insights {
  display: grid;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-hover);
}

.habit-card-section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.habit-card-section-label,
.habit-insight-label,
.habit-card-metric-label {
  color: var(--color-text-muted);
}

.habit-card-section-note {
  color: var(--color-text);
}

.habit-progress-track {
  height: 6px;
  border-radius: var(--radius-full);
  background: var(--color-surface-elevated);
  overflow: hidden;
}

.habit-progress-fill {
  height: 100%;
  border-radius: var(--radius-full);
  background: var(--domain-primary, var(--color-accent));
  transition: width var(--motion-slow);
}

.habit-card-diagnostics {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(200px, 0.8fr);
  gap: 12px;
}

.habit-heatmap {
  display: flex;
  gap: 2px;
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 2px;
}

.habit-heatmap-week {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.habit-heatmap-cell {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  background: var(--color-surface-hover);
  opacity: 0.35;
  flex: 0 0 auto;
}

.habit-heatmap-cell.status-completed {
  background: var(--domain-primary, var(--color-accent));
  opacity: 0.95;
}

.habit-heatmap-cell.status-minimum {
  background: var(--color-warning);
  opacity: 0.92;
}

.habit-heatmap-cell.status-partial {
  background: var(--color-info);
  opacity: 0.9;
}

.habit-heatmap-cell.status-skipped {
  background: var(--color-danger);
  opacity: 0.92;
}

.habit-card-insights {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.habit-insight-tile {
  display: grid;
  gap: 6px;
  padding: 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-hover);
  min-height: 68px;
}

.habit-insight-value {
  font-family: var(--font-sans);
  font-weight: 700;
  font-size: 20px;
  line-height: 1;
  color: var(--color-text);
}

.habit-card-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 10px;
  border-top: 1px solid var(--color-border);
}

.habit-card-action-group {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.habit-card-action-group-recovery {
  padding-left: 10px;
  border-left: 1px solid var(--color-border);
}

.habit-card-action-group-secondary {
  margin-left: auto;
}

.habit-card-action-label {
  color: var(--color-warning);
}

.habit-card-action-note {
  color: var(--color-text-muted);
}

.habit-card-sidebar {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  align-content: start;
}

.habit-card-metric {
  display: grid;
  gap: 4px;
  min-height: 64px;
  padding: 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-hover);
}

.habit-card-metric-value {
  font-family: var(--font-sans);
  font-weight: 700;
  font-size: 20px;
  line-height: 1;
  color: var(--color-text);
}

.habit-history-modal {
  max-width: min(760px, 100%);
}

.habit-history-shell {
  display: grid;
  gap: 14px;
}

.habit-history-copy {
  display: grid;
  gap: 6px;
}

.habit-history-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
}

.habit-history-note {
  font-size: 12px;
  line-height: 1.55;
  color: var(--color-text-muted);
}

.habit-history-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(220px, 0.9fr);
  gap: 12px;
}

.habit-history-panel {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-hover);
}

.habit-history-panel-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.habit-history-panel-meta {
  font-family: var(--font-sans);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

.habit-history-state {
  display: grid;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-hover);
}

.habit-history-state-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.habit-history-state-label {
  font-family: var(--font-sans);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

.habit-history-state-value {
  font-family: var(--font-sans);
  font-weight: 700;
  font-size: 18px;
  color: var(--color-text);
  line-height: 1;
}

.habit-history-state-detail {
  font-family: var(--font-sans);
  font-size: 11px;
  line-height: 1.5;
  color: var(--color-warning);
}

.habit-history-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.habit-history-actions > .btn {
  flex: 1 1 180px;
}

.habit-history-disabled,
.habit-history-empty {
  font-size: 11px;
  line-height: 1.55;
  color: var(--color-text-muted);
}

.habit-history-chip-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.habit-date-chip {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface-hover);
  color: var(--color-text-muted);
  font-family: var(--font-sans);
  font-size: 11px;
}

.habit-date-chip:hover {
  color: var(--color-text);
  border-color: var(--color-border-strong);
}

.habit-date-chip.is-active {
  color: var(--color-accent);
  border-color: var(--color-accent);
  background: var(--color-accent-muted);
}
```

- [ ] **Step 2: Commit** (skip if no git repo)

```bash
git add src/styles/globals.css
git commit -m "theme: globals.css part 2/4 — cards, nav items, habit card family"
```

---

### Task 4: Rewrite `src/styles/globals.css` — part 3 of 4 (buttons, inputs, badges, modal, skeleton, progress, animations)

**Files:**
- Modify: `src/styles/globals.css` (append after the content from Task 3)

- [ ] **Step 1: Append the following after `.habit-date-chip.is-active`'s closing brace:**

```css
/* ── BUTTONS ───────────────────────────────────────────────────────────────── */
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
.btn:focus-visible { box-shadow: var(--shadow-focus-ring); }
.btn:disabled { opacity: 0.45; cursor: default; }

.btn-sm { padding: 0 10px; font-size: 12px; min-height: 28px; }

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

.btn-ghost {
  border-color: var(--color-border);
  color: var(--color-text-muted);
  background: transparent;
}

.btn-danger {
  border-color: var(--color-danger);
  color: var(--color-danger);
  background: transparent;
}
.btn-danger:hover:not(:disabled) {
  background: color-mix(in srgb, var(--color-danger) 12%, transparent);
}

/* ── INPUTS ────────────────────────────────────────────────────────────────── */
.input {
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-family: var(--font-sans);
  font-size: calc(14px * var(--body-scale));
  padding: 6px 10px;
  min-height: calc(36px * var(--panel-scale));
  outline: none;
  width: 100%;
  transition: border-color var(--motion-fast), box-shadow var(--motion-fast);
}
.input:focus { border-color: var(--color-accent); box-shadow: var(--shadow-focus-ring); }
.input::placeholder { color: var(--color-text-faint); }
textarea.input, .input[rows] { height: auto; min-height: 80px; resize: vertical; line-height: 1.6; }

/* ── BADGES ────────────────────────────────────────────────────────────────── */
.badge {
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-family: var(--font-sans);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

/* ── PRIORITY ──────────────────────────────────────────────────────────────── */
.priority-critical { color: var(--color-danger); }
.priority-high     { color: var(--color-warning); }
.priority-medium   { color: var(--color-info); }
.priority-low      { color: var(--color-text-muted); }

.priority-badge-critical { border: 1px solid var(--color-danger);  color: var(--color-danger);  border-radius: var(--radius-sm); font-size: 10px; padding: 1px 6px; letter-spacing: 0.02em; text-transform: uppercase; font-family: var(--font-sans); }
.priority-badge-high     { border: 1px solid var(--color-warning); color: var(--color-warning); border-radius: var(--radius-sm); font-size: 10px; padding: 1px 6px; letter-spacing: 0.02em; text-transform: uppercase; font-family: var(--font-sans); }
.priority-badge-medium   { border: 1px solid var(--color-info);    color: var(--color-info);    border-radius: var(--radius-sm); font-size: 10px; padding: 1px 6px; letter-spacing: 0.02em; text-transform: uppercase; font-family: var(--font-sans); }
.priority-badge-low      { border: 1px solid var(--color-border);  color: var(--color-text-muted); border-radius: var(--radius-sm); font-size: 10px; padding: 1px 6px; letter-spacing: 0.02em; text-transform: uppercase; font-family: var(--font-sans); }

/* ── MODAL ─────────────────────────────────────────────────────────────────── */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(4,5,8,0.6);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  overflow: auto;
}
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
.modal-header {
  min-height: 46px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: var(--color-surface);
}
.modal-title {
  font-family: var(--font-sans);
  font-weight: 600;
  font-size: 16px;
  color: var(--color-text);
}
.modal-body { padding: var(--panel-padding); }

/* ── SKELETON ──────────────────────────────────────────────────────────────── */
@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
.skeleton {
  background: linear-gradient(90deg, var(--color-surface-hover) 25%, var(--color-surface-elevated) 50%, var(--color-surface-hover) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s linear infinite;
  border-radius: var(--radius-sm);
}

/* ── PROGRESS BAR ──────────────────────────────────────────────────────────── */
.progress-track,
.xp-bar-track {
  background: var(--color-surface-elevated);
  border-radius: var(--radius-full);
  height: 4px;
  overflow: hidden;
}
.progress-fill,
.xp-bar-fill {
  height: 100%;
  border-radius: var(--radius-full);
  background: var(--domain-primary, var(--color-accent));
  transition: width var(--motion-slow);
}

/* ── ANIMATIONS ────────────────────────────────────────────────────────────── */
@keyframes bootIn {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes pageRise {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes modalEnter {
  from { opacity: 0; transform: translateY(10px) scale(0.985); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes softPulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.5; }
}
@keyframes toastIn {
  from { transform: translateX(120%); opacity: 0; }
  to   { transform: translateX(0);    opacity: 1; }
}
@keyframes toastOut {
  from { transform: translateX(0);    opacity: 1; }
  to   { transform: translateX(120%); opacity: 0; }
}

.blink        { animation: softPulse 1s var(--motion-slow) infinite; }
.fade-in      { animation: bootIn var(--motion-fast) both; }
.check-pop    { animation: bootIn var(--motion-fast) both; }
.streak-pulse { animation: softPulse 1.4s var(--motion-slow); }

/* Staggered boot-in for list items */
.boot-item { animation: bootIn var(--motion-fast) both; }
.boot-item:nth-child(1)  { animation-delay: 0ms; }
.boot-item:nth-child(2)  { animation-delay: 50ms; }
.boot-item:nth-child(3)  { animation-delay: 100ms; }
.boot-item:nth-child(4)  { animation-delay: 150ms; }
.boot-item:nth-child(5)  { animation-delay: 200ms; }
.boot-item:nth-child(6)  { animation-delay: 250ms; }
.boot-item:nth-child(7)  { animation-delay: 300ms; }
.boot-item:nth-child(8)  { animation-delay: 350ms; }
.boot-item:nth-child(9)  { animation-delay: 400ms; }
.boot-item:nth-child(10) { animation-delay: 450ms; }
```

`.blink-slow` and `.red-alert` are dropped here: `grep -rn "blink-slow\|red-alert" src --include=*.tsx` (run this to confirm) returns zero component consumers — they were already-dead CSS in the old file, not a loss of any visible behavior. `redPulse`, `flicker`, `screenSweep`, and `borderPulse` keyframes are dropped for the same reason (no consumers) plus `flicker`/`screenSweep` specifically powered the removed CRT scanline/sweep effects.

- [ ] **Step 2: Commit** (skip if no git repo)

```bash
git add src/styles/globals.css
git commit -m "theme: globals.css part 3/4 — buttons, inputs, badges, modal, skeleton, progress, animations"
```

---

### Task 5: Rewrite `src/styles/globals.css` — part 4 of 4 (level-up, toasts, boot screen, typography, empty state, stat card, media queries)

**Files:**
- Modify: `src/styles/globals.css` (append after the content from Task 4 — this is the final part of the file)

- [ ] **Step 1: Append the following after the `.boot-item:nth-child(10)` rule:**

```css
/* ── LEVEL UP CARD (shrunk from full-screen ceremony to a centered card) ───── */
.level-up-overlay {
  position: fixed;
  inset: 0;
  z-index: 9998;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(4,5,8,0.55);
}
.level-up-shell {
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 28px 40px;
  text-align: center;
  background: var(--color-surface);
  border: 1px solid var(--domain-primary, var(--color-accent));
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  min-width: 320px;
}
.level-up-hud,
.level-up-grid {
  width: 100%;
  display: flex;
  justify-content: space-between;
  gap: 16px;
  font-family: var(--font-sans);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
  text-transform: uppercase;
}
.level-up-kicker {
  font-family: var(--font-sans);
  font-weight: 600;
  font-size: 13px;
  letter-spacing: 0.08em;
  color: var(--color-text-muted);
  text-transform: uppercase;
}
.level-up-rank {
  font-family: var(--font-sans);
  font-weight: 700;
  font-size: 56px;
  letter-spacing: -0.02em;
  color: var(--domain-bright, var(--color-accent));
  line-height: 1;
}
.level-up-title {
  font-family: var(--font-sans);
  font-weight: 700;
  font-size: 24px;
  color: var(--color-text);
}
.level-up-subtitle {
  font-family: var(--font-sans);
  font-size: 11px;
  color: var(--color-text-muted);
}

/* ── ACHIEVEMENT TOAST ─────────────────────────────────────────────────────── */
.achievement-toast-wrap {
  animation: toastIn var(--motion-base) both;
}
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
.achievement-toast::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  border-radius: var(--radius-full) 0 0 var(--radius-full);
  background: var(--color-accent);
}
.achievement-toast-icon {
  min-width: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text);
  font-size: 14px;
}
.achievement-toast-kicker {
  font-family: var(--font-sans);
  font-weight: 600;
  font-size: 10px;
  letter-spacing: 0.06em;
  color: var(--color-text-muted);
  text-transform: uppercase;
}
.achievement-toast-title {
  font-family: var(--font-sans);
  font-weight: 700;
  font-size: 16px;
  color: var(--color-accent);
}
.achievement-toast-copy {
  font-family: var(--font-sans);
  font-size: 11px;
  color: var(--color-text-muted);
  margin-top: 4px;
}

/* ── UNDO TOAST ────────────────────────────────────────────────────────────── */
.undo-toast-stack {
  position: fixed;
  right: 16px;
  bottom: 78px;
  z-index: 340;
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: min(360px, calc(100vw - 32px));
  pointer-events: none;
}

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

.undo-toast-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.undo-toast-title {
  font-family: var(--font-sans);
  font-weight: 600;
  font-size: 14px;
  color: var(--color-warning);
}

.undo-toast-detail {
  font-family: var(--font-sans);
  font-size: 12px;
  color: var(--color-text);
  line-height: 1.45;
  word-break: break-word;
}

.undo-toast-close {
  border: none;
  background: transparent;
  color: var(--color-text-muted);
}

.undo-toast-close:hover {
  color: var(--color-text);
}

.undo-toast-meter {
  position: relative;
  height: 3px;
  border-radius: var(--radius-full);
  background: var(--color-surface-elevated);
  overflow: hidden;
}

.undo-toast-meter-fill {
  height: 100%;
  border-radius: var(--radius-full);
  background: var(--color-warning);
}

.undo-toast-actions {
  display: flex;
  justify-content: flex-end;
}

/* ── BOOT SCREEN ───────────────────────────────────────────────────────────── */
.boot-screen {
  display: flex;
  align-items: center;
  justify-content: center;
}
.boot-shell {
  width: min(880px, calc(100% - 64px));
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.boot-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-end;
}
.boot-brand {
  font-family: var(--font-sans);
  font-weight: 700;
  font-size: 40px;
  letter-spacing: -0.02em;
  color: var(--color-text);
}
.boot-subtitle,
.boot-panel-title,
.boot-log-line,
.boot-stat,
.boot-footer {
  font-family: var(--font-sans);
  font-size: 11px;
}
.boot-subtitle,
.boot-panel-title,
.boot-footer {
  color: var(--color-text-muted);
}
.boot-grid {
  display: grid;
  grid-template-columns: 1.2fr 0.8fr;
  gap: 16px;
}
.boot-panel {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-xs);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.boot-log {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.boot-log-line {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  color: var(--color-text-faint);
}
.boot-log-line.active {
  color: var(--color-accent);
}
.boot-stat {
  display: flex;
  justify-content: space-between;
  color: var(--color-text);
}
.boot-progress {
  height: 8px;
  border-radius: var(--radius-full);
  background: var(--color-surface-elevated);
  overflow: hidden;
}
.boot-progress-fill {
  height: 100%;
  border-radius: var(--radius-full);
  background: var(--color-accent);
  transition: width var(--motion-base);
}

/* ── TYPOGRAPHY UTILITIES ──────────────────────────────────────────────────── */
.font-display { font-family: var(--font-sans); }
.font-mono    { font-family: var(--font-sans); }
.font-heading { font-family: var(--font-sans); }
.meta-label {
  font-family: var(--font-sans);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

/* ── EMPTY STATE (formerly .pip-empty) ─────────────────────────────────────── */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 20px;
  gap: 10px;
  color: var(--color-text-muted);
  font-family: var(--font-sans);
  font-size: 13px;
  text-align: center;
}
.empty-state-title {
  font-family: var(--font-sans);
  font-weight: 600;
  font-size: 16px;
  color: var(--color-text);
}

/* ── STAT CARD ─────────────────────────────────────────────────────────────── */
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
.stat-value {
  font-family: var(--font-sans);
  font-weight: 700;
  font-size: 26px;
  letter-spacing: -0.02em;
  color: var(--color-text);
  line-height: 1;
}
.stat-label {
  font-family: var(--font-sans);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
  text-transform: uppercase;
}

/* ── DOMAIN / MISC ─────────────────────────────────────────────────────────── */
.domain-card {
  border-radius: var(--radius-lg);
  transition: border-color var(--motion-base);
}
.domain-card:hover { border-color: var(--domain-primary, var(--color-accent)) !important; }

@media (max-width: 1500px) {
  .layout-grid-split {
    grid-template-columns: 1fr;
  }

  .layout-grid-three {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .habit-card {
    grid-template-columns: 1fr;
  }

  .habit-card-sidebar {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .habit-history-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 1280px) {
  .page-title {
    font-size: calc(22px * var(--display-scale));
  }

  .page-header-actions {
    width: 100%;
  }

  .page-header-actions > * {
    flex: 1 1 220px;
  }

  .card-header {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .card-meta {
    justify-content: flex-start;
  }

  .layout-grid-two,
  .layout-grid-three,
  .layout-grid-three-tight,
  .layout-grid-controls,
  .layout-grid-pairs {
    grid-template-columns: 1fr;
  }

  .layout-actions-end {
    justify-content: stretch;
  }

  .layout-actions-end > * {
    flex: 1 1 220px;
  }

  .stat-value {
    font-size: 22px;
  }

  .habit-card-header {
    flex-direction: column;
  }

  .habit-card-window {
    width: 100%;
    min-width: 0;
    text-align: left;
  }

  .habit-card-diagnostics {
    grid-template-columns: 1fr;
  }

  .habit-card-insights {
    grid-template-columns: 1fr;
  }

  .habit-card-sidebar {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .habit-card-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .habit-card-action-group,
  .habit-card-action-group-secondary {
    width: 100%;
    margin-left: 0;
  }

  .habit-card-action-group-recovery {
    padding-left: 0;
    border-left: none;
    padding-top: 8px;
    border-top: 1px solid var(--color-border);
  }

  .habit-card-action-group > .btn {
    flex: 1 1 180px;
  }

  .habit-card-action-label,
  .habit-card-action-note {
    width: 100%;
  }

  .habit-history-actions > .btn {
    flex: 1 1 100%;
  }
}
```

This closes out `globals.css`. Deliberately dropped in this part: `.clip-card`/`.clip-btn`/`.clip-badge` (confirmed zero consumers via `grep -rn "clip-card\|clip-btn\|clip-badge" src`) and `.achievement-toast-scan` (the pulsing scanline strip — a CRT-specific flourish; its JSX element is removed in Task 8).

- [ ] **Step 2: Verify the full file is balanced**

```bash
node -e "const css=require('fs').readFileSync('src/styles/globals.css','utf8'); const open=(css.match(/\{/g)||[]).length; const close=(css.match(/\}/g)||[]).length; if(open!==close) throw new Error('brace mismatch: '+open+' vs '+close); console.log('OK', open, 'rules');"
```

Expected: `OK <N> rules` with no error.

- [ ] **Step 3: Commit** (skip if no git repo)

```bash
git add src/styles/globals.css
git commit -m "theme: globals.css part 4/4 — level-up card, toasts, boot screen, typography, stat card"
```

---

### Task 6: Mechanical rename pass across every other component/lib/page file

**Files:**
- Modify: every `.ts`/`.tsx`/`.css` file under `src/` except `src/styles/tokens.css` and `src/styles/globals.css` (already hand-rewritten in Tasks 1–5)
- Delete: `src/App.css` (confirmed dead — verify first, see Step 1)

This covers every file that references old CSS custom property names or Pip-prefixed class names purely as **consumers** (inline `style={{ color: 'var(--pip-bright)' }}`, `className="pip-panel"`, etc.) with no other meaning attached — e.g. `TopBar.tsx`, `TabBar.tsx`, `FooterBar.tsx`, `TitleBar.tsx`, `Onboarding.tsx`, `HabitHistoryEditor.tsx`, `DebugConsole.tsx`, `FocusTimer.tsx`, `GlobalSearch.tsx`, `PanelHeader.tsx`, `QuickCapture.tsx`, `RouteErrorBoundary.tsx`, `TaskForm.tsx`, `QuickAddTask.tsx`, `ErrorToast.tsx`, `CompletionButton.tsx`, and every file under `src/pages/`. The 7 files with color/text *meaning* changes (not just renames) are handled by hand in Tasks 7–12 instead — do not let this script touch the intent of those, just run it everywhere; the later tasks fix up the specific lines that need more than a rename afterward.

- [ ] **Step 1: Confirm `src/App.css` is unused, then delete it**

```bash
grep -rn "App.css" src/*.tsx
```

Expected: no output (confirms it's never imported — it's unmodified `create-tauri-app` scaffold boilerplate with hardcoded light-mode colors that has no bearing on the actual app).

```bash
rm src/App.css
```

- [ ] **Step 2: Run the ordered rename script**

Order matters — more specific names must be replaced before the shorter names they contain, or the shorter replacement will corrupt the longer name first. Run this exactly as written, top to bottom, from the `Life OS` repo root:

```bash
FILES=$(find src -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.css" \) \
  -not -path "src/styles/tokens.css" -not -path "src/styles/globals.css")

# CSS custom properties — longest/most-specific name first
for pair in \
  "--pip-shadow-deep:--shadow-sm" \
  "--pip-inset-glow:--shadow-xs" \
  "--pip-glow-bright:--shadow-md" \
  "--pip-bright:--color-text" \
  "--pip-muted:--color-text-muted" \
  "--pip-dim:--color-text-faint" \
  "--pip-faint:--color-surface-hover" \
  "--pip-dark:--color-bg" \
  "--pip-bg:--color-bg" \
  "--pip-panel:--color-surface" \
  "--pip-border:--color-border" \
  "--pip-elevated:--color-surface-elevated" \
  "--pip-amber:--color-warning" \
  "--pip-red:--color-danger" \
  "--pip-blue:--color-info" \
  "--pip-glow:--shadow-focus-ring" \
  "--pip:--color-accent" \
  "--font-display:--font-sans" \
  "--font-body:--font-sans" \
  "--font-pip:--font-sans" \
  "--font-mono:--font-sans" \
  "--font-heading:--font-sans" \
  "--t-fast:--motion-fast" \
  "--t-base:--motion-base" \
  "--t-slow:--motion-slow" \
  "--color-bg-base:--color-bg" \
  "--color-bg-panel:--color-surface" \
  "--color-bg-elevated:--color-surface-elevated" \
  "--color-bg-hover:--color-surface-hover" \
  "--color-text-primary:--color-text" \
  "--color-text-dim:--color-text-faint" \
  "--color-border-muted:--color-border" \
  "--text-primary:--color-text" \
  "--text-secondary:--color-text-muted" \
  "--text-muted:--color-text-muted" \
  "--text-faint:--color-text-faint" \
  "--bg-base:--color-bg" \
  "--bg-panel:--color-surface" \
  "--bg-elevated:--color-surface-elevated" \
  "--bg-input:--color-surface-elevated" \
  "--border-base:--color-border" \
  "--border-bright:--color-border-strong" \
  "--border-dim:--color-border" \
  "--state-red:--color-danger" \
  ; do
  old="${pair%%:*}"; new="${pair##*:}"
  echo "$FILES" | xargs sed -i "s/${old//./\\.}/${new}/g"
done
```

- [ ] **Step 3: Run the class-name rename script (separate pass, also ordered longest-first)**

```bash
FILES=$(find src -type f \( -name "*.tsx" -o -name "*.css" \) \
  -not -path "src/styles/tokens.css" -not -path "src/styles/globals.css")

for pair in \
  "pip-panel-header:card-header" \
  "pip-panel-title:card-title" \
  "pip-panel-body:card-body" \
  "pip-panel-meta:card-meta" \
  "pip-panel:card" \
  "pip-tabbar:tabbar" \
  "pip-tab:tab" \
  "pip-footer:footer" \
  "pip-empty-title:empty-state-title" \
  "pip-empty:empty-state" \
  "pip-label:meta-label" \
  ; do
  old="${pair%%:*}"; new="${pair##*:}"
  echo "$FILES" | xargs sed -i "s/${old}/${new}/g"
done
```

- [ ] **Step 4: Verify — zero old references remain anywhere they shouldn't**

```bash
grep -rn -- "--pip\|--mil-\|--bld-\|--slf-\|--font-display\|--font-body\|--t-fast\|--t-base\|--t-slow\|pip-panel\|pip-tab\|pip-footer\|pip-empty\|pip-label" src --include=*.ts --include=*.tsx --include=*.css
```

Expected: no output. If anything remains, it is either a file this task's find/replace didn't reach (fix it the same way, by hand) or one of the intentionally-excluded CRT-wiring/label spots that Tasks 7–12 remove directly (`--scanline-opacity`, `--vignette-opacity`, `--sweep-opacity`, `--glow-text`, `pip-screen` — these are expected to still show up until those tasks run; everything else should be zero).

- [ ] **Step 5: Commit** (skip if no git repo)

```bash
git add -A
git commit -m "theme: mechanical rename pass — old pip/mil/bld/slf tokens and classnames to new semantic names"
```

---

### Task 7: Remove CRT-intensity wiring and the `pip-screen` wrapper from `src/App.tsx`

**Files:**
- Modify: `src/App.tsx`

By this point Task 6 has already renamed every `var(--pip-bg)` etc. inside this file to `var(--color-bg)` — the edits below apply on top of that. The `pip-screen` className is untouched by Task 6 on purpose (it's being deleted, not renamed), so it still reads `"pip-screen ..."` here.

- [ ] **Step 1: Fix the boot step copy that references CRT**

```typescript
const BOOT_STEPS = [
  'MOUNTING LOCAL DATABASE',
  'VERIFYING DOMAIN TELEMETRY',
  'LOADING TODAY BOARD',
  'PREPARING INTERFACE',
  'READYING COMMAND GRID',
] as const;
```

- [ ] **Step 2: Drop the CRT-intensity branch from `buildDisplayVariables`**

Replace:
```typescript
function buildDisplayVariables(
  crtIntensity: 'low' | 'medium' | 'high' | undefined,
  textScale: 'normal' | 'large' | 'xl' | undefined,
  uiDensity: 'compact' | 'comfortable' | undefined,
): React.CSSProperties {
  const crtMap = {
    low: { scanline: '0.45', vignette: '0.35', sweep: '0.28' },
    medium: { scanline: '0.72', vignette: '0.5', sweep: '0.55' },
    high: { scanline: '1', vignette: '0.72', sweep: '0.88' },
  } as const;
  const scaleMap = {
    normal: { body: '1', panel: '1', display: '1' },
    large: { body: '1.08', panel: '1.1', display: '1.08' },
    xl: { body: '1.16', panel: '1.2', display: '1.14' },
  } as const;
  const densityMap = {
    compact: { page: '14px 16px', panel: '8px 10px', row: '28px' },
    comfortable: { page: '18px 22px', panel: '10px 12px', row: '34px' },
  } as const;

  const crt = crtMap[crtIntensity ?? 'medium'];
  const scale = scaleMap[textScale ?? 'normal'];
  const density = densityMap[uiDensity ?? 'comfortable'];

  return {
    ['--scanline-opacity' as string]: crt.scanline,
    ['--vignette-opacity' as string]: crt.vignette,
    ['--sweep-opacity' as string]: crt.sweep,
    ['--body-scale' as string]: scale.body,
    ['--panel-scale' as string]: scale.panel,
    ['--display-scale' as string]: scale.display,
    ['--page-padding' as string]: density.page,
    ['--panel-padding' as string]: density.panel,
    ['--row-height' as string]: density.row,
  };
}
```

with:
```typescript
function buildDisplayVariables(
  textScale: 'normal' | 'large' | 'xl' | undefined,
  uiDensity: 'compact' | 'comfortable' | undefined,
): React.CSSProperties {
  const scaleMap = {
    normal: { body: '1', panel: '1', display: '1' },
    large: { body: '1.08', panel: '1.1', display: '1.08' },
    xl: { body: '1.16', panel: '1.2', display: '1.14' },
  } as const;
  const densityMap = {
    compact: { page: '14px 16px', panel: '8px 10px', row: '28px' },
    comfortable: { page: '18px 22px', panel: '10px 12px', row: '34px' },
  } as const;

  const scale = scaleMap[textScale ?? 'normal'];
  const density = densityMap[uiDensity ?? 'comfortable'];

  return {
    ['--body-scale' as string]: scale.body,
    ['--panel-scale' as string]: scale.panel,
    ['--display-scale' as string]: scale.display,
    ['--page-padding' as string]: density.page,
    ['--panel-padding' as string]: density.panel,
    ['--row-height' as string]: density.row,
  };
}
```

- [ ] **Step 3: Update the call site**

Find the `useMemo` that calls `buildDisplayVariables` (search for `buildDisplayVariables(appState`) and change:
```typescript
    () => buildDisplayVariables(appState?.crt_intensity, appState?.text_scale, appState?.ui_density),
    [appState?.crt_intensity, appState?.text_scale, appState?.ui_density],
```
to:
```typescript
    () => buildDisplayVariables(appState?.text_scale, appState?.ui_density),
    [appState?.text_scale, appState?.ui_density],
```

- [ ] **Step 4: Remove the `data-crt` attribute**

Find `data-crt={appState?.crt_intensity ?? 'medium'}` on the root shell element and delete that line entirely (no replacement attribute needed).

- [ ] **Step 5: Remove the `pip-screen` class from both wrappers**

Boot screen wrapper — replace:
```typescript
    <div className="pip-screen boot-screen fixed inset-0" style={{ background: 'var(--color-bg)' }}>
```
with:
```typescript
    <div className="boot-screen fixed inset-0" style={{ background: 'var(--color-bg)' }}>
```

Main app shell wrapper — replace:
```typescript
      className="pip-screen app-shell"
```
with:
```typescript
      className="app-shell"
```

- [ ] **Step 6: Fix the boot subtitle copy**

Find `<div className="boot-subtitle">PIP-BOY PRODUCTIVITY MATRIX</div>` and change the text to `<div className="boot-subtitle">PREPARING YOUR WORKSPACE</div>`.

- [ ] **Step 7: Verify the app still typechecks**

```bash
npx tsc --noEmit -p tsconfig.json
```

Expected: no errors related to `App.tsx` (the `crt_intensity` field stays on `AppStateRow` in `src/lib/types.ts` and in the Rust schema — this task only stops the frontend from *reading* it for CRT effects, it does not remove the field itself, per the spec's scope boundary against backend changes).

- [ ] **Step 8: Commit** (skip if no git repo)

```bash
git add src/App.tsx
git commit -m "theme: drop CRT-intensity display wiring and pip-screen wrapper from App.tsx"
```

---

### Task 8: Remove the CRT-intensity control from `src/pages/Settings.tsx`

**Files:**
- Modify: `src/pages/Settings.tsx`

By this point Task 6 has already renamed `pip-panel` → `card` and `pip-panel-body` → `card-body` in this file. The `crt_intensity` field stays on `AppStateRow`/the Rust `update_ui_preferences` command (out of scope — see spec §4) — this task only removes the now-meaningless frontend control and always passes a fixed value through instead.

- [ ] **Step 1: Remove the local state**

Find and delete this line (verify with `grep -n "crtIntensity, setCrtIntensity" src/pages/Settings.tsx` first):
```typescript
  const [crtIntensity, setCrtIntensity] = useState(appState?.crt_intensity ?? 'medium');
```

- [ ] **Step 2: Remove the state-sync line**

Find and delete (verify with `grep -n "setCrtIntensity(appState" src/pages/Settings.tsx`):
```typescript
    setCrtIntensity(appState?.crt_intensity ?? 'medium');
```

- [ ] **Step 3: Remove it from the effect's dependency array**

Find and delete the line `    appState?.crt_intensity,` from the `useEffect` dependency array that step 2's line lived inside (verify with `grep -n "appState?.crt_intensity" src/pages/Settings.tsx` — after steps 1 and 2 this should be the only remaining hit).

- [ ] **Step 4: Hardcode the value passed to the save call**

Replace:
```typescript
    await db.updateUiPreferences(crtIntensity, textScale, uiDensity);
```
with:
```typescript
    await db.updateUiPreferences('medium', textScale, uiDensity);
```

- [ ] **Step 5: Remove the CRT INTENSITY control and status line from the Display Tuning panel**

Replace:
```typescript
      <div className="card">
        <PanelHeader title="DISPLAY TUNING" />
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={rowLabelStyle}>
            TUNE THE CRT FEEL, TEXT SCALE, AND DENSITY PROFILE. THESE SETTINGS PERSIST IN YOUR DATABASE SO THE APP FEELS CONSISTENT AFTER RESTORE.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={rowLabelStyle}>CRT INTENSITY</span>
              <select className="input" value={crtIntensity} onChange={(e) => setCrtIntensity(e.target.value as 'low' | 'medium' | 'high')}>
                <option value="low">LOW</option>
                <option value="medium">MEDIUM</option>
                <option value="high">HIGH</option>
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={rowLabelStyle}>TEXT SCALE</span>
              <select className="input" value={textScale} onChange={(e) => setTextScale(e.target.value as 'normal' | 'large' | 'xl')}>
                <option value="normal">NORMAL</option>
                <option value="large">LARGE</option>
                <option value="xl">XL</option>
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={rowLabelStyle}>UI DENSITY</span>
              <select className="input" value={uiDensity} onChange={(e) => setUiDensity(e.target.value as 'compact' | 'comfortable')}>
                <option value="compact">COMPACT</option>
                <option value="comfortable">COMFORTABLE</option>
              </select>
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={handleSaveDisplaySettings}>
              {displaySaved ? 'DISPLAY SAVED' : 'SAVE DISPLAY PROFILE'}
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
            <span style={rowLabelStyle}>CURRENT CRT: {appState?.crt_intensity?.toUpperCase() ?? 'MEDIUM'}</span>
            <span style={rowLabelStyle}>CURRENT SCALE: {appState?.text_scale?.toUpperCase() ?? 'NORMAL'}</span>
            <span style={rowLabelStyle}>CURRENT DENSITY: {appState?.ui_density?.toUpperCase() ?? 'COMFORTABLE'}</span>
          </div>
        </div>
      </div>
```
with:
```typescript
      <div className="card">
        <PanelHeader title="DISPLAY TUNING" />
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={rowLabelStyle}>
            TUNE TEXT SCALE AND DENSITY PROFILE. THESE SETTINGS PERSIST IN YOUR DATABASE SO THE APP FEELS CONSISTENT AFTER RESTORE.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={rowLabelStyle}>TEXT SCALE</span>
              <select className="input" value={textScale} onChange={(e) => setTextScale(e.target.value as 'normal' | 'large' | 'xl')}>
                <option value="normal">NORMAL</option>
                <option value="large">LARGE</option>
                <option value="xl">XL</option>
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={rowLabelStyle}>UI DENSITY</span>
              <select className="input" value={uiDensity} onChange={(e) => setUiDensity(e.target.value as 'compact' | 'comfortable')}>
                <option value="compact">COMPACT</option>
                <option value="comfortable">COMFORTABLE</option>
              </select>
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={handleSaveDisplaySettings}>
              {displaySaved ? 'DISPLAY SAVED' : 'SAVE DISPLAY PROFILE'}
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
            <span style={rowLabelStyle}>CURRENT SCALE: {appState?.text_scale?.toUpperCase() ?? 'NORMAL'}</span>
            <span style={rowLabelStyle}>CURRENT DENSITY: {appState?.ui_density?.toUpperCase() ?? 'COMFORTABLE'}</span>
          </div>
        </div>
      </div>
```

- [ ] **Step 6: Typecheck**

```bash
npx tsc --noEmit -p tsconfig.json
```

Expected: no errors (in particular, no "unused variable" or "cannot find name 'crtIntensity'" errors — if you see one, you missed one of steps 1–4).

- [ ] **Step 7: Commit** (skip if no git repo)

```bash
git add src/pages/Settings.tsx
git commit -m "theme: remove CRT-intensity control from Settings display tuning panel"
```

---

### Task 9: Strip decorative text-glow left behind by the mechanical rename

**Files:**
- Modify: `src/pages/DomainPage.tsx`, `src/components/Onboarding.tsx`, `src/components/layout/TopBar.tsx`, `src/components/layout/Sidebar.tsx`

Task 6's rename mapped `--pip-glow` → `--shadow-focus-ring` and `--pip-glow-bright` → `--shadow-md` because most usages were `box-shadow`, where that's a correct equivalent. But 6 spots use these as `textShadow` (a decorative glow-on-text effect) — a box-shadow-shaped value in `textShadow` is meaningless there, and glow-on-text is exactly the CRT effect the spec removes. Delete the `textShadow` in all 6 rather than repoint it.

- [ ] **Step 1: `src/pages/DomainPage.tsx`** — find the line matching `textTransform: 'uppercase', textShadow:` (post-rename it reads `textShadow: 'var(--shadow-focus-ring)'`) and remove the trailing `, textShadow: 'var(--shadow-focus-ring)'` from that style object, and remove `textTransform: 'uppercase'` from the same object too (it's a page-level domain heading, not a small label). Also change `fontFamily: 'var(--font-display)'` (already renamed to `'var(--font-sans)'` by Task 6) — no further action needed there, just confirm it reads `var(--font-sans)`.

- [ ] **Step 2: `src/components/Onboarding.tsx`** — two occurrences (originally lines 166 and 349, each `textShadow: 'var(--pip-glow-bright)'`, post-rename `textShadow: 'var(--shadow-md)'`). In both, delete the `, textShadow: 'var(--shadow-md)'` segment from the style object, leaving the rest of the object (fontFamily/fontSize/color/letterSpacing) intact.

- [ ] **Step 3: `src/components/layout/TopBar.tsx`** — find the style object containing `textShadow: 'var(--shadow-focus-ring)',` (post-rename form of the original `var(--pip-glow)`) on its own line and delete that line entirely.

- [ ] **Step 4: `src/components/layout/Sidebar.tsx`** — two edits:

Replace (post-rename form):
```typescript
        <div
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 16,
            letterSpacing: 3,
            color: 'var(--color-text)',
            textShadow: 'var(--shadow-focus-ring)',
          }}
        >
          LIFE-OS
        </div>
```
with:
```typescript
        <div
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: -0.01em,
            color: 'var(--color-text)',
          }}
        >
          LIFE-OS
        </div>
```

Replace:
```typescript
          <span style={{ color: 'var(--color-accent)', textShadow: 'var(--glow-text)' }}>ONLINE</span>
```
with:
```typescript
          <span style={{ color: 'var(--color-success)' }}>ONLINE</span>
```

Replace (the domain nav row label — drops the glow and the all-caps treatment on what is effectively a primary nav label, not a small tag):
```typescript
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 16, color: active ? 'var(--color-text)' : 'var(--color-text-muted)', letterSpacing: 2, textShadow: active ? 'var(--shadow-focus-ring)' : 'none', textTransform: 'uppercase' }}>
                      {meta.label}
                    </span>
```
with:
```typescript
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600, color: active ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
                      {meta.label}
                    </span>
```

- [ ] **Step 5: Verify no decorative text-shadow glow remains**

```bash
grep -rn "textShadow.*shadow-focus-ring\|textShadow.*shadow-md\|textShadow.*glow-text" src --include=*.tsx
```

Expected: no output.

- [ ] **Step 6: Commit** (skip if no git repo)

```bash
git add src/pages/DomainPage.tsx src/components/Onboarding.tsx src/components/layout/TopBar.tsx src/components/layout/Sidebar.tsx
git commit -m "theme: remove leftover text-glow effects and uppercase nav/heading treatments"
```

---

### Task 10: Restyle `StreakFlame` — color now conveys "streak", not "brightness"

**Files:**
- Modify: `src/components/gamification/StreakFlame.tsx`
- Modify: `src/test/__tests__/StreakFlame.test.tsx` (actual path: `src/components/__tests__/StreakFlame.test.tsx`)

The mechanical rename would have turned this component's `--pip-bright`/`--pip-muted` into `--color-text`/`--color-text-muted`, which is technically valid but loses the point — a streak flame should read as a warm "streak is alive" indicator (warning/amber tone), not just "brighter text". Hand-edit both files together so the test still matches the component.

- [ ] **Step 1: Replace `src/components/gamification/StreakFlame.tsx` in full**

```tsx
import React from 'react';

interface StreakFlameProps {
  count: number;
  size?: 'sm' | 'md' | 'lg';
}

export const StreakFlame: React.FC<StreakFlameProps> = React.memo(({ count, size = 'sm' }) => {
  const fontSizes = { sm: 14, md: 18, lg: 22 };
  const fontSize = fontSizes[size];

  return (
    <span style={{
      fontFamily: 'var(--font-sans)',
      fontWeight: 600,
      fontSize,
      color: count > 0 ? 'var(--color-warning)' : 'var(--color-text-faint)',
      lineHeight: 1,
    }}>
      {count > 0 ? `${count}D` : '0D'}
    </span>
  );
});

StreakFlame.displayName = 'StreakFlame';
```

- [ ] **Step 2: Replace `src/components/__tests__/StreakFlame.test.tsx` in full**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StreakFlame } from '../gamification/StreakFlame';

describe('StreakFlame', () => {
  it('displays day count with D suffix', () => {
    render(<StreakFlame count={7} />);
    expect(screen.getByText('7D')).toBeTruthy();
  });

  it('shows 0D when count is 0', () => {
    render(<StreakFlame count={0} />);
    expect(screen.getByText('0D')).toBeTruthy();
  });

  it('applies faint color when count is 0', () => {
    const { container } = render(<StreakFlame count={0} />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.color).toContain('color-text-faint');
  });

  it('applies warning color when count > 0', () => {
    const { container } = render(<StreakFlame count={5} />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.color).toContain('color-warning');
  });

  it('renders with sm size (default)', () => {
    const { container } = render(<StreakFlame count={3} />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.fontSize).toBe('14px');
  });

  it('renders with md size', () => {
    const { container } = render(<StreakFlame count={3} size="md" />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.fontSize).toBe('18px');
  });

  it('renders with lg size', () => {
    const { container } = render(<StreakFlame count={3} size="lg" />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.fontSize).toBe('22px');
  });
});
```

- [ ] **Step 3: Run the test file**

```bash
npx vitest run src/components/__tests__/StreakFlame.test.tsx
```

Expected: all 7 tests pass.

- [ ] **Step 4: Commit** (skip if no git repo)

```bash
git add src/components/gamification/StreakFlame.tsx src/components/__tests__/StreakFlame.test.tsx
git commit -m "theme: restyle StreakFlame to use warning/faint tones instead of bright/muted text"
```

---

### Task 11: Drop the achievement toast scanline flourish

**Files:**
- Modify: `src/components/gamification/AchievementToast.tsx`

`.achievement-toast-scan` no longer exists in `globals.css` (dropped in Task 5) — remove the now-dead element that referenced it.

- [ ] **Step 1: Remove the scan line div**

Replace:
```tsx
          <div className="achievement-toast-kicker">ACHIEVEMENT UNLOCKED</div>
          <div className="achievement-toast-title">{display.title}</div>
          <div className="achievement-toast-copy">{display.description}</div>
          <div className="achievement-toast-scan" />
```
with:
```tsx
          <div className="achievement-toast-kicker">ACHIEVEMENT UNLOCKED</div>
          <div className="achievement-toast-title">{display.title}</div>
          <div className="achievement-toast-copy">{display.description}</div>
```

- [ ] **Step 2: Commit** (skip if no git repo)

```bash
git add src/components/gamification/AchievementToast.tsx
git commit -m "theme: drop achievement toast scanline flourish"
```

---

### Task 12: Update domain colors in `types.ts` and the no-domain fallback in `domain-utils.ts`

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/domain-utils.ts`

- [ ] **Step 1: Replace `DOMAIN_META` in `src/lib/types.ts`**

Replace:
```typescript
export const DOMAIN_META = {
  military: { label: 'Military', icon: '[M]', color: '#C8A96E', accent: '#8B0000' },
  builder:  { label: 'Builder',  icon: '[B]', color: '#4A9EFF', accent: '#00D4AA' },
  self:     { label: 'Self',     icon: '[+]', color: '#7EC87A', accent: '#A78BFA' },
};
```
with:
```typescript
export const DOMAIN_META = {
  military: { label: 'Military', icon: '[M]', color: '#D4A73D', accent: '#B8901F' },
  builder:  { label: 'Builder',  icon: '[B]', color: '#4A90E2', accent: '#3574C4' },
  self:     { label: 'Self',     icon: '[+]', color: '#34B27B', accent: '#26935F' },
};
```

These match `--color-domain-military`/`--color-domain-builder`/`--color-domain-self` from `tokens.css` (Task 1) — `DOMAIN_META` is the runtime/JS source of truth for domain colors (consumed by `domain-utils.ts`), `tokens.css`'s versions are the CSS-side static fallback used by the `[data-domain]` selector blocks. Keep them in sync.

- [ ] **Step 2: Replace the no-domain fallback in `src/lib/domain-utils.ts`**

Replace:
```typescript
  if (!domainId) {
    return {
      label: 'Global',
      icon: '[*]',
      color: '#4afa4a',
      accent: '#1e7a1e',
    };
  }
```
with:
```typescript
  if (!domainId) {
    return {
      label: 'Global',
      icon: '[*]',
      color: '#7C6CFF',
      accent: '#5B4FCF',
    };
  }
```

This was the last hardcoded Pip-Boy-green hex value in the codebase outside the style files — it now matches `--color-accent`.

- [ ] **Step 3: Verify no hardcoded Pip-Boy hex values remain**

```bash
grep -rn "#4afa4a\|#50fa7b\|#80ff80\|#1e7a1e\|#C8A96E\|#8B0000\|#7EC87A\|#A78BFA" src --include=*.ts --include=*.tsx
```

Expected: no output.

- [ ] **Step 4: Commit** (skip if no git repo)

```bash
git add src/lib/types.ts src/lib/domain-utils.ts
git commit -m "theme: update domain palette and no-domain fallback to new accent color"
```

---

### Task 13: Swap the bundled fonts — VT323/Share Tech Mono out, Inter in

**Files:**
- Delete: `src/assets/fonts/VT323-Regular.ttf`, `src/assets/fonts/ShareTechMono-Regular.ttf`
- Create: `src/assets/fonts/Inter-Variable.ttf`

`globals.css` (Task 2) already declares the `@font-face` block pointing at `Inter-Variable.ttf` — this task only needs to get that file in place. The "no Google Fonts CDN" rule from the old theme still applies for the same reason (Tauri's offline production build has no network access) — this is a one-time local download during development, not a runtime CDN import, exactly like the original VT323/Share Tech Mono files were added.

- [ ] **Step 1: Try downloading the variable Inter font from its official open-source repo**

```bash
mkdir -p src/assets/fonts
curl -fL "https://raw.githubusercontent.com/rsms/inter/master/docs/font-files/Inter-VariableFont_opsz,wght.ttf" -o src/assets/fonts/Inter-Variable.ttf
```

- [ ] **Step 2: Verify the download actually succeeded**

```bash
node -e "const s=require('fs').statSync('src/assets/fonts/Inter-Variable.ttf'); if (s.size < 100000) throw new Error('file too small ('+s.size+' bytes) — likely an HTML error page, not a font'); console.log('OK', s.size, 'bytes');"
```

Expected: `OK <N> bytes` where N is at least a few hundred KB. If step 1 failed (no network access in this environment, or the URL has moved), this check will fail loudly rather than silently leaving a broken/tiny file in place — in that case, stop and get the font manually: download "Inter" from https://fonts.google.com/specimen/Inter or https://rsms.me/inter/, take the variable font file (or `Inter-Regular.ttf` + `Inter-Medium.ttf` + `Inter-SemiBold.ttf` + `Inter-Bold.ttf` as static weights if variable isn't available), place it at `src/assets/fonts/Inter-Variable.ttf` (or adjust the `@font-face` block in `globals.css` to reference multiple static files instead — one `src: url(...)` per weight, each with its own `font-weight` value instead of the `100 900` range), and re-run this verification step.

- [ ] **Step 3: Remove the old font files**

```bash
rm src/assets/fonts/VT323-Regular.ttf src/assets/fonts/ShareTechMono-Regular.ttf
```

- [ ] **Step 4: Verify nothing still references the deleted fonts**

```bash
grep -rn "VT323\|ShareTechMono\|Share Tech Mono" src
```

Expected: no output (the `@font-face` blocks for these were removed in Task 2; `--font-arabic` in `tokens.css` is untouched and doesn't reference either).

- [ ] **Step 5: Commit** (skip if no git repo)

```bash
git add -A
git commit -m "theme: swap VT323/Share Tech Mono for self-hosted Inter variable font"
```

---

### Task 14: Final verification

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

Expected: all suites pass, including `xp-engine`, `momentum`, `achievement-checker`, `habit-schedule`, `weekly-review-date`, `useTaskStore`, `useNoteStore`, `useCalendarStore`, `StreakFlame`, `CompletionButton`. None of these tests assert on color values except `StreakFlame` (fixed in Task 10) — if any other test fails on a string like `pip-` or `--pip`, grep it and fix the same way Task 6 did.

- [ ] **Step 3: Confirm zero old references remain anywhere in the repo**

```bash
grep -rn -- "--pip\b\|--pip-\|--mil-\|--bld-\|--slf-\|pip-panel\|pip-tab\|pip-footer\|pip-empty\|pip-label\|pip-screen\|crt_intensity.*useState\|VT323\|ShareTechMono" src --include=*.ts --include=*.tsx --include=*.css
```

Expected: no output. (`crt_intensity` itself still legitimately appears in `src/lib/types.ts` — the `AppStateRow` interface field and the `db.ts`/`updateUiPreferences` wrapper signature are intentionally unchanged, per the spec's scope boundary against backend changes; this grep specifically excludes that by matching only `crt_intensity.*useState`, the frontend-state usage that Task 8 removed.)

- [ ] **Step 4: Visual smoke test**

```bash
npm run dev
```

Open the app in the browser it prints (or `npm run tauri dev` for the full desktop shell) and click through: Command Center, Today, Tasks, Habits, Goals, Notes, Calendar, Weekly Review, Inbox, Templates, Analytics, a Domain page, Settings. Confirm: no CRT scanline/vignette visible, no crosshair cursor, buttons/cards/inputs have visible rounded corners, Inter renders (not a monospace/pixel font), completing a task still shows the check-pop + XP feedback, and the Settings → Display Tuning panel no longer shows a CRT Intensity control.

- [ ] **Step 5: Commit the verification pass** (skip if no git repo — this step only matters if any fixes were made during Step 2/3/4)

```bash
git add -A
git commit -m "theme: fix stragglers found during final verification"
```

If Step 5 has nothing to commit (verification was clean), skip it.
