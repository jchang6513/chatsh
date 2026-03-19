import { useState, useCallback } from "react";
import Sidebar from "./components/Sidebar";
import Terminal from "./components/Terminal";
import ShellPane from "./components/ShellPane";
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
  const [spawnTrigger, setSpawnTrigger] = useState(0);

  const activeAgent = agents.find((a) => a.id === activeAgentId)!;

  const updateAgentStatus = (id: string, status: Agent["status"]) => {
    setAgents((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status } : a))
    );
  };

  // 選擇角色時，若已停止則觸發重新 spawn
  const handleSelectAgent = useCallback(
    (id: string) => {
      setActiveAgentId(id);
      const agent = agents.find((a) => a.id === id);
      if (agent && agent.status === "offline") {
        console.log(`[App] 選擇已停止的角色 ${id}，觸發 spawn`);
        setSpawnTrigger((t) => t + 1);
      }
    },
    [agents]
  );

  return (
    <div className="flex h-screen w-screen bg-[#0d0d0d]">
      <Sidebar
        agents={agents}
        activeAgentId={activeAgentId}
        onSelect={handleSelectAgent}
      />
      <div className="flex flex-col flex-1 min-w-0">
        <Terminal
          agent={activeAgent}
          onStatusChange={(status) => updateAgentStatus(activeAgentId, status)}
          showShellPane={showShellPane}
          onToggleShell={() => setShowShellPane((v) => !v)}
          spawnTrigger={spawnTrigger}
        />
        {showShellPane && <ShellPane />}
      </div>
    </div>
  );
}
