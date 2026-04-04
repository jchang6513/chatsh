# Test Case Review：T022 + T023
_日期：2026-04-04_

## 原始碼分析摘要

### 圖片貼上相關實作（Terminal.tsx + usePasteImageOverlay.ts）

**Terminal.tsx `attachCustomKeyEventHandler`（T020）**
- 攔截所有 Cmd+V，呼叫 `navigator.clipboard.read()` 判斷是否有圖片
- 有圖片 → 送 `\x16`（Ctrl+V）讓 Claude Code 自行讀取剪貼簿
- 純文字 → 透過 `write_to_agent` 送出
- 最後 `return false` 阻止 xterm 預設 paste

**usePasteImageOverlay.ts（T018）**
- 監聽 DOM `paste` 事件（capture: true）
- 有圖片時顯示 3 秒縮圖 overlay
- **問題**：監聽的是 DOM `paste` 事件，但 Tauri macOS WebView 在 Cmd+V 時可能觸發原生 Paste 選單（context menu），此事件在 `attachCustomKeyEventHandler` 之前觸發

**已知 Bug A 原因推測**
1. **Bug A1（Paste tooltip）**：macOS Tauri WebView 在 Cmd+V 時可能彈出原生 paste 選單，在 xterm 的 `attachCustomKeyEventHandler` 攔截到之前就顯示了
2. **Bug A2（自動 preview）**：當剪貼簿有圖片且按下 Cmd+V，`clipboard.read()` 是非同步的，可能某些時序下 DOM paste 事件也觸發，使 `usePasteImageOverlay` 看到圖片；或 Tauri 內建 paste 機制先觸發
3. **Bug A3（不穩定）**：`clipboard.read()` 權限拒絕或非同步時序問題，fallback 路徑可能不完整

### Resize 相關實作（Terminal.tsx）

**doFit 邏輯**
- `ResizeObserver` 監聽 container 大小變化 → 觸發 `doFit()`
- `dprMediaQuery` 監聽 DPR 變化（應對瀏覽器 zoom）
- `fitAddon.fit()` 計算 cols/rows
- **補正邏輯只在 `uiScale !== 1` 時執行**（T019 fix 針對 CSS zoom）

**已知 Bug B 原因推測**
1. **Bug B1（cols 沒重算）**：macOS 原生 zoom（綠色按鈕 fullscreen）後，`ResizeObserver` 可能無法感知到 container 變化（因為 app 是在 Tauri WebView 層），`fitAddon.fit()` 的 `clientWidth` 可能不反映真實可視寬度；當 `uiScale === 1` 時補正邏輯不執行
2. **Bug B2（scrollbar）**：cols 未更新導致 xterm 認為行寬不足，超出部分出現橫向 scrollbar

---

## 問題 A：圖片貼上（T022）

### 現有測試案例涵蓋狀況

