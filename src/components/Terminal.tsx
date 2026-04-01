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
  const { getResolvedSettings, globalSettings } = useSettings();
  const settings = getResolvedSettings(agent.id);
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

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
    if (fitAddonRef.current) fitAddonRef.current.fit();
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

    const doFit = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
        invoke("resize_pty", {
          agentId: agent.id,
          cols: xterm.cols,
          rows: xterm.rows,
        }).catch(() => {});
      }
    };

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

    // 攔截 Cmd+V：偵測剪貼簿是否有圖片，有則轉 base64 送進 PTY 讓 Claude Code 接收
    xterm.attachCustomKeyEventHandler((e: KeyboardEvent) => {
      if (e.metaKey && e.key === "v" && e.type === "keydown") {
        navigator.clipboard.read().then(items => {
          for (const item of items) {
            const imageType = item.types.find((t: string) => t.startsWith("image/"))
            if (imageType) {
              item.getType(imageType).then((blob: Blob) => {
                const reader = new FileReader()
                reader.onload = () => {
                  const dataUrl = reader.result as string
                  // btoa 編碼後送進 PTY（daemon 會 decode 再寫入）
                  invoke("write_to_agent", {
                    agentId: agent.id,
                    data: btoa(dataUrl),
                  }).catch(console.error)
                }
                reader.readAsDataURL(blob)
              }).catch(() => {})
              return
            }
          }
        }).catch(() => {})
        // 不 return false，讓 xterm 繼續處理一般 paste（純文字不受影響）
      }
      return true
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
