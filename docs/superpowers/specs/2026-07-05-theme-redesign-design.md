# Life OS — Visual Redesign: Modern Theme

Status: Approved (brainstorming), pending implementation plan.
Scope: Desktop app (`Life OS/`) and mobile app (`life-os-mobile/`, path `C:\Users\isc\Desktop\Projects\life-os-mobile`).

## 1. Why

The app currently uses a Fallout Pip-Boy CRT terminal aesthetic (phosphor green on black, scanlines, vignette, VT323/Share Tech Mono fonts, zero border-radius, crosshair cursor, step-end/linear-only transitions). The user wants a complete re-theme to something **modern and usable** — a clean, premium productivity-tool look, not a game skin. This replaces the visual language entirely; it does not change what the app does.

## 2. Current state (confirmed by reading the code)

Both apps already fully centralize theming, which makes this a real re-theme rather than a rewrite:

- **Desktop**: `src/styles/tokens.css` defines every color/spacing/motion value as a CSS custom property; `src/styles/globals.css` defines component classes and CRT effects (`.pip-screen::before` scanline, `::after` vignette, `.blink`, boot-cursor). Components consume tokens/classes — they don't hardcode colors (per existing project rule).
- **Mobile**: `lib/design_system/life_os_theme.dart` is a single `LifeOsTheme.theme()` factory producing one Flutter `ThemeData`, consumed app-wide. `lib/design_system/widgets/` holds shared widgets (`PanelCard`, `PipStatCard`, `PipEmptyState`, `PipRouteMotion`, `AdaptivePanelGrid`, `ScreenFrame`) that read from `LifeOsTheme`.
- `tokens.css` currently carries a "BACKWARD-COMPAT ALIASES — DO NOT REMOVE" block from a previous rename that was never finished. This should not happen again — see §7.
- Neither app is currently a git repository (confirmed via `git status` in both — no commit step is part of this workflow instance; the plan/implementation phase should ask the user whether to initialize git before making bulk changes).

## 3. Design language

### 3.1 Color system (dark-first; token structure below is written so a light variant can be added later without renaming anything)

```
Neutrals
  --color-bg              #0C0E12   app background
  --color-surface         #14171D   panel/card background
  --color-surface-elevated #1C2028  modal/dropdown/popover background
  --color-surface-hover   #20242C   hover state fill
  --color-border          #262B34   default border
  --color-border-strong   #3A404C   emphasized/hover/focus border
  --color-text            #EDEEF1   primary text
  --color-text-muted      #9BA1AC   secondary text
  --color-text-faint      #5C636F   tertiary/disabled text

Accent (all primary actions, links, focus, checked states)
  --color-accent          #7C6CFF
  --color-accent-hover    #8F82FF
  --color-accent-muted    rgba(124,108,255,0.15)   subtle active/selected background

Status (semantic, used for priority badges, alerts, form validation)
  --color-success  #34D399
  --color-warning  #F5A524
  --color-danger   #F0554E
  --color-info     #4A9EFF

Domain identity (sparingly: left-border stripe on scoped cards, badges, icon tint — never a full glowing panel)
  --color-domain-military  #D4A73D   (muted gold)
  --color-domain-builder   #4A90E2   (blue)
  --color-domain-self      #34B27B   (green)
```

Priority badges map onto status tokens rather than one-off colors: critical → danger, high → warning, medium → info, low → text-muted/border.

### 3.2 Typography

