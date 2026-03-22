pub mod protocol;

use protocol::*;
use serde_json;
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::unix::OwnedWriteHalf;
use tokio::sync::oneshot;

// ── DaemonClient ──

#[derive(Clone)]
struct DaemonClient {
    writer: std::sync::Arc<tokio::sync::Mutex<OwnedWriteHalf>>,
}

impl DaemonClient {
    async fn send(&self, msg: &ClientMessage) -> Result<(), String> {
        let mut writer = self.writer.lock().await;
        let mut json = serde_json::to_string(msg).map_err(|e| e.to_string())?;
        json.push('\n');
        writer
            .write_all(json.as_bytes())
            .await
            .map_err(|e| format!("socket 寫入失敗: {e}"))?;
        writer
            .flush()
            .await
            .map_err(|e| format!("socket flush 失敗: {e}"))?;
        Ok(())
    }
}

// ── AppState ──

struct AppState {
    daemon: DaemonClient,
    pending_spawns: std::sync::Arc<Mutex<HashMap<String, oneshot::Sender<Result<(), String>>>>>,
    pending_list: std::sync::Arc<Mutex<Option<oneshot::Sender<Vec<PaneInfo>>>>>,
}

// ── Daemon lifecycle ──

fn sock_path() -> String {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".into());
    format!("{}/.chatsh/daemon.sock", home)
}

fn ensure_daemon_running() -> Result<(), String> {
    let sock = sock_path();
    // Try to connect — if successful, daemon is running
    if std::os::unix::net::UnixStream::connect(&sock).is_ok() {
        return Ok(());
    }

    // Find daemon binary: same directory as current exe
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let dir = exe.parent().ok_or("no parent dir")?;
    let daemon_bin = dir.join("chatsh-daemon");

    if !daemon_bin.exists() {
        return Err(format!(
            "找不到 chatsh-daemon binary (expected at {:?})",
            daemon_bin
        ));
    }

    // Create log file
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

    // Spawn daemon in its own process group
    use std::os::unix::process::CommandExt;
    std::process::Command::new(&daemon_bin)
        .process_group(0)
        .stdout(log_file)
        .stderr(log_err)
        .stdin(std::process::Stdio::null())
        .spawn()
        .map_err(|e| format!("無法啟動 chatsh-daemon: {e}"))?;

    // Wait for socket to appear (max 3s)
    for _ in 0..30 {
        std::thread::sleep(std::time::Duration::from_millis(100));
        if std::os::unix::net::UnixStream::connect(&sock).is_ok() {
            return Ok(());
        }
    }
    Err("chatsh-daemon 啟動逾時".into())
}

async fn connect_daemon() -> Result<tokio::net::UnixStream, String> {
    let sock = sock_path();
    tokio::net::UnixStream::connect(&sock)
        .await
        .map_err(|e| format!("無法連線 daemon: {e}"))
}

// ── Background reader task ──

