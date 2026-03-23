/**
 * Low-level file I/O helpers for ~/.chatsh/*.json files.
 * Uses Tauri's read_file / write_file commands with debounced writes.
 */
import { invoke } from "@tauri-apps/api/core"
import { homeDir } from "@tauri-apps/api/path"
import { WRITE_DEBOUNCE_MS } from "./constants"

let cachedDir: string | null = null

export async function chatshDir(): Promise<string> {
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

export function writeJsonFile(name: string, data: unknown, debounceMs = WRITE_DEBOUNCE_MS): void {
  clearTimeout(writeTimers[name])
  writeTimers[name] = setTimeout(async () => {
    try {
      const dir = await chatshDir()
      await invoke("write_file", { path: `${dir}/${name}`, content: JSON.stringify(data, null, 2) })
    } catch (e) {
      console.error(`[fs] 寫入 ${name} 失敗:`, e)
    }
  }, debounceMs)
}

export async function writeJsonFileImmediate(name: string, data: unknown): Promise<void> {
  clearTimeout(writeTimers[name])
  const dir = await chatshDir()
  await invoke("write_file", { path: `${dir}/${name}`, content: JSON.stringify(data, null, 2) })
}
