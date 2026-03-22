export interface Template {
  id: string
  name: string
  command: string        // e.g. "claude" or "/bin/zsh"
  args?: string[]        // extra args
  workingDir: string
  description: string
  isBuiltin: boolean     // auto-detected by system
  claudeMd?: string      // only for claude
}

const STORAGE_KEY = "chatsh_templates"

export const BUILTIN_TEMPLATE_IDS = ["claude", "codex", "gemini", "aider", "zsh", "bash", "node", "python3"]

export const KNOWN_TOOLS: Array<{
  id: string
  name: string
  command: string
  description: string
}> = [
  { id: "claude",  name: "Claude Code",   command: "claude",  description: "Anthropic AI coding assistant" },
  { id: "codex",   name: "OpenAI Codex",  command: "codex",   description: "OpenAI coding agent" },
  { id: "gemini",  name: "Gemini CLI",    command: "gemini",  description: "Google Gemini CLI" },
  { id: "aider",   name: "Aider",         command: "aider",   description: "AI pair programmer" },
  { id: "zsh",     name: "Zsh",           command: "/bin/zsh",description: "Z shell" },
  { id: "bash",    name: "Bash",          command: "/bin/bash",description: "Bash shell" },
  { id: "node",    name: "Node.js Pane",  command: "node",    description: "Node.js interactive Pane" },
  { id: "python3", name: "Python 3",      command: "python3", description: "Python 3 interactive Pane" },
]

export function loadTemplates(): Template[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return JSON.parse(saved)
  } catch {}
  return []
}

export function saveTemplates(templates: Template[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates))
}

export function addTemplate(templates: Template[], t: Template): Template[] {
  const next = [...templates.filter(x => x.id !== t.id), t]
  saveTemplates(next)
  return next
}

export function removeTemplate(templates: Template[], id: string): Template[] {
  const next = templates.filter(t => t.id !== id)
  saveTemplates(next)
  return next
}
