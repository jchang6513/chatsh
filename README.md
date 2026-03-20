# chat.sh

A terminal-native desktop app for managing multiple AI coding assistants — Claude Code, OpenAI Codex, Gemini CLI, and more — in a single window.

Built with Tauri v2 + React + xterm.js. ~12MB, no Electron.

## Download

**macOS (Apple Silicon / Intel)**

→ [Download latest release](https://github.com/jchang6513/chatsh/releases/latest)

```bash
# or via Homebrew
brew install jchang6513/chatsh/chatsh
```

> First launch: right-click → Open (bypasses Gatekeeper for unsigned builds)

## Features

- **Multiple AI agents** — Claude Code, Codex, Gemini, Aider, or any CLI tool
- **Per-agent CLAUDE.md** — edit system prompts isolated from your project
- **Shell sessions** — add/remove/rename shell tabs per panel
- **8 color themes** — Hacker, Dracula, GitHub Dark, Solarized, Amber, Cyan Noir, Red Alert, Phosphor — all synced to terminal ANSI colors
- **Persistent config** — agents survive restarts
- **Terminal-first UI** — monospace, bracket buttons, zero rounded corners

## Quick Start (Dev)

```bash
# Prerequisites: Rust, Node.js 18+

git clone https://github.com/jchang6513/chatsh
cd chatsh
npm install
npm run tauri dev
```

## Build

```bash
npm run tauri build
# → src-tauri/target/release/bundle/dmg/chatsh_*.dmg
```

## Keyboard

| Key | Action |
|-----|--------|
| `Ctrl+C` | Send SIGINT |
| `⌘S` | Save CLAUDE.md |
| Double-click shell tab | Rename |

## Tech

- [Tauri v2](https://tauri.app) — Rust backend, native WebView
- [xterm.js](https://xtermjs.org) — terminal rendering  
- [portable-pty](https://docs.rs/portable-pty) — PTY

## License

MIT
