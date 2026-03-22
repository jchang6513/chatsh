<table><tr><td><img src="docs/icon.png" width="72"></td><td><h1>chat.sh</h1></td></tr></table>

A terminal-native desktop app for managing AI coding assistants — Claude Code, OpenAI Codex, Gemini CLI, and more — in a single window.

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

### Multi-Pane Management
- Open multiple Panes in one window (Claude Code, Codex, Gemini, Zsh, Python, Node...)
- Sidebar with live status indicators (RUNNING / STOPPED)
- Lazy spawn — Panes only start when first selected
- Right-click Pane for Edit / Duplicate / Restart / Delete

### Templates
- Auto-detects installed CLIs on startup
- Save custom templates (command + working dir + system prompt)
- Open Panes from templates in two steps, or with a custom one-off command

### System Prompts
- Per-Pane system prompts, completely isolated
- Supports `CLAUDE.md`, `GEMINI.md`, `AGENTS.md`
- Edit anytime via Edit Pane modal

### Shell Tabs
- Add multiple shell tabs per Pane
- Rename (double-click), close, auto-scroll to active tab

### Status Bar
- Working dir, CLI name, color scheme, RUNNING/STOPPED
- Live clock · Battery level on laptops

### System Notifications
- macOS banner + sound when a background Pane finishes
- Toggle in Preferences

### Keyboard Shortcuts
| Shortcut | Action |
|---|---|
| `⌘1`–`⌘9` | Switch to Pane |
| `⌘[` / `⌘]` | Previous / Next Pane |
| `⌘K` | Command Palette |
| `⌘N` | New Pane |
| `⌘R` | Restart Pane |
| `⌘T` | New shell tab |
| `⌘W` | Close shell tab |
| `⌘Shift+[` / `⌘Shift+]` | Switch shell tab |
| `⌘,` | Preferences |
| `⌘=` | Zoom in |
| `⌘-` | Zoom out |
| `Esc` | Close overlay |

### Preferences
- Font family (system font picker), size, line height
- Cursor style (block / bar / underline) + blink
- Scrollback lines
- 11 color schemes (Nightfox, Kanagawa, Gruvbox...) — Nightfox default
- UI Scale (0.5x – 2.0x), Sidebar position (left / right)
- Notifications toggle
- Per-Pane terminal overrides
- Template management (create / edit / delete)

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

### v0.1.6
- **Terminology**: Agent/REPL → **Pane** throughout the UI
- **Unified Modal**: all overlays share a single Modal component (ESC to close, [×] button)
- **System Notifications**: macOS banner + sound when background Pane finishes (toggle in Preferences)
- **Status bar**: live clock + battery level (laptops)
- **UI Scale**: `⌘=` / `⌘-` zoom entire interface (0.5x–2.0x)
- **Sidebar**: right-click context menu (Edit / Duplicate / Restart / Delete), position toggle (left/right)
- **From Template**: two-step flow (select template → configure Pane)
- **Preferences**: Appearance tab (color scheme, zoom, sidebar position), Keys tab, Notifications toggle
- **Terminal**: zoom-corrected mouse selection, system font dropdown
- **Fix**: unread notification stale closure, modal overflow at high zoom

### v0.1.5
- New logo + Nightfox as default color scheme
- Preferences: Appearance tab, Keys tab, Templates management
- Right-click context menu on Panes
- Auto templates can be deleted
- Shell tabs open in Pane's working directory

### v0.1.4
- Preferences: Template editing, Auto-template deletion
- Shell tab border fix, scrollIntoView for active tab
- Duplicate Pane from context menu

### v0.1.3
- Unread notifications (amber dot)
- UTF-8 / CJK display fixed
- Working Dir native folder picker

### v0.1.0 – v0.1.2
- Initial release, keyboard shortcuts, preferences, system prompts, templates
