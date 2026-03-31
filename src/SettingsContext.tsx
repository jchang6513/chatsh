import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import {
  TerminalSettings,
  DEFAULT_SETTINGS,
  AgentTerminalOverrides,
  loadGlobalSettings,
  saveGlobalSettings,
  loadAgentOverrides,
  saveAgentOverrides,
} from "./settings"
import { settingsStore } from "./storage/settingsStore"
import { flushPendingWrites } from "./storage/fs"
import { LS_SETTINGS_KEY, LS_THEME_KEY } from "./constants"

interface SettingsContextValue {
  globalSettings: TerminalSettings
  updateGlobalSettings: (patch: Partial<TerminalSettings> | ((prev: TerminalSettings) => Partial<TerminalSettings>)) => void
  agentOverrides: Record<string, AgentTerminalOverrides>
  updateAgentOverrides: (agentId: string, overrides: AgentTerminalOverrides) => void
  clearAgentOverrides: (agentId: string) => void
  getResolvedSettings: (agentId: string) => TerminalSettings
}

const SettingsContext = createContext<SettingsContextValue>(null!)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [globalSettings, setGlobalSettings] = useState<TerminalSettings>(DEFAULT_SETTINGS)
  const [agentOverrides, setAgentOverrides] = useState<Record<string, AgentTerminalOverrides>>({})
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      // load() syncs settingsStore.current; loadGlobalSettings() then reads it synchronously.
      // ThemeProvider's lazy useState init also reads settingsStore.get(), so it must render
      // after this resolves — enforced by the `ready` gate below (if !ready return null).
      await settingsStore.load(LS_SETTINGS_KEY, LS_THEME_KEY)
      const overrides = await loadAgentOverrides()
      if (!cancelled) {
        setGlobalSettings(loadGlobalSettings())
        setAgentOverrides(overrides)
        setReady(true)
      }
    })()
    return () => { cancelled = true }
  }, [])

  // 確保 app 關閉前把 debounced 設定寫入磁碟
  useEffect(() => {
    const handler = () => flushPendingWrites()
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [])

  const updateGlobalSettings = (patch: Partial<TerminalSettings> | ((prev: TerminalSettings) => Partial<TerminalSettings>)) => {
    setGlobalSettings(prev => {
      const resolved = typeof patch === 'function' ? patch(prev) : patch
      const next = { ...prev, ...resolved }
      saveGlobalSettings(next)
      return next
    })
  }

  const updateAgentOverrides = (agentId: string, overrides: AgentTerminalOverrides) => {
    setAgentOverrides(prev => {
      const next = { ...prev, [agentId]: overrides }
      saveAgentOverrides(next)
      return next
    })
  }

  const clearAgentOverrides = (agentId: string) => {
    setAgentOverrides(prev => {
      const next = { ...prev }
      delete next[agentId]
      saveAgentOverrides(next)
      return next
    })
  }

  const getResolvedSettings = (agentId: string): TerminalSettings => {
    const overrides = agentOverrides[agentId] ?? {}
    return { ...globalSettings, ...overrides }
  }

  // Don't render children until settings are loaded to avoid flash of defaults.
  // ThemeProvider relies on this gate: its lazy useState reads settingsStore.get().
  if (!ready) return null

  return (
    <SettingsContext.Provider
      value={{
        globalSettings,
        updateGlobalSettings,
        agentOverrides,
        updateAgentOverrides,
        clearAgentOverrides,
        getResolvedSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  )
}

export const useSettings = () => useContext(SettingsContext)
