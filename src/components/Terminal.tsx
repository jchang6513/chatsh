import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Agent } from "../types";
import "@xterm/xterm/css/xterm.css";

interface Props {
  agent: Agent;
  isActive: boolean;
  onStatusChange: (status: Agent["status"]) => void;
  showShellPane: boolean;
  onToggleShell: () => void;
}

export default function Terminal({ agent, isActive, onStatusChange, showShellPane, onToggleShell }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const mountedRef = useRef(false);

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
        background: "#0d0d0d",
        foreground: "#d4d4d4",
        cursor: "#d4d4d4",
        selectionBackground: "#2d3a4a",
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
      <div className="flex items-center gap-2 px-4 h-11 bg-[#0d0d0d] border-b border-[#404040] flex-shrink-0">
        <span className="text-lg">{agent.emoji}</span>
        <div>
          <div className="text-sm font-semibold text-[#e0e0e0]">{agent.name}</div>
          <div className={`text-xs ${agent.status === "online" ? "text-[#3fb950]" : "text-[#f85149]"}`}>
            {agent.status === "online" ? "● 執行中" : "● 已停止"}
          </div>
        </div>
        <div className="ml-auto flex gap-2">
          <button
            onClick={handleRestart}
            className="px-2 py-1 text-xs rounded border border-[#404040] bg-[#1e1e1e] text-[#808080] hover:border-[#4a9eff] hover:text-[#4a9eff]"
          >
            重啟
          </button>
          <button
            onClick={onToggleShell}
            className={`px-2 py-1 text-xs rounded border ${
              showShellPane
                ? "border-[#4a9eff] bg-[#0d1a2a] text-[#4a9eff]"
                : "border-[#404040] bg-[#1e1e1e] text-[#808080] hover:border-[#4a9eff] hover:text-[#4a9eff]"
            }`}
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
