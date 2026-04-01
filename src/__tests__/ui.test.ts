import { describe, it, expect, vi } from "vitest"
import {
  MONO_FONT,
  INPUT_STYLE,
  BTN_BASE,
  LABEL_STYLE,
  onHoverGreen,
  onLeaveGreen,
  onFocusInput,
  onBlurInput,
  onHoverBorder,
  onLeaveBorder,
} from "../ui"

// Helper to create a mock element with style
function mockButton(initialStyle: Record<string, string> = {}) {
  const style: Record<string, string> = { ...initialStyle }
  return {
    currentTarget: {
      style,
    },
  }
}

function mockInput(initialStyle: Record<string, string> = {}) {
  return {
    currentTarget: {
      style: { ...initialStyle },
    },
  }
}

describe("ui constants", () => {
  describe("MONO_FONT", () => {
    it("是非空字串", () => {
      expect(typeof MONO_FONT).toBe("string")
      expect(MONO_FONT.length).toBeGreaterThan(0)
    })

    it("包含 monospace 作為 fallback", () => {
      expect(MONO_FONT).toContain("monospace")
    })
  })

  describe("INPUT_STYLE", () => {
    it("有 background 設定", () => {
      expect(INPUT_STYLE.background).toBeDefined()
    })

    it("有 border 設定", () => {
      expect(INPUT_STYLE.border).toBeDefined()
    })

    it("width 是 100%", () => {
      expect(INPUT_STYLE.width).toBe("100%")
    })

    it("fontFamily 使用 MONO_FONT", () => {
      expect(INPUT_STYLE.fontFamily).toBe(MONO_FONT)
    })
  })

  describe("BTN_BASE", () => {
    it("background 是 transparent", () => {
      expect(BTN_BASE.background).toBe("transparent")
    })

    it("cursor 是 pointer", () => {
      expect(BTN_BASE.cursor).toBe("pointer")
    })

    it("fontFamily 使用 MONO_FONT", () => {
      expect(BTN_BASE.fontFamily).toBe(MONO_FONT)
    })
  })

  describe("LABEL_STYLE", () => {
    it("flexDirection 是 column", () => {
      expect(LABEL_STYLE.flexDirection).toBe("column")
    })

    it("display 是 flex", () => {
      expect(LABEL_STYLE.display).toBe("flex")
    })
  })
})

describe("ui event handlers", () => {
  describe("onHoverGreen / onLeaveGreen", () => {
    it("hover 時設定綠色 borderColor 和 color", () => {
      const evt = mockButton()
      onHoverGreen(evt as unknown as React.MouseEvent<HTMLButtonElement>)
      expect(evt.currentTarget.style.borderColor).toBe("var(--green)")
      expect(evt.currentTarget.style.color).toBe("var(--green)")
    })

    it("leave 時還原 borderColor 和 color", () => {
      const evt = mockButton()
      onLeaveGreen(evt as unknown as React.MouseEvent<HTMLButtonElement>)
      expect(evt.currentTarget.style.borderColor).toBe("var(--border)")
      expect(evt.currentTarget.style.color).toBe("var(--muted)")
    })
  })

  describe("onFocusInput / onBlurInput", () => {
    it("focus 時設定綠色 borderColor", () => {
      const evt = mockInput()
      onFocusInput(evt as unknown as React.FocusEvent<HTMLInputElement>)
      expect(evt.currentTarget.style.borderColor).toBe("var(--green)")
    })

    it("blur 時還原 borderColor", () => {
      const evt = mockInput()
      onBlurInput(evt as unknown as React.FocusEvent<HTMLInputElement>)
      expect(evt.currentTarget.style.borderColor).toBe("var(--border)")
    })
  })

  describe("onHoverBorder / onLeaveBorder", () => {
    it("hover 時設定綠色 borderColor", () => {
      const element = { style: {} as Record<string, string> }
      const evt = { currentTarget: element }
      onHoverBorder(evt as unknown as React.MouseEvent<HTMLButtonElement>)
      expect(element.style.borderColor).toBe("var(--green)")
    })

    it("leave 時還原 borderColor", () => {
      const element = { style: {} as Record<string, string> }
      const evt = { currentTarget: element }
      onLeaveBorder(evt as unknown as React.MouseEvent<HTMLButtonElement>)
      expect(element.style.borderColor).toBe("var(--border)")
    })

    it("可用於 div 元素", () => {
      const element = { style: {} as Record<string, string> }
      const evt = { currentTarget: element }
      onHoverBorder(evt as unknown as React.MouseEvent<HTMLDivElement>)
      expect(element.style.borderColor).toBe("var(--green)")
    })
  })
})
