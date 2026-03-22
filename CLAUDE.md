# CLAUDE.md — chatsh 開發規範

## 開發流程（必須遵守）

### 每次新功能
1. **先更新 `docs/test-cases.md`**：列出新功能的測試案例
2. **開發**
3. **跑相關回歸測試**（見下方）
4. **Commit**（包含測試文件的更新）

### 發版前
- 跑完整回歸：daemon 自動化 + 手動 regression checklist

---

## 自動化測試

### Daemon 整合測試（TC-D01~D07）
```bash
cd ~/Workspace/chatsh
bash scripts/test-daemon.sh
```
**需要**：先 build daemon binary（`cargo build --bin chatsh-daemon`）

### TypeScript 類型檢查
```bash
cd ~/Workspace/chatsh
npx tsc --noEmit
```

### Rust build 確認
```bash
cd ~/Workspace/chatsh/src-tauri
cargo build
```

---

## 手動 Regression Checklist

發版前必須手動過以下項目（對應 `docs/test-cases.md` TC-R 系列）：

- [ ] **TC-R01** Terminal 能打字（點擊 terminal 取得 focus，輸入字母有 echo）
- [ ] **TC-R02** 重啟 app 後 scrollback 正常顯示（不空白）
- [ ] **TC-R03** 重啟 app 後無底色殘留
- [ ] **TC-R04** Gemini/Claude pane 重啟後輸入框不出現 `1;2c`
- [ ] **TC-R05** Sidebar pane 不重複（daemon 主導，不疊加 localStorage）
- [ ] **TC-R06** Scrollback 不重複（只出現一次）

### 重啟測試標準步驟
```bash
# 只殺 app，保留 daemon
pkill -f "target/debug/chatsh$"
pkill -f "vite|tauri dev"
# 等 2 秒後重開
cd ~/Workspace/chatsh && npm run tauri dev
```

---

## 架構重點

### Daemon
- Binary: `src-tauri/src/bin/daemon.rs`
- Protocol: `src-tauri/src/protocol.rs`
- Socket: `~/.chatsh/daemon.sock`
- State: `~/.chatsh/state.json`
- Monitor interval: 500ms

### Frontend ↔ Daemon
- `Terminal.tsx` / `SingleShell.tsx`：`listen()` 完成後才呼叫 `spawn_agent`（避免 scrollback race）
- `write_to_agent`：傳送前必須 base64 encode（daemon protocol 要求）
- App.tsx：**不要在 reconnect 時呼叫 spawn_agent**，由 Terminal.tsx mount 後自行 attach

### 清乾淨環境（測試前）
```bash
pkill -f chatsh-daemon; pkill -f "tauri dev|vite|target/debug/chatsh$"
rm -f ~/.chatsh/daemon.sock ~/.chatsh/state.json
rm -rf ~/.chatsh/agents/
rm -rf ~/Library/WebKit/chatsh/         # dev build
rm -rf ~/Library/WebKit/sh.chat.app/    # release build
```

---

## Known Issues（v0.1.7 待修）

1. Template 不同步（Preference vs New Pane modal）
2. 系統通知去重（body 需加時間戳）
3. ⌘[ / ⌘] 切換 pane 未讀不清除
4. Daemon 重啟後 scrollback 消失（Phase 4：寫入檔案）
