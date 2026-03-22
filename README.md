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

> **First launch on macOS:** If you see "app is damaged", run this in Terminal:
> ```
> xattr -cr /Applications/chat.sh.app
> ```
> Then open normally. This is a one-time step for unsigned apps on macOS 14+.

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
- 11 color schemes (Nightfox, Kanagawa, Gruvbox...) + UI zoom
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

---

## Changelog

### v0.1.3
- **Unread notifications**: dot pulses while streaming, stays lit when idle (unread)
- **UTF-8 / CJK display** fixed in terminal
- Working Dir native folder picker `[...]`
- Lazy REPL spawn (only starts when selected)
- Code quality: shared `ui.ts` constants, `CloseButton` / `FolderButton` components

### v0.1.2
- New REPL flow: From Template / Custom
- System prompts (CLAUDE.md / GEMINI.md / AGENTS.md), per-REPL isolated
- Keyboard shortcuts (⌘K, ⌘1-9, ⌘T/W, ⌘R, ⌘,)
- Preferences panel with per-REPL overrides
- 11 color schemes, Nightfox default

### v0.1.1
- Command Palette (⌘K)
- Preferences panel: font, cursor, terminal settings
- App icon

### v0.1.0
- Initial release
