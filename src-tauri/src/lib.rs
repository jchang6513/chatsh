pub mod protocol;

use base64::Engine as _;
use protocol::*;
use serde_json;
use std::collections::HashMap;
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};

// ── AppState ──

struct AppState {
    sock_path: String,
}

// ── Daemon lifecycle ──

fn sock_path() -> String {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".into());
    format!("{}/.chatsh/daemon.sock", home)
}

fn ensure_daemon_running() -> Result<(), String> {
    let sock = sock_path();
    if std::os::unix::net::UnixStream::connect(&sock).is_ok() {
        return Ok(());
    }

    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let dir = exe.parent().ok_or("no parent dir")?;
    let daemon_bin = dir.join("chatsh-daemon");

    if !daemon_bin.exists() {
        return Err(format!(
            "找不到 chatsh-daemon binary (expected at {:?})",
            daemon_bin
        ));
    }

    let home = std::env::var("HOME").unwrap_or_default();
    let log_dir = format!("{}/.chatsh", home);
    std::fs::create_dir_all(&log_dir).ok();
    let log_path = format!("{}/daemon.log", log_dir);

    let log_file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
        .map_err(|e| format!("無法開啟 daemon log: {e}"))?;

    let log_err = log_file
        .try_clone()
        .map_err(|e| format!("無法複製 log fd: {e}"))?;

    use std::os::unix::process::CommandExt;
    std::process::Command::new(&daemon_bin)
        .process_group(0)
        .stdout(log_file)
        .stderr(log_err)
        .stdin(std::process::Stdio::null())
        .spawn()
        .map_err(|e| format!("無法啟動 chatsh-daemon: {e}"))?;

    for _ in 0..30 {
        std::thread::sleep(std::time::Duration::from_millis(100));
        if std::os::unix::net::UnixStream::connect(&sock).is_ok() {
            return Ok(());
        }
    }
    Err("chatsh-daemon 啟動逾時".into())
}

// ── Per-request helpers ──

async fn daemon_connect(sock_path: &str) -> Result<tokio::net::UnixStream, String> {
    tokio::net::UnixStream::connect(sock_path)
        .await
        .map_err(|e| format!("無法連線 daemon: {e}"))
}

async fn send_msg(stream: &mut tokio::net::UnixStream, msg: &ClientMessage) -> Result<(), String> {
    let mut json = serde_json::to_string(msg).map_err(|e| e.to_string())?;
    json.push('\n');
    stream
        .write_all(json.as_bytes())
        .await
        .map_err(|e| format!("socket 寫入失敗: {e}"))?;
    stream
        .flush()
        .await
        .map_err(|e| format!("socket flush 失敗: {e}"))?;
    Ok(())
}

/// Send a message and read lines until `predicate` returns Some(T).
async fn send_and_recv<T, F>(
    sock_path: &str,
    msg: &ClientMessage,
    predicate: F,
) -> Result<T, String>
where
    F: Fn(ServerMessage) -> Option<T>,
{
    let stream = daemon_connect(sock_path).await?;
    let (read_half, mut write_half) = stream.into_split();

    let mut json = serde_json::to_string(msg).map_err(|e| e.to_string())?;
    json.push('\n');
    write_half
        .write_all(json.as_bytes())
        .await
        .map_err(|e| format!("socket 寫入失敗: {e}"))?;
    write_half
        .flush()
        .await
        .map_err(|e| format!("socket flush 失敗: {e}"))?;

    let mut lines = BufReader::new(read_half).lines();
    while let Ok(Some(line)) = lines.next_line().await {
        if line.trim().is_empty() {
            continue;
        }
        if let Ok(server_msg) = serde_json::from_str::<ServerMessage>(&line) {
            if let Some(result) = predicate(server_msg) {
                return Ok(result);
            }
        }
    }
    Err("daemon 連線中斷，未收到預期回應".into())
}

/// Fire-and-forget: send a message, don't wait for response.
async fn send_fire_and_forget(sock_path: &str, msg: &ClientMessage) -> Result<(), String> {
    let mut stream = daemon_connect(sock_path).await?;
    send_msg(&mut stream, msg).await
}

// ── Attach stream background task ──

