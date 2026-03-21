/**
 * Shared UI constants and helpers — keep DRY
 */

export const MONO_FONT = '"SF Mono", "Menlo", "Monaco", "Courier New", monospace'

export const INPUT_STYLE: React.CSSProperties = {
  background: "var(--bg)",
  border: "1px solid var(--border)",
  padding: "8px 12px",
  fontSize: 12,
  color: "var(--fg)",
  outline: "none",
  fontFamily: MONO_FONT,
  width: "100%",
  boxSizing: "border-box",
}

export const BTN_BASE: React.CSSProperties = {
  padding: "6px 12px",
  background: "transparent",
  border: "1px solid var(--border)",
  color: "var(--muted)",
  fontFamily: MONO_FONT,
  fontSize: 11,
  cursor: "pointer",
  borderRadius: 0,
}

export const LABEL_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  fontSize: 10,
  color: "var(--muted)",
  letterSpacing: "0.08em",
}

// Hover handlers for green border buttons
export const onHoverGreen = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.currentTarget.style.borderColor = "var(--green)"
  e.currentTarget.style.color = "var(--green)"
}
export const onLeaveGreen = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.currentTarget.style.borderColor = "var(--border)"
  e.currentTarget.style.color = "var(--muted)"
}

// Input focus/blur handlers
export const onFocusInput = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
  e.currentTarget.style.borderColor = "var(--green)"
}
export const onBlurInput = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
  e.currentTarget.style.borderColor = "var(--border)"
}
