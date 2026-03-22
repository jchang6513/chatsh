import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import {
  TerminalSettings,
  AgentTerminalOverrides,
  DEFAULT_SETTINGS,
  loadGlobalSettings,
  saveGlobalSettings,
  loadAgentOverrides,
  saveAgentOverrides,
} from "./settings"

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

  // 非同步載入設定
  useEffect(() => {
    loadGlobalSettings().then(setGlobalSettings)
    loadAgentOverrides().then(setAgentOverrides)
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
