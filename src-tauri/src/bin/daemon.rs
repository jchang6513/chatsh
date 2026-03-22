use base64::Engine;

use chatsh_lib::protocol::*;
use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use std::collections::HashMap;
use std::io::{Read as IoRead, Write as IoWrite};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::UnixListener;
use tokio::sync::{broadcast, mpsc};

const MAX_SCROLLBACK: usize = 2 * 1024 * 1024; // 2MB
const BROADCAST_CAP: usize = 4096;
const IDLE_MS: u64 = 500;
const IDLE_POLL_MS: u64 = 100;
const PROCESS_MONITOR_INTERVAL_MS: u64 = 500;

// ── Paths ──

fn chatsh_dir() -> String {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".into());
    format!("{}/.chatsh", home)
}

fn sock_path() -> String {
    format!("{}/daemon.sock", chatsh_dir())
}

fn state_path() -> String {
    format!("{}/state.json", chatsh_dir())
}

// ── Persisted state ──

#[derive(serde::Serialize, serde::Deserialize)]
struct PersistedState {
    panes: Vec<PersistedPane>,
}

#[derive(serde::Serialize, serde::Deserialize)]
struct PersistedPane {
    id: String,
    command: Vec<String>,
    cwd: String,
    status: String,
    pid: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    parent_pane_id: Option<String>,
    #[serde(default = "default_pane_type")]
    pane_type: String,
    #[serde(default)]
    created_at: u64,  // unix timestamp ms, for ordering
}

fn default_pane_type() -> String {
    "agent".to_string()
}

// ── Pane ──

struct Pane {
    id: String,
    command: Vec<String>,
    cwd: String,
    status: String, // "running" | "stopped"
    writer: Option<Box<dyn IoWrite + Send>>,
    master: Option<Box<dyn MasterPty + Send>>,
    scrollback: Arc<Mutex<Vec<u8>>>,
    output_tx: broadcast::Sender<ServerMessage>,
    shutdown: Arc<AtomicBool>,
    child_pid: Option<u32>,
    parent_pane_id: Option<String>,
    pane_type: String,
    created_at: u64,
}

// ── Daemon ──

struct Daemon {
    panes: Arc<Mutex<HashMap<String, Pane>>>,
}

impl Daemon {
    fn new() -> Self {
        Self {
            panes: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    fn spawn_pane(
        &self,
        id: String,
        command: Vec<String>,
        cwd: String,
        _env: HashMap<String, String>,
        cols: u16,
        rows: u16,
        parent_pane_id: Option<String>,
        pane_type: Option<String>,
    ) -> Result<bool, String> {
        if command.is_empty() {
            return Err("command 不能為空".into());
        }

        // If pane already exists and is running, don't replace
        {
            let panes = self.panes.lock().unwrap();
            if let Some(pane) = panes.get(&id) {
                if pane.status == "running" {
                    return Ok(false); // already running
                }
            }
        }

        // Remove any stopped pane with same id
        {
            let mut panes = self.panes.lock().unwrap();
            if let Some(old) = panes.remove(&id) {
                old.shutdown.store(true, Ordering::Relaxed);
            }
        }

        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("無法開啟 PTY: {e}"))?;

        // Expand ~
        let expanded_cwd = if cwd.starts_with('~') {
            let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".into());
            cwd.replacen('~', &home, 1)
        } else {
            cwd.clone()
        };

        // Build command with agent-specific setup
        let (effective_cwd, effective_cmd) =
            build_effective_command(&id, &command, &expanded_cwd);

        let mut cmd = CommandBuilder::new(&effective_cmd[0]);
        if effective_cmd.len() > 1 {
            cmd.args(&effective_cmd[1..]);
        }
        cmd.cwd(&effective_cwd);

        // Inherit env
        for (key, value) in std::env::vars() {
            cmd.env(key, value);
        }

        // Augment PATH
        let home = std::env::var("HOME").unwrap_or_default();
        let current_path = std::env::var("PATH").unwrap_or_default();
        let extra_paths = [
            format!("{}/.local/bin", home),
            format!("{}/.local/share/mise/shims", home),
            "/opt/homebrew/bin".to_string(),
            "/opt/homebrew/sbin".to_string(),
            "/usr/local/bin".to_string(),
            "/usr/bin".to_string(),
            "/bin".to_string(),
        ];
        let mut path_parts: Vec<&str> = current_path.split(':').collect();
        for p in extra_paths.iter() {
            if !path_parts.contains(&p.as_str()) {
                path_parts.insert(0, p.as_str());
            }
        }
        cmd.env("PATH", path_parts.join(":"));
        cmd.env("TERM", "xterm-256color");
        cmd.env("LANG", "en_US.UTF-8");
        cmd.env("LC_ALL", "en_US.UTF-8");
        cmd.env("LC_CTYPE", "UTF-8");

        let child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| format!("無法啟動程序: {e}"))?;

        let child_pid = child.process_id();

        let writer = pair
            .master
            .take_writer()
            .map_err(|e| format!("無法取得 writer: {e}"))?;
        let mut reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| format!("無法取得 reader: {e}"))?;

