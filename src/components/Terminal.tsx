import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Agent } from "../types";
import "@xterm/xterm/css/xterm.css";

interface Props {
  agent: Agent;
  onStatusChange: (status: Agent["status"]) => void;
  showShellPane: boolean;
  onToggleShell: () => void;
}

export default function Terminal({
  agent,
  onStatusChange,
  showShellPane,
  onToggleShell,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const unlistenRef = useRef<(() => void) | null>(null);
  const xtermRef = useRef<XTerm | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = "";

    // 每次切換都新建 xterm
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

    requestAnimationFrame(() => {
      fitAddon.fit();
      xterm.focus();
    });

    // 鍵盤輸入
    const disposable = xterm.onData((data) => {
      if (data === "\x03") {
        invoke("kill_agent", { agentId: agent.id }).then(() => {
          onStatusChange("offline");
          xterm.writeln("\r\n[程序已終止]");
        });
        return;
      }
      invoke("write_to_agent", { agentId: agent.id, data });
    });

    // resize
    const resizeObs = new ResizeObserver(() => {
      fitAddon.fit();
      invoke("resize_pty", {
        agentId: agent.id,
        cols: xterm.cols,
        rows: xterm.rows,
      }).catch(() => {});
    });
    resizeObs.observe(container);

    let disposed = false;

    const setup = async () => {
      // listen PTY output
      const unlisten = await listen<string>(`pty-output-${agent.id}`, (event) => {
        const bytes = Uint8Array.from(atob(event.payload), (c) => c.charCodeAt(0));
        xterm.write(bytes);
      });

      if (disposed) {
        unlisten();
        return;
      }
      unlistenRef.current = unlisten;

      // 確認 PTY 是否在跑
      const alive = await invoke<boolean>("is_agent_alive", { agentId: agent.id });
      if (!alive && !disposed) {
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
        }
      } else if (alive) {
        onStatusChange("online");
      }
    };
    setup();

    return () => {
      disposed = true;
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
      disposable.dispose();
      resizeObs.disconnect();
      xterm.dispose();
      xtermRef.current = null;
    };
  }, [agent.id]);

  const handleRestart = async () => {
    const xterm = xtermRef.current;
    if (!xterm) return;
    try {
      await invoke("kill_agent", { agentId: agent.id });
    } catch {}
    xterm.clear();
    xterm.reset();
    xterm.writeln("[重新啟動中...]");
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
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* 頂部 bar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-[#1e1e1e] border-b border-[#333]">
        <span className="text-xl">{agent.emoji}</span>
        <span className="font-medium">{agent.name}</span>
        <span className="text-xs">
          {agent.status === "online" ? "🟢 執行中" : "🔴 已停止"}
        </span>
        <div className="flex-1" />
        <button
          onClick={handleRestart}
          className="px-2 py-1 text-xs rounded bg-[#333] hover:bg-[#444] transition-colors"
          title="重啟"
        >
          ⟳ 重啟
        </button>
        <button
          onClick={onToggleShell}
          className={`px-2 py-1 text-xs rounded transition-colors ${
            showShellPane ? "bg-[#2d3a4a]" : "bg-[#333] hover:bg-[#444]"
          }`}
          title="Shell 面板"
        >
          ⌨ Shell
        </button>
      </div>

      {/* Terminal 容器 */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 p-1"
        onClick={() => xtermRef.current?.focus()}
      />
    </div>
  );
}
