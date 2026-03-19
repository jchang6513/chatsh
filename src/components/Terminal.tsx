import { useEffect, useRef, useCallback } from "react";
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

// 每個 agent 對應的 terminal 實例快取
const terminalCache = new Map<
  string,
  { xterm: XTerm; fitAddon: FitAddon; spawned: boolean }
>();

export default function Terminal({
  agent,
  onStatusChange,
  showShellPane,
  onToggleShell,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const unlistenRef = useRef<(() => void) | null>(null);

  const spawnAgent = useCallback(async (ag: Agent, xterm: XTerm, fitAddon: FitAddon) => {
    try {
      fitAddon.fit();
      await invoke("spawn_agent", {
        agentId: ag.id,
        command: ag.command,
        workingDir: ag.workingDir,
        cols: xterm.cols,
        rows: xterm.rows,
      });
      onStatusChange("online");
    } catch (e) {
      xterm.writeln(`\r\n[錯誤] 無法啟動 PTY: ${e}`);
    }
  }, [onStatusChange]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 清空容器
    container.innerHTML = "";

    let cached = terminalCache.get(agent.id);
    if (!cached) {
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
      cached = { xterm, fitAddon, spawned: false };
      terminalCache.set(agent.id, cached);
    }

    const { xterm, fitAddon } = cached;
    xterm.open(container);

    // 延遲 fit 確保容器有尺寸
    requestAnimationFrame(() => {
      fitAddon.fit();
    });

    // 監聽 PTY 輸出
    let unlisten: (() => void) | null = null;
    listen<string>(`pty-output-${agent.id}`, (event) => {
      xterm.write(event.payload);
    }).then((fn) => {
      unlisten = fn;
      unlistenRef.current = fn;
    });

    // 首次啟動 PTY
    if (!cached.spawned) {
      cached.spawned = true;
      spawnAgent(agent, xterm, fitAddon);
    }

    // 鍵盤輸入送到 PTY
    const disposable = xterm.onData((data) => {
      // Ctrl+C 攔截：關閉 terminal，角色變 🔴
      if (data === "\x03") {
        invoke("kill_agent", { agentId: agent.id }).then(() => {
          onStatusChange("offline");
          xterm.writeln("\r\n[程序已終止]");
          cached!.spawned = false;
        });
        return;
      }
      invoke("write_to_agent", { agentId: agent.id, data });
    });

    // resize 監聽
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      invoke("resize_pty", {
        agentId: agent.id,
        cols: xterm.cols,
        rows: xterm.rows,
      }).catch(() => {});
    });
    resizeObserver.observe(container);

    return () => {
      disposable.dispose();
      unlisten?.();
      resizeObserver.disconnect();
    };
  }, [agent.id]);

  const handleRestart = async () => {
    const cached = terminalCache.get(agent.id);
    if (!cached) return;
    const { xterm, fitAddon } = cached;

    try {
      await invoke("kill_agent", { agentId: agent.id });
    } catch {}

    xterm.clear();
    xterm.writeln("[重新啟動中...]");
    cached.spawned = true;
    spawnAgent(agent, xterm, fitAddon);
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
      <div ref={containerRef} className="flex-1 min-h-0 p-1" />
    </div>
  );
}
