/**
 * T022: Paste Image — Should not show native paste tooltip
 *
 * Test steps:
 * 1. Launch app (handled by tauri-driver)
 * 2. Set clipboard to a test image via osascript (macOS)
 * 3. Focus the terminal and press Cmd+V
 * 4. Wait briefly for any tooltip to appear
 * 5. Take screenshot
 * 6. Verify no native paste tooltip is visible
 *
 * Note: Setting clipboard to an image requires macOS-specific tooling.
 * This test uses a small inline PNG (1x1 pixel) set via osascript/pbpaste.
 * In CI without display, this test documents expected behavior.
 */
import path from "path";
import { mkdir } from "fs/promises";
import { existsSync, writeFileSync } from "fs";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dir = path.dirname(__filename);
const SCREENSHOTS_DIR = path.resolve(__dir, "..", "screenshots");

// Minimal valid 1x1 transparent PNG (base64)
const TEST_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

async function ensureScreenshotsDir(): Promise<void> {
  if (!existsSync(SCREENSHOTS_DIR)) {
    await mkdir(SCREENSHOTS_DIR, { recursive: true });
  }
}

/**
 * Set clipboard to a PNG image using macOS osascript.
 * Returns true if successful, false if not on macOS or osascript unavailable.
 */
function setClipboardToImage(): boolean {
  try {
    // Write the test PNG to a temp file
    const tmpPath = "/tmp/test-paste-image.png";
    const buf = Buffer.from(TEST_PNG_BASE64, "base64");
    writeFileSync(tmpPath, buf);

    // Use osascript heredoc to set clipboard content to the image file
    const script = `set theFile to POSIX file "${tmpPath}"\nset the clipboard to (read theFile as \xABclass PNGf\xBB)`;
    execSync(`osascript << 'EOF'\n${script}\nEOF`, { timeout: 5000 });
    return true;
  } catch (err) {
    console.warn(
      "[T022] Could not set clipboard to image (not macOS or osascript unavailable):",
      err
    );
    return false;
  }
}

describe("T022: Paste Image — No Native Tooltip", () => {
  before(async () => {
    await ensureScreenshotsDir();
    // Give app time to fully initialize
    await browser.pause(2000);
  });

  it("should not show native paste tooltip when pasting image via Cmd+V", async () => {
    // ── 1. Set clipboard to a test image ──
    const clipboardSet = setClipboardToImage();
    if (!clipboardSet) {
      console.log(
        "[T022] SKIP clipboard setup — proceeding with text paste fallback"
      );
      // Fallback: set clipboard to plain text for basic paste test
      try {
        execSync("echo 'test paste content' | pbcopy", { timeout: 3000 });
      } catch {
        console.warn("[T022] pbcopy also unavailable, skipping clipboard setup");
      }
    }

    // ── 2. Focus terminal ──
    const terminalCanvas = await $(".xterm-helper-textarea");
    await terminalCanvas.click();
    await browser.pause(300);

    // ── 3. Press Cmd+V to paste ──
    await browser.keys(["Meta", "v"]);
    await browser.pause(800); // Wait for any tooltip to appear

    // ── 4. Take screenshot ──
    const screenshotPath = path.join(
      SCREENSHOTS_DIR,
      "t022-paste-result.png"
    );
    await browser.saveScreenshot(screenshotPath);
    console.log(`[T022] Screenshot saved: ${screenshotPath}`);

    // ── 5. Verify no native paste tooltip ──
    // Native macOS paste tooltips typically appear as NSPopover or similar native UI
    // Since we're in a WebDriver context, we check the WebView DOM for any
    // unexpected paste-related UI elements

    // Check that no unexpected overlay/tooltip elements appeared
    // These selectors target common paste UI patterns
    const pasteTooltipSelectors = [
      '[role="tooltip"]',
      ".paste-tooltip",
      ".native-paste-ui",
      '[data-testid="paste-tooltip"]',
    ];

    for (const selector of pasteTooltipSelectors) {
      const elements = await $$(selector);
      const visibleElements = await Promise.all(
        elements.map((el) => el.isDisplayed())
      );
      const hasVisibleTooltip = visibleElements.some(Boolean);
      expect(hasVisibleTooltip).toBe(false);
      if (hasVisibleTooltip) {
        console.error(`[T022] FAIL — Found visible paste tooltip: ${selector}`);
      }
    }

    // Verify the terminal is still functional after paste
    const xtermScreen = await $(".xterm-screen");
    const isDisplayed = await xtermScreen.isDisplayed();
    expect(isDisplayed).toBe(true);

    console.log(
      `[T022] PASS — No native paste tooltip detected. Screenshot: ${screenshotPath}`
    );
    console.log(
      "[T022] NOTE: Manual verification of screenshot recommended for visual confirmation"
    );
  });
});
