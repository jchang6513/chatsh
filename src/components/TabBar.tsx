import type { Agent } from "../types";

interface Props {
  agents: Agent[];
  activeAgentId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
}

export default function TabBar({ agents, activeAgentId, onSelect, onAdd, onRemove }: Props) {
  return (
    <div style={{
      height: 28,
      display: "flex",
      alignItems: "stretch",
      borderBottom: "1px solid var(--border)",
      background: "var(--bg)",
      fontFamily: '"SF Mono", "Menlo", "Monaco", "Courier New", monospace',
      fontSize: 11,
      flexShrink: 0,
    }}>
      {agents.map(agent => {
        const isActive = agent.id === activeAgentId;
        return (
          <div
            key={agent.id}
            onClick={() => onSelect(agent.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "0 12px",
              cursor: "pointer",
              borderRight: "1px solid var(--border)",
              borderBottom: isActive ? "2px solid var(--green)" : "2px solid transparent",
              color: isActive ? "var(--green)" : "var(--muted)",
              position: "relative",
            }}
            onMouseEnter={(e) => {
              if (!isActive) e.currentTarget.style.color = "var(--fg)";
            }}
            onMouseLeave={(e) => {
              if (!isActive) e.currentTarget.style.color = "var(--muted)";
            }}
          >
            <span style={{ border: "1px solid currentColor", padding: "0 2px", fontSize: 9 }}>
              {agent.name[0].toUpperCase()}
            </span>
            {agent.name}
            <span
              onClick={(e) => { e.stopPropagation(); onRemove(agent.id); }}
              style={{ marginLeft: 4, opacity: 0.4, fontSize: 10, cursor: "pointer" }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.4"; }}
            >×</span>
          </div>
        );
      })}
      <button
        onClick={onAdd}
        style={{
          padding: "0 12px",
          background: "transparent",
          border: "none",
          borderRight: "1px solid var(--border)",
          color: "var(--muted)",
          fontFamily: '"SF Mono", "Menlo", "Monaco", "Courier New", monospace',
          fontSize: 11,
          cursor: "pointer",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = "var(--green)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = "var(--muted)"; }}
      >
        +
      </button>
    </div>
  );
}