fn spawn_attach_task(sock_path: String, pane_id: String, app_handle: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let stream = match daemon_connect(&sock_path).await {
            Ok(s) => s,
            Err(e) => {
                eprintln!("attach 連線失敗 (pane {pane_id}): {e}");
                return;
            }
        };
        let (read_half, mut write_half) = stream.into_split();

        // Send attach_pane
        let msg = ClientMessage::AttachPane {
            id: pane_id.clone(),
        };
        let mut json = serde_json::to_string(&msg).unwrap();
        json.push('\n');
        if write_half.write_all(json.as_bytes()).await.is_err() {
            return;
        }
        let _ = write_half.flush().await;

        // Read stream events
        let mut lines = BufReader::new(read_half).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            if line.trim().is_empty() {
                continue;
            }
            let server_msg: ServerMessage = match serde_json::from_str(&line) {
                Ok(m) => m,
                Err(_) => continue,
            };
            match server_msg {
                ServerMessage::PaneOutput { ref id, ref data }
                | ServerMessage::Scrollback { ref id, ref data } => {
                    app_handle.emit(&format!("pty-output-{id}"), data).ok();
                }
                ServerMessage::PaneStatus { ref id, ref status } => {
                    if status == "stopped" || status == "deleted" {
                        app_handle.emit(&format!("pty-exit-{id}"), ()).ok();
                        break;
                    }
                }
                ServerMessage::PaneIdle { ref id } => {
                    app_handle.emit(&format!("pty-idle-{id}"), ()).ok();
                }
                _ => {}
            }
        }
    });
}

// ── Tauri commands ──

#[tauri::command]
async fn spawn_agent(
    agent_id: String,
    command: Vec<String>,
    working_dir: String,
    cols: u16,
    rows: u16,
    parent_pane_id: Option<String>,
    pane_type: Option<String>,
    state: State<'_, AppState>,
    app_handle: AppHandle,
) -> Result<(), String> {
    let sock = state.sock_path.clone();

    // Send spawn_pane and wait for SpawnResult
    let spawn_result = send_and_recv(&sock, &ClientMessage::SpawnPane {
        id: agent_id.clone(),
        command,
        cwd: working_dir,
        env: HashMap::new(),
        cols,
        rows,
        parent_pane_id,
        pane_type,
    }, |msg| {
        match msg {
            ServerMessage::SpawnResult { ref id, success, ref error } if *id == agent_id => {
                if success {
                    Some(Ok(()))
                } else {
                    Some(Err(error.clone().unwrap_or_default()))
                }
            }
            _ => None,
        }
    }).await?;

    // Check if spawn itself failed
    spawn_result?;

    // Resize to current dimensions
    send_fire_and_forget(&sock, &ClientMessage::ResizePane {
        id: agent_id.clone(),
        cols,
        rows,
    }).await.ok();

    // Start background attach stream task
    spawn_attach_task(sock, agent_id, app_handle);

    Ok(())
}

#[tauri::command]
async fn kill_agent(agent_id: String, state: State<'_, AppState>) -> Result<(), String> {
    send_fire_and_forget(&state.sock_path, &ClientMessage::DeletePane { id: agent_id }).await
}

#[tauri::command]
async fn write_to_agent(
    agent_id: String,
    data: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    // daemon expects base64-encoded data
    let encoded = base64::engine::general_purpose::STANDARD.encode(data.as_bytes());
    eprintln!("[write_to_agent] id={agent_id} encoded_len={}", encoded.len());
    send_fire_and_forget(
        &state.sock_path,
        &ClientMessage::WritePane {
            id: agent_id,
            data: encoded,
        },
    )
    .await
}

#[tauri::command]
async fn resize_pty(
    agent_id: String,
    cols: u16,
    rows: u16,
    state: State<'_, AppState>,
) -> Result<(), String> {
    send_fire_and_forget(
        &state.sock_path,
        &ClientMessage::ResizePane {
            id: agent_id,
            cols,
            rows,
        },
    )
    .await
}