        let (output_tx, _) = broadcast::channel(BROADCAST_CAP);
        let scrollback: Arc<Mutex<Vec<u8>>> = Arc::new(Mutex::new(Vec::new()));
        let shutdown = Arc::new(AtomicBool::new(false));

        let resolved_pane_type = pane_type.unwrap_or_else(|| "agent".to_string());
        let now_ms = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;
        let pane = Pane {
            id: id.clone(),
            command: command.clone(),
            cwd: cwd.clone(),
            status: "running".to_string(),
            writer: Some(writer),
            master: Some(pair.master),
            scrollback: Arc::clone(&scrollback),
            output_tx: output_tx.clone(),
            shutdown: Arc::clone(&shutdown),
            child_pid,
            parent_pane_id: parent_pane_id.clone(),
            pane_type: resolved_pane_type,
            created_at: now_ms,
        };

        self.panes.lock().unwrap().insert(id.clone(), pane);

        // ── Idle detection thread ──
        let idle_shutdown = Arc::clone(&shutdown);
        let idle_tx = output_tx.clone();
        let idle_id = id.clone();
        let last_output = Arc::new(AtomicU64::new(0));
        let last_output_idle = Arc::clone(&last_output);

        std::thread::spawn(move || {
            while !idle_shutdown.load(Ordering::Relaxed) {
                std::thread::sleep(std::time::Duration::from_millis(IDLE_POLL_MS));
                let ts = last_output_idle.load(Ordering::Relaxed);
                if ts == 0 {
                    continue;
                }
                let now = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis() as u64;
                if now.saturating_sub(ts) >= IDLE_MS {
                    let _ = idle_tx.send(ServerMessage::PaneIdle {
                        id: idle_id.clone(),
                    });
                    last_output_idle.store(0, Ordering::Relaxed);
                }
            }
        });

        // ── PTY reader thread ──
        let panes_ref = Arc::clone(&self.panes);
        let pane_id = id.clone();
        let sb = Arc::clone(&scrollback);
        let tx = output_tx.clone();
        let reader_shutdown = Arc::clone(&shutdown);

