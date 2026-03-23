import { invoke } from "@tauri-apps/api/core"
import { homeDir } from "@tauri-apps/api/path"

let cachedDir: string | null = null

async function chatshDir(): Promise<string> {
  if (!cachedDir) {
    const home = await homeDir()
    cachedDir = `${home}.chatsh`
  }
  return cachedDir
}

export async function readJsonFile<T>(name: string, fallback: T): Promise<T> {
  try {
    const dir = await chatshDir()
    const content = await invoke<string>("read_file", { path: `${dir}/${name}` })
    return JSON.parse(content) as T
  } catch {
    return fallback
  }
}

const writeTimers: Record<string, ReturnType<typeof setTimeout>> = {}

export function writeJsonFile(name: string, data: unknown, debounceMs = 150): void {
  clearTimeout(writeTimers[name])
  writeTimers[name] = setTimeout(async () => {
    try {
      const dir = await chatshDir()
      await invoke("write_file", { path: `${dir}/${name}`, content: JSON.stringify(data, null, 2) })
    } catch (e) {
      console.error(`[storage] 寫入 ${name} 失敗:`, e)
    }
  }, debounceMs)
}

export function writeJsonFileImmediate(name: string, data: unknown): Promise<void> {
  clearTimeout(writeTimers[name])
  return (async () => {
    const dir = await chatshDir()
    await invoke("write_file", { path: `${dir}/${name}`, content: JSON.stringify(data, null, 2) })
  })()
}

// =========================================================
// SettingsStore — unified settings.json writer
//
// All contexts (ThemeContext, SettingsContext) patch through
// here. Writes are debounced and always carry the full merged
// state, making concurrent patches safe.
// =========================================================

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
  private loaded = false

  /** Load from settings.json (with localStorage migration). Call once on startup. */
  async load(legacySettingsKey: string, legacyThemeKey: string): Promise<AppSettings> {
    // 1. Try settings.json first
    try {
      const dir = await chatshDir()
      const content = await invoke<string>("read_file", { path: `${dir}/settings.json` })
      const parsed = JSON.parse(content) as AppSettings
      this.current = parsed
      // Clean up old localStorage keys
      localStorage.removeItem(legacySettingsKey)
      localStorage.removeItem(legacyThemeKey)
      this.loaded = true
      return { ...this.current }
    } catch {
      // settings.json doesn't exist yet — migrate from legacy
    }

    // 2. Migrate from old config.json + theme.json
    try {
      const dir = await chatshDir()
      let migrated: AppSettings = {}
      try {
        const cfg = await invoke<string>("read_file", { path: `${dir}/config.json` })
        migrated = { ...migrated, ...JSON.parse(cfg) }
      } catch {}
      try {
        const thm = await invoke<string>("read_file", { path: `${dir}/theme.json` })
        migrated.theme = JSON.parse(thm) as string
      } catch {}
      if (Object.keys(migrated).length > 0) {
        this.current = migrated
        await writeJsonFileImmediate("settings.json", this.current)
        this.loaded = true
        return { ...this.current }
      }
    } catch {}

    // 3. Migrate from localStorage
    try {
      const ls = localStorage.getItem(legacySettingsKey)
      if (ls) {
        this.current = { ...this.current, ...JSON.parse(ls) }
        localStorage.removeItem(legacySettingsKey)
      }
    } catch {}
    try {
      const lt = localStorage.getItem(legacyThemeKey)
      if (lt) {
        this.current.theme = lt
        localStorage.removeItem(legacyThemeKey)
      }
    } catch {}

    this.loaded = true
    return { ...this.current }
  }

  /** Merge patch into current settings and schedule a debounced write. */
  patch(partial: Partial<AppSettings>): void {
    this.current = { ...this.current, ...partial }
    this.scheduleSave()
  }

  /** Get a snapshot of current settings (synchronous). */
  get(): AppSettings {
    return { ...this.current }
  }

  private scheduleSave(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(async () => {
      try {
        const dir = await chatshDir()
        await invoke("write_file", {
          path: `${dir}/settings.json`,
          content: JSON.stringify(this.current, null, 2),
        })
      } catch (e) {
        console.error("[SettingsStore] 寫入 settings.json 失敗:", e)
      }
    }, 150)
  }
}

export const settingsStore = new SettingsStore()

/**
 * 從 localStorage 遷移到 JSON 檔。
 * 如果 JSON 檔不存在但 localStorage 有資料，則遷移並清除 localStorage。
 */
export async function migrateFromLocalStorage<T>(
  jsonName: string,
  localStorageKey: string,
  fallback: T,
): Promise<T> {
  // 先嘗試讀 JSON 檔
  try {
    const dir = await chatshDir()
    const content = await invoke<string>("read_file", { path: `${dir}/${jsonName}` })
    const parsed = JSON.parse(content) as T
    // JSON 檔存在，清除 localStorage（如果還有的話）
    localStorage.removeItem(localStorageKey)
    return parsed
  } catch {
    // JSON 檔不存在，嘗試從 localStorage 遷移
  }

  try {
    const saved = localStorage.getItem(localStorageKey)
    if (saved) {
      const parsed = JSON.parse(saved) as T
      // 寫入 JSON 檔
      await writeJsonFileImmediate(jsonName, parsed)
      localStorage.removeItem(localStorageKey)
      return parsed
    }
  } catch {
    // localStorage 也讀不到
  }

  return fallback
}
