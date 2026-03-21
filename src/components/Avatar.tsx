import { MONO_FONT } from "../ui"
// Terminal ANSI color palette (aligned with xterm theme)
const COLORS = [
  "#00ff9f", // green
  "#00ccff", // blue
  "#ffcc00", // yellow
  "#ff00ff", // magenta
  "#00ffff", // cyan
  "#ff3333", // red
  "#ff66ff", // pink
  "#33ddff", // blue-light
]

function hashColor(name: string): string {
  let hash = 0
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff
  return COLORS[hash % COLORS.length]
}

interface AvatarProps {
  name: string
  imageUrl?: string
  size?: number
}

export default function Avatar({ name, imageUrl, size }: AvatarProps) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        style={{ width: size ?? 36, height: size ?? 36, objectFit: "cover", flexShrink: 0 }}
        alt={name}
      />
    )
  }
  const initial = name.trim()[0]?.toUpperCase() ?? "?"
  const color = hashColor(name)
  return (
    <span style={{
      fontFamily: MONO_FONT,
      fontSize: 11,
      color: color,
      border: `1px solid ${color}`,
      padding: "1px 4px",
      flexShrink: 0,
      userSelect: "none",
    }}>
      {initial}
    </span>
  )
}
