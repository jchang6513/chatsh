// Tab ID for the main LLM/REPL terminal tab in each pane
// Shell tabs use dynamic IDs like `__shell_${paneId}_${n}__`
export const REPL_TAB = "terminal" as const

// JSON file names under ~/.chatsh/
export const SETTINGS_FILE = "settings.json"
export const PANES_FILE = "panes.json"
export const TEMPLATES_FILE = "templates.json"

// Legacy file names (for migration)
export const LEGACY_AGENTS_FILE = "agents.json"
export const LEGACY_CONFIG_FILE = "config.json"
export const LEGACY_THEME_FILE = "theme.json"

// localStorage keys (for migration)
export const LS_AGENTS_KEY = "chatsh_agents"
export const LS_SETTINGS_KEY = "chatsh_global_settings"
export const LS_THEME_KEY = "chatsh_scheme"
export const LS_SHELL_SESSIONS_KEY = "chatsh_shell_sessions"
export const LS_SHELL_NAMES_KEY = "chatsh_shell_names"
export const LS_HIDDEN_BUILTINS_KEY = "chatsh_hidden_builtins"
export const LS_PANE_OVERRIDES_KEY = "chatsh_pane_overrides"
export const LEGACY_LS_AGENT_OVERRIDES_KEY = "chatsh_agent_overrides"

// Timing
export const WRITE_DEBOUNCE_MS = 150
export const PTY_IDLE_GRACE_MS = 2000
