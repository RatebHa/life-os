# Remove XP/Level/Achievement System — Design Spec

**Goal:** Completely remove XP, domain levels, and achievements from both the desktop and mobile apps, while keeping streaks and momentum working exactly as they do today.

## Problem

While scoping test coverage for the task-completion and habit-logging commands, a deep read of the actual code (not the docs) found that the app's XP/leveling/achievement loop is disconnected end-to-end: `complete_task` and `record_habit_day` (the Rust functions behind every task/habit completion) never write to `xp_events` or `domains.xp_total`; the frontend's `runPostAction` (documented as "called after every task completion or habit log — handles level-up detection, achievement checks, momentum recalc") is never called from anywhere in the codebase; and `LevelUpCeremony`/`AchievementToast` are never rendered. Rather than repair this dead system, the user decided to remove it entirely — XP, levels, and achievements were never actually working, and the user doesn't want them.

## Scope

**Remove entirely, both platforms:**
- XP: point values, XP events, the rule-based (`xp-engine.ts`) and AI-based (`ai-xp.ts`) scoring engines, all XP display/animation.
- Levels: domain level numbers, level titles (Recruit → Commander), the level-up ceremony.
- Achievements: all 19 trigger conditions, the achievements table's *usage* (not the table itself — see below), unlock tracking, the achievement toast and gallery.

**Explicitly kept, unchanged:** streaks (`streak_current`, `streak_longest`, `streak_freeze_tokens`, `StreakFlame`, `update_domain_streak`, `use_streak_freeze`) and momentum (`momentum_score`, `getMomentumState`, `updateMomentum`, the RED_ALERT banner). Neither depends on XP.

**Database:** additive-only, matching this codebase's existing migration convention (every migration so far has been `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ADD COLUMN` — never a drop). No column or table is dropped by this work, on either platform. `domains.xp_total`, `domains.level`, the `xp_events` table, and the `achievements` table all stay in the SQLite schema, inert and unused. `tasks.xp_value`/`xp_awarded`, `habits.xp_per_completion`, `habit_logs.xp_awarded` also stay — they were always inert passthrough fields (Rust never computed or awarded XP through them; the frontend never read them either), so there's nothing to remove there beyond what's already inert.

**Explicitly not touched:** the Settings "AI Assist" API key storage/UI. `ai-xp.ts` was its only consumer, but the key itself is generic AI infrastructure that was just given OS-keychain protection in a separate, prior sub-project — removing that capability is a separate decision the user hasn't made, so `save_api_key`/the Settings API key section stay as-is even though their one current use case is going away.

**Also not touched (separate, pre-existing issue, noted but out of scope):** momentum recalculation appears to have the same "nothing calls it" problem XP had — `recalculateMomentum`/`updateMomentum` are never invoked after a task/habit completion in the current code. This work does not fix that; it only preserves whatever momentum's current (already-dormant) behavior is.

## Desktop design (Rust/Tauri)

