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
