# Type Scale Harmonization — Design Spec

**Goal:** Fix inconsistent font sizes and weights across the desktop app by replacing scattered raw `fontSize`/`fontWeight` values with a small, coherent token scale.

## Problem

An audit of `src/**/*.tsx` and `src/styles/globals.css` found:
- **17 distinct inline `fontSize` values** (8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 26, 28, 36, 40px), with 294 of 362 total occurrences bunched into a nearly-indistinguishable 9–13px cluster.
- **Only 3 explicit inline `fontWeight` declarations** in the entire `.tsx` codebase (two `600`, one `700`). Everything else silently falls back to the browser default (`400`), regardless of whether the text is a tiny status badge or a section label.

This produces visually incompatible type: text at very similar sizes renders at inconsistent weights depending on whether that specific spot happened to get an explicit `fontWeight`, and the 9–13px cluster reads as noise rather than intentional hierarchy.

## Scale

Seven tokens, each pairing a size with a default weight, defined as CSS custom properties in `tokens.css` (same pattern as the existing `--space-1..8` scale):

| Token | Size | Weight | Role |
|---|---|---|---|
| `--text-2xs` | 10px | 500 | Micro/meta text — footer strip, keyboard hints, badges |
| `--text-xs` | 12px | 400 | Secondary labels — nav items, section dividers, muted meta |
| `--text-sm` | 14px | 400 | Body text — paragraphs, list items, form inputs |
| `--text-md` | 16px | 600 | Emphasized text — card titles, active nav state |
| `--text-lg` | 20px | 700 | Section headings |
| `--text-xl` | 28px | 700 | Page headers |
| `--text-2xl` | 40px | 700 | Dashboard display numbers (XP, streaks, big counters) |

Weight tokens (`--font-weight-regular: 400`, `--font-weight-medium: 500`, `--font-weight-semibold: 600`, `--font-weight-bold: 700`) are also defined so weight can be overridden independently of size where a role needs it (e.g. an active/selected state bumping `--text-xs` from 400 to semibold).

## Rounding rule

Every existing raw pixel value maps to the nearest scale step; exact ties round up (same discipline as the spacing-scale sweep):

```
8, 9, 10        → 10  (--text-2xs)
11, 12          → 12  (--text-xs)
13, 14          → 14  (--text-sm)
15, 16          → 16  (--text-md)
18, 20, 22      → 20  (--text-lg)
24, 26, 28      → 28  (--text-xl)
36, 40          → 40  (--text-2xl)
```

Each converted call site also gets an explicit `fontWeight: var(--font-weight-*)` matching its token's default role weight, unless the surrounding code already special-cases weight for an active/emphasized state (e.g. `fontWeight: active ? 600 : 400`) — those conditional cases are preserved, just re-pointed at the weight tokens.

## Scope

All 25 `.tsx` files currently using inline `fontSize` (`App.tsx`, layout components, shared components, pages — full list already enumerated via `grep -rl "fontSize:" src/`), plus the CSS-level `font-size`/`font-weight` rules in `globals.css`. Same file-by-file sweep pattern as the earlier spacing-scale plan: one task per file, sed substitutions for exact-value matches, manual edits for anything with surrounding conditional logic, `npm test` + build verification at the end.

## Out of scope

- Mobile app (Flutter) — this fix is desktop-only per the reported issue; mobile's Satoshi setup and any weight inconsistencies there are a separate follow-up if needed.
- Redesigning the header/footer/sidebar information density — that's the still-open, separate "layout feels overwhelming" discussion; this spec only fixes size/weight consistency, not what content exists or how dense it is.
