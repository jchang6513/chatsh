import { MONO_FONT, onBlurInput, onFocusInput, onHoverGreen, onLeaveGreen, onHoverBorder, onLeaveBorder } from "../ui"
import { useState, useEffect, useRef } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import type { Agent } from "../types";
import Avatar from "./Avatar";

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

function resizeImage(file: File, size = 64): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.src = url;
  });
}

const monoFont = MONO_FONT;

const btnStyle: React.CSSProperties = {
  padding: "6px 12px",
  background: "transparent",
  border: "1px solid var(--border)",
  color: "var(--muted)",
  fontFamily: monoFont,
  fontSize: 11,
  letterSpacing: "0.05em",
  cursor: "pointer",
  borderRadius: 0,
};

export default function AddAgentModal({ onAdd, onClose, initialValues }: Props) {
  const isEditing = !!initialValues?.id;

  const [step, setStep] = useState<1 | 2>(isEditing ? 2 : 1);
  const [available, setAvailable] = useState<AvailableAgent[]>([]);
  const [scanning, setScanning] = useState(false);

  const [name, setName] = useState(initialValues?.name ?? "");
  const [command, setCommand] = useState(initialValues?.command?.join(" ") ?? "");
  const [workingDir, setWorkingDir] = useState(initialValues?.workingDir ?? "~");
  const [avatarUrl, setAvatarUrl] = useState(initialValues?.avatar ?? "");
  const [claudeMd, setClaudeMd] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialValues) {
      setName(initialValues.name ?? "");
      setCommand(initialValues.command?.join(" ") ?? "");
      setWorkingDir(initialValues.workingDir ?? "~");
      setAvatarUrl(initialValues.avatar ?? "");
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const base64 = await resizeImage(file);
      setAvatarUrl(base64);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !command.trim()) return;

    const agentId = initialValues?.id ?? Date.now().toString();
    const agent: Agent = {
      id: agentId,
      name: name.trim(),
      emoji: "🤖",
      avatar: avatarUrl || undefined,
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

  const inputStyle: React.CSSProperties = {
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0, 0, 0, 0.8)" }}
      onClick={onClose}
    >
      <div
        style={{
          width: 440,
          padding: 24,
          background: "var(--bg)",
          border: "1px solid var(--border)",
          fontFamily: monoFont,
        }}
        onClick={(e) => e.stopPropagation()}
      >
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
                    ...btnStyle,
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
                style={btnStyle}
                onMouseEnter={onHoverGreen}
                onMouseLeave={onLeaveGreen}
              >
                [Cancel]
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>
              ┌─── {isEditing ? "EDIT AGENT" : "CONFIGURE"} ───┐
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--green)", marginBottom: 16 }}>
              {isEditing ? "Edit REPL" : `Configure ${name || "REPL"}`}
            </div>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <Avatar
                    name={name || "?"}
                    imageUrl={avatarUrl || undefined}
                    size={56}
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    style={{ ...btnStyle, fontSize: 10, padding: "2px 6px" }}
                    onMouseEnter={onHoverGreen}
                    onMouseLeave={onLeaveGreen}
                  >
                    [Upload]
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "var(--muted)" }}>
                    Name
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      style={inputStyle}
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
                        style={inputStyle}
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
                        style={{ ...inputStyle, flex: 1 }}
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
                        ...inputStyle,
                        resize: "vertical",
                        lineHeight: 1.6,
                      }}
                      onFocus={onFocusInput}
                      onBlur={onBlurInput}
                    />
                    <span style={{ fontSize: 10, color: "var(--muted)" }}>Stored at ~/.chatsh/agents/{"{id}"}/${promptFile} — project directory is unaffected</span>
                  </label>
                )
              })()}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                <div>
                  {!isEditing && (
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      style={btnStyle}
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
                    style={btnStyle}
                    onMouseEnter={onHoverGreen}
                    onMouseLeave={onLeaveGreen}
                  >
                    [Cancel]
                  </button>
                  <button
                    type="submit"
                    style={{
                      ...btnStyle,
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
    </div>
  );
}
