import { MONO_FONT, INPUT_STYLE, BTN_BASE, onBlurInput, onFocusInput, onHoverGreen, onLeaveGreen, onHoverBorder, onLeaveBorder } from "../ui"
import Modal from "./ui/Modal"
import { useState, useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import type { Agent } from "../types";

interface AvailableAgent {
  name: string;
  command: string;
  description: string;
}

interface Props {
  onAdd: (agent: Agent) => void;
  onClose: () => void;
  initialValues?: Partial<Agent>;
}


const monoFont = MONO_FONT;

export default function EditPaneModal({ onAdd, onClose, initialValues }: Props) {
  const isEditing = !!initialValues?.id;

  const [step, setStep] = useState<1 | 2>(isEditing ? 2 : 1);
  const [available, setAvailable] = useState<AvailableAgent[]>([]);
  const [scanning, setScanning] = useState(false);

  const [name, setName] = useState(initialValues?.name ?? "");
  const [command, setCommand] = useState(initialValues?.command?.join(" ") ?? "");
  const [workingDir, setWorkingDir] = useState(initialValues?.workingDir ?? "~");
  const [claudeMd, setClaudeMd] = useState("");

  useEffect(() => {
    if (initialValues) {
      setName(initialValues.name ?? "");
      setCommand(initialValues.command?.join(" ") ?? "");
      setWorkingDir(initialValues.workingDir ?? "~");
      // Load existing system prompt file when editing
      const cmd0 = initialValues.command?.[0] ?? ""
      const PROMPT_FILES: Record<string, string> = { claude: "CLAUDE.md", gemini: "GEMINI.md", codex: "AGENTS.md" }
      const promptFile = PROMPT_FILES[cmd0]
      if (initialValues.id && promptFile) {
        const path = `~/.chatsh/agents/${initialValues.id}/${promptFile}`
        invoke<string>("read_file", { path })
          .then(content => setClaudeMd(content))
          .catch(() => setClaudeMd(""))
      }
    }
  }, [initialValues]);

  useEffect(() => {
    if (!isEditing) {
      setScanning(true);
      invoke<AvailableAgent[]>("scan_available_agents")
        .then(setAvailable)
        .catch(() => setAvailable([]))
        .finally(() => setScanning(false));
    }
  }, [isEditing]);

  const selectAgent = (agent: AvailableAgent) => {
    setName(agent.name);
    setCommand(agent.command);
    setStep(2);
  };

  const goCustom = () => {
    setName("");
    setCommand("");
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !command.trim()) return;

    const agentId = initialValues?.id ?? Date.now().toString();
    const agent: Agent = {
      id: agentId,
      name: name.trim(),
      emoji: "🤖",
      command: command.split(" ").filter(Boolean),
      workingDir: workingDir.trim() || "~",
      status: initialValues?.status ?? "offline",
    };

    const cmd0 = agent.command[0]
    const PROMPT_FILES: Record<string,string> = { claude: "CLAUDE.md", gemini: "GEMINI.md", codex: "AGENTS.md" }
    const promptFile = PROMPT_FILES[cmd0]
    if (promptFile && claudeMd.trim()) {
      const path = `~/.chatsh/agents/${agentId}/${promptFile}`;
      await invoke("write_file", { path, content: claudeMd }).catch(() => {});
    }

    onAdd(agent);
  };

  const INPUT_STYLE: React.CSSProperties = {
    background: "var(--bg)",
    border: "1px solid var(--border)",
    padding: "8px 12px",
    fontSize: 12,
    color: "var(--fg)",
    outline: "none",
    fontFamily: monoFont,
    borderRadius: 0,
  };

  

  return (
    <Modal title={isEditing ? "Edit Pane" : "New Pane"} onClose={onClose} width={440}>
      <div style={{ padding: 24 }}>
        {step === 1 && !isEditing ? (
          <>
            <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>┌─── SELECT AGENT ───┐</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--green)", marginBottom: 16 }}>
              Select Agent Type
            </div>
            {scanning ? (
              <div style={{ fontSize: 12, padding: "32px 0", textAlign: "center", color: "var(--muted)" }}>
                Scanning available CLIs...
              </div>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                  {available.map((a) => (
                    <button
                      key={a.command}
                      type="button"
                      onClick={() => selectAgent(a)}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                        padding: 12,
                        textAlign: "left",
                        border: "1px solid var(--border)",
                        background: "var(--bg)",
                        cursor: "pointer",
                        fontFamily: monoFont,
                        borderRadius: 0,
                        color: "var(--fg)",
                      }}
                      onMouseEnter={onHoverBorder}
                      onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--border)"}
                    >
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{a.name}</span>
                      <span style={{ fontSize: 10, color: "var(--muted)" }}>{a.description}</span>
                      <code style={{ fontSize: 10, color: "var(--muted)", opacity: 0.7 }}>{a.command}</code>
                    </button>
                  ))}
                </div>
                {available.length === 0 && (
                  <div style={{ fontSize: 12, padding: "16px 0", textAlign: "center", color: "var(--muted)" }}>
                    No CLI tools detected
                  </div>
                )}
                <button
                  type="button"
                  onClick={goCustom}
                  style={{
                    ...BTN_BASE,
                    display: "block",
                    width: "100%",
                    padding: "10px",
                    border: "1px dashed var(--border)",
                  }}
                  onMouseEnter={onHoverGreen}
                  onMouseLeave={onLeaveGreen}
                >
                  [+ Custom Command]
                </button>
              </>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <button
                type="button"
                onClick={onClose}
                style={BTN_BASE}
                onMouseEnter={onHoverGreen}
                onMouseLeave={onLeaveGreen}
              >
                [Cancel]
              </button>
            </div>
          </>
        ) : (
          <>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "var(--muted)" }}>
                    Name
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      style={INPUT_STYLE}
                      onFocus={onFocusInput}
                      onBlur={onBlurInput}
                      placeholder="e.g. Engineering"
                      autoFocus
                    />
                  </label>
                  {isEditing && (
                    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "var(--muted)" }}>
                      Command
                      <input
                        type="text"
                        value={command}
                        onChange={(e) => setCommand(e.target.value)}
                        style={INPUT_STYLE}
                        onFocus={onFocusInput}
                        onBlur={onBlurInput}
                        placeholder="e.g. claude or /bin/zsh"
                      />
                    </label>
                  )}
                  <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "var(--muted)" }}>
                    Working Dir
                    <div style={{ display: "flex", gap: 6 }}>
                      <input
                        type="text"
                        value={workingDir}
                        onChange={(e) => setWorkingDir(e.target.value)}
                        style={{ ...INPUT_STYLE, flex: 1 }}
                        onFocus={onFocusInput}
                        onBlur={onBlurInput}
                        placeholder="~"
                      />
                      <button type="button" onClick={async () => {
                        const f = await open({ directory: true, multiple: false });
                        if (typeof f === "string") setWorkingDir(f);
                      }} style={{
                        padding: "4px 8px", background: "transparent",
                        border: "1px solid var(--border)", color: "var(--muted)",
                        fontFamily: "monospace", fontSize: 10, cursor: "pointer", flexShrink: 0,
                      }}
                        onMouseEnter={onHoverGreen}
                        onMouseLeave={onLeaveGreen}
                      >[...]</button>
                    </div>
                  </label>
                </div>
              </div>
              {["claude","gemini","codex"].includes(command.split(" ")[0]) && (() => {
                const cli = command.split(" ")[0]
                const PROMPT_FILES: Record<string, string> = { claude: "CLAUDE.md", gemini: "GEMINI.md", codex: "AGENTS.md" }
                const promptFile = PROMPT_FILES[cli] ?? "CLAUDE.md"
                const PLACEHOLDERS: Record<string, string> = {
                  claude: "You are a focused React frontend engineer...\n\nDefine role, habits, and constraints for Claude here",
                  gemini: "You are a helpful assistant...\n\nDefine role, habits, and constraints for Gemini here",
                  codex: "You are a coding assistant...\n\nDefine role, habits, and constraints for Codex here",
                }
                return (
                  <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "var(--muted)" }}>
                    <span>{promptFile} <span style={{ fontSize: 10 }}>(System prompt, optional)</span></span>
                    <textarea
                      value={claudeMd}
                      onChange={(e) => setClaudeMd(e.target.value)}
                      rows={5}
                      placeholder={PLACEHOLDERS[cli] ?? ""}
                      style={{
                        ...INPUT_STYLE,
                        resize: "vertical",
                        lineHeight: 1.6,
                      }}
                      onFocus={onFocusInput}
                      onBlur={onBlurInput}
                    />
                    <span style={{ fontSize: 10, color: "var(--muted)" }}>Stored at ~/.chatsh/agents/{"{id}"}/{promptFile} — project directory is unaffected</span>
                  </label>
                )
              })()}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                <div>
                  {!isEditing && (
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      style={BTN_BASE}
                      onMouseEnter={onHoverGreen}
                      onMouseLeave={onLeaveGreen}
                    >
                      [Back]
                    </button>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={onClose}
                    style={BTN_BASE}
                    onMouseEnter={onHoverGreen}
                    onMouseLeave={onLeaveGreen}
                  >
                    [Cancel]
                  </button>
                  <button
                    type="submit"
                    style={{
                      ...BTN_BASE,
                      border: "1px solid var(--green)",
                      color: "var(--green)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "var(--green)";
                      e.currentTarget.style.color = "var(--bg)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = "var(--green)";
                    }}
                  >
                    [{isEditing ? "Save" : "Create"}]
                  </button>
                </div>
              </div>
            </form>
          </>
        )}
      </div>
    </Modal>
  );
}
