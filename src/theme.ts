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
  // ANSI 16-color palette（xterm 直接套用）
  ansi: {
    black: string        // 0
    red: string          // 1
    green: string        // 2
    yellow: string       // 3
    blue: string         // 4
    magenta: string      // 5
    cyan: string         // 6
    white: string        // 7
    brightBlack: string  // 8 (dark gray)
    brightRed: string    // 9
    brightGreen: string  // 10
    brightYellow: string // 11
    brightBlue: string   // 12
    brightMagenta: string// 13
    brightCyan: string   // 14
    brightWhite: string  // 15
  }
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
    ansi: {
      black: "#1e1e1e", red: "#f85149", green: "#3fb950", yellow: "#e6a817",
      blue: "#4a9eff", magenta: "#9b59b6", cyan: "#1abc9c", white: "#d4d4d4",
      brightBlack: "#404040", brightRed: "#ff7b72", brightGreen: "#56d364",
      brightYellow: "#f0b72f", brightBlue: "#79c0ff", brightMagenta: "#d2a8ff",
      brightCyan: "#39d3c3", brightWhite: "#e0e0e0",
    },
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
    ansi: {
      black: "#161b22", red: "#f85149", green: "#3fb950", yellow: "#d29922",
      blue: "#58a6ff", magenta: "#bc8cff", cyan: "#39c5cf", white: "#c9d1d9",
      brightBlack: "#30363d", brightRed: "#ff7b72", brightGreen: "#56d364",
      brightYellow: "#e3b341", brightBlue: "#79c0ff", brightMagenta: "#d2a8ff",
      brightCyan: "#56d4dd", brightWhite: "#f0f6fc",
    },
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
    ansi: {
      black: "#073642", red: "#dc322f", green: "#859900", yellow: "#b58900",
      blue: "#268bd2", magenta: "#d33682", cyan: "#2aa198", white: "#eee8d5",
      brightBlack: "#002b36", brightRed: "#cb4b16", brightGreen: "#586e75",
      brightYellow: "#657b83", brightBlue: "#839496", brightMagenta: "#6c71c4",
      brightCyan: "#93a1a1", brightWhite: "#fdf6e3",
    },
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
    ansi: {
      black: "#21222c", red: "#ff5555", green: "#50fa7b", yellow: "#f1fa8c",
      blue: "#bd93f9", magenta: "#ff79c6", cyan: "#8be9fd", white: "#f8f8f2",
      brightBlack: "#6272a4", brightRed: "#ff6e6e", brightGreen: "#69ff94",
      brightYellow: "#ffffa5", brightBlue: "#d6acff", brightMagenta: "#ff92df",
      brightCyan: "#a4ffff", brightWhite: "#ffffff",
    },
  },
  "hacker": {
    name: "Hacker",
    background: "#0a0a0a",
    foreground: "#00ff9f",
    cursor: "#00ff9f",
    selection: "#003320",
    green: "#00ff9f",
    red: "#ff3333",
    blue: "#00ccff",
    yellow: "#ffcc00",
    cyan: "#00ffff",
    magenta: "#ff00ff",
    surface: "#111111",
    border: "#1a3a2a",
    muted: "#336644",
    ansi: {
      black: "#0a0a0a", red: "#ff3333", green: "#00ff9f", yellow: "#ffcc00",
      blue: "#00ccff", magenta: "#ff00ff", cyan: "#00ffff", white: "#ccffcc",
      brightBlack: "#1a3a2a", brightRed: "#ff6666", brightGreen: "#33ffbb",
      brightYellow: "#ffee44", brightBlue: "#33ddff", brightMagenta: "#ff66ff",
      brightCyan: "#66ffff", brightWhite: "#00ff9f",
    },
  },
}

export const DEFAULT_SCHEME = "hacker"
