import { describe, it, expect } from "vitest"
import { SCHEMES, DEFAULT_SCHEME, type ColorScheme } from "../theme"

describe("theme", () => {
  describe("SCHEMES", () => {
    it("包含 DEFAULT_SCHEME 對應的主題", () => {
      expect(SCHEMES[DEFAULT_SCHEME]).toBeDefined()
    })

    it("DEFAULT_SCHEME 是 nightfox", () => {
      expect(DEFAULT_SCHEME).toBe("nightfox")
    })

    it("每個 scheme 都有必要欄位", () => {
      const requiredFields: (keyof ColorScheme)[] = [
        "name", "background", "foreground", "cursor", "selection",
        "green", "red", "blue", "yellow", "cyan", "magenta",
        "surface", "border", "muted", "ansi"
      ]
      for (const [schemeKey, scheme] of Object.entries(SCHEMES)) {
        for (const field of requiredFields) {
          expect(scheme[field], `${schemeKey} 缺少 ${field}`).toBeDefined()
        }
      }
    })

    it("每個 scheme 的 ansi 有 16 色", () => {
      const ansiFields = [
        "black", "red", "green", "yellow", "blue", "magenta", "cyan", "white",
        "brightBlack", "brightRed", "brightGreen", "brightYellow",
        "brightBlue", "brightMagenta", "brightCyan", "brightWhite",
      ]
      for (const [schemeKey, scheme] of Object.entries(SCHEMES)) {
        for (const field of ansiFields) {
          expect(
            (scheme.ansi as Record<string, string>)[field],
            `${schemeKey}.ansi 缺少 ${field}`
          ).toBeDefined()
        }
      }
    })

    it("所有顏色值都是有效的 hex 格式", () => {
      const hexRegex = /^#[0-9a-fA-F]{3,8}$/
      for (const [schemeKey, scheme] of Object.entries(SCHEMES)) {
        const topLevel = ["background", "foreground", "cursor", "selection",
          "green", "red", "blue", "yellow", "cyan", "magenta", "surface", "border", "muted"]
        for (const field of topLevel) {
          expect(
            hexRegex.test((scheme as unknown as Record<string, string>)[field]),
            `${schemeKey}.${field} 不是有效的 hex 顏色`
          ).toBe(true)
        }
        for (const [ansiKey, ansiVal] of Object.entries(scheme.ansi)) {
          expect(
            hexRegex.test(ansiVal),
            `${schemeKey}.ansi.${ansiKey} 不是有效的 hex 顏色`
          ).toBe(true)
        }
      }
    })

    it("包含所有預期的主題名稱", () => {
      const expectedSchemes = ["nightfox", "kanagawa", "default", "hacker",
        "amber", "nightfly", "lucario", "miasma", "gotham", "gruvbox"]
      for (const name of expectedSchemes) {
        expect(SCHEMES[name], `缺少 ${name} 主題`).toBeDefined()
      }
    })

    it("每個 scheme 的 name 欄位不為空", () => {
      for (const [key, scheme] of Object.entries(SCHEMES)) {
        expect(scheme.name, `${key}.name 為空`).toBeTruthy()
      }
    })
  })
})
