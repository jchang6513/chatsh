import { MONO_FONT } from "./ui"

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

const GLOBAL_STORAGE_KEY = "chatsh_global_settings"
const AGENT_STORAGE_KEY = "chatsh_agent_overrides"

export function loadGlobalSettings(): TerminalSettings {
  try {
    const saved = localStorage.getItem(GLOBAL_STORAGE_KEY)
    if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) }
  } catch {}
  return { ...DEFAULT_SETTINGS }
}

export function saveGlobalSettings(s: TerminalSettings) {
  localStorage.setItem(GLOBAL_STORAGE_KEY, JSON.stringify(s))
}

export function loadAgentOverrides(): Record<string, AgentTerminalOverrides> {
  try {
    const saved = localStorage.getItem(AGENT_STORAGE_KEY)
    if (saved) return JSON.parse(saved)
  } catch {}
  return {}
}

export function saveAgentOverrides(overrides: Record<string, AgentTerminalOverrides>) {
  localStorage.setItem(AGENT_STORAGE_KEY, JSON.stringify(overrides))
}
