/**
 * panesStore — load and save pane definitions to panes.json.
 * Handles three-tier migration: panes.json → agents.json → localStorage.
 */
import type { Pane } from "../types"
import { readJsonFile, writeJsonFile } from "./fs"
import {
  PANES_FILE,
  LEGACY_AGENTS_FILE,
  LS_AGENTS_KEY,
} from "../constants"

export interface PanesFileData {
  panes: Pane[]
}

export const DEFAULT_PANES: Pane[] = [
  {
    id: "1000000000001",
    name: "Engineering",
    command: ["claude"],
    workingDir: "~",
    llmLabel: "Claude",
    status: "offline",
  },
  {
    id: "1000000000002",
    name: "Shell",
    command: ["/bin/zsh"],
    workingDir: "~",
    status: "offline",
  },
]

export function loadPanesFromLocalStorage(): Pane[] {
  try {
    const saved = localStorage.getItem(LS_AGENTS_KEY)
    if (saved) {
      return (JSON.parse(saved) as Pane[]).map(p => ({ ...p, status: "offline" as const }))
    }
  } catch {}
  return DEFAULT_PANES
}

export async function loadPanesWithMigration(): Promise<Pane[]> {
  // 1. Try panes.json
  const panesData = await readJsonFile<PanesFileData | null>(PANES_FILE, null)
  if (panesData?.panes) {
    return panesData.panes.map(p => ({ ...p, status: "offline" as const }))
  }

  // 2. Backwards compat: try agents.json
  const agentsData = await readJsonFile<{ agents?: Pane[] } | null>(LEGACY_AGENTS_FILE, null)
  if (agentsData?.agents) {
    const panes = agentsData.agents.map(p => ({ ...p, status: "offline" as const }))
    savePanes(panes) // migrate to panes.json
    return panes
  }

  // 3. Fallback: localStorage
  return loadPanesFromLocalStorage()
}

export function savePanes(panes: Pane[]): void {
  writeJsonFile(PANES_FILE, { panes } satisfies PanesFileData)
}
