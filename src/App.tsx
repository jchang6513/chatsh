import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import Sidebar from "./components/Sidebar";
import Terminal from "./components/Terminal";
import ShellPane from "./components/ShellPane";
import AddAgentModal from "./components/AddAgentModal";
import type { Agent } from "./types";

const DEFAULT_AGENTS: Agent[] = [
  {
    id: "claude",
    name: "工程助手",
    emoji: "🤖",
    command: ["claude"],
    workingDir: "/Users/jcssecondmind/Workspace/chatsh",
    llmLabel: "Claude",
    status: "offline",
  },
  {
    id: "shell",
    name: "Shell",
    emoji: "🐚",
    command: ["/bin/zsh"],
    workingDir: "~",
    status: "offline",
  },
];

const STORAGE_KEY = "chatsh_agents";

function loadAgents(): Agent[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved).map((a: Agent) => ({ ...a, status: "offline" }));
    }
  } catch {}
  return DEFAULT_AGENTS;
}

export default function App() {
  const [agents, setAgents] = useState<Agent[]>(loadAgents);
  const [activeAgentId, setActiveAgentId] = useState<string>(
    () => loadAgents()[0]?.id ?? ""
  );
  const [showShellPane, setShowShellPane] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(agents));
  }, [agents]);

  const updateAgentStatus = (id: string, status: Agent["status"]) => {
    setAgents((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status } : a))
    );
  };

  const handleSelectAgent = useCallback((id: string) => {
    setActiveAgentId(id);
  }, []);

  const handleRemoveAgent = useCallback(async (id: string) => {
    try { await invoke("kill_agent", { agentId: id }); } catch {}
    setAgents((prev) => {
      const next = prev.filter((a) => a.id !== id);
      setActiveAgentId((currentId) =>
        currentId === id ? (next[0]?.id ?? "") : currentId
      );
      return next;
    });
  }, []);

  const handleEditAgent = useCallback((agent: Agent) => {
    setEditingAgent(agent);
  }, []);

  const handleReorder = useCallback((newAgents: Agent[]) => {
    setAgents(newAgents);
  }, []);

  const showModal = showAddModal || editingAgent !== null;

  return (
    <div className="flex h-screen w-screen" style={{ background: "var(--bg)" }}>
      <Sidebar
        agents={agents}
        activeAgentId={activeAgentId}
        onSelect={handleSelectAgent}
        onAdd={() => setShowAddModal(true)}
        onRemove={handleRemoveAgent}
        onEdit={handleEditAgent}
        onReorder={handleReorder}
      />
      <div className="flex flex-col flex-1 min-w-0 min-h-0">
        {agents.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-lg" style={{ color: "var(--muted)", background: "var(--bg)" }}>
            點選 <span className="mx-1" style={{ color: "var(--blue)" }}>+ 新增角色</span> 開始使用
          </div>
        )}
        {agents.map((agent) => (
          <div
            key={agent.id}
            className="flex flex-col flex-1 min-w-0 min-h-0"
            style={{
              visibility: agent.id === activeAgentId ? "visible" : "hidden",
              position: agent.id === activeAgentId ? "relative" : "absolute",
              width: "100%",
              height: "100%",
              top: 0,
              left: 0,
            }}
          >
            <Terminal
              agent={agent}
              isActive={agent.id === activeAgentId}
              onStatusChange={(status) => updateAgentStatus(agent.id, status)}
              showShellPane={showShellPane}
              onToggleShell={() => setShowShellPane((v) => !v)}
            />
          </div>
        ))}
        {showShellPane && <ShellPane />}
      </div>
      {showModal && (
        <AddAgentModal
          initialValues={editingAgent ?? undefined}
          onAdd={(agent) => {
            if (editingAgent) {
              setAgents((prev) =>
                prev.map((a) => (a.id === agent.id ? agent : a))
              );
              setEditingAgent(null);
            } else {
              setAgents((prev) => [...prev, agent]);
              setActiveAgentId(agent.id);
              setShowAddModal(false);
            }
          }}
          onClose={() => {
            setShowAddModal(false);
            setEditingAgent(null);
          }}
        />
      )}
    </div>
  );
}