        std::thread::spawn(move || {
            let mut buf = [0u8; 4096];
            let mut child = child;
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        // Scrollback
                        if let Ok(mut s) = sb.lock() {
                            s.extend_from_slice(&buf[..n]);
                            if s.len() > MAX_SCROLLBACK {
                                let excess = s.len() - MAX_SCROLLBACK;
                                s.drain(..excess);
                            }
                        }
                        // Broadcast
                        let data =
                            base64::engine::general_purpose::STANDARD.encode(&buf[..n]);
                        let _ = tx.send(ServerMessage::PaneOutput {
                            id: pane_id.clone(),
                            data,
                        });
                        // Idle timestamp
                        let now = std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .unwrap_or_default()
                            .as_millis() as u64;
                        last_output.store(now, Ordering::Relaxed);
                    }
                    Err(_) => break,
                }
            }

            // Process ended — reap child
            let _ = child.wait();
            reader_shutdown.store(true, Ordering::Relaxed);

            // Update status (only if pane still belongs to us)
            if let Ok(mut map) = panes_ref.lock() {
                if let Some(pane) = map.get_mut(&pane_id) {
                    if Arc::ptr_eq(&pane.scrollback, &sb) {
                        pane.status = "stopped".to_string();
                        pane.writer = None;
                        pane.master = None;
                    }
                }
            }
            let _ = tx.send(ServerMessage::PaneStatus {
                id: pane_id.clone(),
                status: "stopped".to_string(),
            });
            save_state_from_panes(&panes_ref);
        });

        self.save_state();
        Ok(true) // newly spawned
    }

    fn write_pane(&self, id: &str, data: &str) -> Result<(), String> {
        let decoded = base64::engine::general_purpose::STANDARD
            .decode(data)
            .map_err(|e| format!("base64 decode 失敗: {e}"))?;
        let mut panes = self.panes.lock().unwrap();
        if let Some(pane) = panes.get_mut(id) {
            if let Some(ref mut writer) = pane.writer {
                writer
                    .write_all(&decoded)
                    .map_err(|e| format!("寫入失敗: {e}"))?;
                writer.flush().map_err(|e| format!("flush 失敗: {e}"))?;
            } else {
                return Err("pane 已停止".into());
            }
        } else {
            return Err(format!("pane {} 不存在", id));
        }
        Ok(())
    }

    fn resize_pane(&self, id: &str, cols: u16, rows: u16) -> Result<(), String> {
        let panes = self.panes.lock().unwrap();
        if let Some(pane) = panes.get(id) {
            if let Some(ref master) = pane.master {
                master
                    .resize(PtySize {
                        rows,
                        cols,
                        pixel_width: 0,
                        pixel_height: 0,
                    })
                    .map_err(|e| format!("resize 失敗: {e}"))?;
            }
        }
        Ok(())
    }

    fn delete_pane(&self, id: &str) -> Result<(), String> {
        let removed = {
            let mut panes = self.panes.lock().unwrap();
            panes.remove(id)
        };
        if let Some(pane) = removed {
            pane.shutdown.store(true, Ordering::Relaxed);
            let _ = pane.output_tx.send(ServerMessage::PaneStatus {
                id: id.to_string(),
                status: "deleted".to_string(),
            });
            // writer/master drop → PTY close → child SIGHUP
        }
        self.save_state();
        Ok(())
    }

    fn restart_pane(&self, id: &str) -> Result<(), String> {
        let (command, cwd, child_pid, parent_pane_id, pane_type) = {
            let panes = self.panes.lock().unwrap();
            if let Some(pane) = panes.get(id) {
                (pane.command.clone(), pane.cwd.clone(), pane.child_pid, pane.parent_pane_id.clone(), pane.pane_type.clone())
            } else {
                return Err(format!("pane {} 不存在", id));
            }
        };

        // Kill old process
        if let Some(pid) = child_pid {
            unsafe {
                libc::kill(pid as i32, libc::SIGKILL);
            }
        }

        // Remove old pane
        {
            let mut panes = self.panes.lock().unwrap();
            if let Some(old) = panes.remove(id) {
                old.shutdown.store(true, Ordering::Relaxed);
            }
        }

        // Brief delay for cleanup
        std::thread::sleep(std::time::Duration::from_millis(50));

        // Respawn with same id
        self.spawn_pane(id.to_string(), command, cwd, HashMap::new(), 80, 24, parent_pane_id, Some(pane_type))
            .map(|_| ())
    }

    fn list_panes(&self) -> Vec<PaneInfo> {
        let panes = self.panes.lock().unwrap();
        let mut list: Vec<PaneInfo> = panes
            .values()
            .map(|p| PaneInfo {
                id: p.id.clone(),
                command: p.command.clone(),
                cwd: p.cwd.clone(),
                status: p.status.clone(),
                parent_pane_id: p.parent_pane_id.clone(),
                pane_type: p.pane_type.clone(),
                created_at: p.created_at,
            })
            .collect();
        // Sort by creation time so sidebar order is stable across restarts
        list.sort_by_key(|p| p.created_at);
        list
    }

    fn attach_pane(&self, id: &str) -> Option<(Vec<u8>, String, broadcast::Receiver<ServerMessage>)> {
        let panes = self.panes.lock().unwrap();
        panes.get(id).map(|pane| {
            let scrollback = pane.scrollback.lock().unwrap().clone();
            let status = pane.status.clone();
            let rx = pane.output_tx.subscribe();
            (scrollback, status, rx)
        })
    }

    fn save_state(&self) {
        save_state_from_panes(&self.panes);
    }

    fn load_state(&self) {
        let path = state_path();
        if !std::path::Path::new(&path).exists() {
            return;
        }
        let content = match std::fs::read_to_string(&path) {
            Ok(c) => c,
            Err(_) => return,
        };
        let state: PersistedState = match serde_json::from_str(&content) {
            Ok(s) => s,
            Err(_) => return,
        };

        let mut panes = self.panes.lock().unwrap();
        for pp in state.panes {
            // Check if process is still alive
            let alive = pp.pid.map_or(false, |pid| {
                unsafe { libc::kill(pid as i32, 0) == 0 }
            });

            let (output_tx, _) = broadcast::channel(BROADCAST_CAP);
            let pane = Pane {
                id: pp.id.clone(),
                command: pp.command,
                cwd: pp.cwd,
                status: if alive {
                    "running".to_string()
                } else {
                    "stopped".to_string()
                },
                writer: None,
                master: None,
                scrollback: Arc::new(Mutex::new(Vec::new())),
                output_tx,
                shutdown: Arc::new(AtomicBool::new(false)),
                child_pid: pp.pid,
                parent_pane_id: pp.parent_pane_id,
                pane_type: pp.pane_type,
                created_at: pp.created_at,
            };
            panes.insert(pp.id, pane);
        }
    }
}

