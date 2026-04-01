import { describe, it, expect, beforeEach, vi } from "vitest"

// Mock Tauri API and fs module before imports
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}))

vi.mock("@tauri-apps/api/path", () => ({
  homeDir: vi.fn().mockResolvedValue("/home/user/"),
}))

vi.mock("../storage/fs", () => ({
  readJsonFile: vi.fn(),
  writeJsonFile: vi.fn(),
  chatshDir: vi.fn().mockResolvedValue("/home/user/.chatsh"),
}))

import { readJsonFile, writeJsonFile } from "../storage/fs"
import {
  DEFAULT_PANES,
  loadPanesFromLocalStorage,
  loadPanesWithMigration,
  savePanes,
  type PanesFileData,
} from "../storage/panesStore"
import type { Pane } from "../types"

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
})()

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
})

const LS_AGENTS_KEY = "chatsh_agents"

describe("panesStore", () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  describe("DEFAULT_PANES", () => {
    it("有 2 個預設 pane", () => {
      expect(DEFAULT_PANES).toHaveLength(2)
    })

    it("第一個是 Engineering（claude）", () => {
      expect(DEFAULT_PANES[0].name).toBe("Engineering")
      expect(DEFAULT_PANES[0].command).toContain("claude")
    })

    it("第二個是 Shell（zsh）", () => {
      expect(DEFAULT_PANES[1].name).toBe("Shell")
      expect(DEFAULT_PANES[1].command).toContain("/bin/zsh")
    })

    it("所有預設 pane status 是 offline", () => {
      DEFAULT_PANES.forEach(p => {
        expect(p.status).toBe("offline")
      })
    })
  })

  describe("loadPanesFromLocalStorage", () => {
    it("localStorage 有資料時正常讀取", () => {
      const panes: Pane[] = [
        { id: "1", name: "Test", command: ["zsh"], workingDir: "~", status: "online" }
      ]
      localStorageMock.setItem(LS_AGENTS_KEY, JSON.stringify(panes))

      const result = loadPanesFromLocalStorage()

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe("1")
    })

    it("讀取的 pane status 全部被設為 offline", () => {
      const panes: Pane[] = [
        { id: "1", name: "Test", command: ["zsh"], workingDir: "~", status: "online" },
        { id: "2", name: "Test2", command: ["claude"], workingDir: "~", status: "online" },
      ]
      localStorageMock.setItem(LS_AGENTS_KEY, JSON.stringify(panes))

      const result = loadPanesFromLocalStorage()

      result.forEach(p => {
        expect(p.status).toBe("offline")
      })
    })

    it("localStorage 為空時返回 DEFAULT_PANES", () => {
      const result = loadPanesFromLocalStorage()
      expect(result).toEqual(DEFAULT_PANES)
    })

    it("localStorage 有損壞 JSON 時返回 DEFAULT_PANES", () => {
      localStorageMock.setItem(LS_AGENTS_KEY, "{{invalid}}")
      const result = loadPanesFromLocalStorage()
      expect(result).toEqual(DEFAULT_PANES)
    })
  })

  describe("loadPanesWithMigration", () => {
    it("Branch 1: panes.json 存在時直接返回，status 設為 offline", async () => {
      const fileData: PanesFileData = {
        panes: [
          { id: "1", name: "FromFile", command: ["zsh"], workingDir: "~", status: "online" }
        ]
      }
      vi.mocked(readJsonFile).mockResolvedValueOnce(fileData)

      const result = await loadPanesWithMigration()

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe("FromFile")
      expect(result[0].status).toBe("offline")
    })

    it("Branch 2: panes.json 不存在，agents.json 存在時遷移", async () => {
      const agentsData = {
        agents: [
          { id: "2", name: "FromAgents", command: ["claude"], workingDir: "~", status: "online" }
        ]
      }
      // First call (panes.json) returns null, second call (agents.json) returns data
      vi.mocked(readJsonFile)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(agentsData)

      const result = await loadPanesWithMigration()

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe("FromAgents")
      expect(result[0].status).toBe("offline")
      // Should have migrated to panes.json
      expect(writeJsonFile).toHaveBeenCalled()
    })

    it("Branch 3: 兩個 JSON 都不存在，fallback 到 localStorage", async () => {
      vi.mocked(readJsonFile)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)

      const panes: Pane[] = [
        { id: "3", name: "FromLS", command: ["zsh"], workingDir: "~", status: "online" }
      ]
      localStorageMock.setItem(LS_AGENTS_KEY, JSON.stringify(panes))

      const result = await loadPanesWithMigration()

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe("FromLS")
    })

    it("全部 fallback 到 DEFAULT_PANES 當 localStorage 也為空", async () => {
      vi.mocked(readJsonFile)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)

      const result = await loadPanesWithMigration()

      expect(result).toEqual(DEFAULT_PANES)
    })

    it("panes.json 有 panes 為空陣列時直接返回空陣列（空陣列為 truthy）", async () => {
      const fileData: PanesFileData = { panes: [] }
      vi.mocked(readJsonFile).mockResolvedValueOnce(fileData)

      const result = await loadPanesWithMigration()
      // 空陣列在 JS 是 truthy，所以 `if (panesData?.panes)` 成立，直接返回空陣列
      expect(result).toEqual([])
    })
  })

  describe("savePanes", () => {
    it("呼叫 writeJsonFile 儲存 panes", () => {
      const panes: Pane[] = [
        { id: "1", name: "Test", command: ["zsh"], workingDir: "~", status: "online" }
      ]
      savePanes(panes)

      expect(writeJsonFile).toHaveBeenCalledWith(
        "panes.json",
        { panes }
      )
    })

    it("空陣列也可以正常儲存", () => {
      savePanes([])
      expect(writeJsonFile).toHaveBeenCalledWith("panes.json", { panes: [] })
    })
  })
})
