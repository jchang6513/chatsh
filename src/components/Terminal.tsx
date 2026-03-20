import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Agent } from "../types";
import { useTheme } from "../ThemeContext";
import "@xterm/xterm/css/xterm.css";

interface Props {
  agent: Agent;
  isActive: boolean;
  onStatusChange: (status: Agent["status"]) => void;
  showShellPane: boolean;
  onToggleShell: () => void;
}

export default function Terminal({ agent, isActive, onStatusChange, showShellPane, onToggleShell }: Props) {
  const { scheme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const mountedRef = useRef(false);

  // scheme 變化時動態更新 xterm theme
  useEffect(() => {
    if (!xtermRef.current) return;
    xtermRef.current.options.theme = {
      background: scheme.background,
      foreground: scheme.foreground,
      cursor: scheme.cursor,
      cursorAccent: scheme.background,
      selectionBackground: scheme.selection,
      black: scheme.ansi.black,
      red: scheme.ansi.red,
      green: scheme.ansi.green,
      yellow: scheme.ansi.yellow,
      blue: scheme.ansi.blue,
      magenta: scheme.ansi.magenta,
      cyan: scheme.ansi.cyan,
      white: scheme.ansi.white,
      brightBlack: scheme.ansi.brightBlack,
      brightRed: scheme.ansi.brightRed,
      brightGreen: scheme.ansi.brightGreen,
      brightYellow: scheme.ansi.brightYellow,
      brightBlue: scheme.ansi.brightBlue,
      brightMagenta: scheme.ansi.brightMagenta,
      brightCyan: scheme.ansi.brightCyan,
      brightWhite: scheme.ansi.brightWhite,
    };
    // refresh 強制重繪
    xtermRef.current.refresh(0, xtermRef.current.rows - 1);
  }, [scheme]);

  // isActive 變化時 fit + focus
  useEffect(() => {
    if (isActive && xtermRef.current && fitAddonRef.current) {
      setTimeout(() => {
        fitAddonRef.current!.fit();
        xtermRef.current!.focus();
      }, 50);
    }
  }, [isActive]);

  // 只 mount 一次，建立 xterm + spawn PTY
  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;

    const container = containerRef.current;
    if (!container) return;

    const xterm = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "Menlo, Monaco, 'Courier New', monospace",
      theme: {
        background: scheme.background,
        foreground: scheme.foreground,
        cursor: scheme.cursor,
        cursorAccent: scheme.background,
        selectionBackground: scheme.selection,
        // ANSI 16 colors
        black: scheme.ansi.black,
        red: scheme.ansi.red,
        green: scheme.ansi.green,
        yellow: scheme.ansi.yellow,
        blue: scheme.ansi.blue,
        magenta: scheme.ansi.magenta,
        cyan: scheme.ansi.cyan,
        white: scheme.ansi.white,
        brightBlack: scheme.ansi.brightBlack,
        brightRed: scheme.ansi.brightRed,
        brightGreen: scheme.ansi.brightGreen,
        brightYellow: scheme.ansi.brightYellow,
        brightBlue: scheme.ansi.brightBlue,
        brightMagenta: scheme.ansi.brightMagenta,
        brightCyan: scheme.ansi.brightCyan,
        brightWhite: scheme.ansi.brightWhite,
      },
      allowProposedApi: true,
    });
    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);
    xterm.open(container);
    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    setTimeout(() => {
      fitAddon.fit();
      if (isActive) xterm.focus();
    }, 100);

    // resize observer
    const resizeObs = new ResizeObserver(() => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
        invoke("resize_pty", {
          agentId: agent.id,
          cols: xterm.cols,
          rows: xterm.rows,
        }).catch(() => {});
      }
    });
    resizeObs.observe(container);

    // 鍵盤輸入
    xterm.onData((data) => {
      invoke("write_to_agent", { agentId: agent.id, data });
    });

    // listen PTY output
    let unlisten: (() => void) | null = null;
    listen<string>(`pty-output-${agent.id}`, (event) => {
      const bytes = Uint8Array.from(atob(event.payload), (c) => c.charCodeAt(0));
      xterm.write(bytes);
    }).then((fn) => { unlisten = fn; });

    // listen PTY exit
    let unlistenExit: (() => void) | null = null;
    listen<void>(`pty-exit-${agent.id}`, () => {
      onStatusChange("offline");
    }).then((fn) => { unlistenExit = fn; });

    // spawn PTY
    setTimeout(async () => {
      fitAddon.fit();
      try {
        await invoke("spawn_agent", {
          agentId: agent.id,
          command: agent.command,
          workingDir: agent.workingDir,
          cols: xterm.cols,
          rows: xterm.rows,
        });
        onStatusChange("online");
      } catch (e) {
        xterm.writeln(`\r\n[錯誤] 無法啟動: ${e}`);
        onStatusChange("offline");
      }
    }, 200);

    return () => {
      resizeObs.disconnect();
      if (unlisten) unlisten();
      if (unlistenExit) unlistenExit();
      xterm.dispose();
    };
  }, []); // 空 deps，只跑一次

  const handleRestart = async () => {
    const xterm = xtermRef.current;
    const fitAddon = fitAddonRef.current;
    if (!xterm) return;
    try { await invoke("kill_agent", { agentId: agent.id }); } catch {}
    xterm.clear();
    xterm.writeln("[重新啟動中...]");
    fitAddon?.fit();
    try {
      await invoke("spawn_agent", {
        agentId: agent.id,
        command: agent.command,
        workingDir: agent.workingDir,
        cols: xterm.cols,
        rows: xterm.rows,
      });
      onStatusChange("online");
    } catch (e) {
      xterm.writeln(`[錯誤] ${e}`);
      onStatusChange("offline");
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* 頂部 bar */}
      <div className="flex items-center gap-2 px-4 h-11 flex-shrink-0" style={{ background: "var(--bg)", borderBottom: "1px solid var(--border)" }}>
        <span className="text-lg">{agent.emoji}</span>
        <div>
          <div className="text-sm font-semibold" style={{ color: "var(--fg)" }}>{agent.name}</div>
          <div className="text-xs" style={{ color: agent.status === "online" ? "var(--green)" : "var(--red)" }}>
            {agent.status === "online" ? "● 執行中" : "● 已停止"}
          </div>
        </div>
        <div className="ml-auto flex gap-2">
          <button
            onClick={handleRestart}
            className="px-2 py-1 text-xs rounded"
            style={{
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--muted)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--blue)";
              e.currentTarget.style.color = "var(--blue)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border)";
              e.currentTarget.style.color = "var(--muted)";
            }}
          >
            重啟
          </button>
          <button
            onClick={onToggleShell}
            className="px-2 py-1 text-xs rounded"
            style={showShellPane ? {
              border: "1px solid var(--blue)",
              background: "var(--selection)",
              color: "var(--blue)",
            } : {
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--muted)",
            }}
            onMouseEnter={(e) => {
              if (!showShellPane) {
                e.currentTarget.style.borderColor = "var(--blue)";
                e.currentTarget.style.color = "var(--blue)";
              }
            }}
            onMouseLeave={(e) => {
              if (!showShellPane) {
                e.currentTarget.style.borderColor = "var(--border)";
                e.currentTarget.style.color = "var(--muted)";
              }
            }}
          >
            Shell ↓
          </button>
        </div>
      </div>

      {/* xterm 容器 */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 p-1"
        onClick={() => xtermRef.current?.focus()}
      />
    </div>
  );
}
