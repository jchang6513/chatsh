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
  restartKey?: number;
}

export default function Terminal({ agent, isActive, onStatusChange, restartKey = 0 }: Props) {
  const { scheme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

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

  // agent.id 變化時重建 xterm + spawn PTY
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = "";

    let disposed = false;

    const xterm = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: '"SF Mono", Menlo, Monaco, "Courier New", monospace',
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
    // 禁用 modifyOtherKeys（避免送出 ~XXXX~ escape sequence）
    xterm.write("\x1b[>4;0m");
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

    // IME 組字期間暫停送出
    let composing = false;
    const xtermEl = container.querySelector(".xterm-helper-textarea") as HTMLTextAreaElement | null;
    if (xtermEl) {
      xtermEl.addEventListener("compositionstart", () => { composing = true; });
      xtermEl.addEventListener("compositionend", (e) => {
        composing = false;
        // 組字完成後送出結果
        const text = (e as CompositionEvent).data;
        if (text) invoke("write_to_agent", { agentId: agent.id, data: text });
      });
    }

    xterm.onData((data) => {
      if (composing) return; // 組字中，略過
      invoke("write_to_agent", { agentId: agent.id, data });
    });

    let unlisten: (() => void) | null = null;
    listen<string>(`pty-output-${agent.id}`, (event) => {
      if (disposed) return;
      const bytes = Uint8Array.from(atob(event.payload), (c) => c.charCodeAt(0));
      xterm.write(bytes);
    }).then((fn) => { unlisten = fn; });

    let unlistenExit: (() => void) | null = null;
    listen<void>(`pty-exit-${agent.id}`, () => {
      if (disposed) return;
      onStatusChange("offline");
    }).then((fn) => { unlistenExit = fn; });

    setTimeout(async () => {
      if (disposed) return;
      fitAddon.fit();
      try {
        await invoke("spawn_agent", {
          agentId: agent.id,
          command: agent.command,
          workingDir: agent.workingDir,
          cols: xterm.cols,
          rows: xterm.rows,
        });
        if (!disposed) onStatusChange("online");
      } catch (e) {
        if (!disposed) {
          xterm.writeln(`\r\n[錯誤] 無法啟動: ${e}`);
          onStatusChange("offline");
        }
      }
    }, 200);

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
      {/* xterm 容器 */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 p-1"
        onClick={() => xtermRef.current?.focus()}
      />
    </div>
  );
}
