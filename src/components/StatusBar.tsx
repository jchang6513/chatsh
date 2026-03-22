import { useState, useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"
import { MONO_FONT } from "../ui"
import { useTheme } from "../ThemeContext";
import type { Agent } from "../types";

interface Props {
  agent?: Agent;
}

export default function StatusBar({ agent }: Props) {
  const { scheme, schemeKey } = useTheme();
  const [time, setTime] = useState(() => new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }))
  const [battery, setBattery] = useState<{ percent: number; charging: boolean } | null>(null)

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
        <span style={{ color: "var(--border)" }}>│</span>
        <span>{agent?.command?.join(" ")}</span>
      </div>
      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <span style={{ color: schemeKey === "hacker" ? "var(--green)" : "var(--muted)" }}>{scheme.name}</span>
        <span style={{ color: "var(--border)" }}>│</span>
        <span style={{ color: agent?.status === "online" ? "var(--green)" : "var(--red, var(--muted))" }}>
          ● {agent?.status === "online" ? "RUNNING" : "STOPPED"}
        </span>
        {battery !== null && <>
          <span style={{ color: "var(--border)" }}>│</span>
          <span style={{ color: battery.percent <= 20 ? "var(--red)" : "var(--muted)" }}>
            {battery.charging ? "⚡" : "🔋"}{battery.percent}%
          </span>
        </>}
        <span style={{ color: "var(--border)" }}>│</span>
        <span>{time}</span>
      </div>
    </div>
  );
}
