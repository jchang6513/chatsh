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
  spawnTrigger: number;
}

// 每個 agent 對應的 terminal 實例快取
const terminalCache = new Map<
  string,
  { xterm: XTerm; fitAddon: FitAddon; spawned: boolean }
>();

// 每個 agent 的 xterm DOM element（detached 時暫存）
const terminalDomCache = new Map<string, HTMLElement>();

// detached 容器，不在可見 DOM 中，用來暫存非 active 的 xterm div
const detachedHolder = document.createElement("div");

export default function Terminal({
  agent,
  onStatusChange,
  showShellPane,
  onToggleShell,
  spawnTrigger,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const unlistenRef = useRef<(() => void) | null>(null);

  const spawnAgent = useCallback(async (ag: Agent, xterm: XTerm, fitAddon: FitAddon) => {
    try {
      fitAddon.fit();
      console.log(`[Terminal] spawn_agent 呼叫中: ${ag.id}`, {
        command: ag.command,
        workingDir: ag.workingDir,
        cols: xterm.cols,
        rows: xterm.rows,
      });
      await invoke("spawn_agent", {
        agentId: ag.id,
        command: ag.command,
        workingDir: ag.workingDir,
        cols: xterm.cols,
        rows: xterm.rows,
      });
      console.log(`[Terminal] spawn_agent 成功: ${ag.id}`);
      onStatusChange("online");
    } catch (e) {
      console.error(`[Terminal] spawn_agent 失敗: ${ag.id}`, e);
      xterm.writeln(`\r\n[錯誤] 無法啟動 PTY: ${e}`);
    }
  }, [onStatusChange]);

  const prevAgentIdRef = useRef<string | null>(null);

  // 主要 effect：初始化 terminal、設定 listener、首次 spawn
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const prevAgentId = prevAgentIdRef.current;
    prevAgentIdRef.current = agent.id;

    // 1. 把舊 agent 的 xterm div 移到 detached cache
    if (prevAgentId && prevAgentId !== agent.id) {
      const prevDom = terminalDomCache.get(prevAgentId);
      if (prevDom && prevDom.parentElement === container) {
        detachedHolder.appendChild(prevDom);
      }
    }

    let cached = terminalCache.get(agent.id);
    const existingDom = terminalDomCache.get(agent.id);

    if (cached && existingDom) {
      // 2. 已有 cached DOM，直接掛回 container
      container.appendChild(existingDom);
      requestAnimationFrame(() => {
        cached!.fitAddon.fit();
        cached!.xterm.refresh(0, cached!.xterm.rows - 1);
        cached!.xterm.focus();
      });
    } else {
      // 3. 第一次建立 xterm
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

      // 建立 xterm 的 root div 並快取
      const xtermDiv = document.createElement("div");
      xtermDiv.style.width = "100%";
      xtermDiv.style.height = "100%";
      container.appendChild(xtermDiv);
      xterm.open(xtermDiv);
      terminalDomCache.set(agent.id, xtermDiv);

      // 延遲 fit 確保容器有尺寸
      requestAnimationFrame(() => {
        fitAddon.fit();
        xterm.refresh(0, xterm.rows - 1);
        xterm.focus();
      });
    }

    const { xterm, fitAddon } = cached!;

    // 先設定 event listener，再 spawn PTY（修復 race condition）
    let disposed = false;
    let unlisten: (() => void) | null = null;

    const setup = async () => {
      console.log(`[Terminal] 開始 setup, agent:`, agent.id, agent.command);
      console.log(`[Terminal] window.__TAURI__ 存在:`, !!(window as any).__TAURI__);
      console.log(`[Terminal] 設定 event listener: pty-output-${agent.id}`);
      const fn = await listen<string>(`pty-output-${agent.id}`, (event) => {
        console.log(`[Terminal] 收到 pty-output-${agent.id}, length: ${event.payload.length}`);
        // base64 decode PTY 輸出
        const binary = atob(event.payload);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        xterm.write(bytes);
      });

      if (disposed) {
        fn();
        return;
      }

      unlisten = fn;
      unlistenRef.current = fn;
      console.log(`[Terminal] event listener 已設定: pty-output-${agent.id}`);

      // listener 就緒後才 spawn
      if (!cached!.spawned) {
        cached!.spawned = true;
        console.log(`[Terminal] 首次啟動 PTY: ${agent.id}`);
        await spawnAgent(agent, xterm, fitAddon);
      }
    };
    setup();

    // 鍵盤輸入送到 PTY
    const disposable = xterm.onData((data) => {
      // Ctrl+C 攔截：關閉 terminal，角色變 offline
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
      disposed = true;
      disposable.dispose();
      unlisten?.();
      resizeObserver.disconnect();
      // 切換時把當前 xterm div 移到 detached cache
      const dom = terminalDomCache.get(agent.id);
      if (dom && dom.parentElement === container) {
        detachedHolder.appendChild(dom);
      }
    };
  }, [agent.id]);

  // 點選已停止的角色時觸發重新 spawn
  useEffect(() => {
    if (spawnTrigger === 0) return;
    const cached = terminalCache.get(agent.id);
    if (cached && !cached.spawned) {
      console.log(`[Terminal] spawnTrigger 觸發，重新啟動: ${agent.id}`);
      cached.spawned = true;
      spawnAgent(agent, cached.xterm, cached.fitAddon);
    }
  }, [spawnTrigger, agent.id, agent, spawnAgent]);

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
      <div
        ref={containerRef}
        className="flex-1 min-h-0 p-1"
        onClick={() => {
          const cached = terminalCache.get(agent.id);
          if (cached) cached.xterm.focus();
        }}
      />
    </div>
  );
}
