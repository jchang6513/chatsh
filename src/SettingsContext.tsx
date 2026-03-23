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
import { settingsStore } from "./storage"

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
  // Start with defaults; async load kicks in below
  const [globalSettings, setGlobalSettings] = useState<TerminalSettings>(DEFAULT_SETTINGS)
  const [agentOverrides, setAgentOverrides] = useState<Record<string, AgentTerminalOverrides>>({})
  const [ready, setReady] = useState(false)

  // Load settings.json (and migrate legacy) once on mount, before children render
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await settingsStore.load("chatsh_global_settings", "chatsh_scheme")
      const settings = await loadGlobalSettings()
      const overrides = await loadAgentOverrides()
      if (!cancelled) {
        setGlobalSettings(settings)
        setAgentOverrides(overrides)
        setReady(true)
      }
    })()
    return () => { cancelled = true }
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

  // Don't render children until settings are loaded to avoid flash of defaults
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
