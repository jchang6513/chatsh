import path from "path";
import { fileURLToPath } from "url";
import { existsSync, mkdirSync } from "fs";
import type { Options } from "@wdio/types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Path to built app binary (macOS)
// Release build: src-tauri/target/release/chatsh (or .app bundle)
const APP_BINARY = path.resolve(
  __dirname,
  "..",
  "src-tauri",
  "target",
  "release",
  "chatsh"
);

// On macOS, tauri-driver can also accept the .app bundle path
const APP_BUNDLE = path.resolve(
  __dirname,
  "..",
  "src-tauri",
  "target",
  "release",
  "bundle",
  "macos",
  "chat.sh.app"
);

// Use bundle if it exists, otherwise fall back to binary
const applicationPath = existsSync(APP_BUNDLE) ? APP_BUNDLE : APP_BINARY;

const screenshotsDir = path.resolve(__dirname, "screenshots");

export const config: Options.Testrunner = {
  // ====================
  // Runner Configuration
  // ====================
  runner: "local",

  // ==================
  // Specify Test Files
  // ==================
  specs: ["./specs/**/*.spec.ts"],
  exclude: [],

  // ============
  // Capabilities
  // ============
  maxInstances: 1,
  capabilities: [
    {
      // Tauri 2 WebDriver capability
      "tauri:options": {
        application: applicationPath,
      },
      // Required for Tauri driver
      browserName: "",
    },
  ],

  // ===================
  // Test Configurations
  // ===================
  logLevel: "info",
  bail: 0,
  baseUrl: "http://localhost",
  waitforTimeout: 10000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,

  // ================
  // Service (Driver)
  // ================
  // tauri-driver runs on port 4444 by default
  // Start it with: tauri-driver
  hostname: "localhost",
  port: 4444,
  path: "/",

  // =========
  // Framework
  // =========
  framework: "mocha",
  mochaOpts: {
    ui: "bdd",
    timeout: 60000,
  },

  // ==========
  // Reporters
  // ==========
  reporters: ["spec"],

  // =====
  // Hooks
  // =====
  beforeSuite: async () => {
    // Ensure screenshots dir exists
    mkdirSync(screenshotsDir, { recursive: true });
  },

  afterTest: async (test, _context, { passed }) => {
    if (!passed) {
      // Save screenshot on failure
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const safeName = test.title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
      const screenshotPath = path.join(
        screenshotsDir,
        `FAIL_${safeName}_${timestamp}.png`
      );
      await browser.saveScreenshot(screenshotPath);
      console.log(`Screenshot saved: ${screenshotPath}`);
    }
  },
};
