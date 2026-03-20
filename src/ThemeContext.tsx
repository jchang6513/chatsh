import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { ColorScheme, SCHEMES, DEFAULT_SCHEME } from "./theme"

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
  const [schemeKey, setSchemeKey] = useState(() =>
    localStorage.getItem("chatsh_scheme") ?? DEFAULT_SCHEME
  )

  const scheme = SCHEMES[schemeKey] ?? SCHEMES[DEFAULT_SCHEME]

  useEffect(() => {
    applyScheme(scheme)
    localStorage.setItem("chatsh_scheme", schemeKey)
  }, [scheme, schemeKey])

  return (
    <ThemeContext.Provider value={{ scheme, schemeKey, setScheme: setSchemeKey, availableSchemes: SCHEMES }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
