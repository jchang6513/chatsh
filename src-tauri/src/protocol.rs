use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ── Client → Daemon ──

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ClientMessage {
    #[serde(rename = "spawn_pane")]
    SpawnPane {
        id: String,
        command: Vec<String>,
        cwd: String,
        #[serde(default)]
        env: HashMap<String, String>,
        #[serde(default = "default_cols")]
        cols: u16,
        #[serde(default = "default_rows")]
        rows: u16,
    },
    #[serde(rename = "attach_pane")]
    AttachPane { id: String },
    #[serde(rename = "write_pane")]
    WritePane { id: String, data: String },
    #[serde(rename = "resize_pane")]
    ResizePane { id: String, cols: u16, rows: u16 },
    #[serde(rename = "delete_pane")]
    DeletePane { id: String },
    #[serde(rename = "restart_pane")]
    RestartPane { id: String },
    #[serde(rename = "list_panes")]
    ListPanes,
}

fn default_cols() -> u16 {
    80
}
fn default_rows() -> u16 {
    24
}

// ── Daemon → Client ──

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ServerMessage {
    #[serde(rename = "pane_output")]
    PaneOutput { id: String, data: String },
    #[serde(rename = "pane_status")]
    PaneStatus { id: String, status: String },
    #[serde(rename = "pane_list")]
    PaneList { panes: Vec<PaneInfo> },
    #[serde(rename = "scrollback")]
    Scrollback { id: String, data: String },
    #[serde(rename = "pane_idle")]
    PaneIdle { id: String },
    #[serde(rename = "spawn_result")]
    SpawnResult {
        id: String,
        success: bool,
        #[serde(skip_serializing_if = "Option::is_none")]
        error: Option<String>,
    },
    #[serde(rename = "error")]
    Error { message: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaneInfo {
    pub id: String,
    pub command: Vec<String>,
    pub cwd: String,
    pub status: String,
}
