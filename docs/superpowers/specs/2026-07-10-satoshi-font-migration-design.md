# Life OS — Satoshi Font Migration

Status: Approved (brainstorming), pending implementation plan.
Scope: Desktop app (`Life OS/`) and mobile app (`life-os-mobile/`), both in the same pass — this is a small, mechanical-enough change that splitting it into two sequential passes (as was done for the larger theme redesign and depth-polish work) isn't warranted.

## 1. Why

The base theme redesign (`docs/superpowers/specs/2026-07-05-theme-redesign-design.md`) replaced the Pip-Boy CRT aesthetic with Inter, a clean modern sans-serif. The user's complaint now is that Inter itself reads as generic/overused — it's the default choice for a huge share of modern SaaS apps, so it doesn't give Life OS a distinctive typographic identity even though the rest of the visual system (colors, depth, motion) is now considered.

## 2. Validated direction

Confirmed via a live visual comparison (four real "Today page" mockups — Inter as reference plus three candidates — shown in-browser using the app's actual dark colors and layout): the user chose **Satoshi** (Fontshare) over Geist and General Sans. This matches the stated direction from clarifying questions: "distinctive but still neutral" — a font less common than Inter, but still reading as a clean, professional grotesque/sans rather than something quirky or loud.

## 3. Font sourcing and license

**Satoshi**, published by Fontshare (Indian Type Foundry), released under Fontshare's **ITF Free Font License**:
- Free for personal and commercial use, no attribution required.
- Usable embedded/bundled inside applications (this is standard permitted use — the only real restriction is not reselling or redistributing the raw font files as a font product on another platform, which doesn't apply here).

Available weights: Light (300), Regular (400), Medium (500), Bold (700), Black (900), each with an italic, plus a variable font spanning the 300–900 weight axis. There is **no static SemiBold (600)** file — this is the one real complication, addressed in §5.

## 4. File-level changes

### Desktop (`Life OS/`)

Confirmed via grep that Inter has exactly two real touch points in this codebase (a handful of other files matched "Inter" only as a substring of `setInterval`/`clearInterval`/`interruption` — false positives, not font references):

- `src/assets/fonts/Inter-Variable.ttf` (879KB variable font) → replaced by a new `src/assets/fonts/Satoshi-Variable.ttf`, downloaded from Fontshare.
- `src/styles/globals.css` — the `@font-face` block:
  ```css
  @font-face {
    font-family: 'Inter';
    src: url('../assets/fonts/Inter-Variable.ttf') format('truetype-variations'),
         url('../assets/fonts/Inter-Variable.ttf') format('truetype');
    font-weight: 100 900;
    font-style: normal;
  }
  ```
  becomes `font-family: 'Satoshi'`, `src` pointing at `Satoshi-Variable.ttf`, and `font-weight: 300 900` (Satoshi's actual variable axis range — Inter's happened to span 100–900, Satoshi's doesn't go below 300, so the range must be corrected, not copy-pasted).
- `src/styles/tokens.css` — `--font-sans: 'Inter', system-ui, -apple-system, sans-serif;` → `--font-sans: 'Satoshi', system-ui, -apple-system, sans-serif;`. Everything else in `globals.css`/components already consumes `var(--font-sans)` rather than hardcoding `'Inter'`, so no other CSS file needs a rename.

Because the variable font spans the full weight range natively, every `font-weight` value already used in this codebase (400, 500, 600, 700, etc.) continues to render at its exact intended weight with zero compromise — this is a non-issue on desktop.

### Mobile (`life-os-mobile/`)

- `assets/fonts/Inter-Regular.ttf`, `Inter-Medium.ttf`, `Inter-SemiBold.ttf`, `Inter-Bold.ttf` (4 static files) → replaced by `Satoshi-Regular.ttf` (400), `Satoshi-Medium.ttf` (500), `Satoshi-Bold.ttf` (700) — **3 files, not 4** (see §5 for why SemiBold has no direct replacement). Black (900) and Light (300) are not bundled: grepping `lib/` confirms zero usages of `FontWeight.w900`, `w800`, or `w300` anywhere in the app today, so bundling those weights would add dead weight to the app for no benefit.
- `pubspec.yaml`'s font block:
  ```yaml
  fonts:
    - family: Inter
      fonts:
        - asset: assets/fonts/Inter-Regular.ttf
          weight: 400
        - asset: assets/fonts/Inter-Medium.ttf
          weight: 500
        - asset: assets/fonts/Inter-SemiBold.ttf
          weight: 600
        - asset: assets/fonts/Inter-Bold.ttf
          weight: 700
  ```
  becomes `family: Satoshi` with 3 weight entries (400/500/700) pointing at the new asset files — see §5 for how the weight-600 entry is actually handled.
- `lib/design_system/life_os_theme.dart` — all 25 occurrences of `fontFamily: 'Inter'` become `fontFamily: 'Satoshi'`. Purely mechanical; no other file in `lib/` references a font family by name (confirmed during the base theme redesign's original Inter rollout, and unchanged since).

## 5. Handling weight 600 (SemiBold) on mobile

The codebase uses `FontWeight.w600` in 8 places in `life_os_theme.dart` (nav labels, section headers, etc.). Satoshi has no static SemiBold file, so mobile can't do a direct 1:1 asset swap the way it could for 400/500/700.

**Decision (confirmed with the user):** desktop uses the variable font and gets an exact weight 600 for free — no compromise there. Mobile keeps its existing simpler static-file registration pattern (matching how Inter is set up today) rather than switching to a variable font + `FontVariation` axis control, which would be a larger, less certain implementation lift (Flutter's variable-font weight interpolation behavior isn't something this plan wants to take on faith without hands-on verification, and the added complexity isn't proportionate to fixing 8 text styles).

Concretely: `FontWeight.w600` stays in the Dart source unchanged at all 8 call sites. Flutter resolves an unregistered weight against the nearest registered weight in the same family, so `w600` should land on Bold (700) by default given the registered set is {400, 500, 700}. This needs to be **visually confirmed during implementation** — if it doesn't look right, or if Flutter's actual fallback behavior picks 500 instead of 700, the fix is to add an explicit fourth pubspec entry registering the Bold file a second time under `weight: 600` (a well-known Flutter trick: the same font file can be registered under multiple nominal weights), which forces the match without touching any of the 8 call sites. This is called out explicitly as an implementation-time verification step, not left as an assumption.

## 6. Fallback stack

Both platforms keep their existing fallback chain shape, just with the primary name swapped:
- Desktop: `'Satoshi', system-ui, -apple-system, sans-serif`
- Mobile: Flutter's `fontFamily: 'Satoshi'` already implicitly falls back to the platform default if the font fails to load — no explicit fallback list needed there, matching how Inter was configured.

## 7. Verification

Same shape as the original Inter rollout (base theme redesign, Task 13/Task 2-3):
- `npm run build` (`tsc` + `vite build`) clean on desktop; `flutter analyze` clean on mobile.
- Grep sweep on both repos for any leftover `'Inter'` font-family reference (excluding false-positive substring matches like `setInterval`) to confirm nothing was missed.
- Visual smoke test on both apps: confirm Satoshi actually renders (not a silent fallback to system-ui — distinguishable by Satoshi's letterforms, e.g. its distinctive lowercase 'a' and 'g'), no flash-of-fallback-font on load, no missing-glyph "tofu" boxes anywhere in the UI, and that the weight-600 spots on mobile don't read as noticeably too-thin or too-heavy compared to their surrounding text (the specific check called out in §5).

## 8. Explicitly out of scope

- Italic weights are not bundled on either platform: grepping both codebases confirms zero usages of `font-style: italic` (desktop) or `FontStyle.italic` (mobile) today, so there's nothing to support.
- Any change to font *size*, *line-height*, *letter-spacing*, or the type scale established during the base theme redesign — this is purely a typeface swap, not a typography system redesign.
- Any change to the monospace/display font situation — this app doesn't currently use a secondary font family anywhere; Satoshi replaces Inter as the sole UI font on both platforms, same as before.
- Re-litigating the color palette, motion tokens, or depth/elevation system — unrelated, already-shipped work from earlier passes this session.
