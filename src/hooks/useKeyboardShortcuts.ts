import { useEffect } from "react"

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
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const meta = e.metaKey // ⌘ on Mac
      const shift = e.shiftKey

      // only intercept outside input/textarea (except xterm helper)
      const target = e.target as HTMLElement
      const inInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA"
      // do not intercept xterm helper textarea
      if (e.key === "Escape") {
        e.preventDefault()
        handlers.onEscape()
        return
      }

      if (inInput && !target.classList.contains("xterm-helper-textarea")) return

      if (!meta) return

      // ⌘1-9: switch agent
      if (e.key >= "1" && e.key <= "9" && !shift) {
        e.preventDefault()
        handlers.onSelectAgent(parseInt(e.key) - 1)
        return
      }

      switch (e.key) {
        case "[":
          if (!shift) { e.preventDefault(); handlers.onPrevAgent() }
          else { e.preventDefault(); handlers.onPrevShell() }
          break
        case "]":
          if (!shift) { e.preventDefault(); handlers.onNextAgent() }
          else { e.preventDefault(); handlers.onNextShell() }
          break
        case "n":
          if (!shift) { e.preventDefault(); handlers.onNewAgent() }
          break
        case "r":
          if (!shift) { e.preventDefault(); handlers.onRestartAgent() }
          break
        case ",":
          e.preventDefault(); handlers.onOpenSettings()
          break
        case "t":
          if (!shift) { e.preventDefault(); handlers.onNewShell() }
          break
        case "w":
          if (!shift) { e.preventDefault(); handlers.onCloseShell() }
          break
        case "k":
          if (!shift) { e.preventDefault(); handlers.onToggleCommandPalette() }
          break
        case "=":
        case "+":
          e.preventDefault(); handlers.onFontIncrease()
          break
        case "-":
          e.preventDefault(); handlers.onFontDecrease()
          break
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [handlers])
}
