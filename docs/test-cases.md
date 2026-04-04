# chatsh Test Cases

## 測試環境說明

### 何時清環境
| 情境 | 指令 |
|------|------|
| 全新啟動驗證 / 發版前完整回歸 | 執行 clean（見下方） |
| Session 保留測試（TC-Session01~05） | **不清**，需要有現有 pane |
| 一般功能測試（TC-P/S/T/UI） | 不需要清，在現有環境操作 |
| TC-D 自動化 | 腳本自行 setup/teardown |

### Clean Script（全新啟動用）
```bash
pkill -f chatsh-daemon; pkill -f "tauri dev|vite|target/debug/chatsh$"
sleep 1
rm -f ~/.chatsh/daemon.sock ~/.chatsh/state.json
rm -rf ~/.chatsh/agents/
rm -rf ~/Library/WebKit/chatsh/
rm -rf ~/Library/WebKit/sh.chat.app/
cd ~/Workspace/chatsh && npm run tauri dev
```

### 只重啟 app（保留 session）
```bash
pkill -f "target/debug/chatsh$"; pkill -f "vite|tauri dev"
sleep 2
cd ~/Workspace/chatsh && npm run tauri dev
```

---

## TC-D: Daemon 整合測試（自動化）

執行：`bash scripts/test-daemon.sh`

### TC-D01: Daemon 存活
- Setup: 啟動 daemon
- Expected: socket 存在，list_panes 回傳空陣列

### TC-D02: Delete 殺 process
- Setup: spawn 一個 zsh pane
- Steps: delete_pane → 等 1 秒
- Expected: 對應 PID 不存在

### TC-D03: 外部 kill-9 偵測
- Setup: spawn 一個 zsh pane，記錄 PID
- Steps: `kill -9 <PID>` → 等 1.5 秒
- Expected: pane status = "stopped"
- Note: 必須用 SIGKILL，zsh 會 trap SIGTERM

### TC-D04: Restart 不重複
- Setup: spawn 一個 zsh pane
- Steps: restart_pane × 5
- Expected: pane status = "running"，舊 PID 已不存在

### TC-D05: Daemon 重連
- Setup: spawn 2 個 pane
- Steps: 重新連線（不重啟 daemon）
- Expected: 2 個 pane 仍 running

### TC-D06: Daemon crash 後 state 保留
- Setup: spawn 1 個 pane
- Steps: kill -9 daemon
- Expected: state.json 保留 pane 記錄

### TC-D07: Shell tab 持久化
- Setup: spawn 1 agent + 2 shell tab（parent_pane_id）
- Expected: list_panes 回傳 1 agent + 2 shell，parent_pane_id 正確

---

## TC-P: Pane 管理

### TC-P01: 新增 Pane
- Steps: 點 `+ New Pane` → 選 template → 確認
- Expected: Sidebar 出現新 pane，terminal 啟動，status = RUNNING

### TC-P02: 刪除 Pane
- Steps: 右鍵 pane → Delete（或 Edit Pane → Delete）
- Expected: Sidebar 移除，process 終止，自動切換到其他 pane

### TC-P03: 重命名 Pane
- Steps: Edit Pane → 修改名稱 → Save
- Expected: Sidebar 顯示新名稱，重啟 app 後名稱保留

### TC-P04: （已移除，emoji 欄位已刪除）

### TC-P05: Restart Pane（⌘R）
- Steps: 按 ⌘R
- Expected: terminal 清空，process 重啟，status RUNNING

### TC-P06: Pane 數量上限
- Steps: 建立多個 pane（>10）
- Expected: 正常運作，sidebar 可 scroll

### TC-P07: 切換 Pane（⌘1–9）
- Steps: 按 ⌘1, ⌘2, ⌘3
- Expected: 切換到對應序號的 pane

### TC-P08: 切換 Pane（⌘Shift+[ / ]）
- Steps: 按 ⌘[ 和 ⌘]
- Expected: 前/後切換，**未讀標記清除**

---

## TC-S: Shell Tab

### TC-S01: 新增 Shell tab（⌘T）
- Steps: 按 ⌘T
- Expected: Tab bar 出現新 Shell tab，切換到該 tab

### TC-S02: 關閉 Shell tab（⌘W）
- Steps: 按 ⌘W 或點 × 按鈕
- Expected: tab 移除，切換到前一個 tab；pane process 終止

### TC-S03: 切換 Shell tab（⌘Shift+[ / ]）
- Steps: 按 ⌘Shift+[ 和 ⌘Shift+]
- Expected: 前/後切換 shell tab

