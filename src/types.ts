export interface Pane {
  id: string;
  name: string;
  command: string[];
  workingDir: string;
  llmLabel?: string;
  status: "online" | "offline";
  /** Child process PID (from daemon) — used for real-time cwd tracking */
  pid?: number;
}

// Backwards compatibility alias — remove after full migration
export type Agent = Pane;
