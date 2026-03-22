# chatsh Roadmap

## 開發規則
新功能開發前必須先更新 `docs/test-cases.md`，列出測試案例再開始實作。

---

## 進行中

### v0.1.x（Bug Fixes）
修完即發版，不等累積。

---

## 計劃中

### 設定 JSON 化
**目標**：把所有設定從 localStorage 搬到 `~/.chatsh/*.json`

**動機**：
- Agent 可以直接讀寫設定（不需要走 UI）
- 支援 `vim ~/.chatsh/config.json` 直接修改
- 方便 dotfiles 版本控制、跨機器同步

**設計**：
```
~/.chatsh/
  config.json     # 外觀、字體、zoom、notifications、快捷鍵
  agents.json     # pane 清單（名稱、emoji、command、workingDir）
  templates.json  # template 清單
  state.json      # daemon 管理（不動）
```

**實作重點**：
- 所有 `localStorage.getItem/setItem` 換成 Tauri `read_file`/`write_file`
- 寫入加 debounce（150ms）避免高頻寫
- 啟動時 async 讀取，需要處理好 loading state

### Scrollback 持久化（Phase 4）
**目標**：daemon 重啟後 scrollback 也能恢復

**設計**：把 scrollback buffer 定期寫入 `~/.chatsh/scrollback/{pane_id}`

---

## 已知問題（下版本修）
見 `docs/test-cases.md` → Known Issues 區塊
