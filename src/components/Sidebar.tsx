import type { Agent } from "../types";

interface Props {
  agents: Agent[];
  activeAgentId: string;
  onSelect: (id: string) => void;
}

export default function Sidebar({ agents, activeAgentId, onSelect }: Props) {
  return (
    <div className="w-[260px] min-w-[260px] bg-[#1e1e1e] flex flex-col border-r border-[#333]">
      <div className="px-4 py-3 text-lg font-bold tracking-wide border-b border-[#333]">
        chat.sh
      </div>

      <div className="flex-1 overflow-y-auto">
        {agents.map((agent) => (
          <button
            key={agent.id}
            onClick={() => onSelect(agent.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[#2a2a2a] ${
              agent.id === activeAgentId ? "bg-[#2d3a4a]" : ""
            }`}
          >
            <span className="text-2xl">{agent.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium truncate">{agent.name}</span>
                <span className="text-xs">
                  {agent.status === "online" ? "🟢" : "🔴"}
                </span>
              </div>
              {agent.llmLabel && (
                <span className="text-xs text-gray-400 bg-[#333] px-1.5 py-0.5 rounded">
                  {agent.llmLabel}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>

      <button
        onClick={() => console.log("新增角色")}
        className="m-3 py-2 rounded bg-[#2d3a4a] hover:bg-[#3d4a5a] transition-colors text-sm"
      >
        + 新增角色
      </button>
    </div>
  );
}
