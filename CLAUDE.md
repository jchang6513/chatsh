# CLAUDE.md — chatsh 開發規範

## Branch 與 PR 規範（強制）

**所有新功能、bug fix 必須在獨立 branch 開發，透過 PR merge 回 main。禁止直接 push 到 main 或直接 git merge。**

```bash
# 1. 建 branch
git checkout -b fix/T019-terminal-resize   # 或 feat/T022-xxx

# 2. 開發、commit

# 3. push branch
git push origin fix/T019-terminal-resize

# 4. 開 PR
gh pr create --title "fix T019: ..." --body "..." --base main

# 5. PR merge（squash）
gh pr merge <PR號碼> --squash
```

Branch 命名：`fix/T{號碼}-{描述}` 或 `feat/T{號碼}-{描述}`

---

## 開發流程（必須遵守）

### 每次新功能
1. **先更新 `docs/test-cases.md`**：列出新功能的測試案例
2. **開發**
3. **跑相關回歸測試**（見下方）
4. **Commit**（包含測試文件的更新）

### 發版前
- 跑完整回歸：daemon 自動化 + 手動 regression checklist
- 執行下方完整發版流程（不可跳步驟）

---

## 發版流程（完整，不可跳步驟）

### Step 1：更新版本號（三個地方都要改）
```bash
VERSION="0.1.x"
sed -i '' "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" package.json
sed -i '' "s/^version = .*/version = \"$VERSION\"/" src-tauri/Cargo.toml
# tauri.conf.json 也要改！（DMG 版本名稱來自這裡）
sed -i '' "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" src-tauri/tauri.conf.json
```
**⚠️ 漏掉 `tauri.conf.json` → DMG 名稱會是舊版本號**

### Step 2：跑完整回歸測試
```bash
# TypeScript
npx tsc --noEmit

# Daemon 自動化
cd src-tauri && cargo build --bin chatsh-daemon && cd ..
bash scripts/test-daemon.sh

# JSON storage regression（如有需要）
bash /tmp/test-regression-json.sh
```

### Step 3：Commit 版本更新
```bash
git add -A
git commit -m "bump version to $VERSION"
git push origin main
```

### Step 4：Build Release DMG
```bash
npm run tauri build
# DMG 產出位置：src-tauri/target/release/bundle/dmg/chat.sh_${VERSION}_aarch64.dmg
# 確認 DMG 檔名包含正確版本號！
```

### Step 5：計算 SHA256
```bash
shasum -a 256 src-tauri/target/release/bundle/dmg/chat.sh_${VERSION}_aarch64.dmg
```

### Step 6：建 GitHub release + 上傳 DMG
```bash
TOKEN="<github_token>"
# 建 tag
git tag v$VERSION && git push origin v$VERSION

# 建 release（用 GitHub API）
RELEASE_ID=$(curl -s -X POST \
  -H "Authorization: token $TOKEN" \
  -H "Content-Type: application/json" \
  https://api.github.com/repos/jchang6513/chatsh/releases \
  -d "{\"tag_name\":\"v$VERSION\",\"name\":\"v$VERSION\",\"body\":\"<changelog>\",\"draft\":false,\"prerelease\":false}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

# 上傳 DMG
curl -s -X POST \
  -H "Authorization: token $TOKEN" \
  -H "Content-Type: application/octet-stream" \
  --data-binary @"src-tauri/target/release/bundle/dmg/chat.sh_${VERSION}_aarch64.dmg" \
  "https://uploads.github.com/repos/jchang6513/chatsh/releases/${RELEASE_ID}/assets?name=chat.sh_${VERSION}_aarch64.dmg"
```

### Step 7：更新 Homebrew Formula
```bash
SHA256="<sha256_from_step5>"
cat > ~/Workspace/homebrew-chatsh/Casks/chatsh.rb << EOF
cask "chatsh" do
  version "$VERSION"
  sha256 "$SHA256"
  url "https://github.com/jchang6513/chatsh/releases/download/v#{version}/chat.sh_#{version}_aarch64.dmg"
  name "chat.sh"
  desc "Terminal-native AI Pane manager"
  homepage "https://chatsh-terminal.vercel.app"
  app "chat.sh.app"
  postflight do
    system_command "/usr/bin/xattr", args: ["-cr", "#{appdir}/chat.sh.app"], sudo: false
  end
end
EOF
cd ~/Workspace/homebrew-chatsh && git add -A && git commit -m "chatsh $VERSION: <changelog>" && git push
```

### 發版 Checklist
- [ ] `package.json` 版本更新
- [ ] `src-tauri/Cargo.toml` 版本更新
- [ ] `src-tauri/tauri.conf.json` 版本更新 ← **常被漏掉**
- [ ] 完整回歸測試通過
- [ ] DMG 檔名包含正確版本號（確認！）
- [ ] GitHub release 建立並有 DMG asset
- [ ] Homebrew formula 更新並 push

---

## E2E 自動化測試（T024）

### 框架
tauri-driver + WebdriverIO，測試真實 release build

### 前置條件
```bash
# 安裝 tauri-driver（一次性）
cargo install tauri-driver

# Build app
npm run tauri build
```

### 執行 E2E 測試
```bash
# 完整流程（build + test）
npm run test:e2e:build

# 僅跑測試（已有 build）
tauri-driver &   # 另開 terminal 或背景執行
npm run test:e2e
```

### E2E Spec 清單
- `e2e/specs/t023-resize.spec.ts` — T023: 視窗 resize 後長行不截斷
- `e2e/specs/t022-paste.spec.ts` — T022: 貼上圖片不出現 native paste tooltip

### 截圖
測試截圖自動儲存至 `e2e/screenshots/`（失敗時自動截圖，各 spec 也有手動截圖）

### 新增 E2E 測試
1. 在 `docs/test-cases.md` 加入測試案例
2. 建立 `e2e/specs/t{號碼}-{描述}.spec.ts`
3. 執行 `npm run test:e2e` 驗證

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

### 何時需要清環境

| 測試類型 | 需要清環境？ | 說明 |
|---------|------------|------|
| TC-D（自動化） | ❌ 不需要 | 腳本自己 setup/teardown |
| TC-Session01~04（保留測試） | ❌ 不需要 | 測試的就是「有東西可以保留」 |
| TC-P / TC-S / TC-T / TC-UI | ❌ 不需要 | 在現有環境操作即可 |
| **全新啟動測試（from scratch）** | ✅ 必須清 | 確認無舊 state 干擾 |
| **發版前完整回歸** | ✅ 必須清 | 從零驗證整個流程 |

### 清乾淨環境指令
只在需要「從零開始」時執行：
```bash
pkill -f chatsh-daemon; pkill -f "tauri dev|vite|target/debug/chatsh$"
sleep 1
rm -f ~/.chatsh/daemon.sock ~/.chatsh/state.json
rm -rf ~/.chatsh/agents/
rm -rf ~/Library/WebKit/chatsh/         # dev build
rm -rf ~/Library/WebKit/sh.chat.app/    # release build
```

### 只重啟 app（保留 daemon 和 session）
```bash
pkill -f "target/debug/chatsh$"
pkill -f "vite|tauri dev"
# 等 2 秒後重開
cd ~/Workspace/chatsh && npm run tauri dev
```

---

## Known Issues（v0.1.7 待修）

1. Template 不同步（Preference vs New Pane modal）
2. 系統通知去重（body 需加時間戳）
3. ⌘[ / ⌘] 切換 pane 未讀不清除
4. Daemon 重啟後 scrollback 消失（Phase 4：寫入檔案）