| 測試 | 場景 | 能測到？ | 說明 |
|------|------|---------|------|
| TC-UX05 | 貼上圖片 → 顯示縮圖 overlay | ⚠️ 部分 | 能測試正常流程，但無法確認「是否出現 Paste tooltip」；若 Bug A1 發生，Paste tooltip 彈出後仍可能貼上，此測試會 PASS，bug 被遮蔽 |
| TC-UX06 | 貼上圖片 → PTY 不收到亂碼 | ⚠️ 部分 | 可測試 PTY 不含亂碼，但對 Bug A1（tooltip）和 Bug A2（自動 preview）無感知 |
| TC-UX07 | Cmd+V 貼上圖片到 Claude Code → 顯示 [Image #1] | ⚠️ 部分 | 可測到 Bug A3（成功率不穩定）；若 Bug A1 發生（paste 選單出現），使用者必須手動點「Paste」才能繼續，FAIL；但無法自動化驗證 tooltip 本身 |
| TC-UX08 | Cmd+V 純文字貼上不受影響 | ❌ 無關 | 純文字場景，對三個 Bug 均無感知 |

### 缺口分析

1. **Bug A1（Paste tooltip）**：沒有任何測試案例明確驗證「Cmd+V 不應出現 paste 選單/tooltip」。TC-UX05/06/07 的步驟都假設貼上可直接發生，沒有明確 step 確認「無 tooltip 彈出」。
2. **Bug A2（自動觸發 preview）**：沒有測試案例驗證「剪貼簿有圖片但未主動貼上時，preview 不應自動出現」這個場景。
3. **Bug A3（不穩定）**：TC-UX07 可間接測到（Claude Code 沒顯示 [Image #1] 即 FAIL），但缺乏重複測試和 fallback 路徑驗證。

### 建議新增/修改

#### 修改 TC-UX05（新增 Paste tooltip 驗證步驟）
在 Expected 中加入：「**不應**出現原生 Paste 選單或 tooltip」作為明確驗證點。

#### 新增 TC-UX09：Cmd+V 不應出現 Paste tooltip
```
場景：剪貼簿有圖片，在 terminal 按 Cmd+V
Steps：
  1. 複製任意圖片到剪貼簿
  2. 點擊 terminal pane 確保 focus
  3. 按 Cmd+V
  4. 立即觀察畫面（1 秒內）
Expected：
  - 不出現 macOS 原生 Paste 選單或右鍵 tooltip
  - 直接觸發圖片縮圖 overlay 顯示
  - 若出現選單需手動點擊才能貼上 → FAIL
Note：此為 Bug A1 的直接驗證
```

#### 新增 TC-UX10：剪貼簿有圖片但未貼上時不自動 preview
```
場景：剪貼簿有圖片，未執行任何貼上操作
Steps：
  1. 複製任意圖片到剪貼簿（Cmd+Shift+4 截圖或 Cmd+C）
  2. 切換到 chatsh terminal pane
  3. 不要按任何貼上按鍵，只是正常使用（輸入文字、切換 pane 等）
  4. 觀察 terminal 左上角 30 秒
Expected：
  - 不出現圖片縮圖 overlay
  - 只有在主動按 Cmd+V 後才觸發 overlay
Note：此為 Bug A2 的直接驗證
```

#### 修改 TC-UX07（加入重複測試 + FAIL 條件）
在 Steps 中加入「重複操作 3 次」，Expected 加入「3 次均成功顯示 [Image #1]，成功率 100%」。

---

## 問題 B：視窗縮放（T023）

### 現有測試案例涵蓋狀況

| 測試 | 場景 | 能測到？ | 說明 |
|------|------|---------|------|
| TC-T04 | 拖拉 app 視窗改變大小 → terminal 自動 reflow | ⚠️ 部分 | 覆蓋了「拖拉 resize」場景，但未涵蓋「macOS 原生 zoom（綠色按鈕/雙擊 title bar）」；Expected 只說「不出現亂碼」，沒有明確驗證 cols 重算和 scrollbar 消失 |

### 缺口分析

1. **Bug B1（macOS zoom 後 cols 沒重算）**：TC-T04 只測拖拉 resize，不覆蓋 macOS fullscreen zoom 場景；期望條件也不夠具體（「不出現亂碼」≠「cols 正確重算」）。
2. **Bug B2（文字右側截斷 + scrollbar）**：TC-T04 的 Expected 未明確要求「無橫向 scrollbar」、「長行文字不截斷」。

### 建議新增/修改

#### 修改 TC-T04（加強驗證條件 + 新增 scrollbar 檢查）
```
Expected（修改）：
  - terminal 自動 reflow，不出現亂碼
  - 無橫向 scrollbar
  - 長行指令（>80 chars）不被截斷（可用 `printf '%0.s-' {1..120}` 測試）
  - cols/rows 與視窗大小對應（可在 terminal 輸入 `tput cols` 驗證）
```

#### 新增 TC-T07：macOS 原生 zoom 後 terminal 正常 reflow
```
場景：使用 macOS 原生 zoom/fullscreen 操作
Steps：
  1. 在 terminal 輸入 `printf '%0.s-' {1..120}` 產生 120 字元長行
  2. 點擊 macOS 視窗左上角綠色 zoom 按鈕（或雙擊 title bar 全螢幕）
  3. 等待 1 秒讓 resize 完成
  4. 觀察 terminal 顯示
Expected：
  - 長行文字完整顯示，不被截斷
  - 不出現橫向 scrollbar
  - `tput cols` 輸出與視窗寬度對應（可預估：全螢幕應 ≥ 200 cols）
  - 文字 reflow 正確
Note：
  - 此為 Bug B1/B2 的直接驗證
  - 若 zoom 後 cols 未更新，長行被截斷且出現 scrollbar → FAIL
  - macOS zoom = 雙擊 title bar 或點綠色按鈕放大視窗（非 fullscreen）
```

#### 新增 TC-T08：視窗 resize 後 cols 正確更新
```
場景：拖拉視窗後驗證 PTY cols 同步
Steps：
  1. 記錄當前 cols（在 terminal 輸入 `tput cols`）
  2. 拖拉視窗右邊框，明顯加寬（至少加寬 200px）
  3. 在 terminal 輸入 `tput cols`
Expected：
  - 加寬後 `tput cols` 的值比加寬前大
  - 差異合理（每 ~7px 對應 1 col，加寬 200px 應增加 ~28 cols）
  - 不出現橫向 scrollbar
Note：
  - 此為 Bug B1 的精確驗證（cols 數值層面）
  - 若 cols 不變 → FAIL（表示 resize_pty 未呼叫或 doFit 無效）
```

---

## 結論

- [ ] T022 所有 bug 均有對應測試案例
  - Bug A1（Paste tooltip）：TC-UX05/06/07 均未明確覆蓋 → **需新增 TC-UX09**
  - Bug A2（自動 preview）：無任何測試覆蓋 → **需新增 TC-UX10**
  - Bug A3（不穩定）：TC-UX07 部分覆蓋，需加強重複測試
- [ ] T023 所有 bug 均有對應測試案例
  - Bug B1（macOS zoom cols 未更新）：TC-T04 未覆蓋 zoom 場景 → **需新增 TC-T07**
  - Bug B1（cols 數值驗證）：TC-T04 無數值驗證 → **需新增 TC-T08**
  - Bug B2（scrollbar）：TC-T04 的 Expected 未包含 scrollbar 檢查 → **需修改 TC-T04**
- [x] 需要補充的測試案例已記錄（TC-UX09, TC-UX10, TC-T07, TC-T08 + 修改 TC-T04/TC-UX07）
