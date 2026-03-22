import { useRef } from "react"
import CloseButton from "./ui/CloseButton"
import FolderButton from "./ui/FolderButton"
import { MONO_FONT, onHoverGreen, onLeaveGreen, onFocusInput, onBlurInput, onHoverBorder, onLeaveBorder } from "../ui"
import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Agent } from "../types";
import type { Template } from "../templates";
import { KNOWN_TOOLS, addTemplate } from "../templates";


interface Props {
  templates: Template[];
  onAdd: (agent: Agent) => void;
  onAddTemplate?: (t: Template) => void;
  onClose: () => void;
}

const mono = MONO_FONT;

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

const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  fontSize: 11,
  color: "var(--muted)",
};

type Mode = "choose" | "from-template" | "custom";

// which commands support system prompt and their filenames
const SYSTEM_PROMPT_SUPPORT: Record<string, { label: string; filename: string }> = {
  claude:  { label: "CLAUDE.md",  filename: "CLAUDE.md" },
  gemini:  { label: "GEMINI.md",  filename: "GEMINI.md" },
  codex:   { label: "AGENTS.md",  filename: "AGENTS.md" },
}

function getSystemPromptInfo(command: string) {
  const cmd = command.split(" ")[0].split("/").pop() ?? ""
  return SYSTEM_PROMPT_SUPPORT[cmd] ?? null
}

async function writeSystemPrompt(agentId: string, command: string, content: string) {
  const info = getSystemPromptInfo(command)
  if (!info || !content.trim()) return
  const path = `~/.chatsh/agents/${agentId}/${info.filename}`
  await invoke("write_file", { path, content }).catch(() => {})
}

