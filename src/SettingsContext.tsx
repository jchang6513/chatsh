import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react"
import {
  TerminalSettings,
  DEFAULT_SETTINGS,
  loadGlobalSettings,
} from "./settings"
import { settingsStore } from "./storage/settingsStore"
import { flushPendingWrites } from "./storage/fs"
import { LS_SETTINGS_KEY, LS_THEME_KEY } from "./constants"

interface SettingsContextValue {
  globalSettings: TerminalSettings
  updateGlobalSettings: (patch: Partial<TerminalSettings> | ((prev: TerminalSettings) => Partial<TerminalSettings>)) => void
}

const SettingsContext = createContext<SettingsContextValue>(null!)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [globalSettings, setGlobalSettings] = useState<TerminalSettings>(DEFAULT_SETTINGS)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await settingsStore.load(LS_SETTINGS_KEY, LS_THEME_KEY)
      if (!cancelled) {
        setGlobalSettings(loadGlobalSettings())
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

  // ref 持有最新 globalSettings，避免 updateGlobalSettings 閉包過期
  const globalSettingsRef = useRef(globalSettings)
  globalSettingsRef.current = globalSettings

  const updateGlobalSettings = (patch: Partial<TerminalSettings> | ((prev: TerminalSettings) => Partial<TerminalSettings>)) => {
    const prev = globalSettingsRef.current
    const resolved = typeof patch === 'function' ? patch(prev) : patch
    const next = { ...prev, ...resolved }
    setGlobalSettings(next)
    // side effect 在 setState 外面，避免 React 18 concurrent mode 下的重複執行問題
    settingsStore.patchImmediate(next).catch(console.error)
  }

  if (!ready) return null

  return (
    <SettingsContext.Provider value={{ globalSettings, updateGlobalSettings }}>
      {children}
    </SettingsContext.Provider>
  )
}

export const useSettings = () => useContext(SettingsContext)
