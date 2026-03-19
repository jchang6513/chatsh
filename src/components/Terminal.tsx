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

// 每個 agent 有自己的 xterm container div（保留在 DOM 不刪除）
const xtermDivs = new Map<string, HTMLDivElement>();
const xtermInstances = new Map<string, { xterm: XTerm; fitAddon: FitAddon; unlisten: (() => void) | null; spawned: boolean }>();

export default function Terminal({ agent, onStatusChange, showShellPane, onToggleShell }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    // 隱藏所有其他 agent 的 xterm div
    xtermDivs.forEach((div, id) => {
      div.style.display = id === agent.id ? "flex" : "none";
    });

    // 如果這個 agent 的 xterm 已存在，只需顯示並 focus
    if (xtermDivs.has(agent.id)) {
      const inst = xtermInstances.get(agent.id)!;
      inst.fitAddon.fit();
      inst.xterm.focus();

      // 如果 PTY 沒在跑，重新 spawn
      invoke<boolean>("is_agent_alive", { agentId: agent.id }).then((alive) => {
        if (!alive && !inst.spawned) {
          spawnAgent(agent, inst.xterm, inst.fitAddon).then(() => {
            inst.spawned = true;
            onStatusChange("online");
          });
        } else if (alive) {
          inst.spawned = true;
          onStatusChange("online");
        }
      });
      return;
    }

    // 第一次：建立 xterm div，append 到 wrapper
    const div = document.createElement("div");
    div.style.cssText = "display:flex; flex:1; min-height:0; width:100%; height:100%;";
    wrapper.appendChild(div);
    xtermDivs.set(agent.id, div);

    const xterm = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "Menlo, Monaco, 'Courier New', monospace",
      theme: { background: "#0d0d0d", foreground: "#d4d4d4", cursor: "#d4d4d4" },
      allowProposedApi: true,
    });
    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);
    xterm.open(div);

    const inst = { xterm, fitAddon, unlisten: null as (() => void) | null, spawned: false };
    xtermInstances.set(agent.id, inst);

    // fit 後 spawn
    setTimeout(async () => {
      fitAddon.fit();
      xterm.focus();

      // listen PTY output
      inst.unlisten = await listen<string>(`pty-output-${agent.id}`, (event) => {
        const bytes = Uint8Array.from(atob(event.payload), c => c.charCodeAt(0));
        xterm.write(bytes);
      });

      // spawn
      await spawnAgent(agent, xterm, fitAddon);
      inst.spawned = true;
      onStatusChange("online");
    }, 100);

    // 鍵盤輸入
    xterm.onData((data) => {
      if (data === "\x03") {
        invoke("kill_agent", { agentId: agent.id }).then(() => {
          inst.spawned = false;
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
      invoke("resize_pty", { agentId: agent.id, cols: xterm.cols, rows: xterm.rows }).catch(() => {});
    });
    resizeObs.observe(div);

    return () => { resizeObs.disconnect(); };
  }, [agent.id]);

  const handleRestart = async () => {
    const inst = xtermInstances.get(agent.id);
    if (!inst) return;
    try { await invoke("kill_agent", { agentId: agent.id }); } catch {}
    inst.spawned = false;
    inst.xterm.clear();
    inst.xterm.writeln("[重新啟動中...]");
    await spawnAgent(agent, inst.xterm, inst.fitAddon);
    inst.spawned = true;
    onStatusChange("online");
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* 頂部 bar */}
      <div className="flex items-center gap-2 px-4 h-11 bg-[#1e1e1e] border-b border-[#2d2d2d] flex-shrink-0">
        <span className="text-lg">{agent.emoji}</span>
        <div>
          <div className="text-sm font-semibold text-[#e0e0e0]">{agent.name}</div>
          <div className="text-xs text-[#4caf50]">● 執行中</div>
        </div>
        <div className="ml-auto flex gap-2">
          <button
            onClick={handleRestart}
            className="px-2 py-1 text-xs rounded border border-[#333] bg-[#252525] text-[#aaa] hover:border-[#4a9eff] hover:text-[#4a9eff]"
          >
            重啟
          </button>
          <button
            onClick={onToggleShell}
            className={`px-2 py-1 text-xs rounded border ${showShellPane ? "border-[#4a9eff] bg-[#1a2a3a] text-[#4a9eff]" : "border-[#333] bg-[#252525] text-[#aaa] hover:border-[#4a9eff] hover:text-[#4a9eff]"}`}
          >
            Shell ↓
          </button>
        </div>
      </div>
      {/* xterm wrapper：所有 agent 的 xterm div 都 append 在這裡 */}
      <div ref={wrapperRef} className="flex-1 min-h-0 relative" />
    </div>
  );
}

async function spawnAgent(agent: Agent, xterm: XTerm, fitAddon: FitAddon) {
  fitAddon.fit();
  try {
    await invoke("spawn_agent", {
      agentId: agent.id,
      command: agent.command,
      workingDir: agent.workingDir,
      cols: xterm.cols,
      rows: xterm.rows,
    });
  } catch (e) {
    xterm.writeln(`\r\n[錯誤] 無法啟動: ${e}`);
  }
}
