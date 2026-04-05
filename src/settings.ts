import { MONO_FONT } from "./ui"
import { LS_PANE_OVERRIDES_KEY, LEGACY_LS_AGENT_OVERRIDES_KEY } from "./constants"
import { settingsStore } from "./storage"
import type { AppSettings } from "./storage"

export interface TerminalSettings {
  fontFamily: string
  fontSize: number
  lineHeight: number
  cursorStyle: "block" | "bar" | "underline"
  cursorBlink: boolean
  scrollback: number
  backgroundOpacity: number
  padding: number
  uiScale: number
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

// TerminalSettings keys that live in AppSettings
const TERMINAL_KEYS: ReadonlyArray<keyof TerminalSettings> = [
  "fontFamily", "fontSize", "lineHeight", "cursorStyle", "cursorBlink",
  "scrollback", "backgroundOpacity", "padding", "uiScale",
  "sidebarPosition", "notificationsEnabled",
]

/** Extract TerminalSettings fields from the shared AppSettings store (synchronous).
 *  If any terminal key is missing from the persisted store, backfill it so
 *  settings.json always contains the full set after the first launch. */
export function loadGlobalSettings(): TerminalSettings {
  const saved: AppSettings = settingsStore.get()
  const overrides: Partial<TerminalSettings> = {}
  let hasMissing = false
  for (const k of TERMINAL_KEYS) {
    if (k in saved) {
      overrides[k] = saved[k] as never
    } else {
      hasMissing = true
    }
  }
  const merged = { ...DEFAULT_SETTINGS, ...overrides }
  if (hasMissing) {
    settingsStore.patch(merged)
  }
  return merged
}

export function saveGlobalSettings(s: TerminalSettings): void {
  settingsStore.patch(s)
}

// Per-pane overrides — stored in localStorage (runtime state, not config)
export async function loadAgentOverrides(): Promise<Record<string, AgentTerminalOverrides>> {
  // Migrate legacy key
  const legacy = localStorage.getItem(LEGACY_LS_AGENT_OVERRIDES_KEY)
  if (legacy) {
    try {
      const parsed = JSON.parse(legacy) as Record<string, AgentTerminalOverrides>
      localStorage.setItem(LS_PANE_OVERRIDES_KEY, legacy)
      localStorage.removeItem(LEGACY_LS_AGENT_OVERRIDES_KEY)
      return parsed
    } catch {}
  }
  try {
    const saved = localStorage.getItem(LS_PANE_OVERRIDES_KEY)
    if (saved) return JSON.parse(saved) as Record<string, AgentTerminalOverrides>
  } catch {}
  return {}
}

export function saveAgentOverrides(overrides: Record<string, AgentTerminalOverrides>): void {
  localStorage.setItem(LS_PANE_OVERRIDES_KEY, JSON.stringify(overrides))
}
