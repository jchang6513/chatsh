const COLORS = [
  "#e74c3c", "#e67e22", "#f1c40f", "#2ecc71",
  "#1abc9c", "#3498db", "#9b59b6", "#e91e63",
];

function hashColor(name: string): string {
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff;
  return COLORS[hash % COLORS.length];
}

export default function Avatar({
  name,
  imageUrl,
  size = 36,
}: {
  name: string;
  imageUrl?: string;
  size?: number;
}) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
        }}
      />
    );
  }
  const initial = name.trim()[0]?.toUpperCase() ?? "?";
  const color = hashColor(name);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.42,
        fontWeight: 600,
        color: "rgba(255,255,255,0.9)",
        flexShrink: 0,
        userSelect: "none",
      }}
    >
      {initial}
    </div>
  );
}
