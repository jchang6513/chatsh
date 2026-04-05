/**
 * Low-level file I/O helpers for ~/.chatsh/*.json files.
 * Uses Tauri's read_file / write_file commands with debounced writes.
 */
import { invoke } from "@tauri-apps/api/core"
import { homeDir } from "@tauri-apps/api/path"
import { WRITE_DEBOUNCE_MS } from "../constants"

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
const pendingWrites: Record<string, unknown> = {}

export function writeJsonFile(name: string, data: unknown, debounceMs = WRITE_DEBOUNCE_MS): void {
  pendingWrites[name] = data
  clearTimeout(writeTimers[name])
  writeTimers[name] = setTimeout(async () => {
    delete pendingWrites[name]
    try {
      const dir = await chatshDir()
      await invoke("write_file", { path: `${dir}/${name}`, content: JSON.stringify(data, null, 2) })
    } catch (e) {
      console.error(`[fs] 寫入 ${name} 失敗:`, e)
    }
  }, debounceMs)
}

export async function writeJsonFileImmediate(name: string, data: unknown): Promise<void> {
  delete pendingWrites[name]
  clearTimeout(writeTimers[name])
  const dir = await chatshDir()
  await invoke("write_file", { path: `${dir}/${name}`, content: JSON.stringify(data, null, 2) })
}

/** 立即寫入所有尚未完成的 debounce 寫入（app 關閉前呼叫） */
export function flushPendingWrites(): void {
  for (const name of Object.keys(pendingWrites)) {
    clearTimeout(writeTimers[name])
    const data = pendingWrites[name]
    delete pendingWrites[name]
    chatshDir().then(dir =>
      invoke("write_file", { path: `${dir}/${name}`, content: JSON.stringify(data, null, 2) })
    ).catch(e => console.error(`[fs] flush 寫入 ${name} 失敗:`, e))
  }
}
