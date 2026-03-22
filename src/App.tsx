import { REPL_TAB } from "./constants"
import { MONO_FONT, onHoverGreen, onLeaveGreen } from "./ui"
import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { listen } from "@tauri-apps/api/event";
import Sidebar from "./components/Sidebar";
import Terminal from "./components/Terminal";
import SingleShell from "./components/SingleShell";
import StatusBar from "./components/StatusBar";
import EditPaneModal from "./components/EditPaneModal";
import AddPaneModal from "./components/AddPaneModal";
import { loadTemplates } from "./templates";
import CommandPalette from "./components/CommandPalette";
import SettingsPanel from "./components/SettingsPanel";
import { useSettings } from "./SettingsContext";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { migrateFromLocalStorage, writeJsonFile } from "./storage";
import type { Agent } from "./types";

const DEFAULT_AGENTS: Agent[] = [
  {
    id: "1000000000001",
    name: "Engineering",
    emoji: "🤖",
    command: ["claude"],
    workingDir: "~",
    llmLabel: "Claude",
    status: "offline",
  },
  {
    id: "1000000000002",
    name: "Shell",
    emoji: "🐚",
    command: ["/bin/zsh"],
    workingDir: "~",
    status: "offline",
  },
];

interface AgentsFileData {
  agents: Agent[]
  shellSessions: Record<string, string[]>
  shellNames: Record<string, string>
  hiddenBuiltins: string[]
}

const DEFAULT_AGENTS_FILE: AgentsFileData = {
  agents: [],
  shellSessions: {},
  shellNames: {},
  hiddenBuiltins: [],
}

