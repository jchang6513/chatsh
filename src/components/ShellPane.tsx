import { useEffect, useRef, useState } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useTheme } from "../ThemeContext";
import "@xterm/xterm/css/xterm.css";

interface ShellSession {
  id: string;
  label: string;
  xterm: XTerm;
  fitAddon: FitAddon;
  spawned: boolean;
  unlisten: (() => void) | null;
}

// module-level cache — 跨 render 存活
const sessions: Map<string, ShellSession> = new Map();
let sessionCounter = 1;

function makeId() {
  return `__shell_${Date.now()}_${sessionCounter++}__`;
}

function createSession(scheme: any, label: string): ShellSession {
  const id = makeId();
  const xterm = new XTerm({
    cursorBlink: true,
    fontSize: 13,
    fontFamily: '"SF Mono", "Menlo", "Monaco", "Courier New", monospace',
    theme: {
      background: scheme.background,
      foreground: scheme.foreground,
      cursor: scheme.cursor,
      selectionBackground: scheme.selection,
      black: scheme.ansi?.black, red: scheme.ansi?.red,
      green: scheme.ansi?.green, yellow: scheme.ansi?.yellow,
      blue: scheme.ansi?.blue, magenta: scheme.ansi?.magenta,
      cyan: scheme.ansi?.cyan, white: scheme.ansi?.white,
      brightBlack: scheme.ansi?.brightBlack, brightRed: scheme.ansi?.brightRed,
      brightGreen: scheme.ansi?.brightGreen, brightYellow: scheme.ansi?.brightYellow,
      brightBlue: scheme.ansi?.brightBlue, brightMagenta: scheme.ansi?.brightMagenta,
      brightCyan: scheme.ansi?.brightCyan, brightWhite: scheme.ansi?.brightWhite,
    },
    allowProposedApi: true,
  });
  const fitAddon = new FitAddon();
  xterm.loadAddon(fitAddon);
  const session: ShellSession = { id, label, xterm, fitAddon, spawned: false, unlisten: null };
  sessions.set(id, session);
  return session;
}

interface ShellTerminalProps {
  session: ShellSession;
  isActive: boolean;
}

function ShellTerminal({ session, isActive }: ShellTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    session.xterm.open(container);
    session.xterm.write("\x1b[>4;0m");
    setTimeout(() => {
      session.fitAddon.fit();
      if (isActive) session.xterm.focus();
    }, 50);

    // listen PTY output
    if (!session.unlisten) {
      listen<string>(`pty-output-${session.id}`, (event) => {
        const bytes = Uint8Array.from(atob(event.payload), c => c.charCodeAt(0));
        session.xterm.write(bytes);
      }).then(fn => { session.unlisten = fn; });
    }

    // spawn
    if (!session.spawned) {
      session.spawned = true;
      session.fitAddon.fit();
      invoke("spawn_agent", {
        agentId: session.id,
        command: ["/bin/zsh"],
        workingDir: "~",
        cols: session.xterm.cols,
        rows: session.xterm.rows,
      }).catch(e => session.xterm.writeln(`\r\n[錯誤] ${e}`));
    }

    // IME 組字期間暫停送出
    let composing = false;
    const xtermEl = container.querySelector(".xterm-helper-textarea") as HTMLTextAreaElement | null;
    if (xtermEl) {
      xtermEl.addEventListener("compositionstart", () => { composing = true; });
      xtermEl.addEventListener("compositionend", (e) => {
        composing = false;
        const text = (e as CompositionEvent).data;
        if (text) invoke("write_to_agent", { agentId: session.id, data: text });
      });
    }

    // keyboard
    const disposable = session.xterm.onData(data => {
      if (composing) return;
      invoke("write_to_agent", { agentId: session.id, data });
    });

    // resize
    const obs = new ResizeObserver(() => {
      session.fitAddon.fit();
      invoke("resize_pty", { agentId: session.id, cols: session.xterm.cols, rows: session.xterm.rows }).catch(() => {});
    });
    obs.observe(container);

    return () => {
      disposable.dispose();
      obs.disconnect();
    };
  }, [session.id]);

  // scheme 變化時更新 theme
  const { scheme } = useTheme();
  useEffect(() => {
    session.xterm.options.theme = {
      background: scheme.background, foreground: scheme.foreground,
      cursor: scheme.cursor, selectionBackground: scheme.selection,
      black: scheme.ansi?.black, red: scheme.ansi?.red,
      green: scheme.ansi?.green, yellow: scheme.ansi?.yellow,
      blue: scheme.ansi?.blue, magenta: scheme.ansi?.magenta,
      cyan: scheme.ansi?.cyan, white: scheme.ansi?.white,
      brightBlack: scheme.ansi?.brightBlack, brightRed: scheme.ansi?.brightRed,
      brightGreen: scheme.ansi?.brightGreen, brightYellow: scheme.ansi?.brightYellow,
      brightBlue: scheme.ansi?.brightBlue, brightMagenta: scheme.ansi?.brightMagenta,
      brightCyan: scheme.ansi?.brightCyan, brightWhite: scheme.ansi?.brightWhite,
    };
    session.xterm.refresh(0, session.xterm.rows - 1);
  }, [scheme]);

  return (
    <div
      ref={containerRef}
      style={{ flex: 1, minHeight: 0, padding: 2, display: isActive ? "flex" : "none", flexDirection: "column" }}
      onClick={() => session.xterm.focus()}
    />
  );
}

export default function ShellPane() {
  const { scheme } = useTheme();
  const [sessionIds, setSessionIds] = useState<string[]>(() => {
    // 第一個 session（永久，不能關）
    if (sessions.size === 0) {
      const s = createSession(scheme, "zsh");
      return [s.id];
    }
    return Array.from(sessions.keys());
  });
  const [activeId, setActiveId] = useState<string>(sessionIds[0]);

  const addSession = () => {
    const s = createSession(scheme, `zsh ${sessionIds.length + 1}`);
    setSessionIds(prev => [...prev, s.id]);
    setActiveId(s.id);
  };

  const removeSession = (id: string) => {
    // 第一個不能關
    if (id === sessionIds[0]) return;
    const s = sessions.get(id);
    if (s) {
      s.unlisten?.();
      s.xterm.dispose();
      invoke("kill_agent", { agentId: id }).catch(() => {});
      sessions.delete(id);
    }
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
          const s = sessions.get(id);
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
              <span>{s?.label ?? "zsh"}</span>
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
        {/* 新增 shell */}
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
        {sessionIds.map(id => {
          const s = sessions.get(id);
          if (!s) return null;
          return (
            <div key={id} style={{ position: "absolute", inset: 0, display: id === activeId ? "flex" : "none", flexDirection: "column" }}>
              <ShellTerminal session={s} isActive={id === activeId} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
