import { MONO_FONT } from "../../ui"

interface Props {
  onClose: () => void
  label?: string
}

export default function CloseButton({ onClose, label = "[×]" }: Props) {
  return (
    <button
      onClick={onClose}
      style={{
        background: "none",
        border: "none",
        color: "var(--muted)",
        cursor: "pointer",
        fontFamily: MONO_FONT,
        fontSize: 12,
        padding: "0 4px",
      }}
      onMouseEnter={e => (e.currentTarget.style.color = "var(--red)")}
      onMouseLeave={e => (e.currentTarget.style.color = "var(--muted)")}
    >
      {label}
    </button>
  )
}
