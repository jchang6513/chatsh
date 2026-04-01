import { describe, it, expect, beforeEach, vi } from "vitest"

// Mock Tauri APIs before importing the module
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}))

vi.mock("../storage/fs", () => ({
  chatshDir: vi.fn().mockResolvedValue("/home/user/.chatsh"),
  writeJsonFileImmediate: vi.fn().mockResolvedValue(undefined),
}))

import { invoke } from "@tauri-apps/api/core"
import { chatshDir, writeJsonFileImmediate } from "../storage/fs"
import { migrateFromLocalStorage } from "../storage/migrate"

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

describe("migrateFromLocalStorage", () => {
  const jsonName = "panes.json"
  const lsKey = "chatsh_agents"
  const fallback = { panes: [] }

  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  describe("Branch 1: JSON file 存在", () => {
    it("JSON file 存在且有效時直接返回，並移除 localStorage key", async () => {
      const fileData = { panes: [{ id: "1", name: "Test" }] }
      vi.mocked(invoke).mockResolvedValueOnce(JSON.stringify(fileData))
      localStorageMock.setItem(lsKey, JSON.stringify({ old: true }))

      const result = await migrateFromLocalStorage(jsonName, lsKey, fallback)

      expect(result).toEqual(fileData)
      expect(localStorageMock.getItem(lsKey)).toBeNull()
      expect(invoke).toHaveBeenCalledWith("read_file", expect.objectContaining({ path: expect.stringContaining(jsonName) }))
    })

    it("JSON file 存在時不會呼叫 writeJsonFileImmediate", async () => {
      const fileData = { panes: [] }
      vi.mocked(invoke).mockResolvedValueOnce(JSON.stringify(fileData))

      await migrateFromLocalStorage(jsonName, lsKey, fallback)

      expect(writeJsonFileImmediate).not.toHaveBeenCalled()
    })
  })

  describe("Branch 2: JSON file 不存在，localStorage 有資料", () => {
    it("JSON file 缺失時從 localStorage 讀取並寫入 JSON", async () => {
      vi.mocked(invoke).mockRejectedValueOnce(new Error("file not found"))
      const lsData = { panes: [{ id: "2", name: "From LS" }] }
      localStorageMock.setItem(lsKey, JSON.stringify(lsData))

      const result = await migrateFromLocalStorage(jsonName, lsKey, fallback)

      expect(result).toEqual(lsData)
      expect(writeJsonFileImmediate).toHaveBeenCalledWith(jsonName, lsData)
      expect(localStorageMock.getItem(lsKey)).toBeNull()
    })
  })

  describe("Branch 3: JSON file 不存在，localStorage 也沒有資料", () => {
    it("兩者都缺失時返回 fallback", async () => {
      vi.mocked(invoke).mockRejectedValueOnce(new Error("file not found"))

      const result = await migrateFromLocalStorage(jsonName, lsKey, fallback)

      expect(result).toEqual(fallback)
      expect(writeJsonFileImmediate).not.toHaveBeenCalled()
    })

    it("localStorage 有損壞 JSON 時返回 fallback", async () => {
      vi.mocked(invoke).mockRejectedValueOnce(new Error("file not found"))
      localStorageMock.setItem(lsKey, "{{invalid json}}")

      const result = await migrateFromLocalStorage(jsonName, lsKey, fallback)

      expect(result).toEqual(fallback)
    })
  })

  describe("不同 fallback 型別", () => {
    it("fallback 為陣列時正常運作", async () => {
      vi.mocked(invoke).mockRejectedValueOnce(new Error("no file"))
      const arrFallback: string[] = []

      const result = await migrateFromLocalStorage<string[]>(jsonName, lsKey, arrFallback)

      expect(result).toEqual([])
    })

    it("fallback 為 null 時正常運作", async () => {
      vi.mocked(invoke).mockRejectedValueOnce(new Error("no file"))

      const result = await migrateFromLocalStorage<null>(jsonName, lsKey, null)

      expect(result).toBeNull()
    })
  })
})
