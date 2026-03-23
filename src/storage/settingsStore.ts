/**
 * SettingsStore — unified settings.json writer
 *
 * All contexts (ThemeContext, SettingsContext) patch through here.
 * `patch()` merges into current state, so concurrent patches are safe —
 * the last scheduled write always carries the full merged snapshot.
 */
import { invoke } from "@tauri-apps/api/core"
import { chatshDir, readJsonFile, writeJsonFileImmediate } from "./fs"
import {
  SETTINGS_FILE,
  LEGACY_CONFIG_FILE,
  LEGACY_THEME_FILE,
  WRITE_DEBOUNCE_MS,
} from "../constants"

export interface AppSettings {
  // Terminal / UI
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
  // Theme
  theme?: string
  // Schema version — bump when shape changes
  _version?: number
}

class SettingsStore {
  private current: AppSettings = {}
  private timer: ReturnType<typeof setTimeout> | null = null

  /**
   * Load from settings.json, migrating from legacy files or localStorage if needed.
   * Call once before rendering (SettingsProvider useEffect).
   */
  async load(legacySettingsLsKey: string, legacyThemeLsKey: string): Promise<AppSettings> {
    // 1. Try settings.json
    try {
      const dir = await chatshDir()
      const content = await invoke<string>("read_file", { path: `${dir}/${SETTINGS_FILE}` })
      const parsed = JSON.parse(content) as AppSettings
      this.current = parsed
      localStorage.removeItem(legacySettingsLsKey)
      localStorage.removeItem(legacyThemeLsKey)
      return { ...this.current }
    } catch {}

    // 2. Migrate from old config.json + theme.json
    let migrated: AppSettings = {}
    try {
      const dir = await chatshDir()
      try {
        const cfg = await invoke<string>("read_file", { path: `${dir}/${LEGACY_CONFIG_FILE}` })
        migrated = { ...migrated, ...JSON.parse(cfg) }
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
    try {
      const ls = localStorage.getItem(legacySettingsLsKey)
      if (ls) {
        this.current = { ...this.current, ...JSON.parse(ls) }
        localStorage.removeItem(legacySettingsLsKey)
      }
    } catch {}
    try {
      const lt = localStorage.getItem(legacyThemeLsKey)
      if (lt) {
        this.current.theme = lt
        localStorage.removeItem(legacyThemeLsKey)
      }
    } catch {}

    return { ...this.current }
  }

  /** Merge partial update into current state and schedule a debounced write. */
  patch(partial: Partial<AppSettings>): void {
    this.current = { ...this.current, ...partial }
    this.scheduleSave()
  }

  /** Synchronous snapshot of current settings. */
  get(): AppSettings {
    return { ...this.current }
  }

  private scheduleSave(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(async () => {
      try {
        const dir = await chatshDir()
        await invoke("write_file", {
          path: `${dir}/${SETTINGS_FILE}`,
          content: JSON.stringify(this.current, null, 2),
        })
      } catch (e) {
        console.error("[SettingsStore] 寫入 settings.json 失敗:", e)
      }
    }, WRITE_DEBOUNCE_MS)
  }
}

export const settingsStore = new SettingsStore()

// Re-export readJsonFile for callers that only need file reads
export { readJsonFile }
