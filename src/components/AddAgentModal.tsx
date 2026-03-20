import { useState, useEffect, useRef } from "react";
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

export default function AddAgentModal({ onAdd, onClose, initialValues }: Props) {
  const isEditing = !!initialValues?.id;

  // Step 1 state
  const [step, setStep] = useState<1 | 2>(isEditing ? 2 : 1);
  const [available, setAvailable] = useState<AvailableAgent[]>([]);
  const [scanning, setScanning] = useState(false);

  // Step 2 state
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

    // 若是 claude 且有填 CLAUDE.md，建立目錄並寫入
    const isClaudeCmd = agent.command[0] === "claude";
    if (isClaudeCmd && claudeMd.trim()) {
      const path = `~/.chatsh/agents/${agentId}/CLAUDE.md`;
      await invoke("write_file", { path, content: claudeMd }).catch(() => {});
    }

    onAdd(agent);
  };

  const inputStyle: React.CSSProperties = {
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    padding: "8px 12px",
    fontSize: 14,
    color: "var(--fg)",
    outline: "none",
  };

  const secondaryBtnStyle: React.CSSProperties = {
    background: "var(--surface)",
    color: "var(--muted)",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className="rounded-lg w-[440px] p-6 shadow-xl"
        style={{ background: "var(--bg)", border: "1px solid var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {step === 1 && !isEditing ? (
          <>
            <h2 className="text-lg font-bold mb-4" style={{ color: "var(--fg)" }}>
              選擇要新增的 Agent
            </h2>
            {scanning ? (
              <div className="text-sm py-8 text-center" style={{ color: "var(--muted)" }}>
                掃描可用 CLI 中…
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {available.map((a) => (
                    <button
                      key={a.command}
                      type="button"
                      onClick={() => selectAgent(a)}
                      className="flex flex-col gap-1 p-3 rounded-lg transition-colors text-left"
                      style={{ border: "1px solid var(--border)", background: "var(--bg)" }}
                      onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--blue)"}
                      onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--border)"}
                    >
                      <span className="text-sm font-medium" style={{ color: "var(--fg)" }}>
                        {a.name}
                      </span>
                      <span className="text-xs" style={{ color: "var(--muted)" }}>
                        {a.description}
                      </span>
                      <code className="text-xs mt-0.5" style={{ color: "var(--muted)", opacity: 0.7 }}>
                        {a.command}
                      </code>
                    </button>
                  ))}
                </div>
                {available.length === 0 && (
                  <div className="text-sm py-4 text-center" style={{ color: "var(--muted)" }}>
                    未偵測到可用的 CLI 工具
                  </div>
                )}
                <button
                  type="button"
                  onClick={goCustom}
                  className="w-full py-2.5 rounded-lg text-sm transition-colors"
                  style={{ border: "1px dashed var(--border)", color: "var(--muted)" }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--blue)";
                    e.currentTarget.style.color = "var(--fg)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--border)";
                    e.currentTarget.style.color = "var(--muted)";
                  }}
                >
                  + 自訂指令
                </button>
              </>
            )}
            <div className="flex justify-end mt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded text-sm transition-colors"
                style={secondaryBtnStyle}
                onMouseEnter={(e) => e.currentTarget.style.color = "var(--fg)"}
                onMouseLeave={(e) => e.currentTarget.style.color = "var(--muted)"}
              >
                取消
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-lg font-bold mb-4" style={{ color: "var(--fg)" }}>
              {isEditing ? "編輯角色" : `設定 ${name || "Agent"}`}
            </h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex items-start gap-4">
                <div className="flex flex-col items-center gap-1.5">
                  <Avatar
                    name={name || "?"}
                    imageUrl={avatarUrl || undefined}
                    size={56}
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="text-xs hover:underline"
                    style={{ color: "var(--blue)" }}
                  >
                    上傳頭像
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>
                <div className="flex-1 flex flex-col gap-3">
                  <label className="flex flex-col gap-1 text-sm" style={{ color: "var(--muted)" }}>
                    名稱
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      style={inputStyle}
                      onFocus={(e) => e.currentTarget.style.borderColor = "var(--blue)"}
                      onBlur={(e) => e.currentTarget.style.borderColor = "var(--border)"}
                      placeholder="例如：工程助手"
                      autoFocus
                    />
                  </label>
                  {isEditing && (
                    <label className="flex flex-col gap-1 text-sm" style={{ color: "var(--muted)" }}>
                      指令
                      <input
                        type="text"
                        value={command}
                        onChange={(e) => setCommand(e.target.value)}
                        style={inputStyle}
                        onFocus={(e) => e.currentTarget.style.borderColor = "var(--blue)"}
                        onBlur={(e) => e.currentTarget.style.borderColor = "var(--border)"}
                        placeholder="例如：claude 或 /bin/zsh"
                      />
                    </label>
                  )}
                  <label className="flex flex-col gap-1 text-sm" style={{ color: "var(--muted)" }}>
                    工作目錄
                    <input
                      type="text"
                      value={workingDir}
                      onChange={(e) => setWorkingDir(e.target.value)}
                      style={inputStyle}
                      onFocus={(e) => e.currentTarget.style.borderColor = "var(--blue)"}
                      onBlur={(e) => e.currentTarget.style.borderColor = "var(--border)"}
                      placeholder="~"
                    />
                  </label>
                </div>
              </div>
              {/* CLAUDE.md — 只對 claude 指令顯示 */}
              {command.split(" ")[0] === "claude" && (
                <label className="flex flex-col gap-1 text-sm mt-3" style={{ color: "var(--muted)" }}>
                  <span>CLAUDE.md <span style={{ color: "var(--muted)", fontSize: 11 }}>（System prompt，選填）</span></span>
                  <textarea
                    value={claudeMd}
                    onChange={(e) => setClaudeMd(e.target.value)}
                    rows={5}
                    placeholder={"你是一個專注於 React 的前端工程師...\n\n可以在這裡設定 Claude 的角色、工作習慣、注意事項等"}
                    style={{
                      ...inputStyle,
                      resize: "vertical",
                      fontFamily: "Menlo, Monaco, monospace",
                      fontSize: 12,
                      lineHeight: 1.6,
                    }}
                    onFocus={(e) => e.currentTarget.style.borderColor = "var(--blue)"}
                    onBlur={(e) => e.currentTarget.style.borderColor = "var(--border)"}
                  />
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>存放於 ~/.chatsh/agents/{"{id}"}/CLAUDE.md，不影響專案目錄</span>
                </label>
              )}
              <div className="flex justify-between mt-2">
                <div>
                  {!isEditing && (
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="px-4 py-2 rounded text-sm transition-colors"
                      style={secondaryBtnStyle}
                      onMouseEnter={(e) => e.currentTarget.style.color = "var(--fg)"}
                      onMouseLeave={(e) => e.currentTarget.style.color = "var(--muted)"}
                    >
                      上一步
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded text-sm transition-colors"
                    style={secondaryBtnStyle}
                    onMouseEnter={(e) => e.currentTarget.style.color = "var(--fg)"}
                    onMouseLeave={(e) => e.currentTarget.style.color = "var(--muted)"}
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded text-sm transition-colors"
                    style={{ background: "var(--selection)", color: "var(--blue)" }}
                  >
                    {isEditing ? "儲存" : "確認新增"}
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
