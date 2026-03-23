import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { ColorScheme, SCHEMES, DEFAULT_SCHEME } from "./theme"
import { settingsStore } from "./storage"

interface ThemeContextValue {
  scheme: ColorScheme
  schemeKey: string
  setScheme: (key: string) => void
  availableSchemes: typeof SCHEMES
}

const ThemeContext = createContext<ThemeContextValue>(null!)

function applyScheme(scheme: ColorScheme) {
  const root = document.documentElement
  root.style.setProperty("--bg", scheme.background)
  root.style.setProperty("--fg", scheme.foreground)
  root.style.setProperty("--cursor", scheme.cursor)
  root.style.setProperty("--selection", scheme.selection)
  root.style.setProperty("--green", scheme.green)
  root.style.setProperty("--red", scheme.red)
  root.style.setProperty("--blue", scheme.blue)
  root.style.setProperty("--yellow", scheme.yellow)
  root.style.setProperty("--cyan", scheme.cyan)
  root.style.setProperty("--magenta", scheme.magenta)
  root.style.setProperty("--surface", scheme.surface)
  root.style.setProperty("--border", scheme.border)
  root.style.setProperty("--muted", scheme.muted)
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Initialize from settingsStore (already loaded by SettingsProvider before render)
  const [schemeKey, setSchemeKey] = useState<string>(() => {
    const saved = settingsStore.get().theme
    return (saved && SCHEMES[saved]) ? saved : DEFAULT_SCHEME
  })

  const scheme = SCHEMES[schemeKey] ?? SCHEMES[DEFAULT_SCHEME]

  useEffect(() => {
    applyScheme(scheme)
  }, [scheme])

  const setScheme = (key: string) => {
    setSchemeKey(key)
    settingsStore.patch({ theme: key })
  }

  return (
    <ThemeContext.Provider value={{ scheme, schemeKey, setScheme, availableSchemes: SCHEMES }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
