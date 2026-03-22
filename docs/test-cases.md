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

### TC-P04: 修改 Pane emoji
- Steps: Edit Pane → 修改 emoji
- Expected: Sidebar 顯示新 emoji

### TC-P05: Restart Pane（⌘R）
- Steps: 按 ⌘R
- Expected: terminal 清空，process 重啟，status RUNNING

### TC-P06: Pane 數量上限
- Steps: 建立多個 pane（>10）
- Expected: 正常運作，sidebar 可 scroll

### TC-P07: 切換 Pane（⌘1–9）
- Steps: 按 ⌘1, ⌘2, ⌘3
- Expected: 切換到對應序號的 pane

### TC-P08: 切換 Pane（⌘[ / ⌘]）
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

### TC-S03: 切換 Shell tab（⌘Shift+[ / ⌘Shift+]）
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

### TC-T04: Resize
- Steps: 拖拉 app 視窗改變大小
- Expected: terminal 自動 reflow，不出現亂碼

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

### TC-R04: 無 `1;2c` 輸入（DA query 副作用）
- Commit: 244e87e
- Steps: Gemini pane → 重啟 app → 觀察輸入框
- Expected: 不出現 `1;2c`

### TC-R05: Pane 不重複（localStorage vs daemon）
- Commit: f16c44e
- Steps: 全新環境建 2 pane → 重啟 app
- Expected: sidebar 只顯示 2 個，不重複

### TC-R06: Scrollback 不重複（double attach）
- Commit: 4619b2e
- Steps: 有 output 的 pane → 重啟 app
- Expected: scrollback 只出現一次

---

## Known Issues（v0.1.7 待修）

| # | 問題 | 修法 |
|---|------|------|
| 1 | Template 不同步（Preference vs New Pane modal） | 移除 auto-detect，固定 4 個預設 |
| 2 | 系統通知去重（同內容只彈一次） | body 加時間戳 |
| 3 | ⌘[ / ⌘] 切換 pane 未讀不清除 | 改走 handleSelectAgent |
| 4 | Daemon 重啟後 scrollback 消失 | Phase 4：scrollback 寫入 `~/.chatsh/scrollback/{id}` |
