export interface Template {
  id: string
  name: string
  command: string        // e.g. "claude" or "/bin/zsh"
  args?: string[]        // extra args
  workingDir: string
  description: string
  isBuiltin: boolean     // true = default template (cannot delete, only hide)
  claudeMd?: string      // only for claude
}

const STORAGE_KEY = "chatsh_templates"

export const DEFAULT_TEMPLATES: Template[] = [
  { id: "shell", name: "Zsh", command: "/bin/zsh", workingDir: "~", description: "Interactive shell", isBuiltin: true },
  { id: "claude", name: "Claude Code", command: "claude", workingDir: "~", description: "Anthropic AI coding assistant", isBuiltin: true },
  { id: "gemini", name: "Gemini CLI", command: "gemini", workingDir: "~", description: "Google Gemini CLI", isBuiltin: true },
  { id: "codex", name: "Codex", command: "codex", workingDir: "~", description: "OpenAI Codex agent", isBuiltin: true },
]

export function loadTemplates(): Template[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed: Template[] = JSON.parse(saved)
      if (parsed.length > 0) return parsed
    }
  } catch {}
  // First launch or empty: seed with defaults
  saveTemplates(DEFAULT_TEMPLATES)
  return [...DEFAULT_TEMPLATES]
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
