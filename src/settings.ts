import { MONO_FONT } from "./ui"
import { settingsStore } from "./storage"

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
export type PaneTerminalOverrides = Partial<TerminalSettings>

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

/** Extract TerminalSettings fields from the shared AppSettings store. */
export async function loadGlobalSettings(): Promise<TerminalSettings> {
  const saved = settingsStore.get()
  return { ...DEFAULT_SETTINGS, ...pickTerminalFields(saved as unknown as Record<string, unknown>) }
}

export function saveGlobalSettings(s: TerminalSettings): void {
  settingsStore.patch(s)
}

function pickTerminalFields(obj: Record<string, unknown>): Partial<TerminalSettings> {
  const keys: Array<keyof TerminalSettings> = [
    "fontFamily", "fontSize", "lineHeight", "cursorStyle", "cursorBlink",
    "scrollback", "backgroundOpacity", "padding", "uiScale",
    "sidebarPosition", "notificationsEnabled",
  ]
  const result: Partial<TerminalSettings> = {}
  for (const k of keys) {
    if (k in obj) (result as Record<string, unknown>)[k] = obj[k]
  }
  return result
}

// Per-pane overrides — stored in localStorage (runtime state, not config)
const PANE_OVERRIDES_KEY = "chatsh_pane_overrides"
// Keep legacy key for migration
const LEGACY_AGENT_OVERRIDES_KEY = "chatsh_agent_overrides"

export async function loadAgentOverrides(): Promise<Record<string, AgentTerminalOverrides>> {
  // Migrate legacy key
  const legacy = localStorage.getItem(LEGACY_AGENT_OVERRIDES_KEY)
  if (legacy) {
    try {
      const parsed = JSON.parse(legacy)
      localStorage.setItem(PANE_OVERRIDES_KEY, legacy)
      localStorage.removeItem(LEGACY_AGENT_OVERRIDES_KEY)
      return parsed
    } catch {}
  }
  try {
    const saved = localStorage.getItem(PANE_OVERRIDES_KEY)
    if (saved) return JSON.parse(saved)
  } catch {}
  return {}
}

export function saveAgentOverrides(overrides: Record<string, AgentTerminalOverrides>): void {
  localStorage.setItem(PANE_OVERRIDES_KEY, JSON.stringify(overrides))
}
