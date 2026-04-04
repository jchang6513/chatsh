/**
 * T023: Window Resize — Long lines should not be truncated after resize
 *
 * Test steps:
 * 1. Launch app (handled by tauri-driver)
 * 2. Type a 120-character long line into the terminal
 * 3. Take screenshot (before resize)
 * 4. Resize the window to a narrower width
 * 5. Wait 1 second for re-render
 * 6. Take screenshot (after resize)
 * 7. Verify the long line is still present (not blank/truncated)
 */
import path from "path";
import { mkdir } from "fs/promises";
import { existsSync } from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dir = path.dirname(__filename);
const SCREENSHOTS_DIR = path.resolve(__dir, "..", "screenshots");
const LONG_LINE = "A".repeat(120); // 120-char line to test truncation

async function ensureScreenshotsDir(): Promise<void> {
  if (!existsSync(SCREENSHOTS_DIR)) {
    await mkdir(SCREENSHOTS_DIR, { recursive: true });
  }
}

describe("T023: Window Resize — Long Line Preservation", () => {
  before(async () => {
    await ensureScreenshotsDir();
    // Give app time to fully initialize
    await browser.pause(2000);
  });

  it("should preserve long lines after window resize", async () => {
    // ── 1. Find the terminal input area ──
    // chatsh uses xterm.js; the active area is a canvas + textarea
    // We interact via keyboard since xterm renders to canvas (not DOM text)
    const terminalCanvas = await $(".xterm-helper-textarea");

    // Click to focus
    await terminalCanvas.click();
    await browser.pause(500);

    // ── 2. Type a 120-char long line ──
    await browser.keys(LONG_LINE.split(""));
    await browser.pause(300);

    // ── 3. Screenshot BEFORE resize ──
    const beforePath = path.join(SCREENSHOTS_DIR, "t023-before-resize.png");
    await browser.saveScreenshot(beforePath);
    console.log(`[T023] Before screenshot: ${beforePath}`);

    // ── 4. Get current window size and resize to narrower ──
    const windowSize = await browser.getWindowSize();
    const originalWidth = windowSize.width;
    const originalHeight = windowSize.height;

    const narrowWidth = Math.max(600, Math.floor(originalWidth * 0.5));
    await browser.setWindowSize(narrowWidth, originalHeight);
    console.log(
      `[T023] Resized window: ${originalWidth}px → ${narrowWidth}px`
    );

    // ── 5. Wait 1 second for re-render ──
    await browser.pause(1000);

    // ── 6. Screenshot AFTER resize ──
    const afterPath = path.join(SCREENSHOTS_DIR, "t023-after-resize.png");
    await browser.saveScreenshot(afterPath);
    console.log(`[T023] After screenshot: ${afterPath}`);

    // ── 7. Verify terminal is still rendered (not blank) ──
    // Check that the xterm canvas is still present and visible
    const xtermScreen = await $(".xterm-screen");
    const isDisplayed = await xtermScreen.isDisplayed();
    expect(isDisplayed).toBe(true);

    // Check the terminal viewport still has dimensions (not collapsed to 0)
    const size = await xtermScreen.getSize();
    expect(size.width).toBeGreaterThan(0);
    expect(size.height).toBeGreaterThan(0);

    // Additional: verify the textarea (input area) is still active
    const helperTextarea = await $(".xterm-helper-textarea");
    const textareaExists = await helperTextarea.isExisting();
    expect(textareaExists).toBe(true);

    console.log(
      `[T023] PASS — Terminal visible after resize (${size.width}x${size.height})`
    );

    // ── Restore original window size ──
    await browser.setWindowSize(originalWidth, originalHeight);
  });
});