### TC-S04: 重命名 Shell tab
- Steps: 雙擊 tab 名稱 → 輸入新名稱 → Enter
- Expected: tab 顯示新名稱，重啟 app 後保留

### TC-S05: Shell tab 輸入有效
- Steps: 在 shell tab 輸入 `echo hello` → Enter
- Expected: terminal 顯示 `hello`

---

## TC-T: Terminal 互動

### TC-T01: 基本輸入輸出
- Steps: 點擊 terminal → 輸入 `ls` → Enter
- Expected: 列出目錄，文字正常顯示

### TC-T02: 滾動（scrollback）
- Steps: 產生大量輸出 → 向上滾動
- Expected: 可滾動查看歷史，最多 2000 行

### TC-T03: 貼上文字
- Steps: ⌘V 貼上多行文字
- Expected: 內容正確貼到 PTY

### TC-T04: Resize（拖拉視窗）
- Steps:
  1. 在 terminal 輸入 `printf '%0.s-' {1..120}` 產生 120 字元長行
  2. 拖拉 app 視窗右邊框明顯改變大小（縮窄再放寬）
  3. 等待 1 秒讓 resize 完成
- Expected:
  - terminal 自動 reflow，不出現亂碼
  - 無橫向 scrollbar
  - 長行文字不被截斷（120 字元長行在視窗夠寬時完整顯示）
  - `tput cols` 的值與視窗大小對應，resize 前後數值不同
- Note: 此測試涵蓋 T023 Bug B2（scrollbar）的驗證

### TC-T07: macOS 原生 zoom 後 terminal 正常 reflow（T023 Bug B1）
- Steps:
  1. 在 terminal 輸入 `printf '%0.s-' {1..120}` 產生 120 字元長行
  2. 記錄當前 cols（輸入 `tput cols`）
  3. 點擊 macOS 視窗左上角綠色 zoom 按鈕（放大視窗，非 fullscreen）
  4. 等待 1 秒讓 resize 完成
  5. 在 terminal 輸入 `tput cols`，比較前後差異
  6. 觀察 terminal 顯示
- Expected:
  - zoom 後 `tput cols` 的值比 zoom 前大（視窗變寬應增加 cols）
  - 長行文字完整顯示，不被截斷
  - 不出現橫向 scrollbar
  - 文字 reflow 正確
- FAIL 條件：
  - zoom 前後 `tput cols` 相同（cols 未更新）→ FAIL
  - 長行文字右側被截斷，出現 scrollbar → FAIL
- Note: 此為 T023 Bug B1 的直接驗證；根本原因：`uiScale === 1` 時補正邏輯不執行，fitAddon.fit() 可能未感知 macOS native zoom 的大小變化

### TC-T08: 視窗 resize 後 cols 數值正確更新（T023 Bug B1 精確驗證）
- Steps:
  1. 在 terminal 輸入 `tput cols`，記錄當前值（例：120）
  2. 拖拉視窗右邊框明顯加寬（至少 200px）
  3. 等待 1 秒
  4. 再次輸入 `tput cols`
- Expected:
  - 加寬後 `tput cols` 的值比加寬前大（每加寬 ~7px 應增加 1 col）
  - 加寬 200px 應增加約 28 cols（容許 ±5 誤差）
  - 不出現橫向 scrollbar
- FAIL 條件：
  - `tput cols` 前後相同 → FAIL（resize_pty 未被呼叫或 doFit 無效）
- Note: 此測試驗證 doFit → resize_pty 的完整呼叫鏈，與 TC-T04 互補（TC-T04 測視覺，TC-T08 測數值）

### TC-T05: Focus 行為
- Steps: 切換 pane 後直接打字（不點擊）
- Expected: 能直接輸入（xterm 自動 focus）

### TC-T06: LLM pane 輸入（Claude Code / Gemini / Codex）
- Steps: 開 Claude Code pane → trust → 輸入問題
- Expected: 輸入顯示，AI 正常回應

---

## TC-UI: 介面與設定

### TC-UI01: Command Palette（⌘K）
- Steps: 按 ⌘K
- Expected: 彈出 palette，可搜尋並切換 pane，Esc 關閉

### TC-UI02: Preferences（⌘,）
- Steps: 按 ⌘,
- Expected: 設定面板開啟，Esc 關閉

### TC-UI03: UI Zoom（⌘= / ⌘-）
- Steps: 按 ⌘= 放大，⌘- 縮小
- Expected: terminal font size 等比例縮放，設定保留

