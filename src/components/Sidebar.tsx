import { useState, useRef } from "react";
import type { Agent } from "../types";
import Avatar from "./Avatar";

interface Props {
  agents: Agent[];
  activeAgentId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onEdit: (agent: Agent) => void;
  onReorder: (agents: Agent[]) => void;
}

export default function Sidebar({ agents, activeAgentId, onSelect, onAdd, onRemove, onEdit, onReorder }: Props) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragCounter = useRef<Record<string, number>>({});

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDragEnter = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    dragCounter.current[id] = (dragCounter.current[id] || 0) + 1;
    if (id !== dragId) setDragOverId(id);
  };

  const handleDragLeave = (_e: React.DragEvent, id: string) => {
    dragCounter.current[id] = (dragCounter.current[id] || 0) - 1;
    if (dragCounter.current[id] <= 0) {
      dragCounter.current[id] = 0;
      if (dragOverId === id) setDragOverId(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    dragCounter.current = {};
    if (!dragId || dragId === targetId) {
      setDragId(null);
      setDragOverId(null);
      return;
    }
    const fromIdx = agents.findIndex((a) => a.id === dragId);
    const toIdx = agents.findIndex((a) => a.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const next = [...agents];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    onReorder(next);
    setDragId(null);
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    setDragId(null);
    setDragOverId(null);
    dragCounter.current = {};
  };

  return (
    <div className="w-[260px] min-w-[260px] bg-[#0d0d0d] flex flex-col border-r border-[#404040]">
      <div className="px-4 h-11 flex items-center text-lg font-bold tracking-wide text-[#e0e0e0] border-b border-[#404040]">
        chat.sh
      </div>

      <div className="flex-1 overflow-y-auto">
        {agents.map((agent) => (
          <div
            key={agent.id}
            draggable
            onDragStart={(e) => handleDragStart(e, agent.id)}
            onDragOver={handleDragOver}
            onDragEnter={(e) => handleDragEnter(e, agent.id)}
            onDragLeave={(e) => handleDragLeave(e, agent.id)}
            onDrop={(e) => handleDrop(e, agent.id)}
            onDragEnd={handleDragEnd}
            className={`group relative w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[#161616] cursor-pointer ${
              agent.id === activeAgentId ? "bg-[#1e1e1e]" : ""
            } ${dragOverId === agent.id && dragId !== agent.id ? "border-t-2 border-blue-500" : ""} ${
              dragId === agent.id ? "opacity-40" : ""
            }`}
            onClick={() => onSelect(agent.id)}
          >
            <Avatar name={agent.name} imageUrl={agent.avatar} size={36} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium truncate text-[#e0e0e0]">{agent.name}</span>
                <span className={`text-xs ${agent.status === "online" ? "text-[#3fb950]" : "text-[#f85149]"}`}>
                  ●
                </span>
              </div>
              {agent.llmLabel && (
                <span className="text-xs text-[#808080] bg-[#1e1e1e] px-1.5 py-0.5 rounded">
                  {agent.llmLabel}
                </span>
              )}
            </div>
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(agent);
                }}
                className="text-[#555555] hover:text-[#e0e0e0] text-sm px-1"
                title="編輯"
              >
                ✎
              </button>
              {agent.id !== activeAgentId && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(agent.id);
                  }}
                  className="text-[#555555] hover:text-[#e0e0e0] text-sm px-1"
                  title="刪除"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={onAdd}
        className="m-3 py-2 rounded bg-[#1e1e1e] hover:bg-[#252525] text-[#808080] hover:text-[#e0e0e0] transition-colors text-sm border-t border-[#404040]"
      >
        + 新增角色
      </button>
    </div>
  );
}
