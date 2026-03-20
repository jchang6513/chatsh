# chat.sh

A terminal-native desktop app for managing multiple AI coding assistants — Claude Code, Codex, and more — in a single window.

Built with Tauri v2 + React + xterm.js. Lightweight (~12MB), no Electron.


## Features

- **Multiple AI agents** — Claude Code, OpenAI Codex, or any CLI tool
- **Shell sessions** — add/remove shell tabs per agent panel, rename with double-click
- **CLAUDE.md editor** — edit system prompts per agent without touching project files
- **Theme system** — 8 built-in color schemes (Hacker, Dracula, GitHub Dark, Solarized, Amber, Cyan Noir, Red Alert, Phosphor), all synced to terminal ANSI colors
- **Persistent agents** — agent config saved to localStorage, survives restarts
- **Terminal-first UI** — monospace fonts, bracket buttons, no rounded corners

## Quick Start

```bash
# Prerequisites: Rust, Node.js 18+, Xcode CLI tools (macOS)

git clone https://github.com/your-username/chatsh
cd chatsh
npm install
npm run tauri dev
```

## Build

```bash
npm run tauri build
# Output: src-tauri/target/release/chatsh (macOS ~12MB)
```

## Adding Agents

Click `+ NEW AGENT` in the sidebar. The app scans for installed CLI tools (claude, codex, gemini, aider, zsh, python3, node) and presents them as quick-add options.

## CLAUDE.md

Each Claude Code agent has its own `CLAUDE.md` stored at `~/.chatsh/agents/{id}/CLAUDE.md`, isolated from your project directory. Edit it via the `[CLAUDE.MD]` button in the panel header.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl+C` | Send SIGINT to current process |
| `⌘S` | Save CLAUDE.md (in editor) |
| Double-click shell tab | Rename shell session |

## Tech Stack

- **Tauri v2** — Rust backend, native WebView
- **React + TypeScript** — UI
- **xterm.js** — terminal rendering
- **portable-pty** — cross-platform PTY

## License

MIT
