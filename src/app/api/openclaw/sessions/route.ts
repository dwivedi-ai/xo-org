import { NextResponse } from "next/server"
import { execSync } from "child_process"

/**
 * Fetches the live session list from the OpenClaw Gateway via the CLI.
 *
 * The Gateway owns all session state. We call `openclaw gateway call sessions.list`
 * which connects to the running Gateway over WebSocket and returns the full session store.
 *
 * Response shape mirrors the Gateway sessions.list payload:
 *   { sessions: GatewaySession[], count: number, defaults: {...} }
 */

export type GatewaySession = {
  key: string
  kind: string
  chatType: string
  sessionId: string
  updatedAt: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  contextTokens: number
  model: string
  modelProvider: string
  origin?: {
    provider?: string
    label?: string
    from?: string
    surface?: string
    chatType?: string
  }
  lastChannel?: string
  deliveryContext?: Record<string, string>
}

export async function GET() {
  try {
    const raw = execSync("openclaw gateway call sessions.list --params '{}'", {
      timeout: 8000,
      encoding: "utf8",
    })

    // The CLI outputs a header line "Gateway call: sessions.list" before the JSON
    // Strip everything before the first '{' to get clean JSON
    const jsonStart = raw.indexOf("{")
    if (jsonStart === -1) {
      return NextResponse.json({ error: "No JSON in CLI output", raw }, { status: 502 })
    }

    const payload = JSON.parse(raw.slice(jsonStart)) as {
      sessions: GatewaySession[]
      count: number
      defaults: Record<string, unknown>
      ts: number
    }

    return NextResponse.json(payload)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { error: "Failed to reach OpenClaw Gateway", detail: message },
      { status: 502 }
    )
  }
}