Single family: **Inter**, self-hosted as static TTF/OTF files in both apps (same "must bundle locally, no Google Fonts CDN" constraint that applies to the current fonts — Tauri's offline CSP, and for consistency, Flutter too). Replaces both VT323 (display) and Share Tech Mono (body).

Scale:
| Role | Size | Weight | Notes |
|---|---|---|---|
| display | 32–40px | 700 | letter-spacing -0.02em; big stat numbers (momentum, XP, level) |
| h1 | 24px | 700 | page titles |
| h2 | 20px | 600 | section titles |
| h3 | 16px | 600 | card/panel titles |
| body | 14px | 400 | line-height 1.5 |
| label | 12px | 500 | letter-spacing 0.02em |
| caption | 11px | 500 | muted color, secondary metadata |

Uppercase + wide letter-spacing is reserved for small section labels only — not applied to buttons, body text, or nav items everywhere the way the current terminal theme does.

### 3.3 Shape & elevation

```
--radius-sm    6px    inputs, small buttons, badges, checkboxes
--radius-md    8px    buttons, default cards
--radius-lg    12px   panels, modals
--radius-full  9999px pills, avatars, progress bar track ends

--shadow-xs    0 1px 2px rgba(0,0,0,0.24)
--shadow-sm    0 2px 6px rgba(0,0,0,0.28)
--shadow-md    0 8px 24px rgba(0,0,0,0.35)
--shadow-lg    0 16px 48px rgba(0,0,0,0.45)   modals only
--shadow-focus-ring  0 0 0 3px rgba(124,108,255,0.35)   replaces old glow-on-focus
```

Glow effects (`--pip-glow`, `--pip-inset-glow`, `--pip-frame`) are removed; shadows + the focus ring token serve the same "show what's active" purpose.

### 3.4 Motion

Replaces the "step-end/linear only" rule with standard easing:

```
--motion-fast  120ms cubic-bezier(0.4, 0, 0.2, 1)
--motion-base  180ms cubic-bezier(0.4, 0, 0.2, 1)
--motion-slow  260ms cubic-bezier(0.4, 0, 0.2, 1)
```

High-frequency interactions (typing, drag) remain untransitioned/instant. On Flutter, use the platform's standard `Curves.easeOutCubic`-equivalent at the same durations rather than the current linear `Duration`s.

### 3.5 Components & gamification moments

Restyled with the tokens above; no structural/layout changes (see §4 scope boundary). Specific treatments:

- **Buttons**: solid accent fill for primary, bordered/ghost for secondary, `--radius-md`, normal case text (no forced uppercase+tracking).
- **Cards/panels**: `--color-surface`, 1px `--color-border`, `--radius-lg`, `--shadow-xs` at rest; `--shadow-sm` on hover if interactive.
- **Inputs**: `--color-surface-elevated`, `--color-border`, `--radius-sm`; on focus: `--color-accent` border + `--shadow-focus-ring`.
- **Sidebar/nav**: active item = `--color-accent-muted` background + `--color-accent` text/icon + a 2px accent left bar (replaces full border glow).
- **Domain theming**: the `data-domain` attribute mechanism is kept as-is architecturally (desktop) — only the colors it resolves to change. Used for left-border stripes, badges, and icon tints, not full-panel treatments.
- **XP bar**: `--radius-full` track, smooth width transition (`--motion-base`), solid accent (or domain color when shown per-domain) fill, no shimmer.
- **Streak flame**: plain icon + count, colored `--color-warning` regardless of domain (fire reads as amber universally), no glow.
- **Level-up ceremony**: shrinks from a full-screen overlay to a centered card/toast, brief scale+fade (`--motion-slow`), shows new level/title, dismissible.
- **Achievement toast**: unchanged pattern/timing (4s auto-dismiss), restyled as a card-toast using the new tokens.
- **Momentum red-alert**: replaces the pulsing full-card red border with a small status dot + a thin `--color-danger` left border. `peak` uses `--color-accent` or gold accent, `normal` uses default border, `amber` uses a thin `--color-warning` border.
- **Cursor**: `cursor: crosshair` is removed app-wide; standard pointer/default/text cursor conventions apply.

## 4. Explicit scope boundary

This redesign covers **visual language only**: color, typography, shape, elevation, motion, and the naming cleanup in §7. It explicitly does **not** include:
- App layout/IA changes — the desktop 4-row CSS grid (topbar/tabbar/sidebar/main/footer) and the mobile route/shell structure stay exactly where they are, just restyled.
- Any business logic, Tauri/Rust commands, database schema, or Flutter data/sync layer changes.
- New features.
- A shared cross-platform token source (e.g. a generated tokens.json feeding both CSS and Dart) — desktop and mobile each get native, hand-maintained token definitions in this pass. A generated shared source is a reasonable future improvement but is out of scope here (YAGNI for a first re-theme).
- Light mode implementation — only structuring dark-mode tokens so light mode could be added later without a rename.

## 5. What gets fully removed

- Desktop: `.pip-screen::before` (scanline `repeating-linear-gradient`), `::after` (vignette), the CRT flicker keyframe animation, `.blink`/boot-cursor blink, `--scanline`, `--vignette`, `--pip-glow`, `--pip-glow-bright`, `--pip-inset-glow`, `--pip-frame`, `--pip-grid`. The `.pip-screen` wrapper class itself folds into `.app-shell` (it no longer hosts any effect once scanline/vignette are gone).
- Mobile: any CRT-flavored visual affordances in `design_system/widgets/*` (to be identified precisely during planning — none of the current widget names suggest scanline/vignette logic exists on mobile, but this must be verified, not assumed).
- The existing "BACKWARD-COMPAT ALIASES — DO NOT REMOVE" block in `tokens.css` (lines ~68–145) is retired entirely — every current consumer of those aliases gets updated to the new semantic name instead of being aliased again.

## 6. Cross-platform token mapping

Desktop CSS custom properties and Flutter theme fields follow the same names/roles so the two are easy to keep in sync by a human, even without shared tooling:

| CSS var | Flutter (`LifeOsTheme` → rename to `LifeOsColors`/`LifeOsTheme`) |
|---|---|
| `--color-bg` | `LifeOsColors.background` / `scaffoldBackgroundColor` |
| `--color-surface` | `LifeOsColors.surface` / `ColorScheme.surface` |
| `--color-accent` | `LifeOsColors.accent` / `ColorScheme.primary` |
| `--color-border` | `LifeOsColors.border` |
| `--color-text` / `-muted` / `-faint` | `LifeOsColors.textPrimary` / `.textMuted` / `.textFaint` |
| `--color-domain-*` | `LifeOsColors.domainMilitary` / `.domainBuilder` / `.domainSelf` |
| `--radius-*` | `BorderRadius.circular(6/8/12)` constants on `LifeOsRadius` |
| `--shadow-*` | `BoxShadow` constants on `LifeOsShadows` (or Material `elevation` where a direct shadow isn't needed) |
| `--motion-*` | `Duration` constants + `Curves.easeOutCubic` on `LifeOsMotion` |

The single-`ThemeData`-factory architecture in `life_os_theme.dart` is good and is kept as-is structurally — only the constant names/values inside it change (see §7).

## 7. Naming cleanup

Because this is a full rename (not a value swap — see the approved migration approach), every `pip`/`Pip`/`mil`/`bld`/`slf`-prefixed identifier is renamed to a neutral, semantic name in the same pass:

- CSS: `--pip`, `--pip-bright`, `--pip-dim`, `--mil-*`, `--bld-*`, `--slf-*`, `.pip-panel`, `.pip-tab`, `.pip-screen`, etc. → `--color-*` equivalents and semantic class names (`.panel`, `.tab`, etc.) per §3/§6.
- Dart: `LifeOsTheme.pip`, `.pipBright`, `.pipDim`, `.pipBorder`, etc. → `LifeOsColors.accent`, etc. Widget classes `PipStatCard` → `StatCard`, `PipEmptyState` → `EmptyState`, `PipRouteMotion` → `RouteMotion` (file names updated to match).

Every rename must be grep-verified to zero remaining references before considering it done (both `--pip`/`--mil`/`--bld`/`--slf`/`.pip-` in the desktop repo, and `Pip`-prefixed identifiers in the mobile repo).

## 8. Rollout order

1. Desktop app: implement and verify the full new theme end-to-end (all pages, all component states, gamification moments) before moving to mobile.
2. Mobile app: port the same token values/roles into `life_os_theme.dart` and the shared widgets, following the mapping in §6.

Each phase gets verified independently (visual smoke-check + existing automated test suite where relevant) before moving to the next — this spec doesn't prescribe the implementation plan's exact steps, that's the job of the following planning phase.

## 9. Out of scope / explicitly not deciding here

- Exact list of every CSS class / Dart file touched — that's implementation-plan-level detail, not design-level.
- Whether to initialize git in either repo — neither is currently a git repository; the planning/implementation phase should raise this with the user rather than assume.
- Any new visual assets (icons, illustrations) beyond recoloring existing Lucide icons already in use on desktop.
