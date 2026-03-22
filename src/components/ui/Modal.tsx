import { useEffect } from "react"
import { MONO_FONT } from "../../ui"

interface ModalProps {
  title: string
  onClose: () => void
  width?: number | string
  children: React.ReactNode
}

export default function Modal({ title, onClose, width = 520, children }: ModalProps) {
  // Capture phase so ESC always fires regardless of focus position
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        e.stopImmediatePropagation()
        onClose()
      }
    }
    window.addEventListener("keydown", handler, true)
    return () => window.removeEventListener("keydown", handler, true)
  }, [onClose])

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.8)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width, maxHeight: "90vh", maxWidth: "calc(100vw - 40px)",
          display: "flex", flexDirection: "column",
          background: "var(--bg)", border: "1px solid var(--border)",
          borderTop: "2px solid var(--green)", fontFamily: MONO_FONT,
        }}
        onClick={e => e.stopPropagation()}
        onKeyDown={e => { if (e.key === "Escape") { e.stopPropagation(); onClose() } }}
      >
        {/* Unified header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "8px 16px", borderBottom: "1px solid var(--border)", flexShrink: 0,
        }}>
          <span style={{ fontSize: 10, color: "var(--green)", letterSpacing: "0.1em" }}>
            ─ {title.toUpperCase()} ─
          </span>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none",
              color: "var(--muted)", fontFamily: MONO_FONT, fontSize: 14,
              padding: "0 4px", cursor: "pointer", lineHeight: 1,
            }}
            onMouseEnter={e => { e.currentTarget.style.color = "var(--red)" }}
            onMouseLeave={e => { e.currentTarget.style.color = "var(--muted)" }}
          >[×]</button>
        </div>
        {/* Scrollable content */}
        <div style={{ overflowY: "auto", flex: 1 }}>
          {children}
        </div>
      </div>
    </div>
  )
}