fn spawn_reader_task(
    read_half: tokio::net::unix::OwnedReadHalf,
    app_handle: AppHandle,
    pending_spawns: std::sync::Arc<Mutex<HashMap<String, oneshot::Sender<Result<(), String>>>>>,
    pending_list: std::sync::Arc<Mutex<Option<oneshot::Sender<Vec<PaneInfo>>>>>,
) {
    tokio::spawn(async move {
        let mut lines = BufReader::new(read_half).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            if line.trim().is_empty() {
                continue;
            }
            let msg: ServerMessage = match serde_json::from_str(&line) {
                Ok(m) => m,
                Err(_) => continue,
            };
            match msg {
                ServerMessage::PaneOutput { id, data } => {
                    app_handle.emit(&format!("pty-output-{id}"), &data).ok();
                }
                ServerMessage::Scrollback { id, data } => {
                    // Same as PaneOutput — Terminal.tsx writes to xterm
                    app_handle.emit(&format!("pty-output-{id}"), &data).ok();
                }
                ServerMessage::PaneStatus { id, status } => {
                    if status == "stopped" || status == "deleted" {
                        app_handle.emit(&format!("pty-exit-{id}"), ()).ok();
                    }
                }
                ServerMessage::PaneIdle { id } => {
                    app_handle.emit(&format!("pty-idle-{id}"), ()).ok();
                }
                ServerMessage::PaneList { panes } => {
                    if let Ok(mut guard) = pending_list.lock() {
                        if let Some(tx) = guard.take() {
                            let _ = tx.send(panes);
                        }
                    }
                }
                ServerMessage::SpawnResult { id, success, error } => {
                    if let Ok(mut guard) = pending_spawns.lock() {
                        if let Some(tx) = guard.remove(&id) {
                            if success {
                                let _ = tx.send(Ok(()));
                            } else {
                                let _ = tx.send(Err(error.unwrap_or_default()));
                            }
                        }
                    }
                }
                ServerMessage::Error { message } => {
                    eprintln!("daemon error: {message}");
                }
            }
        }
        eprintln!("daemon 連線中斷");
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
    state: State<'_, AppState>,
) -> Result<(), String> {
    let daemon = state.daemon.clone();
    let pending = std::sync::Arc::clone(&state.pending_spawns);

    let (tx, rx) = oneshot::channel();
    pending.lock().unwrap().insert(agent_id.clone(), tx);

    // Send spawn_pane — daemon will not replace if already running
    daemon
        .send(&ClientMessage::SpawnPane {
            id: agent_id.clone(),
            command,
            cwd: working_dir,
            env: HashMap::new(),
            cols,
            rows,
        })
        .await?;

    // Wait for spawn result
    let result = rx.await.map_err(|_| "daemon 連線中斷".to_string())?;

    // Always attach (subscribe to output + get scrollback)
    daemon
        .send(&ClientMessage::AttachPane {
            id: agent_id.clone(),
        })
        .await?;

    // If already running, resize to current dimensions
    daemon
        .send(&ClientMessage::ResizePane {
            id: agent_id,
            cols,
            rows,
        })
        .await?;

    result
}

#[tauri::command]
async fn kill_agent(agent_id: String, state: State<'_, AppState>) -> Result<(), String> {
    state
        .daemon
        .send(&ClientMessage::DeletePane { id: agent_id })
        .await
}

#[tauri::command]
async fn write_to_agent(
    agent_id: String,
    data: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state
        .daemon
        .send(&ClientMessage::WritePane {
            id: agent_id,
            data,
        })
        .await
}

#[tauri::command]
async fn resize_pty(
    agent_id: String,
    cols: u16,
    rows: u16,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state
        .daemon
        .send(&ClientMessage::ResizePane {
            id: agent_id,
            cols,
            rows,
        })
        .await
}

#[tauri::command]
async fn is_agent_alive(agent_id: String, state: State<'_, AppState>) -> Result<bool, String> {
    let daemon = state.daemon.clone();
    let pending = std::sync::Arc::clone(&state.pending_list);

    let (tx, rx) = oneshot::channel();
    pending.lock().unwrap().replace(tx);

    daemon.send(&ClientMessage::ListPanes).await?;

    let panes = rx.await.map_err(|_| "daemon 連線中斷".to_string())?;
    Ok(panes.iter().any(|p| p.id == agent_id && p.status == "running"))
}

#[tauri::command]
async fn list_panes(state: State<'_, AppState>) -> Result<Vec<PaneInfo>, String> {
    let daemon = state.daemon.clone();
    let pending = std::sync::Arc::clone(&state.pending_list);

    let (tx, rx) = oneshot::channel();
    pending.lock().unwrap().replace(tx);

    daemon.send(&ClientMessage::ListPanes).await?;

    rx.await.map_err(|_| "daemon 連線中斷".to_string())
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
    std::fs::write(
        &pending_path,
        serde_json::to_string_pretty(&pending).unwrap_or_default(),
    )
    .map_err(|e| e.to_string())
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
    // Ensure daemon is running (blocking — before Tauri starts)
    if let Err(e) = ensure_daemon_running() {
        eprintln!("Warning: 無法啟動 chatsh-daemon: {e}");
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let app_handle = app.handle().clone();
            let rt = tokio::runtime::Handle::current();

            // Connect to daemon (async, within Tauri's tokio runtime)
            let pending_spawns =
                std::sync::Arc::new(Mutex::new(HashMap::<String, oneshot::Sender<Result<(), String>>>::new()));
            let pending_list =
                std::sync::Arc::new(Mutex::new(None::<oneshot::Sender<Vec<PaneInfo>>>));

            let ps = std::sync::Arc::clone(&pending_spawns);
            let pl = std::sync::Arc::clone(&pending_list);

            let daemon_client = rt.block_on(async {
                match connect_daemon().await {
                    Ok(stream) => {
                        let (read_half, write_half) = stream.into_split();
                        spawn_reader_task(read_half, app_handle, ps, pl);
                        Some(DaemonClient {
                            writer: std::sync::Arc::new(tokio::sync::Mutex::new(write_half)),
                        })
                    }
                    Err(e) => {
                        eprintln!("無法連線到 daemon: {e}");
                        None
                    }
                }
            });

            if let Some(daemon) = daemon_client {
                app.manage(AppState {
                    daemon,
                    pending_spawns,
                    pending_list,
                });
            } else {
                // Fallback: create a dummy connection that will fail on use
                // This allows the app to start even if daemon isn't available
                eprintln!("Warning: 未連線到 daemon，PTY 功能無法使用");
                let (stream, _) = std::os::unix::net::UnixStream::pair().unwrap();
                stream.set_nonblocking(true).ok();
                let tokio_stream = rt.block_on(async {
                    tokio::net::UnixStream::from_std(stream).unwrap()
                });
                let (_, write_half) = tokio_stream.into_split();
                app.manage(AppState {
                    daemon: DaemonClient {
                        writer: std::sync::Arc::new(tokio::sync::Mutex::new(write_half)),
                    },
                    pending_spawns,
                    pending_list,
                });
            }

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
            list_panes,
        ])
        .run(tauri::generate_context!())
        .expect("Failed to launch Tauri app");
}
