# chatsh Test Cases

## Daemon Integration Tests (TC-D)

### TC-D01: Daemon 存活
- Setup: 啟動 daemon
- Steps: 等待 3 秒後查詢 pane list
- Expected: socket 存在，list_panes 回傳空陣列

### TC-D02: Delete 殺 process
- Setup: spawn 一個 zsh pane
- Steps: delete_pane → 等 1 秒
- Expected: 對應 PID 不存在（kill(pid,0) = ESRCH）

### TC-D03: 外部 kill-9 偵測
- Setup: spawn 一個 zsh pane，記錄 PID
- Steps: `kill -9 <PID>` → 等 1 秒（monitor 500ms interval）
- Expected: pane status 變為 "stopped"
- Note: 必須用 SIGKILL，zsh 會 trap SIGTERM

### TC-D04: Restart 不重複
- Setup: spawn 一個 zsh pane
- Steps: restart_pane 5 次
- Expected: 最終只有 1 個 process（PID 改變，舊 PID 不存在）

### TC-D05: App 重連
- Setup: spawn 3 個 pane，關閉 app（不殺 daemon）
- Steps: 重新啟動 app
- Expected: 3 個 pane 全部恢復，status = "running"

### TC-D06: Daemon crash 後恢復
- Setup: spawn 2 個 pane
- Steps: kill daemon → 重啟 daemon
- Expected: state.json 保留 pane 設定，status = "stopped"

### TC-D07: Shell tab 持久化
- Setup: spawn 1 agent pane + 2 shell tab（parent_pane_id = agent id）
- Steps: 關閉 app → 重啟 app
- Expected:
  - Daemon: 1 agent + 2 shell tab 全部保留
  - UI: sidebar 顯示 agent，tab bar 顯示 2 個 shell tab

---

## Regression Tests

### TC-R01: Terminal 輸入有效 (regression: base64 encode)
- 問題: Phase 2 改走 socket 後 write_to_agent 漏掉 base64 encode
- Commit: 3003e76
- Steps:
  1. 開一個 zsh pane
  2. 點擊 terminal 取得 focus
  3. 輸入 `echo hello`，按 Enter
- Expected: terminal 顯示 `hello`
- Note: Enter 有效但字母無效 = focus 問題；完全無效 = encode 問題

### TC-R02: Terminal output 正確顯示 (regression: listener race)
- 問題: listen() async 尚未 ready，spawn_agent 已 attach，scrollback 丟失
- Commit: ca400a5
- Steps:
  1. spawn 一個 claude/gemini pane（有豐富 scrollback）
  2. 關閉 app（不殺 daemon）
  3. 重啟 app
- Expected: scrollback 完整顯示，不空白

### TC-R03: 底色不殘留 (regression: scrollback color state)
- 問題: TUI（Claude/Gemini）scrollback 包含 background color escape code，replay 時殘留
- Commit: 244e87e
- Fix: scrollback 結尾 append `\x1b[0m`
- Steps:
  1. 開一個 Claude Code 或 Gemini CLI pane，讓它渲染一段時間
  2. 關閉 app → 重啟 app
- Expected: scrollback 顯示正常，無底色殘留

### TC-R04: 不出現 `1;2c` 輸入 (regression: DA query)
- 問題: 在 scrollback 前加 `\x1b[?1049l` 觸發 xterm DA query，response 被送入 PTY
- Commit: 244e87e
- Fix: 改為在 scrollback 結尾加 reset，不在開頭加
- Steps:
  1. 開一個 Gemini CLI pane
  2. 關閉 app → 重啟 app
  3. 觀察 Gemini 輸入框
- Expected: 輸入框不出現 `1;2c` 字串

### TC-R05: Pane 不重複（localStorage vs daemon）
- 問題: App.tsx useState 從 localStorage 初始化 + daemon 恢復，導致 sidebar 重複
- Commit: f16c44e
- Fix: daemon 有 pane 時以 daemon 為準，不讀 localStorage
- Steps:
  1. 清空 state（`rm ~/.chatsh/state.json` + 清 WebKit storage）
  2. 建 2 個 pane
  3. 重啟 app
- Expected: sidebar 只顯示 2 個 pane，不重複

### TC-R06: Scrollback 不重複 (regression: double attach)
- 問題: App.tsx reconnect loop 和 Terminal.tsx mount 各自 attach，scrollback 送兩次
- Commit: 4619b2e
- Fix: 移除 App.tsx 的 re-attach loop，由 Terminal.tsx 負責
- Steps:
  1. 開一個有輸出的 pane
  2. 關閉 app → 重啟 app
- Expected: scrollback 只出現一次，不重複

---

## Automated Test Scripts

### daemon-unit.sh — Daemon 協議測試
位置: `scripts/test-daemon.sh`
涵蓋: TC-D01 ~ TC-D07

執行方式:
```bash
cd ~/Workspace/chatsh
bash scripts/test-daemon.sh
```

---

## Known Issues (待修，v0.1.7)

1. **Template 不同步**: Preference 的 auto-detected template 不顯示在 New Pane modal
   - 修法: 移除 auto-detect，固定 4 個預設（bash/zsh + claude + gemini + codex）

2. **通知去重**: 同 pane 的通知只出現一次（macOS 去重相同 title+body）
   - 修法: body 加時間戳（已有 commit b175f9a，待重新 apply）

3. **⌘[ / ⌘] 未讀不清除**: 快捷鍵切換 pane 時未讀不清除
   - 修法: 改走 handleSelectAgent（已有 commit b175f9a，待重新 apply）

4. **Daemon 重啟後 scrollback 消失**: scrollback buffer 在記憶體，daemon 重啟後丟失
   - 修法（Phase 4）: scrollback 寫入 `~/.chatsh/scrollback/{id}` 檔案
