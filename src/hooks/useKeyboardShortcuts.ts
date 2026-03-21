import { useEffect, useRef } from "react"

interface Handlers {
  onSelectAgent: (index: number) => void      // ⌘1-9
  onPrevAgent: () => void                      // ⌘[
  onNextAgent: () => void                      // ⌘]
  onNewAgent: () => void                       // ⌘N
  onRestartAgent: () => void                   // ⌘R
  onOpenSettings: () => void                   // ⌘,
  onNewShell: () => void                       // ⌘T
  onCloseShell: () => void                     // ⌘W
  onPrevShell: () => void                      // ⌘Shift+[
  onNextShell: () => void                      // ⌘Shift+]
  onToggleCommandPalette: () => void           // ⌘K
  onEscape: () => void                         // Esc — close any overlay
  onFontIncrease: () => void                   // ⌘+
  onFontDecrease: () => void                   // ⌘-
}

export function useKeyboardShortcuts(handlers: Handlers) {
  // Always keep a ref to the latest handlers — avoids stale closure
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const h = handlersRef.current
      const meta = e.metaKey
      const shift = e.shiftKey

      const target = e.target as HTMLElement
      const inInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA"

      if (e.key === "Escape") {
        e.preventDefault()
        h.onEscape()
        return
      }

      if (inInput && !target.classList.contains("xterm-helper-textarea")) return

      if (!meta) return

      if (e.key >= "1" && e.key <= "9" && !shift) {
        e.preventDefault()
        h.onSelectAgent(parseInt(e.key) - 1)
        return
      }

      switch (e.key) {
        case "[":
          if (!shift) { e.preventDefault(); h.onPrevAgent() }
          else { e.preventDefault(); h.onPrevShell() }
          break
        case "]":
          if (!shift) { e.preventDefault(); h.onNextAgent() }
          else { e.preventDefault(); h.onNextShell() }
          break
        case "n":
          if (!shift) { e.preventDefault(); h.onNewAgent() }
          break
        case "r":
          if (!shift) { e.preventDefault(); h.onRestartAgent() }
          break
        case ",":
          e.preventDefault(); h.onOpenSettings()
          break
        case "t":
          if (!shift) { e.preventDefault(); h.onNewShell() }
          break
        case "w":
          if (!shift) { e.preventDefault(); h.onCloseShell() }
          break
        case "k":
          if (!shift) { e.preventDefault(); h.onToggleCommandPalette() }
          break
        case "=":
        case "+":
          e.preventDefault(); h.onFontIncrease()
          break
        case "-":
          e.preventDefault(); h.onFontDecrease()
          break
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, []) // mount once, always reads latest via ref
}
