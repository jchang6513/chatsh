/**
 * storage.ts — re-exports for backwards compatibility.
 * New code should import directly from fs.ts / settingsStore.ts / migrate.ts.
 */
export { readJsonFile, writeJsonFile, writeJsonFileImmediate } from "./fs"
export { settingsStore } from "./settingsStore"
export type { AppSettings } from "./settingsStore"
export { migrateFromLocalStorage } from "./migrate"
