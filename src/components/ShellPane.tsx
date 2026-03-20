import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useTheme } from "../ThemeContext";
import "@xterm/xterm/css/xterm.css";

const SHELL_AGENT_ID = "__shell_pane__";

let shellTerminal: { xterm: XTerm; fitAddon: FitAddon; spawned: boolean } | null = null;

export default function ShellPane() {
  const { scheme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = "";

    if (!shellTerminal) {
      const xterm = new XTerm({
        cursorBlink: true,
        fontSize: 13,
        fontFamily: "Menlo, Monaco, 'Courier New', monospace",
        theme: {
          background: scheme.background,
          foreground: scheme.foreground,
          cursor: scheme.cursor,
          selectionBackground: scheme.selection,
          green: scheme.green,
          red: scheme.red,
          blue: scheme.blue,
          cyan: scheme.cyan,
          magenta: scheme.magenta,
          yellow: scheme.yellow,
        },
        allowProposedApi: true,
      });
      const fitAddon = new FitAddon();
      xterm.loadAddon(fitAddon);
      shellTerminal = { xterm, fitAddon, spawned: false };
    }

    const { xterm, fitAddon } = shellTerminal;
    xterm.open(container);
    requestAnimationFrame(() => fitAddon.fit());

    const unlisten = listen<string>(`pty-output-${SHELL_AGENT_ID}`, (event) => {
      xterm.write(event.payload);
    });

    if (!shellTerminal.spawned) {
      shellTerminal.spawned = true;
      fitAddon.fit();
      invoke("spawn_agent", {
        agentId: SHELL_AGENT_ID,
        command: "/bin/zsh",
        workingDir: "~",
        cols: xterm.cols,
        rows: xterm.rows,
      }).catch((e) => {
        xterm.writeln(`\r\n[錯誤] ${e}`);
      });
    }

    const disposable = xterm.onData((data) => {
      invoke("write_to_agent", { agentId: SHELL_AGENT_ID, data });
    });

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      invoke("resize_pty", {
        agentId: SHELL_AGENT_ID,
        cols: xterm.cols,
        rows: xterm.rows,
      }).catch(() => {});
    });
    resizeObserver.observe(container);

    return () => {
      disposable.dispose();
      unlisten.then((fn) => fn());
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div className="h-[250px]" style={{ borderTop: "1px solid var(--border)", background: "var(--bg)" }}>
      <div
        ref={containerRef}
        className="h-full p-1"
        onClick={() => shellTerminal?.xterm.focus()}
      />
    </div>
  );
}
