/**
 * SettingsStore — unified settings.json writer
 *
 * All contexts (ThemeContext, SettingsContext) patch through here.
 * `patch()` merges into current state, so concurrent patches are safe —
 * the last scheduled write always carries the full merged snapshot.
 */
import { invoke } from "@tauri-apps/api/core"
import { chatshDir, readJsonFile, writeJsonFile, writeJsonFileImmediate } from "./fs"
import {
  SETTINGS_FILE,
  LEGACY_CONFIG_FILE,
  LEGACY_THEME_FILE,
} from "../constants"

export interface AppSettings {
  fontFamily?: string
  fontSize?: number
  lineHeight?: number
  cursorStyle?: "block" | "bar" | "underline"
  cursorBlink?: boolean
  scrollback?: number
  backgroundOpacity?: number
  padding?: number
  uiScale?: number
  sidebarPosition?: "left" | "right"
  notificationsEnabled?: boolean
  theme?: string
  _version?: number
}

class SettingsStore {
  private current: AppSettings = {}

  /**
   * Load from settings.json, migrating from legacy files or localStorage if needed.
   * Must be called (and awaited) before any call to get().
   * SettingsProvider ensures this via its async useEffect + ready gate.
   */
  async load(legacySettingsLsKey: string, legacyThemeLsKey: string): Promise<AppSettings> {
    // 1. Try settings.json
    try {
      const dir = await chatshDir()
      const content = await invoke<string>("read_file", { path: `${dir}/${SETTINGS_FILE}` })
      this.current = JSON.parse(content) as AppSettings
      localStorage.removeItem(legacySettingsLsKey)
      localStorage.removeItem(legacyThemeLsKey)
      return { ...this.current }
    } catch {}

    // 2. Migrate from old config.json + theme.json
    const migrated: AppSettings = {}
    try {
      const dir = await chatshDir()
      try {
        const cfg = await invoke<string>("read_file", { path: `${dir}/${LEGACY_CONFIG_FILE}` })
        Object.assign(migrated, JSON.parse(cfg))
      } catch {}
      try {
        const thm = await invoke<string>("read_file", { path: `${dir}/${LEGACY_THEME_FILE}` })
        migrated.theme = JSON.parse(thm) as string
      } catch {}
      if (Object.keys(migrated).length > 0) {
        this.current = migrated
        await writeJsonFileImmediate(SETTINGS_FILE, this.current)
        return { ...this.current }
      }
    } catch {}

    // 3. Migrate from localStorage
    let migratedFromLs = false
    try {
      const ls = localStorage.getItem(legacySettingsLsKey)
      if (ls) {
        Object.assign(this.current, JSON.parse(ls))
        localStorage.removeItem(legacySettingsLsKey)
        migratedFromLs = true
      }
    } catch {}
    try {
      const lt = localStorage.getItem(legacyThemeLsKey)
      if (lt) {
        this.current.theme = lt
        localStorage.removeItem(legacyThemeLsKey)
        migratedFromLs = true
      }
    } catch {}

    // 寫入 settings.json，避免下次啟動時 localStorage 已刪但檔案不存在
    if (migratedFromLs) {
      await writeJsonFileImmediate(SETTINGS_FILE, this.current)
    }

    return { ...this.current }
  }

  /** Merge partial update and schedule a debounced write via fs.writeJsonFile. */
  patch(partial: Partial<AppSettings>): void {
    this.current = { ...this.current, ...partial }
    // Reuse writeJsonFile's built-in debounce (keyed by filename)
    writeJsonFile(SETTINGS_FILE, this.current)
  }

  /** Immediately flush current state to disk (call before app close). */
  async flush(): Promise<void> {
    await writeJsonFileImmediate(SETTINGS_FILE, this.current)
  }

  /** Synchronous snapshot — valid only after load() has resolved. */
  get(): AppSettings {
    return { ...this.current }
  }
}

export const settingsStore = new SettingsStore()

export { readJsonFile }
