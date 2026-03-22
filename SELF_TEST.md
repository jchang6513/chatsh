# chat.sh 自測文件

每次重大改動後執行。截圖存到 `~/.openclaw/media/`，用 `image` tool 分析結果。

---

## 環境準備

```bash
# 重啟 dev
pkill -9 -f "target/debug/chatsh|tauri dev|vite"
cd ~/Workspace/chatsh && npm run tauri dev > /tmp/chatsh-dev.log 2>&1 &
# 等 20 秒讓 app 起來
sleep 20

# 帶 app 到前景
osascript -e 'tell application "chat.sh" to activate'
sleep 2

# 截圖
/usr/sbin/screencapture -x ~/.openclaw/media/chatsh-test-$(date +%H%M%S).png
```

---

## TC-01：基本 UI 佈局

**觸發：** 每次啟動

**截圖分析：**
- [ ] chatsh 視窗可見
- [ ] Sidebar 在左側（或設定的右側）
- [ ] `[Preferences ⌘,]` 和 `[+ New Pane]` 按鈕在 Sidebar **底部**
- [ ] Status bar 在最底部，顯示路徑、CLI 名稱、主題名、RUNNING/STOPPED、時鐘
- [ ] 筆電：status bar 有電量顯示

---

## TC-02：Preferences 彈窗

**觸發：**
```bash
osascript -e 'tell application "System Events" to tell process "chatsh" to keystroke "," using {command down}'
sleep 1
/usr/sbin/screencapture -x ~/.openclaw/media/chatsh-prefs.png
```

**截圖分析：**
- [ ] 彈窗**置中**顯示
- [ ] 標題只有一行 `─ PREFERENCES ─`（無雙標題）
- [ ] 右上角有 `[×]` 按鈕
- [ ] 無 `[ESC]` 按鈕（已改為 `[×]`）
- [ ] 四個 tab：Terminal / Appearance / Keys / Templates
- [ ] 彈窗不超出畫面
- [ ] `⌘,` 或 Esc 可關閉

---

## TC-03：New Pane 彈窗

**觸發：** `⌘N`（鍵盤）

**截圖分析：**
- [ ] 彈窗**置中**
- [ ] 標題 `─ NEW PANE ─`
- [ ] 右上角有 `[×]`
- [ ] 三個選項：FROM TEMPLATE / CUSTOM
- [ ] FROM TEMPLATE 點選後進入 Step 2（非展開在同畫面）
- [ ] Step 2 有 `[Back]` 按鈕可回 Step 1
- [ ] Esc 可關閉

---

## TC-04：Edit Pane 彈窗

**觸發：** 右鍵 Sidebar → Edit

**截圖分析：**
- [ ] 彈窗**置中**
- [ ] 標題 `─ EDIT PANE ─`
- [ ] 右上角有 `[×]`
- [ ] 無 Upload/Avatar 按鈕
- [ ] system prompt 欄位顯示正確檔名（claude → CLAUDE.md，gemini → GEMINI.md）
- [ ] 已存的 system prompt 內容有讀取顯示
- [ ] Esc 可關閉

---

## TC-05：右鍵選單位置（Zoom 測試）

**觸發：** Preferences → Appearance → UI Scale 調到非 1.0（如 1.2）→ 右鍵 Sidebar item

**截圖分析：**
- [ ] Context menu 出現在滑鼠點擊位置附近（不偏移）
- [ ] 選單項目：Edit / Duplicate / Restart / Delete

---

## TC-06：Terminal 文字選取（Zoom 測試）

**觸發：** UI Scale 調到非 1.0 → 在 terminal 內拖曳選取文字

**截圖分析：**
- [ ] 選取框準確框住目標文字（不偏移）
- [ ] 複製後內容正確

---

## TC-07：Shell Tab 功能

**觸發：** `⌘T` 新增 Shell tab

**截圖分析：**
- [ ] Tab bar 出現新的 Shell tab
- [ ] `+` 按鈕左右都有 border
- [ ] Shell 在 agent 的 workingDir 開啟（不是 `~`）
- [ ] 多個 shell tabs 時橫向滾動，active tab 自動可見
- [ ] `⌘W` 關閉當前 shell

---

## TC-08：未讀通知

**觸發：** 切換到另一個 Pane → 在背景 Pane 執行指令或等 LLM 回應

**截圖分析：**
- [ ] 背景 Pane 完成後，圓點變為 amber 靜態（不閃爍）
- [ ] 切換回該 Pane 後 amber 圓點消失
- [ ] 無閃爍動畫

---

## TC-09：色系切換

**觸發：** Preferences → Appearance → 點選不同色系

**截圖分析：**
- [ ] 整個 UI 色系立即更新
- [ ] Terminal 顏色同步更新
- [ ] 設定後重啟 app 仍保留

---

## TC-10：Sidebar 位置切換

**觸發：** Preferences → Appearance → SIDEBAR POSITION → RIGHT

**截圖分析：**
- [ ] Sidebar 移到右側
- [ ] LEFT 可切換回來
- [ ] 設定後重啟保留

---

## 截圖分析 Prompt 範本

```
這是 chatsh 的截圖。請確認：
1) chatsh 視窗是否在最前面？
2) [具體測試項目描述]
3) 有沒有任何明顯的 UI 異常？
```

---

## 已知限制

- `osascript keystroke` 需要 Accessibility 權限，目前沙箱下無法自動觸發按鍵
- 截圖需要 chatsh 在前景，用 `osascript 'tell application "chat.sh" to activate'`
- Tauri dev 截圖前要等 app 完全載入（約 20 秒）

---

_最後更新：2026-03-22_
