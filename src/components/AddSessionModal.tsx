import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Agent } from "../types";
import type { Template } from "../templates";
import { KNOWN_TOOLS } from "../templates";

interface Props {
  templates: Template[];
  onAdd: (agent: Agent) => void;
  onClose: () => void;
}

const mono = '"SF Mono", "Menlo", "Monaco", "Courier New", monospace';

const inputStyle: React.CSSProperties = {
  background: "var(--bg)",
  border: "1px solid var(--border)",
  padding: "8px 12px",
  fontSize: 12,
  color: "var(--fg)",
  outline: "none",
  fontFamily: mono,
  width: "100%",
  boxSizing: "border-box",
};

const btnBase: React.CSSProperties = {
  padding: "6px 12px",
  background: "transparent",
  border: "1px solid var(--border)",
  color: "var(--muted)",
  fontFamily: mono,
  fontSize: 11,
  cursor: "pointer",
};

type Mode = "choose" | "from-template" | "custom";

export default function AddSessionModal({ templates, onAdd, onClose }: Props) {
  const [mode, setMode] = useState<Mode>("choose");
  const [detectedIds, setDetectedIds] = useState<string[]>([]);

  // 自訂模式欄位
  const [name, setName] = useState("");
  const [command, setCommand] = useState("");
  const [workingDir, setWorkingDir] = useState("~");
  const [claudeMd, setClaudeMd] = useState("");

  // 從樣板模式
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [sessionName, setSessionName] = useState("");

  useEffect(() => {
    invoke<{ name: string; command: string; description: string }[]>("scan_available_agents")
      .then(list => setDetectedIds(
        list.map(a => KNOWN_TOOLS.find(t => t.command === a.command)?.id ?? a.command)
      ))
      .catch(() => {});
  }, []);

  const builtinTemplates = KNOWN_TOOLS.filter(t => detectedIds.includes(t.id));
  const userTemplates = templates.filter(t => !t.isBuiltin);
  const allTemplates = [
    ...builtinTemplates.map(t => ({
      id: t.id,
      name: t.name,
      command: t.command,
      workingDir: "~",
      description: t.description,
      isBuiltin: true,
    } as Template)),
    ...userTemplates,
  ];

  const handleFromTemplate = () => {
    if (!selectedTemplate) return;
    const id = Date.now().toString();
    const agent: Agent = {
      id,
      name: sessionName.trim() || selectedTemplate.name,
      emoji: "🤖",
      command: [selectedTemplate.command, ...(selectedTemplate.args ?? [])],
      workingDir: selectedTemplate.workingDir || "~",
      status: "offline",
    };
    if (selectedTemplate.command === "claude" && selectedTemplate.claudeMd) {
      invoke("write_file", {
        path: `~/.chatsh/agents/${id}/CLAUDE.md`,
        content: selectedTemplate.claudeMd,
      }).catch(() => {});
    }
    onAdd(agent);
  };

  const handleCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !command.trim()) return;
    const id = Date.now().toString();
    const agent: Agent = {
      id,
      name: name.trim(),
      emoji: "🤖",
      command: command.split(" ").filter(Boolean),
      workingDir: workingDir.trim() || "~",
      status: "offline",
    };
    if (command.split(" ")[0] === "claude" && claudeMd.trim()) {
      invoke("write_file", {
        path: `~/.chatsh/agents/${id}/CLAUDE.md`,
        content: claudeMd,
      }).catch(() => {});
    }
    onAdd(agent);
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={onClose}
    >
      <div
        style={{ width: 480, background: "var(--bg)", border: "1px solid var(--border)", borderTop: "2px solid var(--green)", fontFamily: mono }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
          <span style={{ fontSize: 10, color: "var(--green)", letterSpacing: "0.1em" }}>
            ─ {mode === "choose" ? "NEW SESSION" : mode === "from-template" ? "FROM TEMPLATE" : "CUSTOM"} ─
          </span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontFamily: mono, fontSize: 12 }}
            onMouseEnter={e => e.currentTarget.style.color = "var(--red)"}
            onMouseLeave={e => e.currentTarget.style.color = "var(--muted)"}
          >[×]</button>
        </div>

        <div style={{ padding: 20 }}>

          {/* CHOOSE MODE */}
          {mode === "choose" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>開啟方式：</div>

              <button
                onClick={() => setMode("from-template")}
                style={{
                  ...btnBase,
                  display: "flex", flexDirection: "column", gap: 4,
                  padding: 14, textAlign: "left",
                  border: "1px solid var(--border)",
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = "var(--green)"}
                onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}
              >
                <span style={{ color: "var(--fg)", fontSize: 12 }}>[從樣板開啟]</span>
                <span style={{ color: "var(--muted)", fontSize: 10 }}>從已偵測的 CLI 或自訂樣板建立 session</span>
              </button>

              <button
                onClick={() => setMode("custom")}
                style={{
                  ...btnBase,
                  display: "flex", flexDirection: "column", gap: 4,
                  padding: 14, textAlign: "left",
                  border: "1px dashed var(--border)",
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = "var(--green)"}
                onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}
              >
                <span style={{ color: "var(--fg)", fontSize: 12 }}>[直接輸入指令]</span>
                <span style={{ color: "var(--muted)", fontSize: 10 }}>自填指令，不存為樣板</span>
              </button>
            </div>
          )}

          {/* FROM TEMPLATE */}
          {mode === "from-template" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {allTemplates.length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", padding: "24px 0" }}>
                  未偵測到可用工具，請用「直接輸入指令」
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  {allTemplates.map(t => (
                    <button
                      key={t.id}
                      onClick={() => { setSelectedTemplate(t); setSessionName(t.name); }}
                      style={{
                        ...btnBase,
                        display: "flex", flexDirection: "column", gap: 3,
                        padding: 10, textAlign: "left",
                        borderColor: selectedTemplate?.id === t.id ? "var(--green)" : "var(--border)",
                        color: selectedTemplate?.id === t.id ? "var(--green)" : "var(--fg)",
                      }}
                      onMouseEnter={e => { if (selectedTemplate?.id !== t.id) e.currentTarget.style.borderColor = "var(--green)"; }}
                      onMouseLeave={e => { if (selectedTemplate?.id !== t.id) e.currentTarget.style.borderColor = "var(--border)"; }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{t.name}</span>
                        {t.isBuiltin && (
                          <span style={{ fontSize: 9, color: "var(--green)", border: "1px solid var(--green)", padding: "0 3px" }}>AUTO</span>
                        )}
                      </div>
                      <span style={{ fontSize: 10, color: "var(--muted)" }}>{t.description}</span>
                      <code style={{ fontSize: 10, color: "var(--muted)", opacity: 0.6 }}>{t.command}</code>
                    </button>
                  ))}
                </div>
              )}

              {selectedTemplate && (
                <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "var(--muted)" }}>
                  Session 名稱
                  <input
                    type="text"
                    value={sessionName}
                    onChange={e => setSessionName(e.target.value)}
                    style={inputStyle}
                    placeholder={selectedTemplate.name}
                    autoFocus
                    onFocus={e => e.currentTarget.style.borderColor = "var(--green)"}
                    onBlur={e => e.currentTarget.style.borderColor = "var(--border)"}
                  />
                </label>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                <button onClick={() => setMode("choose")} style={btnBase}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--green)"; e.currentTarget.style.color = "var(--green)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--muted)"; }}
                >[上一步]</button>
                <button
                  onClick={handleFromTemplate}
                  disabled={!selectedTemplate}
                  style={{ ...btnBase, borderColor: selectedTemplate ? "var(--green)" : "var(--border)", color: selectedTemplate ? "var(--green)" : "var(--muted)" }}
                  onMouseEnter={e => { if (selectedTemplate) { e.currentTarget.style.background = "var(--green)"; e.currentTarget.style.color = "var(--bg)"; } }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = selectedTemplate ? "var(--green)" : "var(--muted)"; }}
                >[開啟 Session]</button>
              </div>
            </div>
          )}

          {/* CUSTOM */}
          {mode === "custom" && (
            <form onSubmit={handleCustom} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "var(--muted)" }}>
                名稱
                <input type="text" value={name} onChange={e => setName(e.target.value)}
                  style={inputStyle} placeholder="例如：後端助手" autoFocus
                  onFocus={e => e.currentTarget.style.borderColor = "var(--green)"}
                  onBlur={e => e.currentTarget.style.borderColor = "var(--border)"} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "var(--muted)" }}>
                指令
                <input type="text" value={command} onChange={e => setCommand(e.target.value)}
                  style={inputStyle} placeholder="例如：claude 或 /bin/zsh 或 python3"
                  onFocus={e => e.currentTarget.style.borderColor = "var(--green)"}
                  onBlur={e => e.currentTarget.style.borderColor = "var(--border)"} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "var(--muted)" }}>
                工作目錄
                <input type="text" value={workingDir} onChange={e => setWorkingDir(e.target.value)}
                  style={inputStyle} placeholder="~"
                  onFocus={e => e.currentTarget.style.borderColor = "var(--green)"}
                  onBlur={e => e.currentTarget.style.borderColor = "var(--border)"} />
              </label>
              {command.split(" ")[0] === "claude" && (
                <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "var(--muted)" }}>
                  CLAUDE.md <span style={{ fontSize: 10 }}>（system prompt，選填）</span>
                  <textarea value={claudeMd} onChange={e => setClaudeMd(e.target.value)} rows={4}
                    placeholder="你是一個專注於後端的工程師..."
                    style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
                    onFocus={e => e.currentTarget.style.borderColor = "var(--green)"}
                    onBlur={e => e.currentTarget.style.borderColor = "var(--border)"} />
                </label>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                <button type="button" onClick={() => setMode("choose")} style={btnBase}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--green)"; e.currentTarget.style.color = "var(--green)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--muted)"; }}
                >[上一步]</button>
                <button type="submit" style={{ ...btnBase, borderColor: "var(--green)", color: "var(--green)" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "var(--green)"; e.currentTarget.style.color = "var(--bg)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--green)"; }}
                >[建立 Session]</button>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
