import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useTheme } from "../ThemeContext";
import { useSettings } from "../SettingsContext";
import "@xterm/xterm/css/xterm.css";

interface SingleShellProps {
  sessionId: string;
  isActive: boolean;
  agentId: string;
  workingDir?: string;
}

export default function SingleShell({ sessionId, isActive, agentId, workingDir = "~" }: SingleShellProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const { scheme } = useTheme();
  const { getResolvedSettings, globalSettings } = useSettings();
  const settings = getResolvedSettings(agentId);

  // xterm lifecycle: create on mount, cleanup on unmount
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;

    const xterm = new XTerm({
      cursorBlink: settings.cursorBlink,
      cursorStyle: settings.cursorStyle,
      fontSize: Math.round(settings.fontSize * (globalSettings.uiScale ?? 1)),
      fontFamily: settings.fontFamily,
      lineHeight: settings.lineHeight,
      scrollback: settings.scrollback,
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

    // Wait for listener to register before spawning,
    // so scrollback from daemon is not missed.
    let unlisten: (() => void) | null = null;
    listen<string>(`pty-output-${sessionId}`, (event) => {
      const bytes = Uint8Array.from(atob(event.payload), c => c.charCodeAt(0));
      xterm.write(bytes);
    }).then(fn => {
      unlisten = fn;
      if (disposed) return;
      // spawn PTY after listener is ready
      fitAddon.fit();
      invoke("spawn_agent", {
        agentId: sessionId,
        command: ["/bin/zsh"],
        workingDir: workingDir,
        cols: xterm.cols,
        rows: xterm.rows,
        parentPaneId: agentId,
        paneType: "shell",
      }).catch(e => xterm.writeln(`\r\n[Error] ${e}`));
    });

    // keyboard input
    const disposable = xterm.onData(data => {
      // Filter DA responses xterm.js auto-generates — must not reach PTY
      if (/^\x1b\[[?>\d][?>\d;]*c$/.test(data)) return;
      invoke("write_to_agent", { agentId: sessionId, data });
    });

    // resize
    const obs = new ResizeObserver(() => {
      fitAddon.fit();
      invoke("resize_pty", { agentId: sessionId, cols: xterm.cols, rows: xterm.rows }).catch(() => {});
    });
    obs.observe(container);

    return () => {
      disposed = true;
      disposable.dispose();
      obs.disconnect();
      unlisten?.();
      xterm.dispose();
      // Don't kill — daemon keeps the shell alive for reconnect.
      // Kill happens in removeShellFromAgent when user closes the tab.
      xtermRef.current = null;
      fitRef.current = null;
    };
  }, [sessionId]);

  // update theme when scheme changes
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

  // apply settings changes in real-time
  useEffect(() => {
    const xterm = xtermRef.current;
    if (!xterm) return;
    xterm.options.fontSize = Math.round(settings.fontSize * (globalSettings.uiScale ?? 1));
    xterm.options.fontFamily = settings.fontFamily;
    xterm.options.lineHeight = settings.lineHeight;
    xterm.options.cursorBlink = settings.cursorBlink;
    xterm.options.cursorStyle = settings.cursorStyle;
    xterm.options.scrollback = settings.scrollback;
    if (fitRef.current) fitRef.current.fit();
  }, [settings]);

  // focus when active
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
      style={{ flex: 1, minHeight: 0, padding: settings.padding, display: "flex", flexDirection: "column" }}
      onClick={() => xtermRef.current?.focus()}
    />
  );
}
