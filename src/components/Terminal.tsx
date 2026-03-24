import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Pane } from "../types";
import { useTheme } from "../ThemeContext";
import { useSettings } from "../SettingsContext";
import "@xterm/xterm/css/xterm.css";

interface Props {
  agent: Pane;
  isActive: boolean;
  onStatusChange: (status: Pane["status"]) => void;
  restartKey?: number;
}

export default function Terminal({ agent, isActive, onStatusChange, restartKey = 0 }: Props) {
  const { scheme } = useTheme();
  const { getResolvedSettings, globalSettings } = useSettings();
  const settings = getResolvedSettings(agent.id);
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  // apply settings changes in real-time
  useEffect(() => {
    if (!xtermRef.current) return;
    const xterm = xtermRef.current;
    xterm.options.fontSize = Math.round(settings.fontSize * (globalSettings.uiScale ?? 1));
    xterm.options.fontFamily = settings.fontFamily;
    xterm.options.lineHeight = settings.lineHeight;
    xterm.options.cursorBlink = settings.cursorBlink;
    xterm.options.cursorStyle = settings.cursorStyle;
    xterm.options.scrollback = settings.scrollback;
    if (fitAddonRef.current) fitAddonRef.current.fit();
  }, [settings]);

  // dynamically update xterm theme when scheme changes
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
    xtermRef.current.refresh(0, xtermRef.current.rows - 1);
  }, [scheme]);

  // fit + focus when isActive changes
  useEffect(() => {
    if (isActive && xtermRef.current && fitAddonRef.current) {
      setTimeout(() => {
        fitAddonRef.current!.fit();
        xtermRef.current!.focus();
      }, 50);
    }
  }, [isActive]);

  // rebuild xterm + spawn PTY when agent.id changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = "";

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
      },
      allowProposedApi: true,
      customGlyphs: false,
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

    xterm.onData((data) => {
      // Filter DA (Device Attributes) responses xterm.js auto-generates —
      // must not be forwarded to PTY (causes "1;2c" appearing as spurious input)
      // DA1 response: \x1b[?1;2c  DA2 response: \x1b[>...c
      if (/^\x1b\[[?>\d][?>\d;]*c$/.test(data)) return;
      invoke("write_to_agent", { agentId: agent.id, data });
    });

    let unlisten: (() => void) | null = null;
    let unlistenExit: (() => void) | null = null;

    // Wait for both listeners to be registered before spawning,
    // so scrollback from daemon is not missed.
    Promise.all([
      listen<string>(`pty-output-${agent.id}`, (event) => {
        if (disposed) return;
        console.log("[Terminal] pty-output received", event.payload.length, "chars");
        const bytes = Uint8Array.from(atob(event.payload), (c) => c.charCodeAt(0));
        xterm.write(bytes);
      }),
      listen<void>(`pty-exit-${agent.id}`, () => {
        if (disposed) return;
        onStatusChange("offline");
      }),
    ]).then(([fn1, fn2]) => {
      unlisten = fn1;
      unlistenExit = fn2;

      if (disposed) return;
      fitAddon.fit();
      onStatusChange("online");
      invoke("spawn_agent", {
        agentId: agent.id,
        command: agent.command,
        workingDir: agent.workingDir,
        cols: xterm.cols,
        rows: xterm.rows,
      }).then(() => {
        console.log("[Terminal] spawn_agent done for", agent.id);
      }).catch((e) => {
        if (!disposed) {
          xterm.writeln(`\r\n[Error] Failed to spawn: ${e}`);
          onStatusChange("offline");
        }
      });
    });

    return () => {
      disposed = true;
      resizeObs.disconnect();
      if (unlisten) unlisten();
      if (unlistenExit) unlistenExit();
      xterm.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, [agent.id, restartKey]);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* xterm container */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0"
        style={{ padding: settings.padding }}
        onClick={() => xtermRef.current?.focus()}
      />
    </div>
  );
}