// ── Helpers ──

fn build_effective_command(
    agent_id: &str,
    command: &[String],
    expanded_cwd: &str,
) -> (String, Vec<String>) {
    let home = std::env::var("HOME").unwrap_or_default();
    let agent_dir = format!("{}/.chatsh/agents/{}", home, agent_id);

    match command.first().map(|s| s.as_str()) {
        Some("claude") => {
            std::fs::create_dir_all(&agent_dir).ok();
            let claude_md = format!("{}/CLAUDE.md", agent_dir);
            let mut cmd = command.to_vec();
            if std::path::Path::new(&claude_md).exists() {
                if let Ok(content) = std::fs::read_to_string(&claude_md) {
                    let trimmed = content.trim().to_string();
                    if !trimmed.is_empty() {
                        cmd.push("--append-system-prompt".to_string());
                        cmd.push(trimmed);
                    }
                }
            }
            (expanded_cwd.to_string(), cmd)
        }
        Some("gemini") => {
            std::fs::create_dir_all(&agent_dir).ok();
            let gemini_md = format!("{}/GEMINI.md", agent_dir);
            let has_prompt = std::path::Path::new(&gemini_md).exists()
                && std::fs::read_to_string(&gemini_md)
                    .map(|s| !s.trim().is_empty())
                    .unwrap_or(false);
            if has_prompt {
                (agent_dir, command.to_vec())
            } else {
                (expanded_cwd.to_string(), command.to_vec())
            }
        }
        Some("codex") => {
            std::fs::create_dir_all(&agent_dir).ok();
            let agents_md = format!("{}/AGENTS.md", agent_dir);
            let has_prompt = std::path::Path::new(&agents_md).exists()
                && std::fs::read_to_string(&agents_md)
                    .map(|s| !s.trim().is_empty())
                    .unwrap_or(false);
            if has_prompt {
                (agent_dir, command.to_vec())
            } else {
                (expanded_cwd.to_string(), command.to_vec())
            }
        }
        _ => (expanded_cwd.to_string(), command.to_vec()),
    }
}

fn save_state_from_panes(panes: &Arc<Mutex<HashMap<String, Pane>>>) {
    let panes = match panes.lock() {
        Ok(p) => p,
        Err(_) => return,
    };
    let persisted = PersistedState {
        panes: panes
            .values()
            .map(|p| PersistedPane {
                id: p.id.clone(),
                command: p.command.clone(),
                cwd: p.cwd.clone(),
                status: p.status.clone(),
                pid: p.child_pid,
                parent_pane_id: p.parent_pane_id.clone(),
                pane_type: p.pane_type.clone(),
                created_at: p.created_at,
            })
            .collect(),
    };
    let dir = chatsh_dir();
    std::fs::create_dir_all(&dir).ok();
    let json = serde_json::to_string_pretty(&persisted).unwrap_or_default();
    std::fs::write(state_path(), json).ok();
}

// ── Client handler ──

