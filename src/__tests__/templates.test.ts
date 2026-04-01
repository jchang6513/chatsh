import { describe, it, expect, beforeEach, vi } from "vitest"
import {
  DEFAULT_TEMPLATES,
  loadTemplates,
  saveTemplates,
  addTemplate,
  removeTemplate,
  type Template,
} from "../templates"

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

const STORAGE_KEY = "chatsh_templates"

describe("templates", () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  describe("DEFAULT_TEMPLATES", () => {
    it("包含 4 個預設 template", () => {
      expect(DEFAULT_TEMPLATES).toHaveLength(4)
    })

    it("所有預設 template 都是 builtin", () => {
      DEFAULT_TEMPLATES.forEach(t => {
        expect(t.isBuiltin).toBe(true)
      })
    })

    it("包含 shell, claude, gemini, codex", () => {
      const ids = DEFAULT_TEMPLATES.map(t => t.id)
      expect(ids).toContain("shell")
      expect(ids).toContain("claude")
      expect(ids).toContain("gemini")
      expect(ids).toContain("codex")
    })
  })

  describe("loadTemplates", () => {
    it("localStorage 空白時返回預設 templates 並儲存", () => {
      const result = loadTemplates()
      expect(result).toHaveLength(4)
      expect(result[0].id).toBe("shell")
      // 應該已寫入 localStorage
      expect(localStorageMock.getItem(STORAGE_KEY)).not.toBeNull()
    })

    it("localStorage 有有效資料時讀取成功", () => {
      const custom: Template[] = [
        { id: "custom1", name: "My Tool", command: "mytool", workingDir: "~", description: "test", isBuiltin: false }
      ]
      localStorageMock.setItem(STORAGE_KEY, JSON.stringify(custom))
      const result = loadTemplates()
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe("custom1")
    })

    it("localStorage 有空陣列時 fallback 到預設", () => {
      localStorageMock.setItem(STORAGE_KEY, JSON.stringify([]))
      const result = loadTemplates()
      expect(result).toHaveLength(4)
    })

    it("localStorage 有損壞的 JSON 時 fallback 到預設", () => {
      localStorageMock.setItem(STORAGE_KEY, "not-valid-json{{}")
      const result = loadTemplates()
      expect(result).toHaveLength(4)
    })
  })

  describe("saveTemplates", () => {
    it("將 templates 寫入 localStorage", () => {
      const templates: Template[] = [
        { id: "t1", name: "Test", command: "test", workingDir: "~", description: "d", isBuiltin: false }
      ]
      saveTemplates(templates)
      const saved = JSON.parse(localStorageMock.getItem(STORAGE_KEY) ?? "[]") as Template[]
      expect(saved).toHaveLength(1)
      expect(saved[0].id).toBe("t1")
    })
  })

  describe("addTemplate", () => {
    it("新增 template 到清單", () => {
      const existing: Template[] = DEFAULT_TEMPLATES
      const newT: Template = {
        id: "new1", name: "New", command: "new", workingDir: "~", description: "new tool", isBuiltin: false
      }
      const result = addTemplate(existing, newT)
      expect(result).toHaveLength(5)
      expect(result.find(t => t.id === "new1")).toBeTruthy()
    })

    it("同 id 的 template 會被取代（dedup）", () => {
      const existing: Template[] = [
        { id: "t1", name: "Old", command: "old", workingDir: "~", description: "old", isBuiltin: false }
      ]
      const updated: Template = {
        id: "t1", name: "New", command: "new", workingDir: "~", description: "new", isBuiltin: false
      }
      const result = addTemplate(existing, updated)
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe("New")
    })

    it("addTemplate 後會儲存到 localStorage", () => {
      const result = addTemplate([], {
        id: "x", name: "X", command: "x", workingDir: "~", description: "x", isBuiltin: false
      })
      const saved = JSON.parse(localStorageMock.getItem(STORAGE_KEY) ?? "[]") as Template[]
      expect(saved).toHaveLength(1)
      expect(result).toHaveLength(1)
    })
  })

  describe("removeTemplate", () => {
    it("刪除指定 id 的 template", () => {
      const templates: Template[] = [
        { id: "t1", name: "T1", command: "t1", workingDir: "~", description: "d", isBuiltin: false },
        { id: "t2", name: "T2", command: "t2", workingDir: "~", description: "d", isBuiltin: true },
      ]
      const result = removeTemplate(templates, "t1")
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe("t2")
    })

    it("刪除不存在的 id 時不影響結果", () => {
      const templates: Template[] = [
        { id: "t1", name: "T1", command: "t1", workingDir: "~", description: "d", isBuiltin: false },
      ]
      const result = removeTemplate(templates, "nonexistent")
      expect(result).toHaveLength(1)
    })

    it("刪除後儲存到 localStorage", () => {
      const templates: Template[] = [
        { id: "t1", name: "T1", command: "t1", workingDir: "~", description: "d", isBuiltin: false },
        { id: "t2", name: "T2", command: "t2", workingDir: "~", description: "d", isBuiltin: true },
      ]
      removeTemplate(templates, "t1")
      const saved = JSON.parse(localStorageMock.getItem(STORAGE_KEY) ?? "[]") as Template[]
      expect(saved).toHaveLength(1)
      expect(saved[0].id).toBe("t2")
    })

    it("清單為空時刪除不崩潰", () => {
      const result = removeTemplate([], "any")
      expect(result).toHaveLength(0)
    })
  })
})
