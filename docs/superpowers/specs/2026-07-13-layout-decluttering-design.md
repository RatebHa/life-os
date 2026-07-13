# Layout Decluttering — Design Spec

**Goal:** Reduce the header/sidebar/footer chrome density that makes the desktop app feel overwhelming and disorienting, without losing any information that isn't already available elsewhere.

## Problem

`TopBar.tsx`, `TabBar.tsx`, `Sidebar.tsx`, and `FooterBar.tsx` all still carry the original Pip-Boy/CRT terminal design's information density and typographic treatment (tiny tracked uppercase, redundant status strips, decorative dividers, terminal-bracket keyboard hints) — this never got redesigned when the color palette and font moved to the modern dark theme. The result is four separate chrome regions each independently trying to show "system status," several pieces of information duplicated across two or more of them, and one nav item (the domain rows) acting as a full 6-metric mini-dashboard.

## Changes

**`TopBar.tsx`**
- Remove the two decorative gradient divider lines (`<div style={{ flex: 1, height: 1, background: 'linear-gradient(...)' }} />`) — pure visual noise, no functional signal.
- Keep the MIT / Top 3 / Overdue / Focus status cluster (real, useful signal), but restyle: normal case instead of uppercase+tracked, accent color reserved for the warning state only (overdue > 0, MIT missing), muted/neutral otherwise.

**`TabBar.tsx`**
- Remove "OPEN TODAY" and "OVERVIEW" quick-nav buttons — redundant with sidebar navigation, which is always visible.
- Remove the "ASSIST READY / LOCAL MODE" status text — belongs in Settings (where the API key is actually configured), not repeated on every page.
- Keep: section label, page title, page description.

**`Sidebar.tsx`**
- Collapse each domain nav item from a 6-metric grid (OPEN/DONE/OVERDUE/FOCUS/HABITS/STREAK, ~18 numbers total across 3 domains) down to one line: icon + domain name + streak flame. Full stats remain available on that domain's detail page — nothing is deleted, just de-duplicated.
- Remove the "SYS: ONLINE" status box at the top of the sidebar — the footer already shows system status.
- Keep: LIFE-OS wordmark, workspace/support nav sections, search/capture action buttons.

**`FooterBar.tsx`**
- Remove `DB: LOCAL | TEXT: NORMAL | DENSITY: COMFORTABLE` — these are Settings-page values being echoed into permanent ambient chrome; a user changing text scale in Settings doesn't need it re-confirmed on every screen afterward.
- Keep: system online indicator, backup status, keyboard shortcut hints (these are the parts that are actually referenced during normal use).

## Typography

Everything above continues using the `--text-*` / `--font-weight-*` tokens from the type-scale fix. Uppercase + heavy letter-spacing is dropped from body-level chrome text (nav items, status text, domain rows) but kept for true section-label micro-copy (`-- WORKSPACE --`, `-- SUPPORT --`) where it's serving as a visual category marker, not body content.

## Out of scope

- No new features, no new pages.
- Domain detail page, Settings page, and all other page content are untouched — this only touches the four persistent chrome components.
- Mobile app — desktop-only, matching the original complaint.
