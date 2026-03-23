/**
 * One-time migration helper: reads a JSON file; if absent, migrates from localStorage.
 */
import { chatshDir, writeJsonFileImmediate } from "./fs"
import { invoke } from "@tauri-apps/api/core"

export async function migrateFromLocalStorage<T>(
  jsonName: string,
  localStorageKey: string,
  fallback: T,
): Promise<T> {
  // Try JSON file first
  try {
    const dir = await chatshDir()
    const content = await invoke<string>("read_file", { path: `${dir}/${jsonName}` })
    const parsed = JSON.parse(content) as T
    localStorage.removeItem(localStorageKey)
    return parsed
  } catch {
    // JSON file absent — fall through to localStorage migration
  }

  // Migrate from localStorage
  try {
    const saved = localStorage.getItem(localStorageKey)
    if (saved) {
      const parsed = JSON.parse(saved) as T
      await writeJsonFileImmediate(jsonName, parsed)
      localStorage.removeItem(localStorageKey)
      return parsed
    }
  } catch {}

  return fallback
}
