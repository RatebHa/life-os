# Rust Backend Rules
- All DB operations use rusqlite — never diesel or sqlx
- All public functions exposed as Tauri commands via #[tauri::command]
- Use uuid crate for all ID generation
- All errors return Result<T, String> for Tauri compatibility
- Momentum decay runs in scheduler.rs via a background thread
- See root CLAUDE.md for full schema and command list