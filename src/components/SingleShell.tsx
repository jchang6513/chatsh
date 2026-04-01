import { useEffect, useRef, useCallback } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useTheme } from "../ThemeContext";
import { useSettings } from "../SettingsContext";
import { usePasteImageOverlay } from "../hooks/usePasteImageOverlay";
import "@xterm/xterm/css/xterm.css";

interface SingleShellProps {
  sessionId: string;
  isActive: boolean;
  agentId: string;
  workingDir?: string;
}

export default function SingleShell({ sessionId, isActive, agentId, workingDir = "~" }: SingleShellProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const { scheme } = useTheme();
  const { getResolvedSettings, globalSettings } = useSettings();
  const settings = getResolvedSettings(agentId);
  // T017: 用 ref 持有最新 uiScale，避免 doFit closure stale 問題
  const uiScaleRef = useRef(globalSettings.uiScale ?? 1);
  const doFitRef = useRef<() => void>(() => {});

  // 同步最新 uiScale 到 ref（globalSettings 變動時立即更新）
  useEffect(() => {
    uiScaleRef.current = globalSettings.uiScale ?? 1;
    // uiScale 變動後立即重新 fit 以修正 cols
    doFitRef.current();
  }, [globalSettings.uiScale]);

  // T018: 圖片貼上縮圖 overlay
  const { imageUrl, clearImage } = usePasteImageOverlay(containerRef);

  // 點擊 overlay 立即關閉
  const handleOverlayClick = useCallback(() => {
    clearImage();
    xtermRef.current?.focus();
  }, [clearImage]);

  // xterm lifecycle: create on mount, cleanup on unmount
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
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
        selectionBackground: scheme.selection,
        black: scheme.ansi?.black, red: scheme.ansi?.red,
        green: scheme.ansi?.green, yellow: scheme.ansi?.yellow,
        blue: scheme.ansi?.blue, magenta: scheme.ansi?.magenta,
        cyan: scheme.ansi?.cyan, white: scheme.ansi?.white,
        brightBlack: scheme.ansi?.brightBlack, brightRed: scheme.ansi?.brightRed,
        brightGreen: scheme.ansi?.brightGreen, brightYellow: scheme.ansi?.brightYellow,
        brightBlue: scheme.ansi?.brightBlue, brightMagenta: scheme.ansi?.brightMagenta,
        brightCyan: scheme.ansi?.brightCyan, brightWhite: scheme.ansi?.brightWhite,
      },
      allowProposedApi: true,
    });
    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);

    // Cmd+Click opens URL in default browser
    xterm.loadAddon(new WebLinksAddon((_e, uri) => {
      invoke("open_url", { url: uri }).catch(console.error)
    }));

    xtermRef.current = xterm;
    fitRef.current = fitAddon;

    xterm.open(container);

    // Auto-copy on selection
    xterm.onSelectionChange(() => {
      const text = xterm.getSelection()
      if (text) navigator.clipboard.writeText(text).catch(console.error)
    });
    setTimeout(() => fitAddon.fit(), 50);

    // Wait for listener to register before spawning,
    // so scrollback from daemon is not missed.
    let unlisten: (() => void) | null = null;
    listen<string>(`pty-output-${sessionId}`, (event) => {
      const bytes = Uint8Array.from(atob(event.payload), c => c.charCodeAt(0));
      xterm.write(bytes);
    }).then(fn => {
      unlisten = fn;
      if (disposed) return;
      // spawn PTY after listener is ready
      fitAddon.fit();
      invoke("spawn_agent", {
        agentId: sessionId,
        command: ["/bin/zsh"],
        workingDir: workingDir,
        cols: xterm.cols,
        rows: xterm.rows,
        parentPaneId: agentId,
        paneType: "shell",
      }).catch(e => xterm.writeln(`\r\n[Error] ${e}`));
    });

    // keyboard input
    const disposable = xterm.onData(data => {
      // Filter DA responses xterm.js auto-generates — must not reach PTY
      if (/^\x1b\[[?>\d][?>\d;]*c$/.test(data)) return;
      invoke("write_to_agent", { agentId: sessionId, data });
    });

    // resize
    const doFit = () => {
      fitAddon.fit();
      // 補正 CSS zoom 造成的 cols 誤差
      // T017 fix: 透過 uiScaleRef.current 取得最新 uiScale，避免 closure 閉包過期值
      const uiScale = uiScaleRef.current;
      if (uiScale !== 1 && container) {
        const rect = container.getBoundingClientRect();
        const core = (xterm as any)._core;
        const cellW = core?._renderService?.dimensions?.css?.cell?.width;
        if (cellW && cellW > 0) {
          const correctCols = Math.max(2, Math.floor(rect.width / cellW));
          if (correctCols !== xterm.cols) {
            xterm.resize(correctCols, xterm.rows);
          }
        }
      }
      invoke("resize_pty", { agentId: sessionId, cols: xterm.cols, rows: xterm.rows }).catch(() => {});
    };
    // 更新 ref 讓外部 effect（uiScale 變動）可呼叫最新 doFit
    doFitRef.current = doFit;
    const obs = new ResizeObserver(doFit);
    obs.observe(container);

    // 監聽 devicePixelRatio 變化（zoom in/out）
    let dprMQ: MediaQueryList | null = null;
    const onDprChange = () => {
      doFit();
      dprMQ?.removeEventListener("change", onDprChange);
      dprMQ = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      dprMQ.addEventListener("change", onDprChange);
    };
    dprMQ = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    dprMQ.addEventListener("change", onDprChange);

    return () => {
      disposed = true;
      disposable.dispose();
      obs.disconnect();
      dprMQ?.removeEventListener("change", onDprChange);
      unlisten?.();
      xterm.dispose();
      // Don't kill — daemon keeps the shell alive for reconnect.
      // Kill happens in removeShellFromAgent when user closes the tab.
      xtermRef.current = null;
      fitRef.current = null;
    };
  }, [sessionId]);

  // update theme when scheme changes
  useEffect(() => {
    const xterm = xtermRef.current;
    if (!xterm) return;
    xterm.options.theme = {
      background: scheme.background, foreground: scheme.foreground,
      cursor: scheme.cursor, selectionBackground: scheme.selection,
      black: scheme.ansi?.black, red: scheme.ansi?.red,
      green: scheme.ansi?.green, yellow: scheme.ansi?.yellow,
      blue: scheme.ansi?.blue, magenta: scheme.ansi?.magenta,
      cyan: scheme.ansi?.cyan, white: scheme.ansi?.white,
      brightBlack: scheme.ansi?.brightBlack, brightRed: scheme.ansi?.brightRed,
      brightGreen: scheme.ansi?.brightGreen, brightYellow: scheme.ansi?.brightYellow,
      brightBlue: scheme.ansi?.brightBlue, brightMagenta: scheme.ansi?.brightMagenta,
      brightCyan: scheme.ansi?.brightCyan, brightWhite: scheme.ansi?.brightWhite,
    };
    xterm.refresh(0, xterm.rows - 1);
  }, [scheme]);

  // apply settings changes in real-time
  useEffect(() => {
    const xterm = xtermRef.current;
    if (!xterm) return;
    xterm.options.fontSize = Math.round(settings.fontSize * (globalSettings.uiScale ?? 1));
    xterm.options.fontFamily = settings.fontFamily;
    xterm.options.lineHeight = settings.lineHeight;
    xterm.options.cursorBlink = settings.cursorBlink;
    xterm.options.cursorStyle = settings.cursorStyle;
    xterm.options.scrollback = settings.scrollback;
    // T017: 呼叫帶有 cols 補正的 doFit，而非裸 fitRef.current.fit()
    doFitRef.current();
  }, [settings]);

  // focus when active
  useEffect(() => {
    if (isActive) {
      const xterm = xtermRef.current;
      const fitAddon = fitRef.current;
      if (xterm && fitAddon) {
        setTimeout(() => {
          fitAddon.fit();
          xterm.focus();
        }, 50);
      }
    }
  }, [isActive]);

  return (
    <div style={{ position: "relative", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <div
        ref={containerRef}
        style={{ flex: 1, minHeight: 0, padding: settings.padding, display: "flex", flexDirection: "column", overflow: "hidden" }}
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
  );
}
