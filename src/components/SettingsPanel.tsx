import CloseButton from "./ui/CloseButton"
import Modal from "./ui/Modal"
import { MONO_FONT, INPUT_STYLE, LABEL_STYLE, onBlurInput, onFocusInput, onHoverGreen, onLeaveGreen } from "../ui"
import { useState, useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"
import { useSettings } from "../SettingsContext"
import { useTheme } from "../ThemeContext"
import { DEFAULT_SETTINGS, type TerminalSettings } from "../settings"
import { loadTemplates, saveTemplates, type Template } from "../templates"
import type { Pane } from "../types"

interface Props {
  hiddenBuiltins?: Set<string>
  onHiddenBuiltinsChange?: (h: Set<string>) => void
  agents: Pane[]
  onTemplatesChange?: (templates: Template[]) => void
  onClose: () => void
}

const monoFont = MONO_FONT

type MainTab = "terminal" | "appearance" | "keybindings" | "templates"

const SYSTEM_PROMPT_FILES: Record<string, string> = {
  claude: "CLAUDE.md", gemini: "GEMINI.md", codex: "AGENTS.md",
}

export default function SettingsPanel({ agents, onTemplatesChange, hiddenBuiltins: hiddenBuiltinsProp, onHiddenBuiltinsChange, onClose }: Props) {
  const { globalSettings, updateGlobalSettings } = useSettings()
  const { schemeKey, setScheme, availableSchemes } = useTheme()
  const [hoveredScheme, setHoveredScheme] = useState<string | null>(null)
  const hiddenBuiltins = hiddenBuiltinsProp ?? new Set<string>()
  const hideBuiltin = (id: string) => {
    const next = new Set([...hiddenBuiltins, id])
    onHiddenBuiltinsChange?.(next)
  }

  const [mainTab, setMainTab] = useState<MainTab>("terminal")
  const [editingTpl, setEditingTpl] = useState<Template | null>(null)
  const [systemFonts, setSystemFonts] = useState<string[]>([])
  const [fontSearch, setFontSearch] = useState("")

  useEffect(() => {
    invoke<string[]>("list_fonts").then(fonts => {
      const mono = ["SF Mono", "Menlo", "Monaco", "Courier New", "JetBrains Mono", "Fira Code", "Source Code Pro"]
      const filtered = fonts.filter(f => !mono.includes(f))
      setSystemFonts([...mono, ...filtered])
    }).catch(() => {})
  }, [])

  // Templates state
  const [templates, setTemplates] = useState<Template[]>(loadTemplates)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [showNewTemplate, setShowNewTemplate] = useState(false)
  const [newTpl, setNewTpl] = useState({ name: "", command: "", workingDir: "~", description: "" })

  const updateField = <K extends keyof TerminalSettings>(key: K, value: TerminalSettings[K]) => {
    updateGlobalSettings({ [key]: value })
  }

  const sectionStyle: React.CSSProperties = {
    marginBottom: 16,
    padding: "0 0 12px 0",
    borderBottom: "1px solid var(--border)",
  }

  const renderFieldRow = (
    label: string,
    input: React.ReactNode,
  ) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
      <span style={{ ...LABEL_STYLE, width: 120, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1 }}>{input}</div>
    </div>
  )

  return (
    <Modal title="Preferences" onClose={onClose} width={560}>
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

        {/* Main tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--border)", fontSize: 10, letterSpacing: "0.06em", flexShrink: 0 }}>
          {([["terminal", "Terminal"], ["appearance", "Appearance"], ["keybindings", "Keys"], ["templates", "Templates"]] as [MainTab, string][]).map(([t, label]) => (
            <div key={t} onClick={() => setMainTab(t)} style={{
              padding: "7px 16px", cursor: "pointer",
              borderBottom: mainTab === t ? "2px solid var(--green)" : "2px solid transparent",
              color: mainTab === t ? "var(--green)" : "var(--muted)",
            }}>{label}</div>
          ))}
        </div>

        {/* Settings content */}
        <div style={{ flex: 1, overflow: "auto", padding: 16 }}>

          {/* APPEARANCE tab */}
          {mainTab === "appearance" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--fg)", fontWeight: 600, marginBottom: 12 }}>COLOR SCHEME</div>
                <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 8 }}>
                  {hoveredScheme ? availableSchemes[hoveredScheme]?.name : availableSchemes[schemeKey]?.name}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {Object.entries(availableSchemes).map(([key, s]) => (
                    <button key={key} onClick={() => setScheme(key)} title={s.name}
                      style={{
                        width: 32, height: 32, borderRadius: "50%", background: s.green, padding: 0, cursor: "pointer", flexShrink: 0,
                        border: key === schemeKey ? `3px solid ${s.green}` : "3px solid transparent",
                        outline: key === schemeKey ? `2px solid ${s.green}` : "2px solid transparent",
                        outlineOffset: 2,
                        opacity: key === schemeKey ? 1 : 0.5,
                        transition: "opacity 0.15s",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.opacity = "1"; setHoveredScheme(key) }}
                      onMouseLeave={e => { e.currentTarget.style.opacity = key === schemeKey ? "1" : "0.5"; setHoveredScheme(null) }}
                    />
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--fg)", fontWeight: 600, marginBottom: 8 }}>SIDEBAR POSITION</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {(["left", "right"] as const).map(pos => (
                    <button key={pos} onClick={() => updateGlobalSettings({ sidebarPosition: pos })}
                      style={{
                        background: globalSettings.sidebarPosition === pos ? "var(--green)" : "transparent",
                        border: "1px solid var(--border)", color: globalSettings.sidebarPosition === pos ? "var(--bg)" : "var(--muted)",
                        fontFamily: monoFont, fontSize: 10, padding: "4px 16px", cursor: "pointer", letterSpacing: "0.08em",
                      }}
                      onMouseEnter={e => { if (globalSettings.sidebarPosition !== pos) { e.currentTarget.style.borderColor = "var(--green)"; e.currentTarget.style.color = "var(--green)" }}}
                      onMouseLeave={e => { if (globalSettings.sidebarPosition !== pos) { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--muted)" }}}
                    >{pos.toUpperCase()}</button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--fg)", fontWeight: 600, marginBottom: 8 }}>UI SCALE</div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <input type="range" min={0.5} max={2.0} step={0.05}
                    value={globalSettings.uiScale}
                    onChange={e => updateGlobalSettings({ uiScale: Number(e.target.value) })}
                    style={{ flex: 1, accentColor: "var(--green)" }}
                  />
                  <span style={{ fontSize: 11, color: "var(--muted)", width: 36 }}>{Math.round(globalSettings.uiScale * 100)}%</span>
                </div>
                <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>⌘= zoom in · ⌘- zoom out</div>
              </div>
            </div>
          )}

          {/* KEYBINDINGS tab */}
          {mainTab === "keybindings" && (
            <div>
              <div style={{ fontSize: 11, color: "var(--fg)", fontWeight: 600, marginBottom: 16 }}>KEYBOARD SHORTCUTS</div>
              {[
                ["⌘1–9", "Switch to Pane"],
                ["⌘Shift+[", "Previous Pane"],
                ["⌘Shift+]", "Next Pane"],
                ["⌘N", "New Pane"],
                ["⌘R", "Restart Pane"],
                ["⌘T", "New Shell tab"],
                ["⌘W", "Close Shell tab"],
                ["⌘[", "Previous Shell tab"],
                ["⌘]", "Next Shell tab"],
                ["⌘K", "Command palette"],
                ["⌘,", "Preferences"],
                ["⌘=", "Zoom in"],
                ["⌘-", "Zoom out"],
                ["Esc", "Close overlay"],
              ].map(([key, desc]) => (
                <div key={key} style={{ display: "flex", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                  <code style={{ color: "var(--green)", fontFamily: monoFont, fontSize: 11, width: 140, flexShrink: 0 }}>{key}</code>
                  <span style={{ color: "var(--muted)", fontSize: 11 }}>{desc}</span>
                </div>
              ))}
            </div>
          )}

          {/* TEMPLATES tab */}
          {mainTab === "templates" && (() => {
            const mono = monoFont
            const onBlur = (e: React.FocusEvent<HTMLInputElement>) => e.currentTarget.style.borderColor = "var(--border)"

            const saveNewTemplate = () => {
              if (!newTpl.name.trim() || !newTpl.command.trim()) return
              const t: Template = {
                id: crypto.randomUUID(),
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

            const saveEditTemplate = () => {
              if (!editingTpl) return
              const next = templates.map(t => t.id === editingTpl.id ? editingTpl : t)
              setTemplates(next)
              saveTemplates(next)
              onTemplatesChange?.(next)
              setEditingTpl(null)
            }

            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <div style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.08em" }}>Templates</div>
                    <button onClick={() => setShowNewTemplate(v => !v)}
                      style={{ background: "none", border: "1px solid var(--border)", color: "var(--muted)", fontFamily: mono, fontSize: 9, padding: "2px 6px", cursor: "pointer" }}
                      onMouseEnter={onHoverGreen} onMouseLeave={onLeaveGreen}
                    >[+ New]</button>
                  </div>

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
                            style={INPUT_STYLE} placeholder={placeholder} onFocus={onFocusInput} onBlur={onBlur} />
                        </label>
                      ))}
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        <button onClick={() => setShowNewTemplate(false)}
                          style={{ background: "none", border: "1px solid var(--border)", color: "var(--muted)", fontFamily: mono, fontSize: 10, padding: "3px 8px", cursor: "pointer" }}
                        >[Cancel]</button>
                        <button onClick={saveNewTemplate}
                          style={{ background: "none", border: "1px solid var(--green)", color: "var(--green)", fontFamily: mono, fontSize: 10, padding: "3px 8px", cursor: "pointer" }}
                          onMouseEnter={e => { e.currentTarget.style.background = "var(--green)"; e.currentTarget.style.color = "var(--bg)" }}
                          onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "var(--green)" }}
                        >[Save]</button>
                      </div>
                    </div>
                  )}

                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {templates.map(t => (
                      <div key={t.id}>
                        {editingTpl?.id === t.id ? (
                          <div style={{ border: "1px solid var(--green)", padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                            <div style={{ fontSize: 10, color: "var(--green)" }}>EDIT TEMPLATE</div>
                            {([["Name", "name"], ["Command", "command"], ["Working Dir", "workingDir"], ["Description", "description"]] as const).map(([label, key]) => (
                              <label key={key} style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 10, color: "var(--muted)" }}>
                                {label}
                                <input value={(editingTpl as any)[key] ?? ""} onChange={e => setEditingTpl(p => p ? ({ ...p, [key]: e.target.value }) : p)}
                                  style={INPUT_STYLE} onFocus={onFocusInput} onBlur={onBlur} />
                              </label>
                            ))}
                            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                              <button onClick={() => setEditingTpl(null)} style={{ background: "none", border: "1px solid var(--border)", color: "var(--muted)", fontFamily: mono, fontSize: 10, padding: "3px 8px", cursor: "pointer" }}>[Cancel]</button>
                              <button onClick={saveEditTemplate}
                                style={{ background: "none", border: "1px solid var(--green)", color: "var(--green)", fontFamily: mono, fontSize: 10, padding: "3px 8px", cursor: "pointer" }}
                                onMouseEnter={e => { e.currentTarget.style.background = "var(--green)"; e.currentTarget.style.color = "var(--bg)" }}
                                onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "var(--green)" }}
                              >[Save]</button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", border: "1px solid var(--border)", fontSize: 11 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <span style={{ color: "var(--fg)" }}>{t.name}</span>
                              {t.description && <span style={{ color: "var(--muted)", fontSize: 10, marginLeft: 8 }}>{t.description}</span>}
                            </div>
                            <code style={{ color: "var(--muted)", fontSize: 10 }}>{t.command}</code>
                            {t.isBuiltin ? (
                              <>
                                <span style={{ fontSize: 9, color: "var(--green)", border: "1px solid var(--green)", padding: "1px 4px" }}>DEFAULT</span>
                                <button onClick={() => hideBuiltin(t.id)} style={{ background: "none", border: "1px solid var(--border)", color: "var(--muted)", fontFamily: mono, fontSize: 9, padding: "1px 5px", cursor: "pointer" }}
                                  onMouseEnter={onHoverGreen} onMouseLeave={onLeaveGreen}>[Hide]</button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => setEditingTpl(t)} style={{ background: "none", border: "1px solid var(--border)", color: "var(--muted)", fontFamily: mono, fontSize: 9, padding: "1px 5px", cursor: "pointer" }}
                                  onMouseEnter={onHoverGreen} onMouseLeave={onLeaveGreen}>[Edit]</button>
                                <CloseButton onClose={() => deleteTemplate(t.id)} style={{ fontSize: 10 }} />
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {templates.length === 0 && (
                    <div style={{ fontSize: 11, color: "var(--muted)", padding: "12px 0", textAlign: "center" }}>No templates</div>
                  )}
                </div>
              </div>
            )
          })()}

          {/* TERMINAL tab — global only */}
          {mainTab === "terminal" && (
            <div>
              <div style={sectionStyle}>
                <div style={{ fontSize: 11, color: "var(--fg)", fontWeight: 600, marginBottom: 8 }}>TEXT</div>
                {renderFieldRow("Font Family",
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
                    <input
                      list="system-fonts-list"
                      value={globalSettings.fontFamily}
                      onChange={e => updateField("fontFamily", e.target.value)}
                      style={INPUT_STYLE}
                      onFocus={onFocusInput}
                      onBlur={onBlurInput}
                      placeholder="e.g. SF Mono"
                    />
                    <datalist id="system-fonts-list">
                      {systemFonts.map(f => <option key={f} value={f} />)}
                    </datalist>
                  </div>
                )}
                {renderFieldRow("Font Size",
                  <input
                    type="number" min={8} max={32}
                    value={globalSettings.fontSize}
                    onChange={e => updateField("fontSize", Number(e.target.value))}
                    style={{ ...INPUT_STYLE, width: 80 }}
                    onFocus={onFocusInput} onBlur={onBlurInput}
                  />
                )}
                {renderFieldRow("Line Height",
                  <input
                    type="number" min={1.0} max={3.0} step={0.1}
                    value={globalSettings.lineHeight}
                    onChange={e => updateField("lineHeight", Number(e.target.value))}
                    style={{ ...INPUT_STYLE, width: 80 }}
                    onFocus={onFocusInput} onBlur={onBlurInput}
                  />
                )}
              </div>

              <div style={sectionStyle}>
                <div style={{ fontSize: 11, color: "var(--fg)", fontWeight: 600, marginBottom: 8 }}>CURSOR</div>
                {renderFieldRow("Style",
                  <div style={{ display: "flex", gap: 4 }}>
                    {(["block", "bar", "underline"] as const).map(style => (
                      <button key={style} onClick={() => updateField("cursorStyle", style)}
                        style={{
                          ...INPUT_STYLE, width: "auto", padding: "3px 10px", cursor: "pointer",
                          border: globalSettings.cursorStyle === style ? "1px solid var(--green)" : "1px solid var(--border)",
                          color: globalSettings.cursorStyle === style ? "var(--green)" : "var(--muted)",
                        }}
                      >{style}</button>
                    ))}
                  </div>
                )}
                {renderFieldRow("Blink",
                  <button onClick={() => updateField("cursorBlink", !globalSettings.cursorBlink)}
                    style={{
                      ...INPUT_STYLE, width: "auto", padding: "3px 10px", cursor: "pointer",
                      color: globalSettings.cursorBlink ? "var(--green)" : "var(--muted)",
                      border: globalSettings.cursorBlink ? "1px solid var(--green)" : "1px solid var(--border)",
                    }}
                  >{globalSettings.cursorBlink ? "ON" : "OFF"}</button>
                )}
              </div>

              <div style={sectionStyle}>
                <div style={{ fontSize: 11, color: "var(--fg)", fontWeight: 600, marginBottom: 8 }}>SCROLLBACK</div>
                {renderFieldRow("Lines",
                  <input
                    type="number" min={500} max={100000} step={500}
                    value={globalSettings.scrollback}
                    onChange={e => updateField("scrollback", Number(e.target.value))}
                    style={{ ...INPUT_STYLE, width: 100 }}
                    onFocus={onFocusInput} onBlur={onBlurInput}
                  />
                )}
              </div>

              <div style={sectionStyle}>
                <div style={{ fontSize: 11, color: "var(--fg)", fontWeight: 600, marginBottom: 8 }}>APPEARANCE</div>
                {renderFieldRow("BG Opacity",
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="range" min={0} max={1} step={0.05}
                      value={globalSettings.backgroundOpacity}
                      onChange={e => updateField("backgroundOpacity", Number(e.target.value))}
                      style={{ flex: 1, accentColor: "var(--green)" }}
                    />
                    <span style={{ fontSize: 10, color: "var(--fg)", width: 32, textAlign: "right" }}>
                      {Math.round(globalSettings.backgroundOpacity * 100)}%
                    </span>
                  </div>
                )}
                {renderFieldRow("Padding",
                  <input
                    type="number" min={0} max={32}
                    value={globalSettings.padding}
                    onChange={e => updateField("padding", Number(e.target.value))}
                    style={{ ...INPUT_STYLE, width: 80 }}
                    onFocus={onFocusInput} onBlur={onBlurInput}
                  />
                )}
              </div>

              <div style={sectionStyle}>
                <div style={{ fontSize: 11, color: "var(--fg)", fontWeight: 600, marginBottom: 8 }}>NOTIFICATIONS</div>
                <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11, color: "var(--muted)", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={globalSettings.notificationsEnabled ?? true}
                    onChange={e => updateGlobalSettings({ notificationsEnabled: e.target.checked })}
                    style={{ accentColor: "var(--green)", width: 14, height: 14, cursor: "pointer" }}
                  />
                  System notifications + sound when Pane finishes
                </label>
              </div>

              <div>
                <div style={{ fontSize: 11, color: "var(--fg)", fontWeight: 600, marginBottom: 8 }}>UI SCALE</div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <input type="range" min={0.5} max={2.0} step={0.05}
                    value={globalSettings.uiScale}
                    onChange={e => updateGlobalSettings({ uiScale: Number(e.target.value) })}
                    style={{ flex: 1, accentColor: "var(--green)" }}
                  />
                  <span style={{ fontSize: 11, color: "var(--muted)", width: 36 }}>{Math.round(globalSettings.uiScale * 100)}%</span>
                </div>
                <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>⌘= zoom in · ⌘- zoom out</div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "8px 16px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button
            onClick={() => updateGlobalSettings(DEFAULT_SETTINGS)}
            style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--muted)", fontFamily: monoFont, fontSize: 10, padding: "4px 10px", cursor: "pointer", letterSpacing: "0.05em" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--red)"; e.currentTarget.style.color = "var(--red)" }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--muted)" }}
          >[Reset All]</button>
        </div>
      </div>
    </Modal>
  )
}
