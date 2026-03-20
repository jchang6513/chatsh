// Terminal ANSI 色系 palette（對齊 xterm theme）
const COLORS = [
  "#3fb950", // green
  "#4a9eff", // blue
  "#e67e22", // orange (ANSI yellow-bright)
  "#9b59b6", // magenta
  "#1abc9c", // cyan
  "#f85149", // red
  "#e91e63", // pink
  "#58a6ff", // blue-light
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

export default function Avatar({ name, imageUrl, size = 36 }: AvatarProps) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
        alt={name}
      />
    )
  }
  const initial = name.trim()[0]?.toUpperCase() ?? "?"
  const color = hashColor(name)
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: "50%",
      background: color,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: Math.round(size * 0.42),
      fontWeight: 700,
      color: "var(--bg)",
      flexShrink: 0,
      userSelect: "none",
      fontFamily: "Menlo, Monaco, monospace",
    }}>
      {initial}
    </div>
  )
}