async fn handle_client(stream: tokio::net::UnixStream, daemon: Arc<Daemon>) {
    let (read_half, write_half) = stream.into_split();
    let mut lines = BufReader::new(read_half).lines();

    let (msg_tx, mut msg_rx) = mpsc::unbounded_channel::<ServerMessage>();

    // Writer task
    let mut writer = write_half;
    let write_task = tokio::spawn(async move {
        while let Some(msg) = msg_rx.recv().await {
            let mut json = serde_json::to_string(&msg).unwrap_or_default();
            json.push('\n');
            if writer.write_all(json.as_bytes()).await.is_err() {
                break;
            }
        }
    });

    // Per-pane subscription tasks (pane_id → task handle)
    let mut sub_handles: HashMap<String, tokio::task::JoinHandle<()>> = HashMap::new();

    while let Ok(Some(line)) = lines.next_line().await {
        if line.trim().is_empty() {
            continue;
        }

        let msg: ClientMessage = match serde_json::from_str(&line) {
            Ok(m) => m,
            Err(e) => {
                let _ = msg_tx.send(ServerMessage::Error {
                    message: e.to_string(),
                });
                continue;
            }
        };

        match msg {
            ClientMessage::SpawnPane {
                id,
                command,
                cwd,
                env,
                cols,
                rows,
                parent_pane_id,
                pane_type,
            } => match daemon.spawn_pane(id.clone(), command, cwd, env, cols, rows, parent_pane_id, pane_type) {
                Ok(newly_spawned) => {
                    let _ = msg_tx.send(ServerMessage::SpawnResult {
                        id,
                        success: true,
                        error: if newly_spawned {
                            None
                        } else {
                            Some("already_running".into())
                        },
                    });
                }
                Err(e) => {
                    let _ = msg_tx.send(ServerMessage::SpawnResult {
                        id,
                        success: false,
                        error: Some(e),
                    });
                }
            },

            ClientMessage::AttachPane { id } => {
                // Cancel old subscription for this pane (idempotent)
                if let Some(h) = sub_handles.remove(&id) {
                    h.abort();
                }

                match daemon.attach_pane(&id) {
                    Some((scrollback_data, status, rx)) => {
                        // Send scrollback (append SGR reset to clear stale color state)
                        if !scrollback_data.is_empty() {
                            let mut payload = scrollback_data.clone();
                            // Append reset to neutralize any trailing color/background state from TUI
                            payload.extend_from_slice(b"\x1b[0m");
                            let data = base64::engine::general_purpose::STANDARD
                                .encode(&payload);
                            let _ = msg_tx.send(ServerMessage::Scrollback {
                                id: id.clone(),
                                data,
                            });
                        }
                        // Send current status
                        let _ = msg_tx.send(ServerMessage::PaneStatus {
                            id: id.clone(),
                            status,
                        });
                        // Forward broadcast → client
                        let tx = msg_tx.clone();
                        let handle = tokio::spawn(async move {
                            let mut rx = rx;
                            loop {
                                match rx.recv().await {
                                    Ok(msg) => {
                                        if tx.send(msg).is_err() {
                                            break;
                                        }
                                    }
                                    Err(broadcast::error::RecvError::Lagged(_)) => continue,
                                    Err(broadcast::error::RecvError::Closed) => break,
                                }
                            }
                        });
                        sub_handles.insert(id, handle);
                    }
                    None => {
                        let _ = msg_tx.send(ServerMessage::Error {
                            message: format!("pane {} 不存在", id),
                        });
                    }
                }
            }

            ClientMessage::WritePane { id, data } => {
                if let Err(e) = daemon.write_pane(&id, &data) {
                    let _ = msg_tx.send(ServerMessage::Error { message: e });
                }
            }

            ClientMessage::ResizePane { id, cols, rows } => {
                if let Err(e) = daemon.resize_pane(&id, cols, rows) {
                    let _ = msg_tx.send(ServerMessage::Error { message: e });
                }
            }

            ClientMessage::DeletePane { id } => {
                if let Some(h) = sub_handles.remove(&id) {
                    h.abort();
                }
                if let Err(e) = daemon.delete_pane(&id) {
                    let _ = msg_tx.send(ServerMessage::Error { message: e });
                }
            }

            ClientMessage::RestartPane { id } => {
                if let Some(h) = sub_handles.remove(&id) {
                    h.abort();
                }
                if let Err(e) = daemon.restart_pane(&id) {
                    let _ = msg_tx.send(ServerMessage::Error { message: e });
                }
            }

            ClientMessage::ListPanes => {
                let panes = daemon.list_panes();
                let _ = msg_tx.send(ServerMessage::PaneList { panes });
            }
        }
    }

    // Client disconnected
    drop(msg_tx);
    for (_, h) in sub_handles {
        h.abort();
    }
    let _ = write_task.await;
}

