import { useState, useEffect, useRef } from "react"
import type { Agent } from "../types"

interface Props {
  agents: Agent[]
  activeAgentId: string
  onSelect: (id: string) => void
  onClose: () => void
}

const mono = '"SF Mono", "Menlo", "Monaco", "Courier New", monospace'

export default function CommandPalette({ agents, activeAgentId, onSelect, onClose }: Props) {
  const [query, setQuery] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const filtered = agents.filter(a =>
    a.name.toLowerCase().includes(query.toLowerCase())
  )

  const [selectedIdx, setSelectedIdx] = useState(0)

  // reset selection when query changes
  useEffect(() => {
    setSelectedIdx(0)
  }, [query])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { onClose(); return }
    if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, filtered.length - 1)) }
    if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)) }
    if (e.key === "Enter") {
      const agent = filtered[selectedIdx]
      if (agent) { onSelect(agent.id); onClose() }
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        justifyContent: "center",
        paddingTop: 80,
        background: "rgba(0,0,0,0.5)",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 420,
          maxHeight: 360,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          fontFamily: mono,
          fontSize: 13,
          color: "var(--fg)",
          overflow: "hidden",
        }}
      >
        {/* Search input */}
        <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)" }}>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search sessions..."
            style={{
              width: "100%",
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--fg)",
              fontFamily: mono,
              fontSize: 13,
              letterSpacing: "0.04em",
            }}
          />
        </div>
        {/* Results list */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {filtered.length === 0 && (
            <div style={{ padding: "12px 16px", color: "var(--muted)", fontSize: 12 }}>
              No results
            </div>
          )}
          {filtered.map((agent, idx) => (
            <div
              key={agent.id}
              onClick={() => { onSelect(agent.id); onClose() }}
              onMouseEnter={() => setSelectedIdx(idx)}
              style={{
                padding: "6px 16px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: idx === selectedIdx ? "var(--border)" : "transparent",
                color: agent.id === activeAgentId ? "var(--green)" : "var(--fg)",
              }}
            >
              <span style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 20,
                height: 20,
                border: "1px solid currentColor",
                fontSize: 10,
                flexShrink: 0,
              }}>
                {agent.name[0].toUpperCase()}
              </span>
              <span style={{ flex: 1 }}>{agent.name}</span>
              <span style={{
                fontSize: 10,
                color: "var(--muted)",
                letterSpacing: "0.06em",
              }}>
                {agent.status === "online" ? "RUNNING" : "STOPPED"}
              </span>
              {/* ⌘ number hint */}
              {agents.indexOf(agent) < 9 && (
                <span style={{ fontSize: 9, color: "var(--muted)", opacity: 0.6 }}>
                  ⌘{agents.indexOf(agent) + 1}
                </span>
              )}
            </div>
          ))}
        </div>
        {/* Bottom shortcut hints */}
        <div style={{
          padding: "6px 12px",
          borderTop: "1px solid var(--border)",
          fontSize: 10,
          color: "var(--muted)",
          display: "flex",
          gap: 12,
          letterSpacing: "0.04em",
        }}>
          <span>↑↓ navigate</span>
          <span>↵ select</span>
          <span>ESC close</span>
        </div>
      </div>
    </div>
  )
}
