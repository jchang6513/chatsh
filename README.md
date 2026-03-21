<table><tr><td><img src="docs/icon.png" width="72"></td><td><h1>chat.sh</h1></td></tr></table>

A terminal-native desktop app for managing multiple AI coding assistants — Claude Code, OpenAI Codex, Gemini CLI, and more — in a single window.

Built with Tauri v2 + React + xterm.js. ~4MB, no Electron.

![chat.sh](docs/screenshot.png)

---

## Download

**macOS Apple Silicon**
```
brew tap jchang6513/chatsh
brew install --cask chatsh
```
Or [download the DMG](https://github.com/jchang6513/chatsh/releases/latest) directly.

> First launch: right-click → Open (unsigned build bypasses Gatekeeper)

---

## Features

### Multi-REPL Management
- Open multiple REPLs in one window (Claude Code, Codex, Gemini, Zsh, Python, Node...)
- Sidebar with live status indicators (RUNNING / STOPPED)
- Lazy spawn — REPLs only start when first selected

### Templates
- Auto-detects installed CLIs on startup
- Save custom templates (command + working dir + system prompt)
- Open REPLs from templates or with a custom one-off command

### System Prompts
- Per-REPL system prompts, completely isolated from each other
- Supports `CLAUDE.md`, `GEMINI.md`, `AGENTS.md` — appended on top of your project's CLAUDE.md
- Edit anytime via the `[System Prompt]` button

### Shell Tabs
- Add multiple shell tabs per REPL panel
- Rename (double-click), close, stable numbering

### Keyboard Shortcuts
| Shortcut | Action |
|---|---|
| `⌘1`–`⌘9` | Switch to REPL |
| `⌘[` / `⌘]` | Previous / Next REPL |
| `⌘K` | Command Palette |
| `⌘N` | New REPL |
| `⌘R` | Restart REPL |
| `⌘T` | New shell tab |
| `⌘W` | Close shell tab |
| `⌘Shift+[` / `⌘Shift+]` | Switch shell tab |
| `⌘,` | Preferences |
| `Esc` | Close overlay |

### Preferences
- Font family, size, line height
- Cursor style (block / bar / underline) + blink
- Scrollback lines, padding
- 8 color schemes (Amber, Hacker, Dracula, Phosphor...) + background opacity
- Per-REPL terminal overrides

---

## Development

```bash
git clone https://github.com/jchang6513/chatsh
cd chatsh
npm install
npm run tauri dev
```

Requirements: [Rust](https://rustup.rs), [Node.js](https://nodejs.org)

---

## License

MIT
