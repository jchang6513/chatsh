# chatsh E2E 測試框架

使用 **tauri-driver + WebdriverIO** 對 chatsh 進行端對端自動化測試。

## 架構

```
e2e/
  wdio.conf.ts          # WebdriverIO 設定
  tsconfig.json         # TypeScript 設定（獨立於主專案）
  specs/
    t023-resize.spec.ts  # T023: 視窗 resize 不截斷長行
    t022-paste.spec.ts   # T022: 貼上圖片不顯示 native tooltip
  screenshots/          # 測試截圖（failures 自動儲存）
  README.md             # 本文件
```

## 前置條件

### 1. 安裝 tauri-driver（一次性）
```bash
cargo install tauri-driver
```

### 2. Build chatsh app
```bash
npm run tauri build
```

### 3. 安裝 E2E 依賴
```bash
npm install --save-dev @wdio/cli @wdio/local-runner @wdio/mocha-framework @wdio/spec-reporter @types/mocha
```

## 執行測試

### 完整流程（build + test）
```bash
npm run test:e2e:build
```

### 僅跑測試（已有 build）
```bash
# 1. 啟動 tauri-driver（另開 terminal）
tauri-driver

# 2. 執行測試
npm run test:e2e
```

## 測試清單

| 測試 | 對應 Spec | 說明 |
|------|----------|------|
| T023 | t023-resize.spec.ts | 視窗縮小後長行不消失 |
| T022 | t022-paste.spec.ts | 貼上圖片不出現 native paste tooltip |

## 截圖

- **自動截圖**：測試失敗時自動儲存至 `e2e/screenshots/FAIL_*.png`
- **手動截圖**：各 spec 在關鍵步驟呼叫 `browser.saveScreenshot()` 儲存

## 新增測試

1. 在 `docs/test-cases.md` 加入新測試案例
2. 在 `e2e/specs/` 建立 `t{號碼}-{描述}.spec.ts`
3. 遵循現有 spec 的架構（before/it/screenshot pattern）
4. 執行 `npm run test:e2e` 驗證

## 技術說明

### 為什麼選 tauri-driver + WebdriverIO？

| 方案 | 優點 | 缺點 | 選擇 |
|------|------|------|------|
| tauri-driver + WebdriverIO | 官方支援、測試真實 build | 需先 build | ✅ 選用 |
| Playwright + CDP | 快（dev mode）| 非真實 build | ❌ |
| node-screenshots + robotjs | 簡單 | 無 DOM access，脆弱 | ❌ |

### Tauri 2 WebDriver 設定

```typescript
capabilities: [{
  "tauri:options": {
    application: "/path/to/chatsh"
  },
  browserName: ""
}]
```

### xterm.js 測試注意事項

chatsh 使用 xterm.js，terminal 內容渲染在 `<canvas>` 上而非 DOM 文字節點。
因此：
- 無法用 `getText()` 取得 terminal 輸出
- 改用 `.xterm-helper-textarea` 作為輸入入口
- 用 `.xterm-screen` 驗證 terminal 可見性
- 截圖是驗證 UI 狀態的主要手段
