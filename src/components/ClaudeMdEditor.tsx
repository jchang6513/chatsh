import { MONO_FONT, onHoverGreen, onLeaveGreen } from "../ui"
import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Agent } from "../types";

interface Props {
  agent: Agent;
  onClose: () => void;
}

export default function ClaudeMdEditor({ agent, onClose }: Props) {
  const [content, setContent] = useState("");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  const filePath = `~/.chatsh/agents/${agent.id}/CLAUDE.md`;

  useEffect(() => {
    invoke<string>("read_file", { path: filePath })
      .then((c) => { setContent(c); setLoading(false); })
      .catch(() => { setContent(""); setLoading(false); });
  }, [filePath]);

  const handleSave = async () => {
    await invoke("write_file", { path: filePath, content }).catch(() => {});
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const mono: React.CSSProperties = {
    fontFamily: MONO_FONT,
  };

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100 }}
      />

      {/* Panel — slides in from right */}
      <div style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        width: 480,
        background: "var(--bg)",
        borderLeft: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        zIndex: 101,
        ...mono,
      }}>

        {/* Header */}
        <div style={{
          height: 36,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 12px",
          borderBottom: "1px solid var(--border)",
          borderTop: "2px solid var(--green)",
          flexShrink: 0,
          fontSize: 10,
          letterSpacing: "0.1em",
        }}>
          <span style={{ color: "var(--green)" }}>
            ─ CLAUDE.MD ─ <span style={{ color: "var(--muted)" }}>{agent.name.toUpperCase()}</span>
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            {saved && (
              <span style={{ color: "var(--green)", fontSize: 10 }}>[✓ SAVED]</span>
            )}
            <button
              onClick={handleSave}
              style={{
                background: "transparent",
                border: "1px solid var(--border)",
                color: "var(--muted)",
                ...mono,
                fontSize: 9,
                padding: "2px 8px",
                cursor: "pointer",
                letterSpacing: "0.05em",
              }}
              onMouseEnter={onHoverGreen}
              onMouseLeave={onLeaveGreen}
            >
              [SAVE]
            </button>
            <button
              onClick={onClose}
              style={{
                background: "transparent",
                border: "1px solid var(--border)",
                color: "var(--muted)",
                ...mono,
                fontSize: 9,
                padding: "2px 8px",
                cursor: "pointer",
                letterSpacing: "0.05em",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--red)"; e.currentTarget.style.color = "var(--red)"; }}
              onMouseLeave={onLeaveGreen}
            >
              [×]
            </button>
          </div>
        </div>

        {/* Path */}
        <div style={{
          padding: "4px 12px",
          fontSize: 9,
          color: "var(--muted)",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
          letterSpacing: "0.05em",
        }}>
          {filePath}
        </div>

        {/* Textarea */}
        <textarea
          value={loading ? "// loading..." : content}
          onChange={(e) => setContent(e.target.value)}
          disabled={loading}
          placeholder={"# System Prompt\n\nYou are a focused React frontend engineer...\n\nDefine the role, habits, and constraints here."}
          style={{
            flex: 1,
            background: "var(--bg)",
            color: "var(--fg)",
            border: "none",
            outline: "none",
            resize: "none",
            padding: "12px",
            ...mono,
            fontSize: 12,
            lineHeight: 1.7,
            caretColor: "var(--green)",
          }}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "s") {
              e.preventDefault();
              handleSave();
            }
          }}
        />

        {/* Footer */}
        <div style={{
          height: 22,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 12px",
          borderTop: "1px solid var(--border)",
          flexShrink: 0,
          fontSize: 9,
          color: "var(--muted)",
          letterSpacing: "0.05em",
        }}>
          <span>⌘S to save</span>
          <span>This CLAUDE.md is agent-specific and does not affect the project directory</span>
        </div>
      </div>
    </>
  );
}
