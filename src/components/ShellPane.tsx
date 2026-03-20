import { useState } from "react";
import SingleShell from "./SingleShell";

let counter = 1;

export default function ShellPane() {
  const [sessionIds, setSessionIds] = useState<string[]>(() => [`__shell_1__`]);
  const [activeId, setActiveId] = useState("__shell_1__");

  const addSession = () => {
    const id = `__shell_${++counter}__`;
    setSessionIds(prev => [...prev, id]);
    setActiveId(id);
  };

  const removeSession = (id: string) => {
    if (id === sessionIds[0]) return;
    setSessionIds(prev => {
      const next = prev.filter(i => i !== id);
      if (activeId === id) setActiveId(next[next.length - 1]);
      return next;
    });
  };

  const mono = '"SF Mono", "Menlo", "Monaco", "Courier New", monospace';

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", background: "var(--bg)" }}>
      {/* Shell session tab bar */}
      <div style={{
        height: 24,
        display: "flex",
        alignItems: "stretch",
        borderBottom: "1px solid var(--border)",
        flexShrink: 0,
        fontFamily: mono,
        fontSize: 10,
      }}>
        {sessionIds.map((id, idx) => {
          const isFirst = idx === 0;
          return (
            <div
              key={id}
              onClick={() => setActiveId(id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "0 10px",
                cursor: "pointer",
                borderRight: "1px solid var(--border)",
                borderBottom: id === activeId ? "1px solid var(--green)" : "1px solid transparent",
                color: id === activeId ? "var(--green)" : "var(--muted)",
                letterSpacing: "0.05em",
              }}
            >
              <span>zsh{isFirst ? "" : ` ${idx + 1}`}</span>
              {!isFirst && (
                <span
                  onClick={e => { e.stopPropagation(); removeSession(id); }}
                  style={{ opacity: 0.5, cursor: "pointer", fontSize: 10, marginLeft: 2 }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                  onMouseLeave={e => (e.currentTarget.style.opacity = "0.5")}
                >×</span>
              )}
            </div>
          );
        })}
        <button
          onClick={addSession}
          style={{
            padding: "0 10px",
            background: "transparent",
            border: "none",
            borderRight: "1px solid var(--border)",
            color: "var(--muted)",
            fontFamily: mono,
            fontSize: 12,
            cursor: "pointer",
          }}
          onMouseEnter={e => (e.currentTarget.style.color = "var(--green)")}
          onMouseLeave={e => (e.currentTarget.style.color = "var(--muted)")}
        >+</button>
      </div>

      {/* Shell terminals */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", position: "relative" }}>
        {sessionIds.map(id => (
          <div key={id} style={{ position: "absolute", inset: 0, display: id === activeId ? "flex" : "none", flexDirection: "column" }}>
            <SingleShell sessionId={id} agentId="shell" isActive={id === activeId} />
          </div>
        ))}
      </div>
    </div>
  );
}
