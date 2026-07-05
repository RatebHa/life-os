# Frontend Rules
- Zustand stores only — no Context API, no prop drilling beyond 2 levels
- All Tauri calls through typed wrappers in lib/db.ts — never raw invoke()
- Domain theming via data-domain attribute — never hardcoded colors
- React.memo on all list items
- See root CLAUDE.md for full design system and token definitions
