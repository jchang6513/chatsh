import { migrateFromLocalStorage, writeJsonFile } from "./storage"

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

export const DEFAULT_TEMPLATES: Template[] = [
  { id: "shell", name: "Zsh", command: "/bin/zsh", workingDir: "~", description: "Interactive shell", isBuiltin: true },
  { id: "claude", name: "Claude Code", command: "claude", workingDir: "~", description: "Anthropic AI coding assistant", isBuiltin: true },
  { id: "gemini", name: "Gemini CLI", command: "gemini", workingDir: "~", description: "Google Gemini CLI", isBuiltin: true },
  { id: "codex", name: "Codex", command: "codex", workingDir: "~", description: "OpenAI Codex agent", isBuiltin: true },
]

export async function loadTemplates(): Promise<Template[]> {
  const saved = await migrateFromLocalStorage<Template[]>(
    "templates.json", "chatsh_templates", []
  )
  if (saved.length > 0) return saved
  // First launch or empty: seed with defaults
  await saveTemplatesAsync(DEFAULT_TEMPLATES)
  return [...DEFAULT_TEMPLATES]
}

export function saveTemplates(templates: Template[]) {
  writeJsonFile("templates.json", templates)
}

async function saveTemplatesAsync(templates: Template[]) {
  const { writeJsonFileImmediate } = await import("./storage")
  await writeJsonFileImmediate("templates.json", templates)
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