// ── Process monitor ──
// 定期檢查所有 running pane 的 PID 是否還存活。
// 當外部 kill process 且 PTY reader 未偵測到時，由此補救。

fn start_process_monitor(panes: Arc<Mutex<HashMap<String, Pane>>>) {
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(std::time::Duration::from_millis(PROCESS_MONITOR_INTERVAL_MS)).await;

            let dead_panes: Vec<(String, broadcast::Sender<ServerMessage>)> = {
                let panes_guard = match panes.lock() {
                    Ok(p) => p,
                    Err(_) => continue,
                };
                eprintln!("[monitor] checking {} panes", panes_guard.len());
                panes_guard
                    .iter()
                    .filter(|(id, pane)| {
                        if pane.status != "running" {
                            return false;
                        }
                        if let Some(pid) = pane.child_pid {
                            unsafe {
                                let ret = libc::kill(pid as i32, 0);
                                if ret == 0 {
                                    // process alive
                                    false
                                } else {
                                    let err = *libc::__error();
                                    let is_dead = err == libc::ESRCH; // No such process
                                    eprintln!("[monitor] pane {} pid={} kill_ret={} errno={} is_dead={}", id, pid, ret, err, is_dead);
                                    is_dead
                                }
                            }
                        } else {
                            false
                        }
                    })
                    .map(|(id, pane)| (id.clone(), pane.output_tx.clone()))
                    .collect()
            };

            eprintln!("[monitor] found {} dead panes", dead_panes.len());

            if dead_panes.is_empty() {
                continue;
            }

            {
                let mut panes_guard = match panes.lock() {
                    Ok(p) => p,
                    Err(_) => continue,
                };
                for (id, tx) in &dead_panes {
                    if let Some(pane) = panes_guard.get_mut(id) {
                        if pane.status == "running" {
                            pane.status = "stopped".to_string();
                            pane.writer = None;
                            pane.master = None;
                            let _ = tx.send(ServerMessage::PaneStatus {
                                id: id.clone(),
                                status: "stopped".to_string(),
                            });
                        }
                    }
                }
            }

            save_state_from_panes(&panes);
        }
    });
}

// ── Main ──

#[tokio::main]
async fn main() {
    // Ignore SIGPIPE
    unsafe {
        libc::signal(libc::SIGPIPE, libc::SIG_IGN);
    }

    let dir = chatsh_dir();
    std::fs::create_dir_all(&dir).ok();

    let sock = sock_path();

    // Check if already running
    if std::path::Path::new(&sock).exists() {
        match tokio::net::UnixStream::connect(&sock).await {
            Ok(_) => {
                eprintln!("chatsh-daemon 已在執行中");
                std::process::exit(0);
            }
            Err(_) => {
                // Stale socket
                std::fs::remove_file(&sock).ok();
            }
        }
    }

    let listener = UnixListener::bind(&sock).expect("無法綁定 Unix socket");
    // Restrict socket access to owner only (0600)
    std::fs::set_permissions(&sock, std::os::unix::fs::PermissionsExt::from_mode(0o600)).ok();
    eprintln!("chatsh-daemon 啟動：{}", sock);

    let daemon = Arc::new(Daemon::new());
    daemon.load_state();

    // 啟動 process 監控背景任務
    start_process_monitor(Arc::clone(&daemon.panes));

    // Graceful shutdown handler
    let sock_cleanup = sock.clone();
    let daemon_save = Arc::clone(&daemon);
    tokio::spawn(async move {
        let mut sigterm =
            tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()).unwrap();
        let mut sigint =
            tokio::signal::unix::signal(tokio::signal::unix::SignalKind::interrupt()).unwrap();
        tokio::select! {
            _ = sigterm.recv() => {}
            _ = sigint.recv() => {}
        }
        eprintln!("chatsh-daemon 正在關閉...");
        daemon_save.save_state();
        std::fs::remove_file(&sock_cleanup).ok();
        std::process::exit(0);
    });

    loop {
        match listener.accept().await {
            Ok((stream, _)) => {
                let d = Arc::clone(&daemon);
                tokio::spawn(handle_client(stream, d));
            }
            Err(e) => {
                eprintln!("accept 錯誤: {e}");
            }
        }
    }
}
