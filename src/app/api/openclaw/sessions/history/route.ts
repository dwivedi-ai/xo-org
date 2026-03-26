import { NextRequest, NextResponse } from "next/server"
import { execSync } from "child_process"

/**
 * Fetches chat history for a specific OpenClaw session.
 *
 * Query params:
 *   sessionKey  - required: the full Gateway session key (e.g. "agent:main:main")
 *   limit       - optional: number of messages to return (default 100)
 *
 * Calls: openclaw gateway call chat.history --params '{"sessionKey":"...","limit":N}'
 */

export type GatewayMessage = {
  role: "user" | "assistant" | "toolCall" | "toolResult"
  content: Array<{ type: string; text?: string }>
  timestamp?: number
  model?: string
  usage?: {
    input?: number
    output?: number
    totalTokens?: number
    cost?: { total?: number }
  }
  toolName?: string
  toolCallId?: string
  isError?: boolean
}

export async function GET(request: NextRequest) {
  const sessionKey = request.nextUrl.searchParams.get("sessionKey")
  const limit = parseInt(request.nextUrl.searchParams.get("limit") ?? "100", 10)

  if (!sessionKey) {
    return NextResponse.json({ error: "sessionKey is required" }, { status: 400 })
  }

  try {
    const params = JSON.stringify({ sessionKey, limit })
    const raw = execSync(
      `openclaw gateway call chat.history --params '${params}'`,
      { timeout: 8000, encoding: "utf8" }
    )

    const jsonStart = raw.indexOf("{")
    if (jsonStart === -1) {
      return NextResponse.json({ error: "No JSON in CLI output" }, { status: 502 })
    }

    const payload = JSON.parse(raw.slice(jsonStart)) as {
      sessionKey: string
      sessionId: string
      messages: GatewayMessage[]
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
