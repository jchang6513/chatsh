import { useState, useCallback } from "react";
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

export default function App() {
  const [agents, setAgents] = useState<Agent[]>(DEFAULT_AGENTS);
  const [activeAgentId, setActiveAgentId] = useState<string>("claude");
  const [showShellPane, setShowShellPane] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const updateAgentStatus = (id: string, status: Agent["status"]) => {
    setAgents((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status } : a))
    );
  };

  const handleSelectAgent = useCallback((id: string) => {
    setActiveAgentId(id);
  }, []);

  return (
    <div className="flex h-screen w-screen bg-[#0d0d0d]">
      <Sidebar
        agents={agents}
        activeAgentId={activeAgentId}
        onSelect={handleSelectAgent}
        onAdd={() => setShowAddModal(true)}
      />
      <div className="flex flex-col flex-1 min-w-0 min-h-0">
        {/* 每個 agent 有自己的 Terminal，用 visibility 切換 */}
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
      {showAddModal && (
        <AddAgentModal
          onAdd={(agent) => {
            setAgents((prev) => [...prev, agent]);
            setActiveAgentId(agent.id);
            setShowAddModal(false);
          }}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}
