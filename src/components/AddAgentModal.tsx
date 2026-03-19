import { useState, useEffect } from "react";
import type { Agent } from "../types";

interface Props {
  onAdd: (agent: Agent) => void;
  onClose: () => void;
  initialValues?: Partial<Agent>;
}

export default function AddAgentModal({ onAdd, onClose, initialValues }: Props) {
  const isEditing = !!initialValues?.id;
  const [name, setName] = useState(initialValues?.name ?? "");
  const [command, setCommand] = useState(initialValues?.command?.join(" ") ?? "");
  const [workingDir, setWorkingDir] = useState(initialValues?.workingDir ?? "~");
  const [llmLabel, setLlmLabel] = useState(initialValues?.llmLabel ?? "");
  const [emoji, setEmoji] = useState(initialValues?.emoji ?? "🤖");

  useEffect(() => {
    if (initialValues) {
      setName(initialValues.name ?? "");
      setCommand(initialValues.command?.join(" ") ?? "");
      setWorkingDir(initialValues.workingDir ?? "~");
      setLlmLabel(initialValues.llmLabel ?? "");
      setEmoji(initialValues.emoji ?? "🤖");
    }
  }, [initialValues]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !command.trim()) return;

    const agent: Agent = {
      id: initialValues?.id ?? Date.now().toString(),
      name: name.trim(),
      emoji: emoji || "🤖",
      command: command.split(" ").filter(Boolean),
      workingDir: workingDir.trim() || "~",
      llmLabel: llmLabel.trim() || undefined,
      status: initialValues?.status ?? "offline",
    };
    onAdd(agent);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-[#1e1e1e] border border-[#444] rounded-lg w-[400px] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold mb-4">{isEditing ? "編輯角色" : "新增角色"}</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            名稱
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-[#2a2a2a] border border-[#555] rounded px-3 py-2 text-sm outline-none focus:border-blue-500"
              placeholder="例如：工程助手"
              autoFocus
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            指令
            <input
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              className="bg-[#2a2a2a] border border-[#555] rounded px-3 py-2 text-sm outline-none focus:border-blue-500"
              placeholder="例如：claude 或 /bin/zsh（空格分隔）"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            工作目錄
            <input
              type="text"
              value={workingDir}
              onChange={(e) => setWorkingDir(e.target.value)}
              className="bg-[#2a2a2a] border border-[#555] rounded px-3 py-2 text-sm outline-none focus:border-blue-500"
              placeholder="~"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            標籤（選填）
            <input
              type="text"
              value={llmLabel}
              onChange={(e) => setLlmLabel(e.target.value)}
              className="bg-[#2a2a2a] border border-[#555] rounded px-3 py-2 text-sm outline-none focus:border-blue-500"
              placeholder="例如：Claude、GPT-4"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Emoji
            <input
              type="text"
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              className="bg-[#2a2a2a] border border-[#555] rounded px-3 py-2 text-sm outline-none focus:border-blue-500 w-20"
            />
          </label>
          <div className="flex justify-end gap-2 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded text-sm bg-[#333] hover:bg-[#444] transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded text-sm bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              {isEditing ? "儲存" : "新增"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
