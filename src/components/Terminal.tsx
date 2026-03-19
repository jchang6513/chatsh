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

// 單一共享 xterm instance（tmux 風格）
let sharedXterm: XTerm | null = null;
let sharedFitAddon: FitAddon | null = null;
let currentUnlisten: (() => void) | null = null;
let currentAgentId: string | null = null;
let currentOnData: { dispose: () => void } | null = null;

function decodeBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export default function Terminal({
  agent,
  onStatusChange,
  showShellPane,
  onToggleShell,
  spawnTrigger,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;

  // 記錄每個 agent 是否已 spawn
  const spawnedRef = useRef<Set<string>>(new Set());

  const spawnAgent = useCallback(async (ag: Agent) => {
    if (!sharedXterm || !sharedFitAddon) return;
    try {
      sharedFitAddon.fit();
      await invoke("spawn_agent", {
        agentId: ag.id,
        command: ag.command,
        workingDir: ag.workingDir,
        cols: sharedXterm.cols,
        rows: sharedXterm.rows,
      });
      spawnedRef.current.add(ag.id);
      onStatusChangeRef.current("online");
    } catch (e) {
      console.error(`[Terminal] spawn_agent 失敗: ${ag.id}`, e);
      sharedXterm.writeln(`\r\n[錯誤] 無法啟動 PTY: ${e}`);
    }
  }, []);

  // 主要 effect：切換 agent 時執行 tmux 風格切換
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;

    const switchTo = async () => {
      // 1. unlisten 舊的 event
      if (currentUnlisten) {
        currentUnlisten();
        currentUnlisten = null;
      }

      // 2. 確保 xterm 存在
      if (!sharedXterm) {
        sharedXterm = new XTerm({
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
        sharedFitAddon = new FitAddon();
        sharedXterm.loadAddon(sharedFitAddon);
      }

      // 3. 如果 xterm 尚未 open 或 container 換了，重新 open
      if (!sharedXterm.element || sharedXterm.element.parentElement !== container) {
        // 清空 container
        container.innerHTML = "";
        const xtermDiv = document.createElement("div");
        xtermDiv.style.width = "100%";
        xtermDiv.style.height = "100%";
        container.appendChild(xtermDiv);
        sharedXterm.open(xtermDiv);
      }

      // 4. fit
      requestAnimationFrame(() => {
        sharedFitAddon!.fit();
      });

      // 5. clear xterm 並 replay buffer
      console.error(`[SWITCH] 切換到 agent: ${agent.id}`);
      sharedXterm.clear();
      sharedXterm.reset();

      try {
        const buf = await invoke<string>("get_buffer", { agentId: agent.id });
        if (buf && !disposed) {
          sharedXterm!.write(decodeBase64(buf));
        }
      } catch (e) {
        console.error(`[Terminal] get_buffer 失敗:`, e);
      }

      if (disposed) return;

      // 6. listen 新 agent 的輸出
      currentUnlisten = await listen<string>(`pty-output-${agent.id}`, (event) => {
        sharedXterm!.write(decodeBase64(event.payload));
      });

      if (disposed) {
        currentUnlisten();
        currentUnlisten = null;
        return;
      }

      currentAgentId = agent.id;

      // 7. 如果 agent 尚未 spawn，自動啟動
      const alive = await invoke<boolean>("is_agent_alive", { agentId: agent.id });
      if (!alive && !disposed) {
        await spawnAgent(agent);
      } else if (alive) {
        spawnedRef.current.add(agent.id);
        onStatusChangeRef.current("online");
      }

      // 8. focus
      if (!disposed) {
        sharedXterm!.focus();
      }
    };

    switchTo();

    // onData：送鍵盤輸入到當前 agent
    if (currentOnData) {
      currentOnData.dispose();
      currentOnData = null;
    }
    currentOnData = sharedXterm?.onData((data) => {
      if (!currentAgentId) return;
      if (data === "\x03") {
        invoke("kill_agent", { agentId: currentAgentId }).then(() => {
          spawnedRef.current.delete(currentAgentId!);
          onStatusChangeRef.current("offline");
          sharedXterm?.writeln("\r\n[程序已終止]");
        });
        return;
      }
      invoke("write_to_agent", { agentId: currentAgentId, data });
    }) ?? null;

    // resize 監聽
    const resizeObserver = new ResizeObserver(() => {
      if (!sharedFitAddon || !currentAgentId) return;
      sharedFitAddon.fit();
      invoke("resize_pty", {
        agentId: currentAgentId,
        cols: sharedXterm!.cols,
        rows: sharedXterm!.rows,
      }).catch(() => {});
    });
    resizeObserver.observe(container);

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      // 注意：不 unlisten，讓切換時的 switchTo 處理
    };
  }, [agent.id, spawnAgent]);

  // 點選已停止的角色時觸發重新 spawn
  useEffect(() => {
    if (spawnTrigger === 0) return;
    if (!spawnedRef.current.has(agent.id)) {
      spawnAgent(agent);
    }
  }, [spawnTrigger, agent.id, agent, spawnAgent]);

  const handleRestart = async () => {
    if (!sharedXterm || !sharedFitAddon) return;
    try {
      await invoke("kill_agent", { agentId: agent.id });
    } catch {}
    spawnedRef.current.delete(agent.id);
    sharedXterm.clear();
    sharedXterm.reset();
    sharedXterm.writeln("[重新啟動中...]");
    await spawnAgent(agent);
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
        onClick={() => sharedXterm?.focus()}
      />
    </div>
  );
}
