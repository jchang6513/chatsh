import { useEffect, useRef, useCallback } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Pane } from "../types";
import { useTheme } from "../ThemeContext";
import { useSettings } from "../SettingsContext";
import { usePasteImageOverlay } from "../hooks/usePasteImageOverlay";
import "@xterm/xterm/css/xterm.css";

interface Props {
  agent: Pane;
  isActive: boolean;
  onStatusChange: (status: Pane["status"]) => void;
  restartKey?: number;
}

export default function Terminal({ agent, isActive, onStatusChange, restartKey = 0 }: Props) {
  const { scheme } = useTheme();
  const { globalSettings } = useSettings();
  const settings = globalSettings;
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  // T019: 用 ref 持有最新 uiScale，避免 doFit closure stale 問題
  const uiScaleRef = useRef(globalSettings.uiScale ?? 1);
  const doFitRef = useRef<() => void>(() => {});

  // 同步最新 uiScale 到 ref（globalSettings 變動時立即更新並重新 fit）
  useEffect(() => {
    uiScaleRef.current = globalSettings.uiScale ?? 1;
    doFitRef.current();
  }, [globalSettings.uiScale]);

  // T018: 圖片貼上縮圖 overlay
  const { imageUrl, clearImage } = usePasteImageOverlay(containerRef);

  // 點擊 overlay 立即關閉
  const handleOverlayClick = useCallback(() => {
    clearImage();
    xtermRef.current?.focus();
  }, [clearImage]);

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
    // T019: 呼叫帶有 cols 補正的 doFit，而非裸 fitAddonRef.current.fit()
    doFitRef.current();
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

    // Cmd+Click opens URL in default browser (uses Tauri's opener via WebLinksAddon)
    xterm.loadAddon(new WebLinksAddon((_e, uri) => {
      invoke("open_url", { url: uri }).catch(console.error)
    }));

    xterm.open(container);

    // Auto-copy on selection
    xterm.onSelectionChange(() => {
      const text = xterm.getSelection()
      if (text) navigator.clipboard.writeText(text).catch(console.error)
    });
    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    setTimeout(() => {
      fitAddon.fit();
      if (isActive) xterm.focus();
    }, 100);

    // T024: 字型載入後重新 fit，避免初始用 fallback 字型量錯 cell width
    if (typeof document !== "undefined" && (document as any).fonts?.ready) {
      (document as any).fonts.ready.then(() => {
        if (!disposed) doFitRef.current();
      }).catch(() => {});
    }

    const doFit = () => {
      if (!fitAddonRef.current || !xtermRef.current) return;
      fitAddonRef.current.fit();
      // T024: 無條件用 getBoundingClientRect().width 補正 cols
      // 即使 uiScale === 1，FitAddon 的 clientWidth 計算仍可能受字型載入時機、
      // sub-pixel rounding、padding 等因素而與真實可視寬度有 1~2 cols 誤差，
      // 造成 TUI 文字被右邊 overflow:hidden 切掉或左側殘影。
      void uiScaleRef.current; // 保留 ref 觸發機制
      if (container) {
        const rect = container.getBoundingClientRect();
        const core = (xtermRef.current as any)._core;
        const cellDims = core?._renderService?.dimensions?.css?.cell;
        const cellW = cellDims?.width;
        const cellH = cellDims?.height;
        if (cellW && cellW > 0 && cellH && cellH > 0) {
          const padX = (parseFloat(getComputedStyle(container).paddingLeft) || 0) * 2;
          const padY = (parseFloat(getComputedStyle(container).paddingTop) || 0) * 2;
          const correctCols = Math.max(2, Math.floor((rect.width - padX) / cellW));
          const correctRows = Math.max(2, Math.floor((rect.height - padY) / cellH));
          if (correctCols !== xtermRef.current.cols || correctRows !== xtermRef.current.rows) {
            xtermRef.current.resize(correctCols, correctRows);
            // 重新 fit 對齊渲染層
            fitAddonRef.current.fit();
          }
        }
      }
      invoke("resize_pty", {
        agentId: agent.id,
        cols: xterm.cols,
        rows: xterm.rows,
      }).catch(() => {});
    };
    // 更新 ref 讓外部 effect（uiScale 變動）可呼叫最新 doFit
    doFitRef.current = doFit;

    const resizeObs = new ResizeObserver(doFit);
    resizeObs.observe(container);

    // 監聽 devicePixelRatio 變化（zoom in/out）
    let dprMediaQuery: MediaQueryList | null = null;
    const onDprChange = () => {
      doFit();
      // 重新監聽下一個 dpr 變化
      dprMediaQuery?.removeEventListener("change", onDprChange);
      dprMediaQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      dprMediaQuery.addEventListener("change", onDprChange);
    };
    dprMediaQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    dprMediaQuery.addEventListener("change", onDprChange);

    // T020: 攔截 Cmd+V，偵測剪貼簿是否有圖片
    // - 有圖片：return false 阻止 xterm，送 Ctrl+V (\x16) 讓 Claude Code 以系統 API 讀取
    // - 純文字：return false 阻止 xterm，手動送文字（維持一致的 paste 路徑）
    //
    // 根本原因修正：舊版用 btoa(dataUrl) 送進 write_to_agent，但 Rust 端會再做一次
    // base64 encode，導致 daemon 寫入 PTY 的是 btoa 後的字串（雙重 encode），
    // Claude Code 無法識別。Claude Code 在 macOS 接受 Ctrl+V 後自己用系統 API 讀取。
    xterm.attachCustomKeyEventHandler((e: KeyboardEvent) => {
      if (e.type !== "keydown" || !e.metaKey || e.key !== "v") return true;

      // 接管所有 Cmd+V：非同步判斷剪貼簿內容
      navigator.clipboard.read().then(items => {
        const hasImage = items.some(item =>
          item.types.some((t: string) => t.startsWith("image/"))
        )
        if (hasImage) {
          // 有圖片：送 Ctrl+V (\x16)，Claude Code 收到後自行呼叫系統 clipboard API 取得圖片
          invoke("write_to_agent", {
            agentId: agent.id,
            data: "\x16",
          }).catch(console.error)
        } else {
          // 純文字：讀取並手動送出（避免 xterm 處理造成 double paste）
          navigator.clipboard.readText().then(text => {
            if (text) {
              invoke("write_to_agent", {
                agentId: agent.id,
                data: text,
              }).catch(console.error)
            }
          }).catch(() => {})
        }
      }).catch(() => {
        // clipboard.read() 權限被拒（沙箱環境）：fallback 讀文字
        navigator.clipboard.readText().then(text => {
          if (text) {
            invoke("write_to_agent", {
              agentId: agent.id,
              data: text,
            }).catch(console.error)
          }
        }).catch(() => {})
      })

      return false // 阻止 xterm 預設 paste，由我們接管
    });

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
      dprMediaQuery?.removeEventListener("change", onDprChange);
      if (unlisten) unlisten();
      if (unlistenExit) unlistenExit();
      xterm.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, [agent.id, restartKey]);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* xterm container，relative 讓 overlay 能絕對定位 */}
      <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
        <div
          ref={containerRef}
          style={{ padding: settings.padding, overflow: "hidden", height: "100%" }}
          onClick={() => xtermRef.current?.focus()}
        />
        {/* T018: 貼上圖片縮圖 overlay */}
        {imageUrl && (
          <div
            onClick={handleOverlayClick}
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              maxWidth: 320,
              maxHeight: 240,
              borderRadius: 8,
              overflow: "hidden",
              boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
              cursor: "pointer",
              zIndex: 100,
            }}
            title="點擊關閉"
          >
            <img
              src={imageUrl}
              alt="貼上的圖片"
              style={{ display: "block", maxWidth: 320, maxHeight: 240, objectFit: "contain" }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
