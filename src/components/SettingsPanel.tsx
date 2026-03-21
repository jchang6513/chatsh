import { useState } from "react"
import { useSettings } from "../SettingsContext"
import { DEFAULT_SETTINGS, type TerminalSettings, type AgentTerminalOverrides } from "../settings"
import { loadTemplates, saveTemplates, type Template, KNOWN_TOOLS } from "../templates"
import type { Agent } from "../types"

interface Props {
  agents: Agent[]
  onTemplatesChange?: (templates: Template[]) => void
  onClose: () => void
}

const monoFont = '"SF Mono", "Menlo", "Monaco", "Courier New", monospace'

type MainTab = "terminal" | "templates"
type TerminalTab = "global" | string // "global" or agentId

const SYSTEM_PROMPT_FILES: Record<string, string> = {
  claude: "CLAUDE.md", gemini: "GEMINI.md", codex: "AGENTS.md",
}

export default function SettingsPanel({ agents, onTemplatesChange, onClose }: Props) {
  const {
    globalSettings,
    updateGlobalSettings,
    agentOverrides,
    updateAgentOverrides,
    clearAgentOverrides,
    getResolvedSettings,
  } = useSettings()

  const [mainTab, setMainTab] = useState<MainTab>("terminal")
  const [activeTab, setActiveTab] = useState<TerminalTab>("global")

  // Templates state
  const [templates, setTemplates] = useState<Template[]>(loadTemplates)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [showNewTemplate, setShowNewTemplate] = useState(false)
  const [newTpl, setNewTpl] = useState({ name: "", command: "", workingDir: "~", description: "" })

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
    // full replacement
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
          title="Reset to global"
        >
          RESET
        </button>
      )}
      {!isGlobal && !isOverridden(key) && (
        <span style={{ fontSize: 9, color: "var(--muted)", opacity: 0.5, flexShrink: 0, width: 40, textAlign: "center" }}>
          Global
        </span>
      )}
    </div>
  )

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0, 0, 0, 0.8)" }}
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
        {/* Header */}
        <div style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>┌─── PREFERENCES ───┐</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--green)" }}>Terminal Settings</div>
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

        {/* Main tabs: TERMINAL / TEMPLATES */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--border)", fontSize: 10, letterSpacing: "0.06em", flexShrink: 0 }}>
          {([["terminal", "Terminal"], ["templates", "Templates"]] as [MainTab, string][]).map(([t, label]) => (
            <div key={t} onClick={() => setMainTab(t)} style={{
              padding: "7px 16px", cursor: "pointer",
              borderBottom: mainTab === t ? "2px solid var(--green)" : "2px solid transparent",
              color: mainTab === t ? "var(--green)" : "var(--muted)",
            }}>{label}</div>
          ))}
        </div>

        {/* Terminal sub-tabs */}
        {mainTab === "terminal" && <div style={{
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
        </div>}

        {/* Settings content */}
        <div style={{ flex: 1, overflow: "auto", padding: 16 }}>

          {/* TEMPLATES tab */}
          {mainTab === "templates" && (() => {
            const builtinIds = KNOWN_TOOLS.map(t => t.id)
            const userTemplates = templates.filter(t => !builtinIds.includes(t.id))
            const mono = monoFont
            const inputSt: React.CSSProperties = {
              background: "var(--bg)", border: "1px solid var(--border)",
              color: "var(--fg)", fontFamily: mono, fontSize: 11,
              padding: "5px 8px", outline: "none", width: "100%", boxSizing: "border-box" as const,
            }
            const onFocus = (e: React.FocusEvent<HTMLInputElement>) => e.currentTarget.style.borderColor = "var(--green)"
            const onBlur = (e: React.FocusEvent<HTMLInputElement>) => e.currentTarget.style.borderColor = "var(--border)"

            const saveNewTemplate = () => {
              if (!newTpl.name.trim() || !newTpl.command.trim()) return
              const t: Template = {
                id: Date.now().toString(),
                name: newTpl.name.trim(),
                command: newTpl.command.trim(),
                workingDir: newTpl.workingDir.trim() || "~",
                description: newTpl.description.trim(),
                isBuiltin: false,
              }
              const next = [...templates, t]
              setTemplates(next)
              saveTemplates(next)
              onTemplatesChange?.(next)
              setShowNewTemplate(false)
              setNewTpl({ name: "", command: "", workingDir: "~", description: "" })
            }

            const deleteTemplate = (id: string) => {
              const next = templates.filter(t => t.id !== id)
              setTemplates(next)
              saveTemplates(next)
              onTemplatesChange?.(next)
            }

            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Auto-detected (read-only) */}
                <div>
                  <div style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.08em", marginBottom: 8 }}>Auto-detected</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {KNOWN_TOOLS.map(t => (
                      <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", border: "1px solid var(--border)", fontSize: 11 }}>
                        <span style={{ color: "var(--fg)", flex: 1 }}>{t.name}</span>
                        <code style={{ color: "var(--muted)", fontSize: 10 }}>{t.command}</code>
                        <span style={{ fontSize: 9, color: "var(--green)", border: "1px solid var(--green)", padding: "1px 4px" }}>AUTO</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Custom Templates */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <div style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.08em" }}>Custom Templates</div>
                    <button onClick={() => setShowNewTemplate(v => !v)}
                      style={{ background: "none", border: "1px solid var(--border)", color: "var(--muted)", fontFamily: mono, fontSize: 9, padding: "2px 6px", cursor: "pointer" }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--green)"; e.currentTarget.style.color = "var(--green)"; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--muted)"; }}
                    >[+ New]</button>
                  </div>

                  {/* New template form */}
                  {showNewTemplate && (
                    <div style={{ border: "1px solid var(--green)", padding: 10, marginBottom: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ fontSize: 10, color: "var(--green)" }}>NEW TEMPLATE</div>
                      {[
                        { label: "Name", key: "name" as const, placeholder: "e.g. Backend Assistant" },
                        { label: "Command", key: "command" as const, placeholder: "e.g. claude or python3" },
                        { label: "Working Dir", key: "workingDir" as const, placeholder: "~" },
                        { label: "Description", key: "description" as const, placeholder: "Optional" },
                      ].map(({ label, key, placeholder }) => (
                        <label key={key} style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 10, color: "var(--muted)" }}>
                          {label}
                          <input value={newTpl[key]} onChange={e => setNewTpl(p => ({ ...p, [key]: e.target.value }))}
                            style={inputSt} placeholder={placeholder} onFocus={onFocus} onBlur={onBlur} />
                        </label>
                      ))}
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        <button onClick={() => setShowNewTemplate(false)}
                          style={{ background: "none", border: "1px solid var(--border)", color: "var(--muted)", fontFamily: mono, fontSize: 10, padding: "3px 8px", cursor: "pointer" }}
                        >[Cancel]</button>
                        <button onClick={saveNewTemplate}
                          style={{ background: "none", border: "1px solid var(--green)", color: "var(--green)", fontFamily: mono, fontSize: 10, padding: "3px 8px", cursor: "pointer" }}
                          onMouseEnter={e => { e.currentTarget.style.background = "var(--green)"; e.currentTarget.style.color = "var(--bg)"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "var(--green)"; }}
                        >[Save]</button>
                      </div>
                    </div>
                  )}

                  {userTemplates.length === 0 && !showNewTemplate && (
                    <div style={{ fontSize: 11, color: "var(--muted)", padding: "12px 0", textAlign: "center" }}>
                      No custom templates yet
                    </div>
                  )}

                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {userTemplates.map(t => (
                      <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", border: "1px solid var(--border)", fontSize: 11 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ color: "var(--fg)" }}>{t.name}</span>
                          {t.description && <span style={{ color: "var(--muted)", fontSize: 10, marginLeft: 8 }}>{t.description}</span>}
                        </div>
                        <code style={{ color: "var(--muted)", fontSize: 10 }}>{t.command}</code>
                        <button onClick={() => deleteTemplate(t.id)}
                          style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontFamily: mono, fontSize: 10, padding: "0 4px" }}
                          onMouseEnter={e => e.currentTarget.style.color = "var(--red)"}
                          onMouseLeave={e => e.currentTarget.style.color = "var(--muted)"}
                        >[×]</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          })()}

          {mainTab === "terminal" && !isGlobal && (
            <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 12, padding: "4px 8px", border: "1px dashed var(--border)" }}>
              Agent settings override global. Click RESET to revert.
            </div>
          )}

          {mainTab === "terminal" && <div id="terminal-settings">
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
          </div>}
        </div>

        {/* Footer */}
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
            [{isGlobal ? "Reset All" : "Clear Agent Settings"}]
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
            [Close]
          </button>
        </div>
      </div>
    </div>
  )
}
