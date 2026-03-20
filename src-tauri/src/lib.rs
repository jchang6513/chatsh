mod pty;

use pty::PtyManager;
use std::sync::Mutex;
use tauri::State;

struct AppState {
    pty_manager: Mutex<PtyManager>,
}

#[tauri::command]
fn spawn_agent(
    agent_id: String,
    command: Vec<String>,
    working_dir: String,
    cols: u16,
    rows: u16,
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let manager = state.pty_manager.lock().map_err(|e| e.to_string())?;
    manager.spawn(&agent_id, &command, &working_dir, cols, rows, app_handle)
}

#[tauri::command]
fn kill_agent(agent_id: String, state: State<'_, AppState>) -> Result<(), String> {
    let manager = state.pty_manager.lock().map_err(|e| e.to_string())?;
    manager.kill(&agent_id)
}

#[tauri::command]
fn write_to_agent(agent_id: String, data: String, state: State<'_, AppState>) -> Result<(), String> {
    let manager = state.pty_manager.lock().map_err(|e| e.to_string())?;
    manager.write(&agent_id, data.as_bytes())
}

#[tauri::command]
fn resize_pty(
    agent_id: String,
    cols: u16,
    rows: u16,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let manager = state.pty_manager.lock().map_err(|e| e.to_string())?;
    manager.resize(&agent_id, cols, rows)
}

#[tauri::command]
fn is_agent_alive(agent_id: String, state: State<'_, AppState>) -> Result<bool, String> {
    let manager = state.pty_manager.lock().map_err(|e| e.to_string())?;
    Ok(manager.is_alive(&agent_id))
}

#[tauri::command]
fn scan_available_agents() -> Vec<serde_json::Value> {
    let candidates = vec![
        ("Claude Code", "claude", "AI coding assistant"),
        ("OpenAI Codex", "codex", "OpenAI coding agent"),
        ("Gemini CLI", "gemini", "Google Gemini CLI"),
        ("Aider", "aider", "AI pair programmer"),
        ("Shell (zsh)", "/bin/zsh", "Standard shell"),
        ("Shell (bash)", "/bin/bash", "Bash shell"),
        ("Node.js REPL", "node", "Node.js interactive"),
        ("Python REPL", "python3", "Python interactive"),
    ];

    candidates
        .into_iter()
        .filter_map(|(name, cmd, desc)| {
            let path = if cmd.starts_with('/') {
                std::path::Path::new(cmd)
                    .exists()
                    .then(|| cmd.to_string())
            } else {
                std::process::Command::new("which")
                    .arg(cmd)
                    .output()
                    .ok()
                    .and_then(|o| {
                        o.status
                            .success()
                            .then(|| String::from_utf8_lossy(&o.stdout).trim().to_string())
                    })
            };
            path.map(|_| {
                serde_json::json!({
                    "name": name,
                    "command": cmd,
                    "description": desc
                })
            })
        })
        .collect()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(AppState {
            pty_manager: Mutex::new(PtyManager::new()),
        })
        .invoke_handler(tauri::generate_handler![
            spawn_agent,
            kill_agent,
            write_to_agent,
            resize_pty,
            is_agent_alive,
            scan_available_agents,
        ])
        .run(tauri::generate_context!())
        .expect("啟動 Tauri 應用程式失敗");
}
