import { useState, useEffect, useRef } from "react"
import { invoke } from "@tauri-apps/api/core"

import { MONO_FONT } from "../ui"
import { useTheme } from "../ThemeContext";
import type { Agent } from "../types";

interface Props {
  agent?: Agent;
}

interface GitInfo {
  repo_name: string
  branch: string
  dirty: boolean
}

export default function StatusBar({ agent }: Props) {
  const { scheme, schemeKey } = useTheme();
  const [time, setTime] = useState(() => new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }))
  const [battery, setBattery] = useState<{ percent: number; charging: boolean } | null>(null)
  const [gitInfo, setGitInfo] = useState<GitInfo | null>(null)
  // Cache: workingDir → GitInfo, avoids flash on pane switch
  const gitCache = useRef<Map<string, GitInfo>>(new Map())

  useEffect(() => {
    const t = setInterval(() => setTime(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const fetchBattery = () => invoke<{ percent: number; charging: boolean } | null>("get_battery").then(b => setBattery(b)).catch(() => {})
    fetchBattery()
    const t = setInterval(fetchBattery, 30000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!agent?.workingDir) { setGitInfo(null); return }
    const dir = agent.workingDir
    // Show cached result immediately (no flash)
    const cached = gitCache.current.get(dir)
    if (cached) setGitInfo(cached)
    let inflight = false
    const fetchGit = () => {
      if (inflight) return  // skip if previous call still in progress
      inflight = true
      invoke<GitInfo | null>("get_git_info", { path: dir })
        .then(r => {
          if (r) gitCache.current.set(dir, r)
          else gitCache.current.delete(dir)
          setGitInfo(r)
        })
        .catch(() => setGitInfo(cached ?? null))
        .finally(() => { inflight = false })
    }
    fetchGit()
    const t = setInterval(fetchGit, 3000)
    return () => clearInterval(t)
  }, [agent?.workingDir, agent?.id])

  return (
    <div style={{
      height: 22,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 12px",
      borderTop: "1px solid var(--border)",
      background: "var(--bg)",
      fontFamily: MONO_FONT,
      fontSize: 10,
      color: "var(--muted)",
      flexShrink: 0,
      letterSpacing: "0.05em",
    }}>
      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <span>{agent?.workingDir ?? "~"}</span>
        {gitInfo && <>
          <span style={{ color: "var(--border)" }}>│</span>
          <span style={{
            background: "#1e3a2e",
            color: "#81b29a",
            padding: "1px 6px",
            borderRadius: 2,
            fontSize: 9,
            letterSpacing: "0.05em",
          }}>{gitInfo.repo_name}</span>
          <span style={{
            background: gitInfo.dirty ? "#3a2a1e" : "#1e2e1e",
            color: gitInfo.dirty ? "#e0a060" : "#81b29a",
            padding: "1px 6px",
            borderRadius: 2,
            fontSize: 9,
            letterSpacing: "0.05em",
          }}>⎇ {gitInfo.branch}{gitInfo.dirty ? "*" : ""}</span>
        </>}
        <span style={{ color: "var(--border)" }}>│</span>
        <span>{agent?.command?.join(" ")}</span>
      </div>
      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <span style={{ color: schemeKey === "hacker" ? "var(--green)" : "var(--muted)" }}>{scheme.name}</span>
        {battery !== null && <>
          <span style={{ color: "var(--border)" }}>│</span>
          <span style={{ color: battery.percent <= 20 ? "var(--red)" : "var(--muted)" }}>
            {battery.charging ? "⚡" : "🔋"}{battery.percent}%
          </span>
        </>}
        <span style={{ color: "var(--border)" }}>│</span>
        <span style={{ color: agent?.status === "online" ? "var(--green)" : "var(--red, var(--muted))" }}>
          ● {agent?.status === "online" ? "RUNNING" : "STOPPED"}
        </span>
        <span style={{ color: "var(--border)" }}>│</span>
        <span>{time}</span>
      </div>
    </div>
  );
}
