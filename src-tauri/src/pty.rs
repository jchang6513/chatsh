use base64::Engine;
use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};

const MAX_BUFFER: usize = 50 * 1024; // 50KB

#[allow(dead_code)]
struct PtySession {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child: Box<dyn portable_pty::Child + Send>,
    buffer: Arc<Mutex<Vec<u8>>>,
}

pub struct PtyManager {
    sessions: Arc<Mutex<HashMap<String, PtySession>>>,
    // buffer 獨立存放，讓 session 結束後仍可讀取
    buffers: Arc<Mutex<HashMap<String, Arc<Mutex<Vec<u8>>>>>>,
}

impl PtyManager {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
            buffers: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn spawn(
        &self,
        agent_id: &str,
        command: &[String],
        working_dir: &str,
        cols: u16,
        rows: u16,
        app_handle: AppHandle,
    ) -> Result<(), String> {
        if command.is_empty() {
            return Err("command 不能為空".to_string());
        }

        // 若已存在，先清除
        self.kill(agent_id)?;

        let pty_system = native_pty_system();

        let pair = pty_system
            .openpty(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("無法開啟 PTY: {e}"))?;

        // 展開 ~ 路徑
        let expanded_dir = if working_dir.starts_with('~') {
            let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
            working_dir.replacen('~', &home, 1)
        } else {
            working_dir.to_string()
        };

        // 若是 claude：cwd = user 的 workingDir，--add-dir 指向 agent 專屬目錄
        // 這樣每個 agent 的 CLAUDE.md 完全隔離，不互相干擾
        let (effective_working_dir, effective_command) =
            if command.first().map(|s| s.as_str()) == Some("claude") {
                let home = std::env::var("HOME").unwrap_or_default();
                let agent_dir = format!("{}/.chatsh/agents/{}", home, agent_id);
                std::fs::create_dir_all(&agent_dir).ok();
                let mut cmd = command.to_vec();
                cmd.push("--add-dir".to_string());
                cmd.push(agent_dir); // 只加 agent 自己的目錄，Claude 讀這裡的 CLAUDE.md
                (expanded_dir, cmd)  // cwd 是 user 設定的工作目錄
            } else {
                (expanded_dir, command.to_vec())
            };

        let mut cmd = CommandBuilder::new(&effective_command[0]);
        if effective_command.len() > 1 {
            cmd.args(&effective_command[1..]);
        }
        cmd.cwd(&effective_working_dir);

        // 繼承環境變數
        for (key, value) in std::env::vars() {
            cmd.env(key, value);
        }

        // 補充 PATH：確保常見 CLI 工具路徑都在（macOS App 啟動時 PATH 很少）
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

        let child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| format!("無法啟動程序: {e}"))?;

        let writer = pair
            .master
            .take_writer()
            .map_err(|e| format!("無法取得 writer: {e}"))?;

        let mut reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| format!("無法取得 reader: {e}"))?;

        // 建立或重用 buffer
        let buffer = {
            let mut bufs = self.buffers.lock().map_err(|e| e.to_string())?;
            let buf = bufs
                .entry(agent_id.to_string())
                .or_insert_with(|| Arc::new(Mutex::new(Vec::new())));
            // 清空舊內容（重新 spawn 時）
            if let Ok(mut b) = buf.lock() {
                b.clear();
            }
            Arc::clone(buf)
        };

        let session = PtySession {
            master: pair.master,
            writer,
            child,
            buffer: Arc::clone(&buffer),
        };

        self.sessions
            .lock()
            .map_err(|e| e.to_string())?
            .insert(agent_id.to_string(), session);

        // 啟動讀取執行緒，將 PTY 輸出推送到前端，同時寫入 buffer
        let event_name = format!("pty-output-{agent_id}");
        let sessions = self.sessions.clone();
        let aid = agent_id.to_string();

        std::thread::spawn(move || {
            let mut buf = [0u8; 4096];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        // 寫入 ring buffer
                        if let Ok(mut buf_lock) = buffer.lock() {
                            buf_lock.extend_from_slice(&buf[..n]);
                            if buf_lock.len() > MAX_BUFFER {
                                let excess = buf_lock.len() - MAX_BUFFER;
                                buf_lock.drain(..excess);
                            }
                        }

                        let data =
                            base64::engine::general_purpose::STANDARD.encode(&buf[..n]);
                        let _ = app_handle.emit(&event_name, data);
                    }
                    Err(_) => break,
                }
            }
            // 程序結束，emit exit 事件並從 sessions 中移除（buffer 保留）
            app_handle.emit(&format!("pty-exit-{}", aid), ()).ok();
            if let Ok(mut map) = sessions.lock() {
                map.remove(&aid);
            }
        });

        Ok(())
    }

    pub fn kill(&self, agent_id: &str) -> Result<(), String> {
        let mut sessions = self.sessions.lock().map_err(|e| e.to_string())?;
        if let Some(mut session) = sessions.remove(agent_id) {
            let _ = session.child.kill();
        }
        Ok(())
    }

    pub fn write(&self, agent_id: &str, data: &[u8]) -> Result<(), String> {
        let mut sessions = self.sessions.lock().map_err(|e| e.to_string())?;
        if let Some(session) = sessions.get_mut(agent_id) {
            session
                .writer
                .write_all(data)
                .map_err(|e| format!("寫入失敗: {e}"))?;
            session.writer.flush().map_err(|e| format!("flush 失敗: {e}"))?;
        }
        Ok(())
    }

    pub fn resize(&self, agent_id: &str, cols: u16, rows: u16) -> Result<(), String> {
        let sessions = self.sessions.lock().map_err(|e| e.to_string())?;
        if let Some(session) = sessions.get(agent_id) {
            session
                .master
                .resize(PtySize {
                    rows,
                    cols,
                    pixel_width: 0,
                    pixel_height: 0,
                })
                .map_err(|e| format!("resize 失敗: {e}"))?;
        }
        Ok(())
    }

    #[allow(dead_code)]
    pub fn get_buffer(&self, agent_id: &str) -> Result<String, String> {
        let bufs = self.buffers.lock().map_err(|e| e.to_string())?;
        if let Some(buffer) = bufs.get(agent_id) {
            let data = buffer.lock().map_err(|e| e.to_string())?;
            if data.is_empty() {
                return Ok(String::new());
            }
            Ok(base64::engine::general_purpose::STANDARD.encode(&*data))
        } else {
            Ok(String::new())
        }
    }

    pub fn is_alive(&self, agent_id: &str) -> bool {
        let sessions = self.sessions.lock().unwrap_or_else(|e| e.into_inner());
        sessions.contains_key(agent_id)
    }
}
