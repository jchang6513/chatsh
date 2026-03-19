export interface Agent {
  id: string;
  name: string;
  emoji: string;
  command: string[];
  workingDir: string;
  llmLabel?: string;
  status: "online" | "offline";
}