### TC-UI04: 主題切換
- Steps: Preferences → Theme → 選不同 color scheme
- Expected: terminal/sidebar 配色立即更新，重啟後保留

### TC-UI05: 字體設定
- Steps: Preferences → Font → 修改 font family / size
- Expected: terminal 字體更新，重啟後保留

### TC-UI06: Status Bar
- Steps: 觀察 app 底部 status bar
- Expected: 顯示 pane 名稱、RUNNING/OFFLINE 狀態、時鐘、電量

### TC-UI07: 未讀通知標記
- Steps: 在非 active pane 產生輸出（AI 回應完成）
- Expected: sidebar 該 pane 出現未讀標記（藍點）

### TC-UI08: 系統通知
- Steps: AI pane 完成輸出，app 不在 focus
- Expected: macOS 系統通知彈出（需授權）

### TC-UI09: 所有 Modal 可 Esc 關閉
- Steps: 開啟 Add Pane / Edit Pane / Preferences / Command Palette → 按 Esc
- Expected: 全部正常關閉

---

## TC-Session: Session 持久化

> **環境說明**
> - TC-Session01~05（保留測試）：**不清環境**，需要有現有 pane 才能驗證保留
> - 全新啟動驗證：先執行 clean script 再從 TC-P01 建 pane

### TC-Session01: App 重啟保留 pane（only kill app）
- 前置: 至少有 1 個 running pane，daemon 繼續跑
- Steps: 關閉 app（不殺 daemon）→ 重啟 app
- Expected: 所有 pane 恢復，scrollback 顯示

### TC-Session02: App 重啟後可正常輸入
- 前置: TC-Session01 通過後
- Steps: 點擊 terminal → 輸入文字 → Enter
- Expected: 輸入正常，有 echo

### TC-Session03: App 重啟後無視覺異常
- 前置: 有 Claude/Gemini pane，daemon 繼續跑
- Steps: 重啟 app，觀察各 pane
- Expected: 無底色殘留，無 `1;2c` 等亂碼，scrollback 不重複

### TC-Session04: Shell tab 重啟保留
- 前置: 有 agent pane + ≥2 shell tab，daemon 繼續跑
- Steps: 重啟 app
- Expected: shell tab 恢復，tab bar 顯示正確數量

### TC-Session05: Pane 設定（名稱/emoji）重啟保留
- 前置: 有已命名的 pane
- Steps: 重啟 app
- Expected: 名稱/emoji 保留

### TC-Session06: Pane 順序重啟後一致
- 前置: 有 ≥2 個 pane（不同建立時間）
- Steps: 記下 sidebar 順序 → 重啟 app
- Expected: sidebar 順序與重啟前相同（依建立時間排序）

---

## TC-R: Regression Tests（已修問題防範）

### TC-R01: Terminal 輸入有效（base64 encode）
- Commit: 3003e76
- Steps: 點擊 terminal → 輸入字母 → Enter
- Expected: 有 echo，不靜默

### TC-R02: Scrollback 不空白（listener race）
- Commit: ca400a5
- Steps: spawn 有豐富 output 的 pane → 重啟 app
- Expected: scrollback 完整顯示

### TC-R03: 無底色殘留（scrollback color state）
- Commit: 244e87e
- Steps: Claude/Gemini pane → 重啟 app
- Expected: 無異常背景色

### TC-R04: 無 `1;2c` 輸入（DA response 過濾）
- Commit: 244e87e, 修正 onData filter
- Steps: Gemini/Claude pane → 重啟 app → 觀察輸入框（每次重啟都驗證）
- Expected: 不出現 `1;2c` 或其他 `\x1b[...c` 格式字串
- Note: xterm.js 自動回應 scrollback 裡的 DA query，需在 onData 過濾

### TC-R05: Pane 不重複（localStorage vs daemon）
- Commit: f16c44e
- Steps: 全新環境建 2 pane → 重啟 app
- Expected: sidebar 只顯示 2 個，不重複

### TC-R06: Scrollback 不重複（double attach）
- Commit: 4619b2e
- Steps: 有 output 的 pane → 重啟 app
- Expected: scrollback 只出現一次

### TC-R07: Font 設定重啟後持久化
- Steps: Preferences → Font Family 改為非預設值（如 "Menlo"）、Font Size 改為 18 → 關閉 app → 重開 app
- Expected: terminal 使用修改後的字體與大小，非預設值
- 驗證: `cat ~/.chatsh/settings.json` 應包含 fontFamily 和 fontSize

