import { MONO_FONT } from "./ui"
import { migrateFromLocalStorage, writeJsonFile } from "./storage"

export interface TerminalSettings {
  fontFamily: string
  fontSize: number
  lineHeight: number
  cursorStyle: "block" | "bar" | "underline"
  cursorBlink: boolean
  scrollback: number
  backgroundOpacity: number
  padding: number
  uiScale: number  // 0.7 - 1.5
  sidebarPosition: "left" | "right"
  notificationsEnabled: boolean
}

export type AgentTerminalOverrides = Partial<TerminalSettings>

export const DEFAULT_SETTINGS: TerminalSettings = {
  fontFamily: MONO_FONT,
  fontSize: 14,
  lineHeight: 1.2,
  cursorStyle: "block",
  cursorBlink: true,
  scrollback: 10000,
  backgroundOpacity: 1.0,
  padding: 4,
  uiScale: 1.0,
  sidebarPosition: "left",
  notificationsEnabled: true,
}

export async function loadGlobalSettings(): Promise<TerminalSettings> {
  const saved = await migrateFromLocalStorage<Partial<TerminalSettings>>(
    "config.json", "chatsh_global_settings", {}
  )
  return { ...DEFAULT_SETTINGS, ...saved }
}

export function saveGlobalSettings(s: TerminalSettings) {
  writeJsonFile("config.json", s)
}

export async function loadAgentOverrides(): Promise<Record<string, AgentTerminalOverrides>> {
  return migrateFromLocalStorage<Record<string, AgentTerminalOverrides>>(
    "agent_overrides.json", "chatsh_agent_overrides", {}
  )
}

export function saveAgentOverrides(overrides: Record<string, AgentTerminalOverrides>) {
  writeJsonFile("agent_overrides.json", overrides)
}
