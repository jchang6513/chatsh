import { useState, useRef } from "react";
import type { Agent } from "../types";
import { useTheme } from "../ThemeContext";

interface Props {
  agents: Agent[];
  activeAgentId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onEdit: (agent: Agent) => void;
  onReorder: (agents: Agent[]) => void;
  onOpenSettings: () => void;
}

export default function Sidebar({ agents, activeAgentId, onSelect, onAdd, onRemove, onEdit, onReorder, onOpenSettings }: Props) {
  const { schemeKey, setScheme, availableSchemes } = useTheme();
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragCounter = useRef<Record<string, number>>({});
  const [hoverId, setHoverId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDragEnter = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    dragCounter.current[id] = (dragCounter.current[id] || 0) + 1;
    if (id !== dragId) setDragOverId(id);
  };

  const handleDragLeave = (_e: React.DragEvent, id: string) => {
    dragCounter.current[id] = (dragCounter.current[id] || 0) - 1;
    if (dragCounter.current[id] <= 0) {
      dragCounter.current[id] = 0;
      if (dragOverId === id) setDragOverId(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    dragCounter.current = {};
    if (!dragId || dragId === targetId) {
      setDragId(null);
      setDragOverId(null);
      return;
    }
    const fromIdx = agents.findIndex((a) => a.id === dragId);
    const toIdx = agents.findIndex((a) => a.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const next = [...agents];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    onReorder(next);
    setDragId(null);
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    setDragId(null);
    setDragOverId(null);
    dragCounter.current = {};
  };

  return (
    <div style={{
      width: 160,
      minWidth: 160,
      display: "flex",
      flexDirection: "column",
      background: "var(--bg)",
      borderRight: "1px solid var(--border)",
      fontFamily: '"SF Mono", "Menlo", "Monaco", "Courier New", monospace',
      height: "100%",
    }}>
      {/* Agent 列表 */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {agents.map((agent) => {
          const isActive = agent.id === activeAgentId;
          const isHover = hoverId === agent.id;
          return (
            <div
              key={agent.id}
              draggable
              onDragStart={(e) => handleDragStart(e, agent.id)}
              onDragOver={handleDragOver}
              onDragEnter={(e) => handleDragEnter(e, agent.id)}
              onDragLeave={(e) => handleDragLeave(e, agent.id)}
              onDrop={(e) => handleDrop(e, agent.id)}
              onDragEnd={handleDragEnd}
              onClick={() => onSelect(agent.id)}
              onMouseEnter={() => setHoverId(agent.id)}
              onMouseLeave={() => setHoverId(null)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "0 10px",
                height: 32,
                fontSize: 11,
                color: isActive ? "var(--green)" : "var(--fg)",
                background: isActive || isHover ? "var(--surface)" : "transparent",
                cursor: "pointer",
                borderLeft: isActive ? "2px solid var(--green)" : "2px solid transparent",
                position: "relative",
                opacity: dragId === agent.id ? 0.4 : 1,
                borderTop: dragOverId === agent.id && dragId !== agent.id ? "2px solid var(--green)" : undefined,
              }}
            >
              <span style={{
                fontSize: 9,
                color: isActive ? "var(--green)" : "var(--muted)",
                border: "1px solid currentColor",
                padding: "0 2px",
                flexShrink: 0,
              }}>
                {agent.name[0].toUpperCase()}
              </span>
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {agent.name}
              </span>
              <span style={{ color: agent.status === "online" ? "var(--green)" : "var(--muted)", fontSize: 8, flexShrink: 0 }}>●</span>
              {/* Hover 按鈕 */}
              {isHover && (
                <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, display: "flex", alignItems: "stretch" }}>
                  <button
                    onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); onEdit(agent); }}
                    style={{
                      color: "var(--muted)", background: "var(--surface)",
                      border: "none", borderLeft: "1px solid var(--border)",
                      cursor: "pointer", fontSize: 11, padding: "0 8px",
                      fontFamily: "monospace",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = "var(--green)"; e.currentTarget.style.background = "var(--bg)"; }}
                    onMouseLeave={e => { e.currentTarget.style.color = "var(--muted)"; e.currentTarget.style.background = "var(--surface)"; }}
                    title="編輯"
                  >✎</button>
                  <button
                    onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); onRemove(agent.id); }}
                    style={{
                      color: "var(--red)", background: "var(--surface)",
                      border: "none", borderLeft: "1px solid var(--border)",
                      cursor: "pointer", fontSize: 13, padding: "0 10px",
                      fontFamily: "monospace", fontWeight: "bold",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = "var(--red)"; e.currentTarget.style.color = "var(--bg)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "var(--surface)"; e.currentTarget.style.color = "var(--red)"; }}
                    title="刪除"
                  >×</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Theme Switcher */}
      <div style={{ padding: "6px 10px", display: "flex", alignItems: "center", gap: 4, borderTop: "1px solid var(--border)", flexWrap: "wrap" }}>
        {Object.entries(availableSchemes).map(([key, s]) => (
          <button
            key={key}
            title={s.name}
            onClick={() => setScheme(key)}
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: s.background,
              border: key === schemeKey ? `2px solid ${s.green}` : `2px solid ${s.border}`,
              cursor: "pointer",
              flexShrink: 0,
              padding: 0,
            }}
          />
        ))}
      </div>

      {/* 設定ボタン */}
      <button
        onClick={onOpenSettings}
        style={{
          display: "block",
          width: "calc(100% - 16px)",
          margin: "4px 8px",
          padding: "5px 0",
          background: "transparent",
          border: "1px solid var(--border)",
          color: "var(--muted)",
          fontFamily: '"SF Mono", "Menlo", "Monaco", "Courier New", monospace',
          fontSize: 10,
          letterSpacing: "0.08em",
          cursor: "pointer",
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--green)"; e.currentTarget.style.color = "var(--green)"; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--muted)"; }}
      >
        [SETTINGS ⌘,]
      </button>

      {/* 新增角色按鈕 */}
      <button
        onClick={onAdd}
        style={{
          display: "block",
          width: "calc(100% - 16px)",
          margin: "6px 8px",
          padding: "5px 0",
          background: "transparent",
          border: "1px solid var(--border)",
          color: "var(--muted)",
          fontFamily: '"SF Mono", "Menlo", "Monaco", "Courier New", monospace',
          fontSize: 10,
          letterSpacing: "0.08em",
          cursor: "pointer",
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--green)"; e.currentTarget.style.color = "var(--green)"; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--muted)"; }}
      >
        [+ NEW AGENT]
      </button>
    </div>
  );
}