### TC-R08: localStorage 遷移後設定不遺失
- Steps: 清除 `~/.chatsh/settings.json`，在 localStorage 設定 `chatsh_global_settings` → 重啟 app
- Expected: 設定從 localStorage 遷移至 settings.json，重啟後保留

---

## Known Issues（v0.1.7 待修）

| # | 問題 | 修法 | 狀態 |
|---|------|------|------|
| 1 | Template 不同步（Preference vs New Pane modal） | 移除 auto-detect，固定預設（zsh/bash 擇一 + claude + gemini + codex），統一儲存 | ✅ v0.1.7 |
| 2 | 系統通知去重（同內容只彈一次） | body 加時間戳 | ✅ v0.1.7 |
| 3 | ⌘Shift+[ / ] 切換 pane 未讀不清除 | 改走 handleSelectAgent | ✅ v0.1.7 |
| 4 | Daemon 重啟後 scrollback 消失 | Phase 4：scrollback 寫入 `~/.chatsh/scrollback/{id}` | 待修 Phase 4 |

---

## TC-V017: v0.1.7 新功能測試案例

### TC-V017-01: New Pane modal 顯示固定預設 template
- 前置: 全新安裝或清 localStorage
- Steps: 點 `+ New Pane` → 選 "From Template"
- Expected:
  - 顯示固定預設：`zsh`（或 `bash` 若無 zsh）、`claude`、`gemini`、`codex`
  - 不顯示其他 auto-detected tool（aider, node, python3 等）
  - 不分「Auto-detected」和「User Templates」兩類，統一列表

### TC-V017-02: Preference Template 與 New Pane 同步
- Steps: Preference → Templates 頁面查看 template 清單 → 開 New Pane → From Template
- Expected: 兩邊顯示完全一致的 template 清單

### TC-V017-03: 系統通知每次都觸發
- 前置: 系統通知已授權
- Steps: 在非 active pane 觸發 AI 回應完成（多次）
- Expected: 每次都有通知彈出（body 帶時間戳避免去重）

### TC-V017-04: ⌘Shift+[ / ] 清除未讀
- Steps: 讓非 active pane 有未讀（藍點）→ 用 ⌘[ 或 ⌘] 切換到該 pane
- Expected: 切換後未讀標記消失

---

## TC-Git: Status Bar Git 資訊

### TC-Git01: Git repo 顯示 branch badge
- 前置: pane working dir 設為一個 git repo（e.g. ~/Workspace/chatsh）
- Expected: status bar working dir 右邊出現帶底色的 repo name badge 和 branch badge

### TC-Git02: Clean repo 顯示綠色 branch
- 前置: working dir 是 clean git repo（no uncommitted changes）
- Expected: branch badge 底色為綠色，不帶 `*`

### TC-Git03: Dirty repo 顯示橘色 branch + `*`
- 前置: working dir 有未 commit 的變更
- Expected: branch badge 底色為橘色，branch name 帶 `*`（e.g. `main*`）

### TC-Git04: 非 git repo 不顯示 badge
- 前置: pane working dir 設為 `/tmp`（非 git repo）
- Expected: status bar 只顯示 working dir，沒有 git badge

### TC-Git05: Branch 更新
- Steps: 在 pane 裡切換 branch（`git checkout other-branch`），等 5 秒
- Expected: status bar 的 branch name 自動更新

---

## TC-JSON: Pane 持久化（panes.json）

### TC-JSON01: 新增 pane 後寫入 panes.json
- Steps: 新增一個 pane
- Expected: `~/.chatsh/panes.json` 存在，包含 `{ "panes": [...] }`，無 emoji 欄位

### TC-JSON02: 從 agents.json 向後相容遷移
- 前置: 手動建立 `~/.chatsh/agents.json`（舊格式 `{ "agents": [...] }`），刪除 `panes.json`
- Steps: 重啟 app
- Expected: app 讀取 agents.json 內容，自動寫入 panes.json

### TC-JSON03: panes.json 優先於 agents.json
- 前置: 同時存在 `panes.json` 和 `agents.json`
- Steps: 重啟 app
- Expected: 使用 panes.json 的內容

### TC-JSON04: Fallback localStorage
- 前置: 刪除 `panes.json` 和 `agents.json`，localStorage 有 chatsh_agents
- Steps: 重啟 app
- Expected: 從 localStorage 讀取 pane 列表

### TC-JSON05: Shell sessions 仍存 localStorage
- Steps: 新增 shell tab
- Expected: `localStorage.chatsh_shell_sessions` 更新，panes.json 不包含 shell session 資料

