import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import TabBar from "./components/TabBar";
import Sidebar from "./components/Sidebar";
import Terminal from "./components/Terminal";
import ShellPane from "./components/ShellPane";
import StatusBar from "./components/StatusBar";
import AddAgentModal from "./components/AddAgentModal";
import ClaudeMdEditor from "./components/ClaudeMdEditor";
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
  const [showClaudeMd, setShowClaudeMd] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(agents));
  }, [agents]);

  useEffect(() => {
    invoke("cleanup_deleted_agents").catch(() => {});
  }, []);

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
    await invoke("schedule_deletion", { agentId: id }).catch(() => {});
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

  const activeAgent = agents.find(a => a.id === activeAgentId);
  const showModal = showAddModal || editingAgent !== null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "var(--bg)" }}>
      {/* Tab bar */}
      <TabBar
        agents={agents}
        activeAgentId={activeAgentId}
        onSelect={handleSelectAgent}
        onAdd={() => setShowAddModal(true)}
        onRemove={handleRemoveAgent}
      />

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {/* Sidebar */}
        <Sidebar
          agents={agents}
          activeAgentId={activeAgentId}
          onSelect={handleSelectAgent}
          onAdd={() => setShowAddModal(true)}
          onRemove={handleRemoveAgent}
          onEdit={handleEditAgent}
          onReorder={handleReorder}
        />

        {/* Terminal panels */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0, padding: 4 }}>
          {agents.length === 0 && (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: 14 }}>
              點選 <span style={{ color: "var(--blue)", margin: "0 4px" }}>+</span> 開始使用
            </div>
          )}
          {agents.map((agent) => (
            <div
              key={agent.id}
              style={{
                display: agent.id === activeAgentId ? "flex" : "none",
                flexDirection: "column",
                flex: 1,
                minHeight: 0,
                border: "1px solid var(--border)",
                borderTop: "2px solid var(--green)",
              }}
            >
              {/* Panel label bar */}
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                height: 20,
                padding: "0 10px",
                borderBottom: "1px solid var(--border)",
                flexShrink: 0,
                fontFamily: '"SF Mono", "Menlo", "Monaco", "Courier New", monospace',
                fontSize: 10,
                letterSpacing: "0.08em",
              }}>
                <span style={{ color: "var(--green)" }}>
                  ─ {agent.name.toUpperCase()} ─
                </span>
                <span style={{ color: "var(--muted)" }}>
                  {agent.workingDir}
                </span>
              </div>
              <Terminal
                agent={agent}
                isActive={agent.id === activeAgentId}
                onStatusChange={(status) => updateAgentStatus(agent.id, status)}
              />
            </div>
          ))}
          {showShellPane && <ShellPane />}
        </div>
      </div>

      {/* Status bar */}
      <StatusBar agent={activeAgent} />

      {showClaudeMd && activeAgent && (
        <ClaudeMdEditor
          agent={activeAgent}
          onClose={() => setShowClaudeMd(false)}
        />
      )}
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
