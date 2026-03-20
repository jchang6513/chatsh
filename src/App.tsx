import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import Sidebar from "./components/Sidebar";
import Terminal from "./components/Terminal";
import SingleShell from "./components/SingleShell";
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
  const [shellSessions, setShellSessions] = useState<Record<string, string[]>>({});
  const [activeTabMap, setActiveTabMap] = useState<Record<string, string>>({});

  const getActivePanelTab = (agentId: string) => activeTabMap[agentId] ?? "terminal";
  const setActivePanelTab = (agentId: string, tab: string) =>
    setActiveTabMap(prev => ({ ...prev, [agentId]: tab }));

  const addShellToAgent = (agentId: string) => {
    const shellId = `__shell_${agentId}_${Date.now()}__`;
    setShellSessions(prev => ({ ...prev, [agentId]: [...(prev[agentId] ?? []), shellId] }));
    setActivePanelTab(agentId, shellId);
  };

  const removeShellFromAgent = (agentId: string, shellId: string) => {
    setShellSessions(prev => {
      const sessions = prev[agentId] ?? [];
      const next = sessions.filter(id => id !== shellId);
      // 只有關掉的是當前分頁才切換
      if (getActivePanelTab(agentId) === shellId) {
        const idx = sessions.indexOf(shellId);
        const prevTab = idx > 0 ? sessions[idx - 1] : "terminal";
        setActivePanelTab(agentId, prevTab);
      }
      return { ...prev, [agentId]: next };
    });
  };

  // Shell 分頁名稱（自訂）
  const [shellNames, setShellNames] = useState<Record<string, string>>({});
  const [editingShellId, setEditingShellId] = useState<string | null>(null);
  const [editingShellName, setEditingShellName] = useState("");
  const getShellName = (shellId: string, idx: number) => shellNames[shellId] ?? `Shell ${idx + 1}`;
  const renameShell = (shellId: string, name: string) =>
    setShellNames(prev => ({ ...prev, [shellId]: name }));
  const startRename = (shellId: string, idx: number) => {
    setEditingShellId(shellId);
    setEditingShellName(getShellName(shellId, idx));
  };
  const commitRename = () => {
    if (editingShellId && editingShellName.trim()) {
      renameShell(editingShellId, editingShellName.trim());
    }
    setEditingShellId(null);
  };

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
              {/* Panel tab bar */}
              <div style={{
                height: 28,
                display: "flex",
                alignItems: "stretch",
                borderBottom: "1px solid var(--border)",
                flexShrink: 0,
                fontFamily: '"SF Mono", "Menlo", "Monaco", "Courier New", monospace',
                fontSize: 10,
                letterSpacing: "0.06em",
              }}>
                {/* Agent terminal tab */}
                <div
                  onClick={() => setActivePanelTab(agent.id, "terminal")}
                  style={{
                    display: "flex", alignItems: "center", gap: 4, padding: "0 12px",
                    cursor: "pointer",
                    borderRight: "1px solid var(--border)",
                    borderBottom: getActivePanelTab(agent.id) === "terminal"
                      ? "2px solid var(--green)" : "2px solid transparent",
                    color: getActivePanelTab(agent.id) === "terminal" ? "var(--green)" : "var(--muted)",
                  }}
                >
                  <span style={{ border: "1px solid currentColor", padding: "0 2px", fontSize: 9 }}>
                    {agent.name[0].toUpperCase()}
                  </span>
                  {agent.name}
                </div>

                {/* Shell tabs */}
                {(shellSessions[agent.id] ?? []).map((shellId, idx) => (
                  <div
                    key={shellId}
                    onClick={() => setActivePanelTab(agent.id, shellId)}
                    style={{
                      display: "flex", alignItems: "center", gap: 4, padding: "0 10px",
                      cursor: "pointer",
                      borderRight: "1px solid var(--border)",
                      borderBottom: getActivePanelTab(agent.id) === shellId
                        ? "2px solid var(--green)" : "2px solid transparent",
                      color: getActivePanelTab(agent.id) === shellId ? "var(--green)" : "var(--muted)",
                    }}
                  >
                    {editingShellId === shellId ? (
                      <input
                        autoFocus
                        value={editingShellName}
                        onChange={e => setEditingShellName(e.target.value)}
                        onBlur={commitRename}
                        onKeyDown={e => {
                          if (e.key === "Enter") commitRename();
                          if (e.key === "Escape") setEditingShellId(null);
                          e.stopPropagation();
                        }}
                        onClick={e => e.stopPropagation()}
                        style={{
                          background: "transparent",
                          border: "none",
                          borderBottom: "1px solid var(--green)",
                          color: "var(--green)",
                          fontFamily: "monospace",
                          fontSize: 10,
                          outline: "none",
                          width: 80,
                          padding: 0,
                        }}
                      />
                    ) : (
                      <span
                        onDoubleClick={e => { e.stopPropagation(); startRename(shellId, idx); }}
                        title="雙擊重命名"
                      >{getShellName(shellId, idx)}</span>
                    )}
                    <span
                      onClick={e => { e.stopPropagation(); removeShellFromAgent(agent.id, shellId); }}
                      style={{ opacity: 0.4, cursor: "pointer", marginLeft: 2, fontSize: 11 }}
                      onMouseEnter={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.color = "var(--red)"; }}
                      onMouseLeave={e => { e.currentTarget.style.opacity = "0.4"; e.currentTarget.style.color = ""; }}
                    >×</span>
                  </div>
                ))}

                {/* + add shell */}
                <button
                  onClick={() => addShellToAgent(agent.id)}
                  style={{
                    padding: "0 10px", background: "transparent", border: "none",
                    borderRight: "1px solid var(--border)", color: "var(--muted)",
                    fontFamily: "monospace", fontSize: 13, cursor: "pointer",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = "var(--green)")}
                  onMouseLeave={e => (e.currentTarget.style.color = "var(--muted)")}
                  title="新增 Shell"
                >+ shell</button>

                {/* 右側工具按鈕 */}
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, padding: "0 10px", borderLeft: "1px solid var(--border)" }}>
                  <span style={{ color: "var(--muted)", fontSize: 9 }}>{agent.workingDir}</span>
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
              <div style={{ flex: 1, display: getActivePanelTab(agent.id) === "terminal" ? "flex" : "none", minHeight: 0 }}>
                <Terminal
                  agent={agent}
                  isActive={agent.id === activeAgentId && getActivePanelTab(agent.id) === "terminal"}
                  onStatusChange={(status) => updateAgentStatus(agent.id, status)}
                  restartKey={restartKeys[agent.id] ?? 0}
                />
              </div>
              {/* Shell tabs（各自獨立，visibility 切換） */}
              {(shellSessions[agent.id] ?? []).map(shellId => (
                <div key={shellId} style={{ flex: 1, display: getActivePanelTab(agent.id) === shellId ? "flex" : "none", minHeight: 0, position: "relative" }}>
                  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
                    <SingleShell sessionId={shellId} isActive={agent.id === activeAgentId && getActivePanelTab(agent.id) === shellId} />
                  </div>
                </div>
              ))}
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