## TC-UX: Terminal UX 功能

### TC-UX01: Cmd+Click 開啟 URL
- Steps: terminal 輸出含 URL（如 `echo "https://example.com"`）→ Cmd+Click 該 URL
- Expected: 系統預設瀏覽器開啟該 URL

### TC-UX02: URL hover 顯示 underline
- Steps: terminal 有 URL 文字 → 滑鼠 hover
- Expected: URL 變成可點擊樣式（underline）

### TC-UX03: 選取後自動複製
- Steps: 在 terminal 拖曳選取任意文字
- Expected: 選取完成後文字自動複製到系統剪貼簿（不需要額外 Cmd+C）

### TC-UX04: SingleShell 也支援相同功能
- Steps: Shell tab 重複 TC-UX01 和 TC-UX03
- Expected: 行為一致

### TC-UX05: 貼上圖片顯示縮圖 (T018)
- Steps: 複製任意圖片 → 在 terminal 按 Cmd+V
- Expected:
  - terminal 左上角出現圖片縮圖 overlay，顯示 3 秒後自動消失；點擊立即關閉
  - **不應出現** macOS 原生 Paste 選單或 tooltip（直接觸發，無需使用者額外確認）
- Note: 純文字 paste 不受影響，走原本 write_to_agent 流程
- Impl: 使用 `attachCustomKeyEventHandler` 攔截 Cmd+V（xterm.js macOS 不觸發 DOM paste 事件）

### TC-UX06: 貼上圖片不寫入 PTY（T018）
- Steps: 複製圖片後貼上
- Expected: PTY 不收到任何亂碼或 binary 輸入（return false 阻止 xterm 預設 paste）

### TC-UX07: Cmd+V 貼上圖片到 Claude Code（T020）
- 前置: Claude Code 在 Terminal pane 正在執行，剪貼板有圖片（截圖）
- Steps:
  1. 在 Terminal pane 按 Cmd+V
  2. 重複操作 3 次（每次重新截圖確保剪貼簿有圖片）
- Expected:
  - Claude Code 顯示 `[Image #1]`，圖片附加到 prompt
  - 3 次操作均成功（成功率 100%）；若任一次失敗 → FAIL（驗證 Bug A3 不穩定問題）
- Impl: 偵測到圖片後送 Ctrl+V (\x16)，Claude Code 收到後自行呼叫系統 clipboard API
- Note: 舊版 bug（btoa(dataUrl) 雙重 encode）已修正

### TC-UX08: Cmd+V 純文字貼上不受影響（T020）
- 前置: 剪貼板有純文字
- Steps: 在 Terminal pane 按 Cmd+V
- Expected: 文字正常貼入 PTY（透過 write_to_agent，行為同 Cmd+V 原本行為）

### TC-UX09: Cmd+V 不應出現 Paste tooltip（T022 Bug A1）
- 前置: 剪貼簿有圖片（Cmd+Shift+4 截圖後 Cmd+C，或 Cmd+Ctrl+Shift+4 截圖到剪貼簿）
- Steps:
  1. 點擊 terminal pane 確保 focus
  2. 按 Cmd+V
  3. 立即觀察畫面（1 秒內）
- Expected:
  - **不**出現 macOS 原生 Paste 選單或右鍵 tooltip
  - 直接觸發圖片縮圖 overlay 顯示（無需額外點擊確認）
  - 若出現 Paste 選單且需要手動點擊才能貼上 → FAIL
- Note: 此為 T022 Bug A1 的直接驗證；根本原因是 Tauri macOS WebView 在 xterm 攔截前觸發原生 paste context menu

### TC-UX10: 剪貼簿有圖片但未貼上時不自動 preview（T022 Bug A2）
- 前置: 剪貼簿有圖片
- Steps:
  1. 複製任意圖片到剪貼簿（Cmd+Ctrl+Shift+4 截圖到剪貼簿）
  2. 切換到 chatsh terminal pane（點擊或 ⌘1 等切換）
  3. 不要按 Cmd+V 或任何貼上操作
  4. 正常輸入文字（如 `ls`）、切換 pane 等操作 30 秒
  5. 觀察 terminal 左上角
- Expected:
  - 30 秒內不出現圖片縮圖 overlay
  - Preview 只在主動按 Cmd+V 後才觸發
  - 若未按 Cmd+V 卻出現 overlay → FAIL
- Note: 此為 T022 Bug A2 的直接驗證；根本原因可能是 DOM paste 事件在 focus 切換時被意外觸發
