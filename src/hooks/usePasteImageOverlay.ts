import { useEffect, useRef, useState, useCallback } from "react";

/**
 * 攔截 paste 事件中的圖片（image/*），返回圖片 URL state。
 * 純文字 paste 不受影響（不阻止）。
 *
 * 使用方式：
 *   const { imageUrl, clearImage } = usePasteImageOverlay(containerRef);
 *
 *   // JSX 中：
 *   <div style={{ position: "relative" }}>
 *     <div ref={containerRef} />
 *     {imageUrl && <PasteImageOverlay url={imageUrl} onDone={clearImage} />}
 *   </div>
 */
export function usePasteImageOverlay(
  containerRef: React.RefObject<HTMLDivElement | null>
) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentBlobUrl = useRef<string | null>(null);

  const clearImage = useCallback(() => {
    setImageUrl(null);
    if (currentBlobUrl.current) {
      URL.revokeObjectURL(currentBlobUrl.current);
      currentBlobUrl.current = null;
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function handlePaste(e: Event) {
      const clipEvent = e as ClipboardEvent;
      const items = clipEvent.clipboardData?.items;
      if (!items) return;

      let hasImage = false;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          hasImage = true;
          const blob = items[i].getAsFile();
          if (!blob) continue;

          // 清掉舊的 blob URL
          if (currentBlobUrl.current) {
            URL.revokeObjectURL(currentBlobUrl.current);
          }
          const url = URL.createObjectURL(blob);
          currentBlobUrl.current = url;
          setImageUrl(url);

          // 3 秒後自動消失
          if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
          hideTimerRef.current = setTimeout(() => {
            setImageUrl(null);
            URL.revokeObjectURL(url);
            currentBlobUrl.current = null;
          }, 3000);
        }
      }

      if (hasImage) {
        // 阻止圖片 paste 進入 xterm PTY（避免亂碼）
        e.stopPropagation();
        e.preventDefault();
      }
    }

    // capture:true 確保在 xterm textarea listener 之前觸發
    container.addEventListener("paste", handlePaste, { capture: true });

    return () => {
      container.removeEventListener("paste", handlePaste, { capture: true });
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [containerRef]);

  return { imageUrl, clearImage };
}
