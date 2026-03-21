import { open } from "@tauri-apps/plugin-dialog"
import { MONO_FONT, onHoverGreen, onLeaveGreen } from "../../ui"

interface Props {
  onSelect: (path: string) => void
}

export default function FolderButton({ onSelect }: Props) {
  const pick = async () => {
    const result = await open({ directory: true, multiple: false })
    if (typeof result === "string") onSelect(result)
  }

  return (
    <button
      type="button"
      onClick={pick}
      style={{
        padding: "4px 8px",
        background: "transparent",
        border: "1px solid var(--border)",
        color: "var(--muted)",
        fontFamily: MONO_FONT,
        fontSize: 10,
        cursor: "pointer",
        flexShrink: 0,
      }}
      onMouseEnter={onHoverGreen}
      onMouseLeave={onLeaveGreen}
    >
      [...]
    </button>
  )
}