**Commands removed** (deregistered from `src-tauri/src/lib.rs`'s `generate_handler!` list, function bodies deleted from `commands.rs`): `update_domain_xp`, `get_xp_events`, `get_xp_events_by_domain_and_range`, `claim_recovery_bonus`, `get_achievements`, `unlock_achievement`, `get_daily_xp`. The private helper `xp_to_level` (used only by two of these) is removed once both its callers are gone.

**Structs removed entirely:** `XpEvent`, `Achievement`, `DailyXp`.

**`Domain` struct:** `xp_total`/`level` fields removed. Because `Domain` rows are built positionally (`row.get(N)` by index, not by name), removing these two fields requires renumbering every subsequent index at each of the following call sites, consistently: `get_domains`, `create_domain` (which also hardcodes `0, 1` as literal INSERT values for these columns — that literal goes too), `get_domain_by_id`, `load_export_payload`, `load_sync_payload`, `import_payload_into_db`, `import_sync_payload_into_db`. This is the highest-risk mechanical change in the whole removal — an off-by-one here would silently swap `streak_current`/`streak_longest`/`streak_freeze_tokens`/`last_activity_date` with each other.

**Other struct field removals:** `BackupCounts.xp_events`/`.achievements`, `ExportPayload.xp_events`/`.achievements`, `ImportPayload.xp_events`/`.achievements`, `CalendarDay.xp_earned` (and the `SUM(xp_amount)` query feeding it inside `get_calendar_data`, which stays as a command but loses this one field/query).

**Cleanup inside otherwise-kept commands:** `delete_domain`'s linked-data guard currently blocks deletion while `xp_events` rows exist for that domain — remove the `xp_events` count and its mention in the error message (the other linked-data checks stay). `undo_habit_log` contains an `if log.xp_awarded > 0 { DELETE FROM xp_events ... }` block that is already dead code today (`record_habit_day` always writes `xp_awarded = 0`, so this condition can never be true) — remove it. `reset_all_data`'s batch drops the two lines `DELETE FROM xp_events;` and `UPDATE achievements SET unlocked = 0, unlocked_at = NULL;` (harmless either way once nothing reads those tables, but removing them keeps the function honest about what it actually resets).

**`import_payload_into_db`:** its delete-batch drops `DELETE FROM xp_events;`/`DELETE FROM achievements;`; its insert loops for `xp_events`/`achievements` are deleted entirely. (Confirmed: `import_sync_payload_into_db`, the cloud-sync path, never touched these two tables in the first place — no change needed there beyond the `Domain` field ripple already covered above.)

## Desktop design (React/TypeScript)

**Files deleted entirely:** `src/lib/xp-engine.ts`, `src/lib/ai-xp.ts`, `src/lib/achievement-checker.ts`, `src/lib/achievement-display.ts`, `src/components/gamification/LevelUpCeremony.tsx`, `src/components/gamification/AchievementToast.tsx`, `src/lib/__tests__/xp-engine.test.ts`, `src/lib/__tests__/achievement-checker.test.ts`. (Both components are already unrendered — not imported by `App.tsx` or any page — so their removal has zero visible effect beyond deleting dead code.)

**`src/lib/post-action.ts`:** the `runPostAction` function is deleted (it was never called from anywhere, and its entire job was level-up detection + achievement checks + a momentum recalc call). `recalculateMomentum` and the private `_calcAndSaveMomentum` helper are kept, unchanged — this is the file's only working, in-scope logic.

**`src/store/useAppStore.ts`:** remove the `Achievement` import, `LevelUpEvent` interface, `achievements`/`pendingUnlocks`/`levelUpEvent` state, and the `loadAchievements`/`unlockAchievement`/`dismissUnlock`/`triggerLevelUp`/`dismissLevelUp` actions (including the `loadAchievements()` call inside `resetData`). `momentumState`, `getMomentumState`, `updateMomentum`, `appState`, `loadAppState`, `setMitTask`, `saveApiKey` all stay untouched.

**`src/lib/types.ts`:** remove `Domain.xp_total`/`.level`, the `XpEvent` interface, the `Achievement` interface, `BackupCounts.xp_events`/`.achievements`, the `DailyXp` interface, `LEVEL_TITLES`, `XP_THRESHOLDS`, `CalendarDay.xp_earned`. Keep `Task.xp_value`/`.xp_awarded`, `Habit.xp_per_completion`, `HabitLog.xp_awarded` (mirroring the inert Rust fields — nothing in the frontend reads these today, but they accurately reflect what the API still returns).

**`src/lib/db.ts`:** remove the `updateDomainXp`, `getXpEvents`, `getXpEventsByDomainAndRange`, `claimRecoveryBonus`, `getAchievements`, `unlockAchievement`, `getDailyXp` wrapper functions and their type imports. `updateDomainStreak`/`useStreakFreeze` stay.

**`src/lib/domain-utils.ts`:** remove `getLevelTitle` (its only caller, `LevelUpCeremony`, is gone) and the now-unused `LEVEL_TITLES` import.

**`src/pages/Analytics.tsx`:** remove the `achievement-display` import, the `AchievementTile` component, the `achievements` destructure from `useAppStore`, the `unlockedCount` calculation, and the achievement-gallery card that renders them.

**`src/pages/Settings.tsx`:** remove the `loadAchievements` destructure and its call in the startup `Promise.all`. The AI API key section is untouched (see Scope).

**`src/store/__tests__/useCalendarStore.test.ts`:** remove `xp_earned` from the mock `CalendarDay` fixtures and the one assertion that reads it.

**`src/styles/globals.css`:** remove the `.xp-bar-track`/`.xp-bar-fill` selector fragments (the shared rule body stays — `.progress-track`/`.progress-fill` are real, used elsewhere), and the entire `LEVEL UP CARD` and `ACHIEVEMENT TOAST` comment blocks.

## Mobile design (Flutter)

No achievements feature exists on mobile — nothing to remove there. Mobile never computed XP/level itself (it only stores/displays whatever synced in from desktop), so removal here is purely UI: `lib/features/domains/presentation/domains_screen.dart` (drop the `LEVEL ${domain.level} |` segment from the domain card header, and the `XP total` signal row), `lib/features/domains/presentation/domain_detail_screen.dart` (drop the `Level` and `XP total` stat cards, keep `Streak`), `lib/features/overview/presentation/overview_screen.dart` (drop the `LEVEL ${domain.level}  |  ` segment from the Domain Watch panel, keep the `STREAK` portion). The Drift schema (`LocalDomains.xpTotal`/`.level` columns) and the sync JSON serialization (`_domainJson`/`_domainCompanionFromJson`) are left untouched — same "inert, not worth a migration" reasoning as desktop.

## Documentation

`CLAUDE.md` (root) needs real edits, not just note-taking: remove the entire `## XP ENGINE` section, the Level System table and Achievement Triggers array inside `## GAMIFICATION RULES` (streak/habit-XP prose in that section is trimmed to remove XP mentions but streak rules stay), the `xp-engine.ts`/`ai-xp.ts`/`achievement-checker.ts` lines in the file-tree comment, the `XPBar`/`AchievementToast`/`LevelUpCeremony` mention in the components directory comment (note: `XPBar` doesn't actually exist in the codebase today — this is pre-existing doc drift, not something this work introduces), the `.xp-bar-track`/`.xp-float`/`.level-up-overlay` CSS class docs, the `xp_events`/`achievements` table schema blocks, and the `get_xp_events`/`get_achievements`/etc. command list entries. Pre-existing staleness unrelated to XP (e.g. the schema/command list already not matching `db.ts` in other ways) is left alone — this pass only removes what's specifically about XP/levels/achievements. The Phase Build Order changelog's completed Phase 10 entry ("Achievement system + Level-up ceremony") is a historical record of what was built and when, not a description of current behavior — it stays as-is rather than being edited to match the new state.

## Testing

No new tests are added by this work — it's a removal. Verification is: `cargo test`/`cargo build` (desktop Rust), `npm test`/`npm run build` (desktop frontend, confirms the two deleted test files' absence doesn't break the suite and nothing else references the removed exports), `flutter analyze`/`flutter test` (mobile). The existing `useTaskStore.test.ts` fixtures that set `xp_value`/`xp_awarded` on mock tasks need no changes (those fields stay on the `Task` type).

## Out of scope

- Dropping any database column or table (additive-only, matching existing convention).
- Removing the Settings AI API key storage/UI.
- Fixing momentum's apparent dead-wiring (noted as a discovered issue, not addressed here).
- Any other pre-existing `CLAUDE.md` staleness not related to XP/levels/achievements.
