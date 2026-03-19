use base64::Engine;
use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};

struct PtySession {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child: Box<dyn portable_pty::Child + Send>,
}

pub struct PtyManager {
    sessions: Arc<Mutex<HashMap<String, PtySession>>>,
}

impl PtyManager {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
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

        let mut cmd = CommandBuilder::new(&command[0]);
        if command.len() > 1 {
            cmd.args(&command[1..]);
        }
        cmd.cwd(&expanded_dir);

        // 繼承環境變數
        for (key, value) in std::env::vars() {
            cmd.env(key, value);
        }
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

        let session = PtySession {
            master: pair.master,
            writer,
            child,
        };

        self.sessions
            .lock()
            .map_err(|e| e.to_string())?
            .insert(agent_id.to_string(), session);

        // 啟動讀取執行緒，將 PTY 輸出推送到前端
        let event_name = format!("pty-output-{agent_id}");
        let sessions = self.sessions.clone();
        let aid = agent_id.to_string();

        std::thread::spawn(move || {
            let mut buf = [0u8; 4096];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        let data = base64::engine::general_purpose::STANDARD.encode(&buf[..n]);
                        let _ = app_handle.emit(&event_name, data);
                    }
                    Err(_) => break,
                }
            }
            // 程序結束，從 sessions 中移除
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
}
