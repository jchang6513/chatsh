import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useTheme } from "../ThemeContext";
import "@xterm/xterm/css/xterm.css";

interface SingleShellProps {
  sessionId: string;
  isActive: boolean;
}

export default function SingleShell({ sessionId, isActive }: SingleShellProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const { scheme } = useTheme();

  // xterm 生命週期：mount 時建立，unmount 時清除
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

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
    xtermRef.current = xterm;
    fitRef.current = fitAddon;

    xterm.open(container);
    setTimeout(() => fitAddon.fit(), 50);

    // listen PTY output
    let unlisten: (() => void) | null = null;
    listen<string>(`pty-output-${sessionId}`, (event) => {
      const bytes = Uint8Array.from(atob(event.payload), c => c.charCodeAt(0));
      xterm.write(bytes);
    }).then(fn => { unlisten = fn; });

    // spawn PTY
    fitAddon.fit();
    invoke("spawn_agent", {
      agentId: sessionId,
      command: ["/bin/zsh"],
      workingDir: "~",
      cols: xterm.cols,
      rows: xterm.rows,
    }).catch(e => xterm.writeln(`\r\n[錯誤] ${e}`));

    // keyboard input
    const disposable = xterm.onData(data => {
      invoke("write_to_agent", { agentId: sessionId, data });
    });

    // resize
    const obs = new ResizeObserver(() => {
      fitAddon.fit();
      invoke("resize_pty", { agentId: sessionId, cols: xterm.cols, rows: xterm.rows }).catch(() => {});
    });
    obs.observe(container);

    return () => {
      disposable.dispose();
      obs.disconnect();
      unlisten?.();
      xterm.dispose();
      invoke("kill_agent", { agentId: sessionId }).catch(() => {});
      xtermRef.current = null;
      fitRef.current = null;
    };
  }, [sessionId]);

  // scheme 變化時更新 theme
  useEffect(() => {
    const xterm = xtermRef.current;
    if (!xterm) return;
    xterm.options.theme = {
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
    xterm.refresh(0, xterm.rows - 1);
  }, [scheme]);

  // active 時 focus
  useEffect(() => {
    if (isActive) {
      const xterm = xtermRef.current;
      const fitAddon = fitRef.current;
      if (xterm && fitAddon) {
        setTimeout(() => {
          fitAddon.fit();
          xterm.focus();
        }, 50);
      }
    }
  }, [isActive]);

  return (
    <div
      ref={containerRef}
      style={{ flex: 1, minHeight: 0, padding: 2, display: "flex", flexDirection: "column" }}
      onClick={() => xtermRef.current?.focus()}
    />
  );
}
