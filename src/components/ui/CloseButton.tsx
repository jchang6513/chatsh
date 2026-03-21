import { MONO_FONT } from "../../ui"

interface Props {
  onClose: () => void
  style?: React.CSSProperties
}

export default function CloseButton({ onClose, style }: Props) {
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
        ...style,
      }}
      onMouseEnter={e => (e.currentTarget.style.color = "var(--red)")}
      onMouseLeave={e => (e.currentTarget.style.color = "var(--muted)")}
    >
      [×]
    </button>
  )
}