export default function AddPaneModal({ templates, onAdd, onAddTemplate, onClose }: Props) {
  const [mode, setMode] = useState<Mode>("choose");
  const [templateStep, setTemplateStep] = useState<1 | 2>(1);
  const [detectedIds, setDetectedIds] = useState<string[]>([]);

  // from template
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [sessionName, setSessionName] = useState("");
  const [templateWorkingDir, setTemplateWorkingDir] = useState("~");
  const [templateSystemPrompt, setTemplateSystemPrompt] = useState("");
  const [showNewTemplatForm, setShowNewTemplateForm] = useState(false);
  const [newTpl, setNewTpl] = useState({ name: "", command: "", workingDir: "~", description: "" });

  // custom
  const [name, setName] = useState("");
  const [command, setCommand] = useState("");
  const [workingDir, setWorkingDir] = useState("~");
  const [systemPrompt, setSystemPrompt] = useState("");

  useEffect(() => {
    invoke<{ name: string; command: string; description: string }[]>("scan_available_agents")
      .then(list => setDetectedIds(
        list.map(a => KNOWN_TOOLS.find(t => t.command === a.command)?.id ?? a.command)
      ))
      .catch(() => {})
  }, [])

  const hiddenBuiltins = new Set<string>(JSON.parse(localStorage.getItem("chatsh_hidden_builtins") ?? "[]"))
  const builtinTemplates = KNOWN_TOOLS.filter(t => detectedIds.includes(t.id) && !hiddenBuiltins.has(t.id))
  const userTemplates = templates.filter(t => !t.isBuiltin)
  const allTemplates = [
    ...builtinTemplates.map(t => ({
      id: t.id, name: t.name, command: t.command,
      workingDir: "~", description: t.description, isBuiltin: true,
    } as Template)),
    ...userTemplates,
  ]

  const handleSelectTemplate = (t: Template) => {
    setSelectedTemplate(t)
    setSessionName(t.name)
    setTemplateWorkingDir(t.workingDir || "~")
    setTemplateSystemPrompt("")
  }

  const submittingRef = useRef(false)
  const handleFromTemplate = async () => {
    if (!selectedTemplate) return
    if (submittingRef.current) return
    submittingRef.current = true
    const id = Date.now().toString()
    const agent: Agent = {
      id,
      name: sessionName.trim() || selectedTemplate.name,
      emoji: "🤖",
      command: [selectedTemplate.command, ...(selectedTemplate.args ?? [])],
      workingDir: templateWorkingDir.trim() || "~",
      status: "offline",
    }
    await writeSystemPrompt(id, selectedTemplate.command, templateSystemPrompt)
    onAdd(agent)
  }

  const handleCustom = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !command.trim()) return
    const id = Date.now().toString()
    const agent: Agent = {
      id,
      name: name.trim(),
      emoji: "🤖",
      command: command.split(" ").filter(Boolean),
      workingDir: workingDir.trim() || "~",
      status: "offline",
    }
    await writeSystemPrompt(id, command, systemPrompt)
    onAdd(agent)
  }

  const templatePromptInfo = selectedTemplate ? getSystemPromptInfo(selectedTemplate.command) : null
  const customPromptInfo = getSystemPromptInfo(command)

  const onFocusInput = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    e.currentTarget.style.borderColor = "var(--green)"
  const onBlurInput = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    (e.currentTarget.style.borderColor = "var(--border)")

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={onClose}
    >
      <div
        style={{ width: 520, maxHeight: "60vh", display: "flex", flexDirection: "column", background: "var(--bg)", border: "1px solid var(--border)", borderTop: "2px solid var(--green)", fontFamily: mono }}
        onClick={e => e.stopPropagation()}
        onKeyDown={e => {
          if (e.key === "Escape") { onClose(); return }
          if (e.key === "Enter" && mode === "from-template" && selectedTemplate && !showNewTemplatForm) {
            e.preventDefault()
            handleFromTemplate()
          }
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <span style={{ fontSize: 10, color: "var(--green)", letterSpacing: "0.1em" }}>
            ─ {mode === "choose" ? "NEW PANE" : mode === "from-template" ? (templateStep === 1 ? "FROM TEMPLATE" : "CONFIGURE PANE") : "CUSTOM"} ─
          </span>
          <CloseButton onClose={onClose} />
        </div>

        <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>

          {/* CHOOSE */}
          {mode === "choose" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>Choose how to open:</div>
              <button onClick={() => { setMode("from-template"); setTemplateStep(1); }} style={{ ...btnBase, display: "flex", flexDirection: "column", gap: 4, padding: 14, textAlign: "left", border: "1px solid var(--border)" }}
                onMouseEnter={onHoverBorder}
                onMouseLeave={onLeaveBorder}
              >
                <span style={{ color: "var(--fg)", fontSize: 12 }}>[From Template]</span>
                <span style={{ color: "var(--muted)", fontSize: 10 }}>Open Pane from template</span>
              </button>
              <button onClick={() => setMode("custom")} style={{ ...btnBase, display: "flex", flexDirection: "column", gap: 4, padding: 14, textAlign: "left", border: "1px dashed var(--border)" }}
                onMouseEnter={onHoverBorder}
                onMouseLeave={onLeaveBorder}
              >
                <span style={{ color: "var(--fg)", fontSize: 12 }}>[Custom]</span>
                <span style={{ color: "var(--muted)", fontSize: 10 }}>Enter command directly, not saved as template</span>
              </button>
            </div>
          )}

          {/* FROM TEMPLATE — Step 1: pick template */}
          {mode === "from-template" && templateStep === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {allTemplates.length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", padding: "24px 0" }}>
                  No tools detected. Use Custom instead.
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {allTemplates.map(t => (
                    <button key={t.id} onClick={() => { handleSelectTemplate(t); setTemplateStep(2); }} style={{
                      ...btnBase,
                      display: "flex", flexDirection: "column", gap: 4,
                      padding: 12, textAlign: "left",
                      borderColor: "var(--border)", color: "var(--fg)",
                    }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--green)"; e.currentTarget.style.color = "var(--green)" }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--fg)" }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{t.name}</span>
                        {t.isBuiltin && (
                          <span style={{ fontSize: 9, color: "var(--green)", border: "1px solid var(--green)", padding: "1px 4px", lineHeight: 1.4, flexShrink: 0 }}>AUTO</span>
                        )}
                      </div>
                      <span style={{ fontSize: 10, color: "var(--muted)" }}>{t.description}</span>
                      <code style={{ fontSize: 10, color: "var(--muted)", opacity: 0.6 }}>{t.command}</code>
                    </button>
                  ))}
                  {!showNewTemplatForm && (
                    <button onClick={() => setShowNewTemplateForm(true)} style={{
                      ...btnBase,
                      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                      gap: 4, padding: 12, border: "1px dashed var(--border)", minHeight: 80,
                    }}
                      onMouseEnter={onHoverBorder} onMouseLeave={onLeaveBorder}
                    >
                      <span style={{ fontSize: 20, color: "var(--muted)" }}>+</span>
                      <span style={{ fontSize: 10, color: "var(--muted)" }}>New Template</span>
                    </button>
                  )}
                </div>
              )}

              {/* New template inline form */}
              {showNewTemplatForm && (
                <div style={{ border: "1px solid var(--green)", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ fontSize: 10, color: "var(--green)", marginBottom: 2 }}>NEW TEMPLATE</div>
                  {([
                    { label: "Name", key: "name", placeholder: "e.g. Backend Assistant" },
                    { label: "Command", key: "command", placeholder: "e.g. claude or python3" },
                    { label: "Description", key: "description", placeholder: "Optional" },
                  ] as const).map(({ label, key, placeholder }) => (
                    <label key={key} style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 10, color: "var(--muted)" }}>
                      {label}
                      <input value={newTpl[key]} onChange={e => setNewTpl(p => ({ ...p, [key]: e.target.value }))}
                        style={inputStyle} placeholder={placeholder} onFocus={onFocusInput} onBlur={onBlurInput} />
                    </label>
                  ))}
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 4 }}>
                    <button onClick={() => setShowNewTemplateForm(false)} style={{ ...btnBase, fontSize: 10 }}
                      onMouseEnter={onHoverGreen} onMouseLeave={onLeaveGreen}>[Cancel]</button>
                    <button onClick={() => {
                      if (!newTpl.name.trim() || !newTpl.command.trim()) return
                      const t: Template = { id: Date.now().toString(), name: newTpl.name.trim(), command: newTpl.command.trim(), workingDir: "~", description: newTpl.description.trim(), isBuiltin: false }
                      addTemplate(templates, t); onAddTemplate?.(t)
                      setNewTpl({ name: "", command: "", workingDir: "~", description: "" })
                      setShowNewTemplateForm(false)
                      handleSelectTemplate(t); setTemplateStep(2)
                    }}
                      style={{ ...btnBase, borderColor: "var(--green)", color: "var(--green)", fontSize: 10 }}
                      onMouseEnter={e => { e.currentTarget.style.background = "var(--green)"; e.currentTarget.style.color = "var(--bg)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--green)"; }}
                    >[Save Template]</button>
                  </div>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-start", marginTop: 4 }}>
                <button onClick={() => setMode("choose")} style={btnBase} onMouseEnter={onHoverGreen} onMouseLeave={onLeaveGreen}>[Back]</button>
              </div>
            </div>
          )}

          {/* FROM TEMPLATE — Step 2: configure pane */}
          {mode === "from-template" && templateStep === 2 && selectedTemplate && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ fontSize: 10, color: "var(--muted)" }}>
                Template: <span style={{ color: "var(--green)" }}>{selectedTemplate.name}</span>
                <code style={{ marginLeft: 8, opacity: 0.6, fontSize: 10 }}>{selectedTemplate.command}</code>
              </div>
              <label style={labelStyle}>
                Pane Name
                <input type="text" value={sessionName} onChange={e => setSessionName(e.target.value)}
                  style={inputStyle} placeholder={selectedTemplate.name} autoFocus
                  onFocus={onFocusInput} onBlur={onBlurInput}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); handleFromTemplate() } }} />
              </label>
              <label style={labelStyle}>
                Working Dir
                <div style={{ display: "flex", gap: 6 }}>
                  <input type="text" value={templateWorkingDir} onChange={e => setTemplateWorkingDir(e.target.value)}
                    style={{ ...inputStyle, flex: 1 }} placeholder="~"
                    onFocus={onFocusInput} onBlur={onBlurInput}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); handleFromTemplate() } }} />
                  <FolderButton onSelect={setTemplateWorkingDir} />
                </div>
              </label>
              {templatePromptInfo && (
                <label style={labelStyle}>
                  <span>System Prompt <span style={{ fontSize: 10, opacity: 0.7 }}>(saved as {templatePromptInfo.filename}, optional)</span></span>
                  <textarea value={templateSystemPrompt} onChange={e => setTemplateSystemPrompt(e.target.value)} rows={4}
                    placeholder={`You are a focused assistant for ${selectedTemplate.name}...`}
                    style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
                    onFocus={onFocusInput} onBlur={onBlurInput} />
                </label>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                <button onClick={() => setTemplateStep(1)} style={btnBase} onMouseEnter={onHoverGreen} onMouseLeave={onLeaveGreen}>[Back]</button>
                <button onClick={handleFromTemplate}
                  style={{ ...btnBase, borderColor: "var(--green)", color: "var(--green)" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "var(--green)"; e.currentTarget.style.color = "var(--bg)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--green)"; }}
                >[Open Pane]</button>
              </div>
            </div>
          )}

          {/* CUSTOM */}
          {mode === "custom" && (
            <form onSubmit={handleCustom} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <label style={labelStyle}>
                Name
                <input type="text" value={name} onChange={e => setName(e.target.value)}
                  style={inputStyle} placeholder="e.g. Backend Assistant" autoFocus
                  onFocus={onFocusInput} onBlur={onBlurInput} />
              </label>
              <label style={labelStyle}>
                Command
                <input type="text" value={command} onChange={e => setCommand(e.target.value)}
                  style={inputStyle} placeholder="e.g. claude or /bin/zsh or python3"
                  onFocus={onFocusInput} onBlur={onBlurInput} />
              </label>
              <label style={labelStyle}>
                Working Dir
                <div style={{ display: "flex", gap: 6 }}>
                  <input type="text" value={workingDir} onChange={e => setWorkingDir(e.target.value)}
                    style={{ ...inputStyle, flex: 1 }} placeholder="~"
                    onFocus={onFocusInput} onBlur={onBlurInput} />
                  <FolderButton onSelect={setWorkingDir} />
                </div>
              </label>
              {customPromptInfo && (
                <label style={labelStyle}>
                  <span>System Prompt <span style={{ fontSize: 10, opacity: 0.7 }}>(saved as {customPromptInfo.filename}, optional)</span></span>
                  <textarea value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)} rows={4}
                    placeholder="You are a focused backend engineer..."
                    style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
                    onFocus={onFocusInput} onBlur={onBlurInput} />
                </label>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                <button type="button" onClick={() => setMode("choose")} style={btnBase}
                  onMouseEnter={onHoverGreen}
                  onMouseLeave={onLeaveGreen}
                >[Back]</button>
                <button type="submit" style={{ ...btnBase, borderColor: "var(--green)", color: "var(--green)" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "var(--green)"; e.currentTarget.style.color = "var(--bg)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--green)"; }}
                >[New Pane]</button>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
