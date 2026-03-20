export interface ColorScheme {
  name: string
  // Terminal 核心色
  background: string   // UI 背景、xterm background
  foreground: string   // 主文字、xterm foreground
  cursor: string       // xterm cursor
  selection: string    // xterm selection、UI active highlight
  // ANSI semantic 色（UI 和 xterm 共用）
  green: string    // 狀態燈 online、success
  red: string      // 狀態燈 offline、error
  blue: string     // accent、focus、link
  yellow: string   // warning
  cyan: string     // info
  magenta: string  // special
  // UI 結構色（從 background 衍生）
  surface: string  // 比 background 稍亮（按鈕、卡片）
  border: string   // 分割線
  muted: string    // 次要文字
}

export const SCHEMES: Record<string, ColorScheme> = {
  "default": {
    name: "Default Dark",
    background: "#0d0d0d",
    foreground: "#d4d4d4",
    cursor: "#d4d4d4",
    selection: "#2d3a4a",
    green: "#3fb950",
    red: "#f85149",
    blue: "#4a9eff",
    yellow: "#e6a817",
    cyan: "#1abc9c",
    magenta: "#9b59b6",
    surface: "#1e1e1e",
    border: "#404040",
    muted: "#808080",
  },
  "github-dark": {
    name: "GitHub Dark",
    background: "#0d1117",
    foreground: "#c9d1d9",
    cursor: "#58a6ff",
    selection: "#1f3a5f",
    green: "#3fb950",
    red: "#f85149",
    blue: "#58a6ff",
    yellow: "#d29922",
    cyan: "#39c5cf",
    magenta: "#bc8cff",
    surface: "#161b22",
    border: "#30363d",
    muted: "#8b949e",
  },
  "solarized-dark": {
    name: "Solarized Dark",
    background: "#002b36",
    foreground: "#839496",
    cursor: "#839496",
    selection: "#073642",
    green: "#859900",
    red: "#dc322f",
    blue: "#268bd2",
    yellow: "#b58900",
    cyan: "#2aa198",
    magenta: "#d33682",
    surface: "#073642",
    border: "#586e75",
    muted: "#657b83",
  },
  "dracula": {
    name: "Dracula",
    background: "#282a36",
    foreground: "#f8f8f2",
    cursor: "#f8f8f2",
    selection: "#44475a",
    green: "#50fa7b",
    red: "#ff5555",
    blue: "#6272a4",
    yellow: "#f1fa8c",
    cyan: "#8be9fd",
    magenta: "#ff79c6",
    surface: "#44475a",
    border: "#6272a4",
    muted: "#6272a4",
  },
}

export const DEFAULT_SCHEME = "default"
