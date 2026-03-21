export interface ColorScheme {
  name: string
  // Terminal core colors
  background: string   // UI background + xterm background
  foreground: string   // primary text + xterm foreground
  cursor: string       // xterm cursor
  selection: string    // xterm selection、UI active highlight
  // ANSI semantic colors (shared by UI and xterm)
  green: string    // status online/success
  red: string      // status offline/error
  blue: string     // accent、focus、link
  yellow: string   // warning
  cyan: string     // info
  magenta: string  // special
  // UI structural colors (derived from background)
  surface: string  // slightly brighter than bg (buttons, cards)
  border: string   // divider
  muted: string    // secondary text
  // ANSI 16-color palette (applied directly to xterm)
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
  "kanagawa": {
    name: "Kanagawa",
    background: "#1f1f28",
    foreground: "#dcd7ba",
    cursor: "#c8c093",
    selection: "#2d4f67",
    green: "#76946a",
    red: "#c34043",
    blue: "#7e9cd8",
    yellow: "#c0a36e",
    cyan: "#6a9589",
    magenta: "#957fb8",
    surface: "#2a2a37",
    border: "#363646",
    muted: "#54546d",
    ansi: {
      black: "#16161d", red: "#c34043", green: "#76946a", yellow: "#c0a36e",
      blue: "#7e9cd8", magenta: "#957fb8", cyan: "#6a9589", white: "#c8c093",
      brightBlack: "#727169", brightRed: "#e82424", brightGreen: "#98bb6c",
      brightYellow: "#e6c384", brightBlue: "#7fb4ca", brightMagenta: "#938aa9",
      brightCyan: "#7aa89f", brightWhite: "#dcd7ba",
    },
  },

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
  "amber": {
    name: "Amber",
    background: "#0a0800",
    foreground: "#ffb000",
    cursor: "#ffb000",
    selection: "#332200",
    green: "#ffb000",
    red: "#ff4400",
    blue: "#ffcc44",
    yellow: "#ffdd00",
    cyan: "#ffaa33",
    magenta: "#ff8800",
    surface: "#110e00",
    border: "#332200",
    muted: "#664400",
    ansi: {
      black: "#0a0800", red: "#ff4400", green: "#ffb000", yellow: "#ffdd00",
      blue: "#ffcc44", magenta: "#ff8800", cyan: "#ffaa33", white: "#ffe080",
      brightBlack: "#332200", brightRed: "#ff6633", brightGreen: "#ffcc44",
      brightYellow: "#ffee66", brightBlue: "#ffdd88", brightMagenta: "#ffaa55",
      brightCyan: "#ffcc88", brightWhite: "#ffb000",
    },
  },
  "nightfly": {
    name: "Nightfly",
    background: "#011627",
    foreground: "#acb4c2",
    cursor: "#9ca1aa",
    selection: "#1d3b53",
    green: "#21c7a8",
    red: "#fc514e",
    blue: "#82aaff",
    yellow: "#e3d18a",
    cyan: "#7fdbca",
    magenta: "#c792ea",
    surface: "#0e2233",
    border: "#1d3b53",
    muted: "#4b6479",
    ansi: {
      black: "#011627", red: "#fc514e", green: "#21c7a8", yellow: "#e3d18a",
      blue: "#82aaff", magenta: "#c792ea", cyan: "#7fdbca", white: "#acb4c2",
      brightBlack: "#575656", brightRed: "#ff5874", brightGreen: "#21c7a8",
      brightYellow: "#ecc48d", brightBlue: "#82aaff", brightMagenta: "#ae81ff",
      brightCyan: "#7fdbca", brightWhite: "#d6deeb",
    },
  },

  "nightfox": {
    name: "Nightfox",
    background: "#192330",
    foreground: "#cdcecf",
    cursor: "#cdcecf",
    selection: "#2b3b51",
    green: "#81b29a",
    red: "#c94f6d",
    blue: "#719cd6",
    yellow: "#dbc074",
    cyan: "#63cdcf",
    magenta: "#9d79d6",
    surface: "#212e3f",
    border: "#2b3b51",
    muted: "#526176",
    ansi: {
      black: "#192330", red: "#c94f6d", green: "#81b29a", yellow: "#dbc074",
      blue: "#719cd6", magenta: "#9d79d6", cyan: "#63cdcf", white: "#cdcecf",
      brightBlack: "#526176", brightRed: "#d16983", brightGreen: "#8ebda8",
      brightYellow: "#e0c989", brightBlue: "#86abdc", brightMagenta: "#b48de3",
      brightCyan: "#7adfe0", brightWhite: "#d8dee9",
    },
  },

  "lucario": {
    name: "Lucario",
    background: "#2b3e50",
    foreground: "#f8f8f2",
    cursor: "#f8f8f0",
    selection: "#3e5771",
    green: "#8fc029",
    red: "#fc4349",
    blue: "#4eb2f8",
    yellow: "#f0cc04",
    cyan: "#24c5d7",
    magenta: "#9966ff",
    surface: "#3a5068",
    border: "#3e5771",
    muted: "#6b8aaa",
    ansi: {
      black: "#2b3e50", red: "#fc4349", green: "#8fc029", yellow: "#f0cc04",
      blue: "#4eb2f8", magenta: "#9966ff", cyan: "#24c5d7", white: "#f8f8f2",
      brightBlack: "#5c98cd", brightRed: "#fc4349", brightGreen: "#8fc029",
      brightYellow: "#e6db74", brightBlue: "#4eb2f8", brightMagenta: "#ae81ff",
      brightCyan: "#a1efe4", brightWhite: "#f8f8f2",
    },
  },

  "miasma": {
    name: "Miasma",
    background: "#222222",
    foreground: "#c2c2b0",
    cursor: "#c2c2b0",
    selection: "#3a3a3a",
    green: "#6e9766",
    red: "#b36d43",
    blue: "#6e83a0",
    yellow: "#c9a554",
    cyan: "#5b9a8b",
    magenta: "#9575ab",
    surface: "#2e2e2e",
    border: "#3a3a3a",
    muted: "#666655",
    ansi: {
      black: "#222222", red: "#b36d43", green: "#6e9766", yellow: "#c9a554",
      blue: "#6e83a0", magenta: "#9575ab", cyan: "#5b9a8b", white: "#c2c2b0",
      brightBlack: "#666655", brightRed: "#d08060", brightGreen: "#88bb80",
      brightYellow: "#e0bb70", brightBlue: "#88a0bb", brightMagenta: "#b090cc",
      brightCyan: "#77bba8", brightWhite: "#ddddcc",
    },
  },

  "gotham": {
    name: "Gotham",
    background: "#0c1014",
    foreground: "#98d1ce",
    cursor: "#d3ebe9",
    selection: "#10151b",
    green: "#2aa889",
    red: "#c33027",
    blue: "#195466",
    yellow: "#edb54b",
    cyan: "#33859e",
    magenta: "#888ca6",
    surface: "#10151b",
    border: "#11151c",
    muted: "#245361",
    ansi: {
      black: "#0c1014", red: "#c33027", green: "#2aa889", yellow: "#edb54b",
      blue: "#195466", magenta: "#888ca6", cyan: "#33859e", white: "#98d1ce",
      brightBlack: "#10151b", brightRed: "#d39a07", brightGreen: "#2aa889",
      brightYellow: "#edb54b", brightBlue: "#195466", brightMagenta: "#888ca6",
      brightCyan: "#33859e", brightWhite: "#d3ebe9",
    },
  },

  "gruvbox": {
    name: "Gruvbox",
    background: "#282828",
    foreground: "#ebdbb2",
    cursor: "#ebdbb2",
    selection: "#3c3836",
    green: "#98971a",
    red: "#cc241d",
    blue: "#458588",
    yellow: "#d79921",
    cyan: "#689d6a",
    magenta: "#b16286",
    surface: "#3c3836",
    border: "#504945",
    muted: "#928374",
    ansi: {
      black: "#282828", red: "#cc241d", green: "#98971a", yellow: "#d79921",
      blue: "#458588", magenta: "#b16286", cyan: "#689d6a", white: "#a89984",
      brightBlack: "#928374", brightRed: "#fb4934", brightGreen: "#b8bb26",
      brightYellow: "#fabd2f", brightBlue: "#83a598", brightMagenta: "#d3869b",
      brightCyan: "#8ec07c", brightWhite: "#ebdbb2",
    },
  },


  "iceberg": {
    name: "Iceberg",
    background: "#161821",
    foreground: "#c6c8d1",
    cursor: "#c6c8d1",
    selection: "#1e2132",
    green: "#b4be82",
    red: "#e27878",
    blue: "#84a0c6",
    yellow: "#e2a478",
    cyan: "#89b8c2",
    magenta: "#a093c7",
    surface: "#1e2132",
    border: "#272c42",
    muted: "#444b71",
    ansi: {
      black: "#161821", red: "#e27878", green: "#b4be82", yellow: "#e2a478",
      blue: "#84a0c6", magenta: "#a093c7", cyan: "#89b8c2", white: "#c6c8d1",
      brightBlack: "#444b71", brightRed: "#e98989", brightGreen: "#c0ca8e",
      brightYellow: "#e9b189", brightBlue: "#91acd1", brightMagenta: "#ada0d3",
      brightCyan: "#95c4ce", brightWhite: "#d2d4de",
    },
  },
}

export const DEFAULT_SCHEME = "kanagawa"
