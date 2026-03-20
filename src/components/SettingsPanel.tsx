import { useState } from "react"
import { useSettings } from "../SettingsContext"
import { DEFAULT_SETTINGS, type TerminalSettings, type AgentTerminalOverrides } from "../settings"
import type { Agent } from "../types"

interface Props {
  agents: Agent[]
  onClose: () => void
}

const monoFont = '"SF Mono", "Menlo", "Monaco", "Courier New", monospace'

type Tab = "global" | string // "global" or agentId

export default function SettingsPanel({ agents, onClose }: Props) {
  const {
    globalSettings,
    updateGlobalSettings,
    agentOverrides,
    updateAgentOverrides,
    clearAgentOverrides,
    getResolvedSettings,
  } = useSettings()

  const [activeTab, setActiveTab] = useState<Tab>("global")

  const isGlobal = activeTab === "global"
  const currentAgent = agents.find(a => a.id === activeTab)
  const currentOverrides = !isGlobal ? (agentOverrides[activeTab] ?? {}) : {}
  const resolved = isGlobal ? globalSettings : getResolvedSettings(activeTab)

  const updateField = <K extends keyof TerminalSettings>(key: K, value: TerminalSettings[K]) => {
    if (isGlobal) {
      updateGlobalSettings({ [key]: value })
    } else {
      updateAgentOverrides(activeTab, { [key]: value })
    }
  }

  const isOverridden = (key: keyof TerminalSettings) => {
    if (isGlobal) return false
    return key in currentOverrides && currentOverrides[key] !== undefined
  }

  const clearField = (key: keyof AgentTerminalOverrides) => {
    if (isGlobal) return
    const next = { ...currentOverrides }
    delete next[key]
    updateAgentOverrides(activeTab, next)
    // 完全置き換え
    clearAgentOverrides(activeTab)
    if (Object.keys(next).length > 0) {
      updateAgentOverrides(activeTab, next)
    }
  }

  const resetAll = () => {
    if (isGlobal) {
      updateGlobalSettings(DEFAULT_SETTINGS)
    } else {
      clearAgentOverrides(activeTab)
    }
  }

  const inputStyle: React.CSSProperties = {
    background: "var(--bg)",
    border: "1px solid var(--border)",
    padding: "4px 8px",
    fontSize: 11,
    color: "var(--fg)",
    outline: "none",
    fontFamily: monoFont,
    borderRadius: 0,
    width: "100%",
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 10,
    color: "var(--muted)",
    letterSpacing: "0.06em",
    textTransform: "uppercase" as const,
  }

  const sectionStyle: React.CSSProperties = {
    marginBottom: 16,
    padding: "0 0 12px 0",
    borderBottom: "1px solid var(--border)",
  }

  const renderFieldRow = (
    label: string,
    key: keyof TerminalSettings,
    input: React.ReactNode,
  ) => (
    <div key={key} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
      <span style={{ ...labelStyle, width: 120, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1 }}>{input}</div>
      {!isGlobal && isOverridden(key) && (
        <button
          onClick={() => clearField(key)}
          style={{
            background: "transparent",
            border: "1px solid var(--border)",
            color: "var(--muted)",
            fontFamily: monoFont,
            fontSize: 9,
            padding: "1px 4px",
            cursor: "pointer",
            flexShrink: 0,
          }}
          onMouseEnter={e => { e.currentTarget.style.color = "var(--red)"; e.currentTarget.style.borderColor = "var(--red)" }}
          onMouseLeave={e => { e.currentTarget.style.color = "var(--muted)"; e.currentTarget.style.borderColor = "var(--border)" }}
          title="全域設定に戻す"
        >
          RESET
        </button>
      )}
      {!isGlobal && !isOverridden(key) && (
        <span style={{ fontSize: 9, color: "var(--muted)", opacity: 0.5, flexShrink: 0, width: 40, textAlign: "center" }}>
          全域
        </span>
      )}
    </div>
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0, 0, 0, 0.8)" }}
      onClick={onClose}
    >
      <div
        style={{
          width: 560,
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          background: "var(--bg)",
          border: "1px solid var(--border)",
          fontFamily: monoFont,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>┌─── PREFERENCES ───┐</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--green)" }}>端末設定</div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "1px solid var(--border)",
              color: "var(--muted)",
              fontFamily: monoFont,
              fontSize: 10,
              padding: "2px 8px",
              cursor: "pointer",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--red)"; e.currentTarget.style.color = "var(--red)" }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--muted)" }}
          >
            [ESC]
          </button>
        </div>

        {/* タブバー */}
        <div style={{
          display: "flex",
          borderBottom: "1px solid var(--border)",
          fontSize: 10,
          letterSpacing: "0.06em",
          overflowX: "auto",
          flexShrink: 0,
        }}>
          <div
            onClick={() => setActiveTab("global")}
            style={{
              padding: "6px 14px",
              cursor: "pointer",
              borderBottom: isGlobal ? "2px solid var(--green)" : "2px solid transparent",
              color: isGlobal ? "var(--green)" : "var(--muted)",
            }}
          >
            GLOBAL
          </div>
          {agents.map(agent => {
            const isActive = activeTab === agent.id
            const hasOverride = Object.keys(agentOverrides[agent.id] ?? {}).length > 0
            return (
              <div
                key={agent.id}
                onClick={() => setActiveTab(agent.id)}
                style={{
                  padding: "6px 14px",
                  cursor: "pointer",
                  borderBottom: isActive ? "2px solid var(--green)" : "2px solid transparent",
                  color: isActive ? "var(--green)" : "var(--muted)",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                {agent.name}
                {hasOverride && <span style={{ color: "var(--yellow)", fontSize: 8 }}>*</span>}
              </div>
            )
          })}
        </div>

        {/* 設定内容 */}
        <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
          {!isGlobal && (
            <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 12, padding: "4px 8px", border: "1px dashed var(--border)" }}>
              Agent 別設定は全域設定を上書きします。「RESET」で全域設定に戻ります。
            </div>
          )}

          {/* Text */}
          <div style={sectionStyle}>
            <div style={{ fontSize: 11, color: "var(--fg)", fontWeight: 600, marginBottom: 8 }}>TEXT</div>
            {renderFieldRow("Font Family", "fontFamily",
              <input
                value={isGlobal ? resolved.fontFamily : (isOverridden("fontFamily") ? (currentOverrides.fontFamily ?? "") : resolved.fontFamily)}
                onChange={e => updateField("fontFamily", e.target.value)}
                style={inputStyle}
                onFocus={e => e.currentTarget.style.borderColor = "var(--green)"}
                onBlur={e => e.currentTarget.style.borderColor = "var(--border)"}
              />
            )}
            {renderFieldRow("Font Size", "fontSize",
              <input
                type="number"
                min={8}
                max={32}
                value={resolved.fontSize}
                onChange={e => updateField("fontSize", Number(e.target.value))}
                style={{ ...inputStyle, width: 80 }}
                onFocus={e => e.currentTarget.style.borderColor = "var(--green)"}
                onBlur={e => e.currentTarget.style.borderColor = "var(--border)"}
              />
            )}
            {renderFieldRow("Line Height", "lineHeight",
              <input
                type="number"
                min={1.0}
                max={3.0}
                step={0.1}
                value={resolved.lineHeight}
                onChange={e => updateField("lineHeight", Number(e.target.value))}
                style={{ ...inputStyle, width: 80 }}
                onFocus={e => e.currentTarget.style.borderColor = "var(--green)"}
                onBlur={e => e.currentTarget.style.borderColor = "var(--border)"}
              />
            )}
          </div>

          {/* Cursor */}
          <div style={sectionStyle}>
            <div style={{ fontSize: 11, color: "var(--fg)", fontWeight: 600, marginBottom: 8 }}>CURSOR</div>
            {renderFieldRow("Style", "cursorStyle",
              <div style={{ display: "flex", gap: 4 }}>
                {(["block", "bar", "underline"] as const).map(style => (
                  <button
                    key={style}
                    onClick={() => updateField("cursorStyle", style)}
                    style={{
                      ...inputStyle,
                      width: "auto",
                      padding: "3px 10px",
                      cursor: "pointer",
                      border: resolved.cursorStyle === style
                        ? "1px solid var(--green)"
                        : "1px solid var(--border)",
                      color: resolved.cursorStyle === style ? "var(--green)" : "var(--muted)",
                    }}
                  >
                    {style}
                  </button>
                ))}
              </div>
            )}
            {renderFieldRow("Blink", "cursorBlink",
              <button
                onClick={() => updateField("cursorBlink", !resolved.cursorBlink)}
                style={{
                  ...inputStyle,
                  width: "auto",
                  padding: "3px 10px",
                  cursor: "pointer",
                  color: resolved.cursorBlink ? "var(--green)" : "var(--muted)",
                  border: resolved.cursorBlink ? "1px solid var(--green)" : "1px solid var(--border)",
                }}
              >
                {resolved.cursorBlink ? "ON" : "OFF"}
              </button>
            )}
          </div>

          {/* Scrollback */}
          <div style={sectionStyle}>
            <div style={{ fontSize: 11, color: "var(--fg)", fontWeight: 600, marginBottom: 8 }}>SCROLLBACK</div>
            {renderFieldRow("Lines", "scrollback",
              <input
                type="number"
                min={500}
                max={100000}
                step={500}
                value={resolved.scrollback}
                onChange={e => updateField("scrollback", Number(e.target.value))}
                style={{ ...inputStyle, width: 100 }}
                onFocus={e => e.currentTarget.style.borderColor = "var(--green)"}
                onBlur={e => e.currentTarget.style.borderColor = "var(--border)"}
              />
            )}
          </div>

          {/* Appearance */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: "var(--fg)", fontWeight: 600, marginBottom: 8 }}>APPEARANCE</div>
            {renderFieldRow("BG Opacity", "backgroundOpacity",
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={resolved.backgroundOpacity}
                  onChange={e => updateField("backgroundOpacity", Number(e.target.value))}
                  style={{ flex: 1, accentColor: "var(--green)" }}
                />
                <span style={{ fontSize: 10, color: "var(--fg)", width: 32, textAlign: "right" }}>
                  {Math.round(resolved.backgroundOpacity * 100)}%
                </span>
              </div>
            )}
            {renderFieldRow("Padding", "padding",
              <input
                type="number"
                min={0}
                max={32}
                value={resolved.padding}
                onChange={e => updateField("padding", Number(e.target.value))}
                style={{ ...inputStyle, width: 80 }}
                onFocus={e => e.currentTarget.style.borderColor = "var(--green)"}
                onBlur={e => e.currentTarget.style.borderColor = "var(--border)"}
              />
            )}
          </div>
        </div>

        {/* フッター */}
        <div style={{
          padding: "8px 16px",
          borderTop: "1px solid var(--border)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <button
            onClick={resetAll}
            style={{
              background: "transparent",
              border: "1px solid var(--border)",
              color: "var(--muted)",
              fontFamily: monoFont,
              fontSize: 10,
              padding: "4px 10px",
              cursor: "pointer",
              letterSpacing: "0.05em",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--red)"; e.currentTarget.style.color = "var(--red)" }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--muted)" }}
          >
            [{isGlobal ? "全てリセット" : "Agent 設定クリア"}]
          </button>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "1px solid var(--green)",
              color: "var(--green)",
              fontFamily: monoFont,
              fontSize: 10,
              padding: "4px 10px",
              cursor: "pointer",
              letterSpacing: "0.05em",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--green)"; e.currentTarget.style.color = "var(--bg)" }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--green)" }}
          >
            [閉じる]
          </button>
        </div>
      </div>
    </div>
  )
}
