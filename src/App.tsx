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

  const activeAgent = agents.find((a) => a.id === activeAgentId)!

  // 切換測試
  useEffect(() => {
    const t1 = setTimeout(() => setActiveAgentId("shell"), 5000)
    const t2 = setTimeout(() => setActiveAgentId("claude"), 9000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, []);

  const updateAgentStatus = (id: string, status: Agent["status"]) => {
    setAgents((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status } : a))
    );
  };

  const handleSelectAgent = useCallback(
    (id: string) => {
      setActiveAgentId(id);
    },
    []
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
          onStatusChange={(status) => updateAgentStatus(activeAgent.id, status)}
          showShellPane={showShellPane}
          onToggleShell={() => setShowShellPane((v) => !v)}
        />
        {showShellPane && <ShellPane />}
      </div>
    </div>
  );
}
