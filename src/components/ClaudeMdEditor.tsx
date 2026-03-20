import { useState, useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"
import type { Agent } from "../types"

interface Props {
  agent: Agent
  onClose: () => void
}

export default function ClaudeMdEditor({ agent, onClose }: Props) {
  const [content, setContent] = useState("")
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  const filePath = `${agent.workingDir}/CLAUDE.md`

  useEffect(() => {
    invoke<string>("read_file", { path: filePath })
      .then(c => { setContent(c); setLoading(false) })
      .catch(() => { setContent(""); setLoading(false) })
  }, [filePath])

  const handleSave = async () => {
    await invoke("write_file", { path: filePath, content })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <>
      {/* overlay */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          zIndex: 998,
        }}
      />
      {/* sliding panel */}
      <div
        style={{
          position: "fixed",
          right: 0,
          top: 0,
          bottom: 0,
          width: 480,
          background: "var(--bg)",
          borderLeft: "1px solid var(--border)",
          zIndex: 999,
          display: "flex",
          flexDirection: "column",
          animation: "slideInRight 0.2s ease-out",
        }}
      >
        {/* header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderBottom: "1px solid var(--border)",
            flexShrink: 0,
          }}
        >
          <div>
            <div style={{ color: "var(--fg)", fontWeight: 600, fontSize: 14 }}>
              CLAUDE.md — {agent.name}
            </div>
            <div style={{ color: "var(--muted)", fontSize: 11 }}>{filePath}</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {saved && (
              <span style={{ color: "var(--green)", fontSize: 12 }}>✓ 已儲存</span>
            )}
            <button
              onClick={handleSave}
              style={{
                padding: "4px 12px",
                fontSize: 12,
                borderRadius: 4,
                border: "none",
                background: "var(--blue)",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              儲存
            </button>
            <button
              onClick={onClose}
              style={{
                padding: "4px 8px",
                fontSize: 14,
                borderRadius: 4,
                border: "1px solid var(--border)",
                background: "var(--surface)",
                color: "var(--muted)",
                cursor: "pointer",
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* textarea */}
        {loading ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--muted)",
            }}
          >
            載入中...
          </div>
        ) : (
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            spellCheck={false}
            style={{
              flex: 1,
              margin: 12,
              padding: 12,
              fontFamily: "Menlo, Monaco, 'Courier New', monospace",
              fontSize: 13,
              lineHeight: 1.5,
              background: "var(--surface)",
              color: "var(--fg)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              resize: "none",
              outline: "none",
            }}
          />
        )}

        {/* footer hint */}
        <div
          style={{
            padding: "8px 16px",
            fontSize: 11,
            color: "var(--muted)",
            textAlign: "right",
            flexShrink: 0,
          }}
        >
          此檔案會在下次啟動 Claude Code 時自動載入
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </>
  )
}
