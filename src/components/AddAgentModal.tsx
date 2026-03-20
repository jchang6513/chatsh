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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !command.trim()) return;

    const agent: Agent = {
      id: initialValues?.id ?? Date.now().toString(),
      name: name.trim(),
      emoji: "🤖",
      avatar: avatarUrl || undefined,
      command: command.split(" ").filter(Boolean),
      workingDir: workingDir.trim() || "~",
      status: initialValues?.status ?? "offline",
    };
    onAdd(agent);
  };

  const inputClass =
    "bg-[#0d0d0d] border border-[#3a3a3a] rounded px-3 py-2 text-sm text-[#e0e0e0] outline-none focus:border-[#4a9eff]";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className="bg-[#141414] border border-[#3a3a3a] rounded-lg w-[440px] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {step === 1 && !isEditing ? (
          <>
            <h2 className="text-lg font-bold mb-4 text-[#e0e0e0]">
              選擇要新增的 Agent
            </h2>
            {scanning ? (
              <div className="text-sm text-[#808080] py-8 text-center">
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
                      className="flex flex-col gap-1 p-3 rounded-lg border border-[#3a3a3a] bg-[#0d0d0d] hover:border-[#4a9eff] hover:bg-[#111] transition-colors text-left"
                    >
                      <span className="text-sm font-medium text-[#e0e0e0]">
                        {a.name}
                      </span>
                      <span className="text-xs text-[#808080]">
                        {a.description}
                      </span>
                      <code className="text-xs text-[#555] mt-0.5">
                        {a.command}
                      </code>
                    </button>
                  ))}
                </div>
                {available.length === 0 && (
                  <div className="text-sm text-[#808080] py-4 text-center">
                    未偵測到可用的 CLI 工具
                  </div>
                )}
                <button
                  type="button"
                  onClick={goCustom}
                  className="w-full py-2.5 rounded-lg border border-dashed border-[#3a3a3a] text-sm text-[#808080] hover:border-[#4a9eff] hover:text-[#e0e0e0] transition-colors"
                >
                  + 自訂指令
                </button>
              </>
            )}
            <div className="flex justify-end mt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded text-sm bg-[#1e1e1e] text-[#808080] hover:text-[#e0e0e0] transition-colors"
              >
                取消
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-lg font-bold mb-4 text-[#e0e0e0]">
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
                    className="text-xs text-[#4a9eff] hover:underline"
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
                  <label className="flex flex-col gap-1 text-sm text-[#808080]">
                    名稱
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={inputClass}
                      placeholder="例如：工程助手"
                      autoFocus
                    />
                  </label>
                  {isEditing && (
                    <label className="flex flex-col gap-1 text-sm text-[#808080]">
                      指令
                      <input
                        type="text"
                        value={command}
                        onChange={(e) => setCommand(e.target.value)}
                        className={inputClass}
                        placeholder="例如：claude 或 /bin/zsh"
                      />
                    </label>
                  )}
                  <label className="flex flex-col gap-1 text-sm text-[#808080]">
                    工作目錄
                    <input
                      type="text"
                      value={workingDir}
                      onChange={(e) => setWorkingDir(e.target.value)}
                      className={inputClass}
                      placeholder="~"
                    />
                  </label>
                </div>
              </div>
              <div className="flex justify-between mt-2">
                <div>
                  {!isEditing && (
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="px-4 py-2 rounded text-sm bg-[#1e1e1e] text-[#808080] hover:text-[#e0e0e0] transition-colors"
                    >
                      上一步
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded text-sm bg-[#1e1e1e] text-[#808080] hover:text-[#e0e0e0] transition-colors"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded text-sm bg-[#1a2d4a] text-[#4a9eff] hover:bg-[#1e3355] transition-colors"
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
