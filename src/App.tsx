import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
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
  const [activeTabs, setActiveTabs] = useState<Record<string, "terminal" | "shell">>({});
  const getTab = (id: string) => activeTabs[id] ?? "terminal";
  const setTab = (id: string, tab: "terminal" | "shell") =>
    setActiveTabs(prev => ({ ...prev, [id]: tab }));
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [showClaudeMd, setShowClaudeMd] = useState(false);
  const [restartKeys, setRestartKeys] = useState<Record<string, number>>({});
  const bumpRestart = (id: string) => setRestartKeys(prev => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));

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
                <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
                  <span style={{ color: "var(--green)", marginRight: 8 }}>─ {agent.name.toUpperCase()} ─</span>
                  {["terminal", "shell"].map(tab => (
                    <button
                      key={tab}
                      onClick={() => setTab(agent.id, tab as "terminal" | "shell")}
                      style={{
                        background: "transparent",
                        border: "none",
                        borderBottom: getTab(agent.id) === tab ? "1px solid var(--green)" : "1px solid transparent",
                        color: getTab(agent.id) === tab ? "var(--green)" : "var(--muted)",
                        fontFamily: "monospace",
                        fontSize: 9,
                        padding: "0 8px",
                        cursor: "pointer",
                        letterSpacing: "0.08em",
                        height: "100%",
                      }}
                    >
                      {tab.toUpperCase()}
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: "var(--muted)" }}>{agent.workingDir}</span>
                  {agent.command[0] === "claude" && (
                    <button
                      onClick={() => setShowClaudeMd(true)}
                      style={{
                        background: "transparent",
                        border: "1px solid var(--border)",
                        color: "var(--muted)",
                        fontFamily: "monospace",
                        fontSize: 9,
                        padding: "1px 6px",
                        cursor: "pointer",
                        letterSpacing: "0.05em",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--green)"; e.currentTarget.style.color = "var(--green)"; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--muted)"; }}
                    >
                      [CLAUDE.MD]
                    </button>
                  )}
                  <button
                    onClick={async () => {
                      try { await invoke("kill_agent", { agentId: agent.id }) } catch {}
                      updateAgentStatus(agent.id, "offline")
                      bumpRestart(agent.id)
                    }}
                    style={{
                      background: "transparent",
                      border: "1px solid var(--border)",
                      color: "var(--muted)",
                      fontFamily: "monospace",
                      fontSize: 9,
                      padding: "1px 6px",
                      cursor: "pointer",
                      letterSpacing: "0.05em",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--green)"; e.currentTarget.style.color = "var(--green)"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--muted)"; }}
                  >
                    [RESTART]
                  </button>
                </div>
              </div>
              {/* Terminal（visibility 切換，不銷毀） */}
              <div style={{ flex: 1, display: getTab(agent.id) === "terminal" ? "flex" : "none", minHeight: 0 }}>
                <Terminal
                  agent={agent}
                  isActive={agent.id === activeAgentId && getTab(agent.id) === "terminal"}
                  onStatusChange={(status) => updateAgentStatus(agent.id, status)}
                  restartKey={restartKeys[agent.id] ?? 0}
                />
              </div>
              {/* Shell（visibility 切換） */}
              <div style={{ flex: 1, display: getTab(agent.id) === "shell" ? "flex" : "none", minHeight: 0 }}>
                <ShellPane />
              </div>
            </div>
          ))}
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