export default function App() {
  const { globalSettings, updateGlobalSettings } = useSettings();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [activeAgentId, setActiveAgentId] = useState<string>("");
  const [shellSessions, setShellSessions] = useState<Record<string, string[]>>({});
  const [activeTabMap, setActiveTabMap] = useState<Record<string, string>>({});

  const getActivePanelTab = (agentId: string) => activeTabMap[agentId] ?? REPL_TAB;
  const setActivePanelTab = (agentId: string, tab: string) =>
    setActiveTabMap(prev => ({ ...prev, [agentId]: tab }));

  // Initialize shell counters from persisted sessions to avoid ID collisions
  const shellCounters = useRef<Record<string, number>>({});
  const addShellToAgent = (agentId: string) => {
    shellCounters.current[agentId] = (shellCounters.current[agentId] ?? 0) + 1;
    const n = shellCounters.current[agentId];
    const shellId = `__shell_${agentId}_${n}__`;
    setShellSessions(prev => ({ ...prev, [agentId]: [...(prev[agentId] ?? []), shellId] }));
    // default name with stable counter
    setShellNames(prev => ({ ...prev, [shellId]: `Shell ${n}` }));
    setActivePanelTab(agentId, shellId);
  };

  const removeShellFromAgent = (agentId: string, shellId: string) => {
    // Kill the shell PTY in daemon
    invoke("kill_agent", { agentId: shellId }).catch(() => {});
    setShellSessions(prev => {
      const sessions = prev[agentId] ?? [];
      const next = sessions.filter(id => id !== shellId);
      // only switch tab if closing the active one
      if (getActivePanelTab(agentId) === shellId) {
        const idx = sessions.indexOf(shellId);
        const prevTab = idx > 0 ? sessions[idx - 1] : REPL_TAB;
        setActivePanelTab(agentId, prevTab);
      }
      return { ...prev, [agentId]: next };
    });
  };

  // shell tab names (custom, persisted)
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

  const [showEditPane, setShowEditPane] = useState(false);
  const [showAddPane, setShowAddPane] = useState(false);
  const [templates, setTemplates] = useState<Awaited<ReturnType<typeof loadTemplates>>>([]);
  const [hiddenBuiltins, setHiddenBuiltins] = useState<Set<string>>(new Set());
  // track which agents have been opened (lazy mount)
  const [mountedAgents, setMountedAgents] = useState<Set<string>>(new Set());
  const [unreadAgents, setUnreadAgents] = useState<Set<string>>(new Set());

  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [restartKeys, setRestartKeys] = useState<Record<string, number>>({});
  const bumpRestart = (id: string) => setRestartKeys(prev => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));

  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Persist agents data to agents.json
  const agentsRef = useRef(agents)
  agentsRef.current = agents
  const shellSessionsRef = useRef(shellSessions)
  shellSessionsRef.current = shellSessions
  const shellNamesRef = useRef(shellNames)
  shellNamesRef.current = shellNames
  const hiddenBuiltinsRef = useRef(hiddenBuiltins)
  hiddenBuiltinsRef.current = hiddenBuiltins

  // 統一寫入 agents.json
  const saveAgentsFile = useCallback(() => {
    const currentAgents = agentsRef.current
    if (currentAgents.length === 0) return
    const seen = new Set<string>()
    const deduped = currentAgents.filter(a => seen.has(a.id) ? false : (seen.add(a.id), true))
    const data: AgentsFileData = {
      agents: deduped,
      shellSessions: shellSessionsRef.current,
      shellNames: shellNamesRef.current,
      hiddenBuiltins: [...hiddenBuiltinsRef.current],
    }
    writeJsonFile("agents.json", data)
  }, [])

  useEffect(() => {
    if (agents.length === 0) return
    saveAgentsFile()
  }, [agents, saveAgentsFile]);

  useEffect(() => { saveAgentsFile() }, [shellSessions, saveAgentsFile]);
  useEffect(() => { saveAgentsFile() }, [shellNames, saveAgentsFile]);
  useEffect(() => { saveAgentsFile() }, [hiddenBuiltins, saveAgentsFile]);

  // Initialize: load from agents.json (with localStorage migration), then daemon
  useEffect(() => {
    (async () => {
      // 載入 agents.json（含遷移）
      const fileData = await loadAgentsFileWithMigration()

      // 載入 templates
      const loadedTemplates = await loadTemplates()
      setTemplates(loadedTemplates)

      // 從 fileData 還原 shell 相關 state
      const savedAgents = fileData.agents.length > 0
        ? fileData.agents.map((a: Agent) => ({ ...a, status: "offline" as const }))
        : DEFAULT_AGENTS
      const savedShellSessions = fileData.shellSessions
      const savedShellNames = fileData.shellNames
      const savedHiddenBuiltins = new Set(fileData.hiddenBuiltins)

      // 計算 shell counters
      const counters: Record<string, number> = {}
      for (const [agentId, ids] of Object.entries(savedShellSessions)) {
        let max = 0
        for (const id of ids) {
          const m = id.match(/__shell_.*_(\d+)__$/)
          if (m) max = Math.max(max, parseInt(m[1], 10))
        }
        counters[agentId] = max
      }
      shellCounters.current = counters

      setHiddenBuiltins(savedHiddenBuiltins)

      // 嘗試從 daemon 取得 pane
      let usedDaemon = false
      try {
        const panes = await invoke<Array<{ id: string; command: string[]; cwd: string; status: string; parent_pane_id: string | null; pane_type: string }>>("list_panes");
        console.log("[App] list_panes result:", JSON.stringify(panes));
        if (panes && panes.length > 0) {
          usedDaemon = true;

          const agentPanes = panes.filter(p => p.pane_type !== "shell");
          const shellPanes = panes.filter(p => p.pane_type === "shell");

          const daemonAgents: Agent[] = agentPanes.map(pane => ({
            id: pane.id,
            name: pane.command[0] ?? "pane",
            emoji: "🔗",
            command: pane.command,
            workingDir: pane.cwd,
            status: (pane.status === "running" ? "online" : "offline") as Agent["status"],
          }));

          // Enrich with saved metadata and preserve saved order
          const savedMap = new Map(savedAgents.map(a => [a.id, a]));
          const savedOrder = new Map(savedAgents.map((a, i) => [a.id, i]));

          for (const agent of daemonAgents) {
            const s = savedMap.get(agent.id);
            if (s) {
              agent.name = s.name;
              agent.emoji = s.emoji;
              if (s.llmLabel) agent.llmLabel = s.llmLabel;
            }
          }

          daemonAgents.sort((a, b) => {
            const ia = savedOrder.has(a.id) ? savedOrder.get(a.id)! : Infinity;
            const ib = savedOrder.has(b.id) ? savedOrder.get(b.id)! : Infinity;
            return ia - ib;
          });

          setAgents(daemonAgents);
          if (daemonAgents.length > 0) {
            setActiveAgentId(daemonAgents[0].id);
            setMountedAgents(new Set([daemonAgents[0].id]));
          }

          // Restore shell sessions from daemon
          if (shellPanes.length > 0) {
            const nextSessions: Record<string, string[]> = {};
            for (const sp of shellPanes) {
              const parentId = sp.parent_pane_id;
              if (!parentId) continue;
              if (!nextSessions[parentId]) nextSessions[parentId] = [];
              if (!nextSessions[parentId].includes(sp.id)) {
                nextSessions[parentId].push(sp.id);
              }
            }
            setShellSessions(nextSessions);

            const daemonCounters: Record<string, number> = {};
            for (const sp of shellPanes) {
              const m = sp.id.match(/__shell_.*_(\d+)__$/);
              if (m && sp.parent_pane_id) {
                const n = parseInt(m[1], 10);
                daemonCounters[sp.parent_pane_id] = Math.max(daemonCounters[sp.parent_pane_id] ?? 0, n);
              }
            }
            shellCounters.current = daemonCounters;

            // Set default shell names for restored shells
            setShellNames(prev => {
              const next = { ...savedShellNames, ...prev };
              for (const sp of shellPanes) {
                if (!next[sp.id]) {
                  const m = sp.id.match(/__shell_.*_(\d+)__$/);
                  next[sp.id] = m ? `Shell ${m[1]}` : "Shell";
                }
              }
              return next;
            });
          } else {
            setShellSessions(savedShellSessions);
            setShellNames(savedShellNames);
          }
        }
      } catch {
        // daemon not ready yet — fallback below
      }

      // Fallback: no daemon panes → use saved agents
      if (!usedDaemon) {
        setAgents(savedAgents);
        setShellSessions(savedShellSessions);
        setShellNames(savedShellNames);
        if (savedAgents.length > 0) {
          setActiveAgentId(savedAgents[0].id);
          setMountedAgents(new Set([savedAgents[0].id]));
        }
      }
    })();
  }, []);

  useEffect(() => {
    invoke("cleanup_deleted_agents").catch(() => {});
  }, []);

  // Request notification permission on startup
  useEffect(() => {
    isPermissionGranted().then(granted => {
      if (!granted) requestPermission()
    }).catch(() => {})
  }, [])

  // Refs for stale closure prevention
  const globalSettingsRef = useRef(globalSettings)
  globalSettingsRef.current = globalSettings

  // Keep a ref to latest activeAgentId to avoid stale closure in listeners
  const activeAgentIdRef = useRef(activeAgentId)

  // Refs for overlay states so onEscape always reads latest
  const showSettingsRef = useRef(showSettings)
  const showAddPaneRef = useRef(showAddPane)
  const showEditPaneRef = useRef(showEditPane)
  const showCommandPaletteRef = useRef(showCommandPalette)
  showSettingsRef.current = showSettings
  showAddPaneRef.current = showAddPane
  showEditPaneRef.current = showEditPane
  showCommandPaletteRef.current = showCommandPalette
  activeAgentIdRef.current = activeAgentId

  // Track when we last switched AWAY from each agent (grace period for pty-idle)
  const switchedAwayAt = useRef<Map<string, number>>(new Map())
  const GRACE_MS = 2000 // ignore pty-idle within 2s of switching away

  // Track streaming + unread state via Rust events
  // Only re-subscribe when mountedAgents changes (not activeAgentId — use ref instead)
  useEffect(() => {
    const unlisteners: (() => void)[] = []
    for (const agentId of mountedAgents) {
      // pty-idle: output stopped → mark unread (works for both LLM and shell)
      // Ignore if active or within grace period after switching away
      listen<void>(`pty-idle-${agentId}`, () => {
        if (agentId === activeAgentIdRef.current) return
        const switchedAt = switchedAwayAt.current.get(agentId)
        if (switchedAt && Date.now() - switchedAt < GRACE_MS) return
        setUnreadAgents(prev => {
          if (prev.has(agentId)) return prev
          return new Set([...prev, agentId])
        })
        // System notification (if enabled and app not in focus)
        if (globalSettingsRef.current.notificationsEnabled) {
          const agent = agentsRef.current.find(a => a.id === agentId)
          const name = agent?.name ?? "Pane"
          isPermissionGranted().then(granted => {
            if (granted) {
              const t = new Date().toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })
              sendNotification({ title: name, body: `完成 ${t}`, sound: "default" })
            }
          }).catch(() => {})
        }
      }).then(fn => unlisteners.push(fn))
    }
    return () => unlisteners.forEach(fn => fn())
  }, [mountedAgents]);

  const updateAgentStatus = (id: string, status: Agent["status"]) => {
    setAgents((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status } : a))
    );
  };

  const handleSelectAgent = useCallback((id: string) => {
    // Record when we switched away from the previous agent
    const prevId = activeAgentIdRef.current
    if (prevId && prevId !== id) {
      switchedAwayAt.current.set(prevId, Date.now())
    }
    setActiveAgentId(id);
    setMountedAgents(prev => new Set([...prev, id]));
    setUnreadAgents(prev => { const next = new Set(prev); next.delete(id); return next });

  }, []);

  const handleRemoveAgent = useCallback((id: string) => {
    // sync UI first
    setAgents((prev) => {
      const next = prev.filter((a) => a.id !== id);
      setActiveAgentId((currentId) =>
        currentId === id ? (next[0]?.id ?? "") : currentId
      );
      return next;
    });
    // cleanup in background, non-blocking
    invoke("kill_agent", { agentId: id }).catch(() => {});
    invoke("schedule_deletion", { agentId: id }).catch(() => {});
  }, []);

  const handleEditAgent = useCallback((agent: Agent) => {
    setEditingAgent(agent);
  }, []);

  const handleReorder = useCallback((newAgents: Agent[]) => {
    setAgents(newAgents);
  }, []);

  const activeAgent = agents.find(a => a.id === activeAgentId);
  const showModal = showEditPane || editingAgent !== null;

  // global keyboard shortcuts
  const keyHandlers = useMemo(() => ({
    onSelectAgent: (index: number) => {
      if (index < agents.length) handleSelectAgent(agents[index].id)
    },
    onPrevAgent: () => {
      const idx = agents.findIndex(a => a.id === activeAgentId)
      if (idx > 0) handleSelectAgent(agents[idx - 1].id)
    },
    onNextAgent: () => {
      const idx = agents.findIndex(a => a.id === activeAgentId)
      if (idx < agents.length - 1) handleSelectAgent(agents[idx + 1].id)
    },
    onNewAgent: () => setShowAddPane(true),
    onRestartAgent: async () => {
      if (!activeAgentId) return
      try { await invoke("kill_agent", { agentId: activeAgentId }) } catch {}
      updateAgentStatus(activeAgentId, "offline")
      bumpRestart(activeAgentId)
    },
    onOpenSettings: () => setShowSettings(prev => !prev),
    onNewShell: () => { if (activeAgentId) addShellToAgent(activeAgentId) },
    onCloseShell: () => {
      if (!activeAgentId) return
      const currentTab = getActivePanelTab(activeAgentId)
      if (currentTab !== REPL_TAB) removeShellFromAgent(activeAgentId, currentTab)
    },
    onPrevShell: () => {
      if (!activeAgentId) return
      const sessions = shellSessions[activeAgentId] ?? []
      const allTabs = [REPL_TAB, ...sessions]
      const currentTab = getActivePanelTab(activeAgentId)
      const idx = allTabs.indexOf(currentTab)
      if (idx > 0) setActivePanelTab(activeAgentId, allTabs[idx - 1])
    },
    onNextShell: () => {
      if (!activeAgentId) return
      const sessions = shellSessions[activeAgentId] ?? []
      const allTabs = [REPL_TAB, ...sessions]
      const currentTab = getActivePanelTab(activeAgentId)
      const idx = allTabs.indexOf(currentTab)
      if (idx < allTabs.length - 1) setActivePanelTab(activeAgentId, allTabs[idx + 1])
    },
    onToggleCommandPalette: () => setShowCommandPalette(prev => !prev),
    onFontIncrease: () => {
      updateGlobalSettings(prev => ({ uiScale: Math.min(+((prev.uiScale ?? 1.0) + 0.05).toFixed(2), 2.0) }))
    },
    onFontDecrease: () => {
      updateGlobalSettings(prev => ({ uiScale: Math.max(+((prev.uiScale ?? 1.0) - 0.05).toFixed(2), 0.5) }))
    },
    onEscape: () => {
      if (showCommandPaletteRef.current) { setShowCommandPalette(false); return }
      if (showSettingsRef.current) { setShowSettings(false); return }
      if (showAddPaneRef.current) { setShowAddPane(false); return }
      if (showEditPaneRef.current) { setShowEditPane(false); return }
    },
  }), [agents, activeAgentId, activeAgent, shellSessions, activeTabMap])

  useKeyboardShortcuts(keyHandlers)

  return (
    <>
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "var(--bg)", zoom: globalSettings.uiScale }}>

      <div style={{ display: "flex", flex: 1, minHeight: 0, flexDirection: globalSettings.sidebarPosition === "right" ? "row-reverse" : "row" }}>
        {/* Sidebar */}
        <Sidebar
          agents={agents}
          activeAgentId={activeAgentId}
          unreadAgents={unreadAgents}
          onSelect={handleSelectAgent}
          onAdd={() => setShowAddPane(true)}
          onRemove={handleRemoveAgent}
          onEdit={handleEditAgent}
          onDuplicate={(agent) => {
            const newAgent = { ...agent, id: Date.now().toString(), name: `${agent.name} (copy)`, status: "offline" as const }
            setAgents(prev => {
              const idx = prev.findIndex(a => a.id === agent.id)
              const next = [...prev]
              next.splice(idx + 1, 0, newAgent)
              return next
            })
            setActiveAgentId(newAgent.id)
            setMountedAgents(prev => new Set([...prev, newAgent.id]))
          }}
          onRestart={async (id) => {
            try { await invoke("kill_agent", { agentId: id }) } catch {}
            updateAgentStatus(id, "offline")
            bumpRestart(id)
          }}
          onReorder={handleReorder}
          onOpenSettings={() => setShowSettings(true)}
        />

        {/* Terminal panels */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0, padding: 4 }}>
          {agents.length === 0 && (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: 14 }}>
              Click + to start
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
                fontFamily: MONO_FONT,
                fontSize: 10,
                letterSpacing: "0.06em",
              }}>
                {/* Agent terminal tab */}
                <div
                  onClick={() => setActivePanelTab(agent.id, REPL_TAB)}
                  style={{
                    display: "flex", alignItems: "center", gap: 4, padding: "0 12px",
                    cursor: "pointer",
                    borderRight: "1px solid var(--border)",
                    borderBottom: getActivePanelTab(agent.id) === REPL_TAB
                      ? "2px solid var(--green)" : "2px solid transparent",
                    color: getActivePanelTab(agent.id) === REPL_TAB ? "var(--green)" : "var(--muted)",
                  }}
                >
                  <span style={{ border: "1px solid currentColor", padding: "0 2px", fontSize: 9, flexShrink: 0 }}>
                    {agent.name[0].toUpperCase()}
                  </span>
                  <span style={{ maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{agent.name}</span>
                </div>

                {/* Shell tabs — scrollable, + shell always visible */}
                <div style={{ display: "flex", overflowX: "auto", maxWidth: "calc(100% - 120px)", scrollbarWidth: "none" }}>
                {(shellSessions[agent.id] ?? []).map((shellId, idx) => (
                  <div
                    key={shellId}
                    ref={el => { if (el && getActivePanelTab(agent.id) === shellId) el.scrollIntoView({ block: "nearest", inline: "nearest" }) }}
                    onClick={() => setActivePanelTab(agent.id, shellId)}
                    style={{
                      display: "flex", alignItems: "center", gap: 4, padding: "0 10px",
                      cursor: "pointer", flexShrink: 0,
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
                        title="Double-click to rename"
                      style={{ maxWidth: 72, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
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

                </div>

                {/* + add shell — always visible */}
                <button
                  onClick={() => addShellToAgent(agent.id)}
                  style={{
                    padding: "0 10px", background: "transparent", border: "none",
                    borderLeft: "1px solid var(--border)", borderRight: "1px solid var(--border)", color: "var(--muted)",
                    fontFamily: "monospace", fontSize: 13, cursor: "pointer", flexShrink: 0,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = "var(--green)")}
                  onMouseLeave={e => (e.currentTarget.style.color = "var(--muted)")}
                  title="New Shell"
                >+</button>

                {/* Right-side toolbar */}
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, padding: "0 10px", borderLeft: "1px solid var(--border)" }}>

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
                    onMouseEnter={onHoverGreen}
                    onMouseLeave={onLeaveGreen}
                  >
                    [RESTART]
                  </button>
                </div>
              </div>
              {/* Terminal: lazy mount, visibility toggle */}
              {/* counter-zoom so xterm mouse coords are correct */}
              <div style={{ flex: 1, display: getActivePanelTab(agent.id) === REPL_TAB ? "flex" : "none", minHeight: 0, zoom: 1 / globalSettings.uiScale }}>
                {mountedAgents.has(agent.id) && (
                  <Terminal
                    agent={agent}
                    isActive={agent.id === activeAgentId && getActivePanelTab(agent.id) === REPL_TAB}
                    onStatusChange={(status) => updateAgentStatus(agent.id, status)}
                    restartKey={restartKeys[agent.id] ?? 0}
                  />
                )}
              </div>
              {/* Shell tabs: independent, visibility toggle */}
              {(shellSessions[agent.id] ?? []).map(shellId => (
                <div key={shellId} style={{ flex: 1, display: getActivePanelTab(agent.id) === shellId ? "flex" : "none", minHeight: 0, position: "relative", zoom: 1 / globalSettings.uiScale }}>
                  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
                    <SingleShell sessionId={shellId} agentId={agent.id} workingDir={agent.workingDir} isActive={agent.id === activeAgentId && getActivePanelTab(agent.id) === shellId} />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Status bar */}
      <StatusBar agent={activeAgent} />
    </div>

      {/* Overlays — outside zoom div so position:fixed works correctly */}
      {showSettings && (
        <SettingsPanel
          agents={agents}
          onTemplatesChange={(t) => setTemplates(t)}
          hiddenBuiltins={hiddenBuiltins}
          onHiddenBuiltinsChange={(h) => setHiddenBuiltins(h)}
          onClose={() => setShowSettings(false)}
        />
      )}
      {showCommandPalette && (
        <CommandPalette
          agents={agents}
          activeAgentId={activeAgentId}
          onSelect={handleSelectAgent}
          onClose={() => setShowCommandPalette(false)}
        />
      )}
      {showAddPane && (
        <AddPaneModal
          templates={templates}
          hiddenBuiltins={hiddenBuiltins}
          onAddTemplate={(t) => setTemplates(prev => [...prev, t])}
          onAdd={(agent) => {
            setAgents(prev => [...prev, agent]);
            setActiveAgentId(agent.id);
            setMountedAgents(prev => new Set([...prev, agent.id]));
            setShowAddPane(false);
          }}
          onClose={() => setShowAddPane(false)}
        />
      )}
      {showModal && (
        <EditPaneModal
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
              setMountedAgents(prev => new Set([...prev, agent.id]));
              setShowEditPane(false);
            }
          }}
          onClose={() => {
            setShowEditPane(false);
            setEditingAgent(null);
          }}
        />
      )}
    </>
  );
}

/**
 * 從 agents.json 載入，支援從多個 localStorage key 遷移
 */
async function loadAgentsFileWithMigration(): Promise<AgentsFileData> {
  // 先嘗試用 migrateFromLocalStorage 讀 agents.json（處理 chatsh_agents）
  const saved = await migrateFromLocalStorage<AgentsFileData | Agent[]>(
    "agents.json", "chatsh_agents", []
  )

  // 如果讀到的是 AgentsFileData 格式（有 agents 欄位）
  if (saved && typeof saved === "object" && !Array.isArray(saved) && "agents" in saved) {
    // 清除已遷移的 localStorage keys
    localStorage.removeItem("chatsh_shell_sessions")
    localStorage.removeItem("chatsh_shell_names")
    localStorage.removeItem("chatsh_hidden_builtins")
    return saved as AgentsFileData
  }

  // 如果讀到的是舊格式（Agent[] 陣列，從 localStorage chatsh_agents 遷移來的）
  const agents = Array.isArray(saved) ? saved as Agent[] : []

  // 繼續遷移其他 localStorage keys
  let shellSessions: Record<string, string[]> = {}
  let shellNames: Record<string, string> = {}
  let hiddenBuiltins: string[] = []

  try {
    const ss = localStorage.getItem("chatsh_shell_sessions")
    if (ss) { shellSessions = JSON.parse(ss); localStorage.removeItem("chatsh_shell_sessions") }
  } catch {}
  try {
    const sn = localStorage.getItem("chatsh_shell_names")
    if (sn) { shellNames = JSON.parse(sn); localStorage.removeItem("chatsh_shell_names") }
  } catch {}
  try {
    const hb = localStorage.getItem("chatsh_hidden_builtins")
    if (hb) { hiddenBuiltins = JSON.parse(hb); localStorage.removeItem("chatsh_hidden_builtins") }
  } catch {}

  const data: AgentsFileData = { agents, shellSessions, shellNames, hiddenBuiltins }

  // 如果有資料，寫入 agents.json
  if (agents.length > 0) {
    const { writeJsonFileImmediate } = await import("./storage")
    await writeJsonFileImmediate("agents.json", data)
  }

  return data
}
