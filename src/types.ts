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
  /** Agent 別端末設定オーバーライド（全域設定を上書き） */
  terminalOverrides?: AgentTerminalOverrides;
}