#[tauri::command]
async fn is_agent_alive(agent_id: String, state: State<'_, AppState>) -> Result<bool, String> {
    let panes: Vec<PaneInfo> = send_and_recv(
        &state.sock_path,
        &ClientMessage::ListPanes,
        |msg| match msg {
            ServerMessage::PaneList { panes } => Some(panes),
            _ => None,
        },
    )
    .await?;
    Ok(panes.iter().any(|p| p.id == agent_id && p.status == "running"))
}

#[tauri::command]
async fn list_panes(state: State<'_, AppState>) -> Result<Vec<PaneInfo>, String> {
    send_and_recv(
        &state.sock_path,
        &ClientMessage::ListPanes,
        |msg| match msg {
            ServerMessage::PaneList { panes } => Some(panes),
            _ => None,
        },
    )
    .await
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
fn open_url(url: String) -> Result<(), String> {
    open::that(&url).map_err(|e| e.to_string())
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
    std::fs::write(
        &pending_path,
        serde_json::to_string_pretty(&pending).unwrap_or_default(),
    )
    .map_err(|e| e.to_string())
}

#[derive(serde::Serialize)]
struct GitInfo {
    repo_name: String,
    branch: String,
    dirty: bool,
}

#[tauri::command]
async fn get_git_info(path: String) -> Option<GitInfo> {
    tokio::task::spawn_blocking(move || {
    let resolved_path = path.replace("~", &std::env::var("HOME").unwrap_or_default());

    // Single git call: status -b --porcelain=v1 gives branch + dirty in one shot
    let out = std::process::Command::new("git")
        .args(["status", "-b", "--porcelain=v1"])
        .current_dir(&resolved_path)
        .output()
        .ok()
        .filter(|o| o.status.success())?;

    let stdout = String::from_utf8_lossy(&out.stdout);
    let mut lines = stdout.lines();

    // First line: ## branch...tracking  or  ## HEAD (no branch)
    let branch_line = lines.next()?;
    let branch = branch_line
        .strip_prefix("## ")
        .and_then(|s| s.split("...").next())
        .and_then(|s| s.split(" ").next())
        .unwrap_or("HEAD")
        .to_string();

    // Remaining lines = dirty files
    let dirty = lines.next().is_some();

    // Get repo name via rev-parse (fast, cached by git)
    let toplevel = std::process::Command::new("git")
        .args(["rev-parse", "--show-toplevel"])
        .current_dir(&resolved_path)
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())?;

    let repo_name = std::path::Path::new(&toplevel)
        .file_name()?
        .to_string_lossy()
        .to_string();

    Some(GitInfo { repo_name, branch, dirty })
    }).await.ok().flatten()
}

#[tauri::command]
fn get_battery() -> Option<serde_json::Value> {
    let output = std::process::Command::new("pmset")
        .args(["-g", "batt"])
        .output()
        .ok()?;
    let text = String::from_utf8_lossy(&output.stdout);
    if text.contains("'AC Power'") && !text.contains("InternalBattery") {
        return None;
    }
    let percent = text
        .lines()
        .find(|l| l.contains('%'))
        .and_then(|l| l.split_whitespace().find(|w| w.ends_with('%') || w.ends_with("%;")))?
        .trim_end_matches("%;")
        .trim_end_matches('%')
        .parse::<u8>()
        .ok()?;
    let charging = text.contains("AC Power") || text.contains("charging");
    Some(serde_json::json!({ "percent": percent, "charging": charging }))
}

#[tauri::command]
fn list_fonts() -> Vec<String> {
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
        _ => vec![
            "SF Mono".to_string(),
            "Menlo".to_string(),
            "Monaco".to_string(),
            "Courier New".to_string(),
        ],
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

    std::fs::write(
        &pending_path,
        serde_json::to_string_pretty(&remaining).unwrap_or_default(),
    )
    .map_err(|e| e.to_string())?;

    Ok(cleaned)
}

// ── Entry point ──

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    if let Err(e) = ensure_daemon_running() {
        eprintln!("Warning: 無法啟動 chatsh-daemon: {e}");
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            app.manage(AppState {
                sock_path: sock_path(),
            });
            Ok(())
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
            get_git_info,
            list_panes,
            open_url,
        ])
        .run(tauri::generate_context!())
        .expect("Failed to launch Tauri app");
}
