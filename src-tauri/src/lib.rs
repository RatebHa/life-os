mod db;
mod commands;
mod credentials;

use commands::DbState;
use rusqlite::Connection;
use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let db_path = db::get_db_path(app.handle());
            let conn = Connection::open(&db_path)
                .expect("Failed to open SQLite database");
            db::init_db(&conn).expect("Failed to initialize database");
            let backup_dir = app
                .handle()
                .path()
                .app_data_dir()
                .expect("Failed to get app data dir")
                .join("backups");
            std::fs::create_dir_all(&backup_dir).expect("Failed to create backup dir");
            conn.execute(
                "UPDATE app_state SET backup_directory = COALESCE(NULLIF(backup_directory, ''), ?1) WHERE id = 1",
                [backup_dir.to_string_lossy().to_string()],
            ).expect("Failed to initialize backup directory");
            app.manage(DbState(Mutex::new(conn)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_domains,
            commands::create_domain,
            commands::delete_domain,
            commands::update_domain_profile,
            commands::update_domain_streak,
            commands::get_tasks,
            commands::get_tasks_by_domain,
            commands::create_task,
            commands::update_task,
            commands::delete_task,
            commands::complete_task,
            commands::undo_complete_task,
            commands::restore_task,
            commands::get_habits,
            commands::create_habit,
            commands::update_habit,
            commands::log_habit,
            commands::log_habit_minimum,
            commands::skip_habit,
            commands::undo_habit_log,
            commands::get_habit_logs,
            commands::get_habit_logs_range,
            commands::restart_habit,
            commands::delete_habit,
            commands::get_goals,
            commands::get_deleted_goals,
            commands::create_goal,
            commands::update_goal,
            commands::delete_goal,
            commands::restore_goal,
            commands::get_app_state,
            commands::update_momentum,
            commands::set_mit_task,
            commands::save_api_key,
            commands::update_backup_settings,
            commands::update_ui_preferences,
            commands::create_backup,
            commands::create_named_snapshot,
            commands::backup_before_risky_action,
            commands::import_data,
            commands::preview_import_data,
            commands::restore_latest_backup,
            commands::preview_latest_backup,
            commands::list_backups,
            commands::get_backup_health_status,
            commands::update_last_opened,
            commands::complete_onboarding,
            commands::configure_sync,
            commands::save_sync_session,
            commands::clear_sync_session,
            commands::update_sync_status,
            commands::get_sync_counts,
            commands::export_sync_payload,
            commands::import_sync_payload,
            commands::get_sync_queue,
            commands::upsert_sync_queue_item,
            commands::delete_sync_queue_item,
            commands::get_sync_cursors,
            commands::set_sync_cursor,
            commands::get_task_stats,
            commands::reset_all_data,
            commands::get_notes,
            commands::get_deleted_notes,
            commands::create_note,
            commands::update_note,
            commands::delete_note,
            commands::restore_note,
            commands::search_notes,
            commands::get_inbox_items,
            commands::get_deleted_inbox_items,
            commands::create_inbox_item,
            commands::triage_inbox_item,
            commands::delete_inbox_item,
            commands::restore_inbox_item,
            commands::get_task_templates,
            commands::create_task_template,
            commands::update_task_template,
            commands::delete_task_template,
            commands::get_focus_sessions,
            commands::get_focus_timer_drafts,
            commands::save_focus_timer_draft,
            commands::clear_focus_timer_draft,
            commands::complete_focus_session,
            commands::get_task_friction_logs,
            commands::create_task_friction_log,
            commands::export_data,
            commands::get_calendar_data,
            commands::use_streak_freeze,
            commands::log_debug_entry,
            commands::get_debug_log,
            commands::clear_debug_log,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
