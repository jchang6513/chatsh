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

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    let expanded = path.replace("~", &std::env::var("HOME").unwrap_or_default());
    std::fs::read_to_string(&expanded).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_file(path: String, content: String) -> Result<(), String> {
    let expanded = path.replace("~", &std::env::var("HOME").unwrap_or_default());
    if let Some(parent) = std::path::Path::new(&expanded).parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(&expanded, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn schedule_deletion(agent_id: String) -> Result<(), String> {
    let home = std::env::var("HOME").unwrap_or_default();
    let pending_path = format!("{}/.chatsh/pending_deletion.json", home);

    let mut pending: Vec<serde_json::Value> = if std::path::Path::new(&pending_path).exists() {
        let content = std::fs::read_to_string(&pending_path).unwrap_or_default();
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        vec![]
    };

    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    pending.push(serde_json::json!({
        "agentId": agent_id,
        "deletedAt": ts
    }));

    if let Some(parent) = std::path::Path::new(&pending_path).parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(&pending_path, serde_json::to_string_pretty(&pending).unwrap_or_default())
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_battery() -> Option<serde_json::Value> {
    let output = std::process::Command::new("pmset")
        .args(["-g", "batt"])
        .output()
        .ok()?;
    let text = String::from_utf8_lossy(&output.stdout);
    // If only AC Power and no battery line, return None
    if text.contains("'AC Power'") && !text.contains("InternalBattery") {
        return None;
    }
    // Extract percentage and charging status
    let percent = text.lines()
        .find(|l| l.contains('%'))
        .and_then(|l| l.split_whitespace().find(|w| w.ends_with('%') || w.ends_with("%;")))?
        .trim_end_matches("%;")
        .trim_end_matches('%')
        .parse::<u8>().ok()?;
    let charging = text.contains("AC Power") || text.contains("charging");
    Some(serde_json::json!({ "percent": percent, "charging": charging }))
}

#[tauri::command]
fn list_fonts() -> Vec<String> {
    // Use system_profiler or fc-list to get installed fonts
    let output = std::process::Command::new("sh")
        .arg("-c")
        .arg(r#"fc-list 2>/dev/null | sed 's/.*: //;s/:.*//;s/, /\n/g' | sort -u | grep -v '^$' || ls /System/Library/Fonts/ /Library/Fonts/ ~/Library/Fonts/ 2>/dev/null | grep -E '\.(ttf|otf|ttc)$' | sed 's/\.[^.]*$//' | sort -u"#)
        .output();
    match output {
        Ok(o) if o.status.success() => {
            let raw = String::from_utf8_lossy(&o.stdout);
            raw.lines()
                .map(|l| l.trim().to_string())
                .filter(|l| !l.is_empty())
                .collect()
        }
        _ => vec!["SF Mono".to_string(), "Menlo".to_string(), "Monaco".to_string(), "Courier New".to_string()]
    }
}

#[tauri::command]
fn cleanup_deleted_agents() -> Result<u32, String> {
    let home = std::env::var("HOME").unwrap_or_default();
    let pending_path = format!("{}/.chatsh/pending_deletion.json", home);

    if !std::path::Path::new(&pending_path).exists() {
        return Ok(0);
    }

    let content = std::fs::read_to_string(&pending_path).map_err(|e| e.to_string())?;
    let pending: Vec<serde_json::Value> = serde_json::from_str(&content).unwrap_or_default();

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    let seven_days = 7 * 24 * 60 * 60;
    let mut cleaned = 0u32;
    let mut remaining = vec![];

    for item in pending {
        let agent_id = item["agentId"].as_str().unwrap_or_default();
        let deleted_at = item["deletedAt"].as_u64().unwrap_or(0);

        if now - deleted_at > seven_days {
            let dir = format!("{}/.chatsh/agents/{}", home, agent_id);
            if std::path::Path::new(&dir).exists() {
                let _ = std::fs::remove_dir_all(&dir);
                cleaned += 1;
            }
        } else {
            remaining.push(item);
        }
    }

    std::fs::write(&pending_path, serde_json::to_string_pretty(&remaining).unwrap_or_default())
        .map_err(|e| e.to_string())?;

    Ok(cleaned)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
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
            read_file,
            write_file,
            schedule_deletion,
            cleanup_deleted_agents,
            list_fonts,
            get_battery,
        ])
        .run(tauri::generate_context!())
        .expect("Failed to launch Tauri app");
}
