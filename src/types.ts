import type { AgentTerminalOverrides } from "./settings";

export interface Agent {
  id: string;
  name: string;
  emoji: string;
  avatar?: string;
  command: string[];
  workingDir: string;
  llmLabel?: string;
  status: "online" | "offline";
  /** Per-agent terminal settings override (overrides global) */
  terminalOverrides?: AgentTerminalOverrides;
}
