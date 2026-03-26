"use client"

import { useEffect, useState, useRef } from "react"
import { cn } from "@/lib/utils"
import {
  BotIcon,
  UserIcon,
  WrenchIcon,
  AlertCircleIcon,
  RefreshCwIcon,
  ClockIcon,
  CoinsIcon,
  LoaderIcon,
} from "lucide-react"

type MessageContent = { type: string; text?: string; name?: string; arguments?: unknown }

type GatewayMessage = {
  role: "user" | "assistant" | "toolCall" | "toolResult"
  content: MessageContent[]
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

function extractText(content: MessageContent[]): string {
  return content
    .filter((c) => c.type === "text" && c.text)
    .map((c) => c.text!)
    .join("\n")
    .trim()
}

function formatTime(ts?: number): string {
  if (!ts) return ""
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

function formatCost(cost?: number): string {
  if (!cost) return ""
  return `$${cost.toFixed(4)}`
}

// ─── Message components ──────────────────────────────────────

function UserBubble({ msg }: { msg: GatewayMessage }) {
  const text = extractText(msg.content)
  if (!text) return null
  return (
    <div className="flex items-start gap-3 max-w-3xl">
      <div className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-lg bg-amber-400/15 text-[11px] font-semibold text-amber-400">
        <UserIcon className="size-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium text-amber-400">You</span>
          {msg.timestamp && (
            <span className="text-[10px] text-muted-foreground/40">{formatTime(msg.timestamp)}</span>
          )}
        </div>
        <div className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">{text}</div>
      </div>
    </div>
  )
}

function AssistantBubble({ msg }: { msg: GatewayMessage }) {
  const textParts = msg.content.filter((c) => c.type === "text" && c.text)
  const toolCalls = msg.content.filter((c) => c.type === "toolCall")

  if (textParts.length === 0 && toolCalls.length === 0) return null

  return (
    <div className="flex items-start gap-3 max-w-3xl">
      <div className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-[11px] font-semibold text-primary">
        <BotIcon className="size-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-xs font-medium text-primary">Assistant</span>
          {msg.model && (
            <span className="text-[10px] text-muted-foreground/40 font-mono">
              {msg.model.split("/").pop()}
            </span>
          )}
          {msg.timestamp && (
            <span className="text-[10px] text-muted-foreground/40">{formatTime(msg.timestamp)}</span>
          )}
          {msg.usage?.cost?.total && (
            <span className="text-[10px] text-muted-foreground/40 ml-auto flex items-center gap-1">
              <CoinsIcon className="size-2.5" />
              {formatCost(msg.usage.cost.total)}
            </span>
          )}
          {msg.usage?.totalTokens && (
            <span className="text-[10px] text-muted-foreground/40 flex items-center gap-1">
              {msg.usage.totalTokens.toLocaleString()} tok
            </span>
          )}
        </div>
        {textParts.map((part, i) => (
          <div key={i} className="text-sm leading-relaxed text-foreground whitespace-pre-wrap mb-2">
            {part.text}
          </div>
        ))}
        {toolCalls.map((tc, i) => (
          <div key={i} className="mt-1 rounded-md border border-border/50 bg-muted/40 px-3 py-2 text-xs font-mono text-muted-foreground">
            <div className="flex items-center gap-1.5 text-primary/70 mb-1">
              <WrenchIcon className="size-3" />
              <span className="font-medium">{String((tc as { name?: string }).name ?? "tool")}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ToolResultBubble({ msg }: { msg: GatewayMessage }) {
  const text = extractText(msg.content)
  const [expanded, setExpanded] = useState(false)
  const isLong = text.length > 300
  const displayText = expanded ? text : text.slice(0, 300)

  if (!text) return null

  return (
    <div className="flex items-start gap-3 max-w-3xl">
      <div
        className={cn(
          "mt-1 flex size-7 shrink-0 items-center justify-center rounded-lg text-[11px]",
          msg.isError ? "bg-red-400/15 text-red-400" : "bg-muted/60 text-muted-foreground"
        )}
      >
        {msg.isError ? <AlertCircleIcon className="size-3.5" /> : <WrenchIcon className="size-3.5" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className={cn("text-xs font-medium font-mono", msg.isError ? "text-red-400" : "text-muted-foreground")}>
            {msg.toolName ?? "tool result"}
          </span>
          {msg.timestamp && (
            <span className="text-[10px] text-muted-foreground/40">{formatTime(msg.timestamp)}</span>
          )}
        </div>
        <pre className="text-[11px] leading-relaxed text-muted-foreground/80 font-mono bg-muted/30 rounded-md px-3 py-2 overflow-x-auto whitespace-pre-wrap">
          {displayText}
          {isLong && !expanded && "…"}
        </pre>
        {isLong && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="mt-1 text-[10px] text-primary/60 hover:text-primary transition-colors"
          >
            {expanded ? "Show less" : `Show all (${text.length} chars)`}
          </button>
        )}
      </div>
    </div>
  )
}

function MessageRow({ msg }: { msg: GatewayMessage }) {
  switch (msg.role) {
    case "user":      return <UserBubble msg={msg} />
    case "assistant": return <AssistantBubble msg={msg} />
    case "toolResult": return <ToolResultBubble msg={msg} />
    default:          return null
  }
}

// ─── Main component ──────────────────────────────────────────

export function SessionView({ sessionId }: { sessionId: string }) {
  const [messages, setMessages] = useState<GatewayMessage[]>([])
  const [sessionKey, setSessionKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // First resolve sessionId → sessionKey via the sessions list
    fetch("/api/openclaw/sessions")
      .then((r) => r.json())
      .then((data) => {
        const session = data.sessions?.find(
          (s: { sessionId: string; key: string }) => s.sessionId === sessionId
        )
        if (!session) throw new Error(`Session ${sessionId} not found`)
        setSessionKey(session.key)
        return fetch(
          `/api/openclaw/sessions/history?sessionKey=${encodeURIComponent(session.key)}&limit=200`
        )
      })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error)
        // Filter out pure tool-call-only assistant messages (no visible text) 
        // and bare toolResult entries with no text
        const visible = (data.messages ?? []).filter((m: GatewayMessage) => {
          if (m.role === "assistant") {
            const hasText = m.content.some((c) => c.type === "text" && c.text?.trim())
            const hasToolCall = m.content.some((c) => c.type === "toolCall")
            return hasText || hasToolCall
          }
          if (m.role === "toolResult") {
            return extractText(m.content).length > 0
          }
          return true
        })
        setMessages(visible)
        setError(null)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [sessionId])

  // Scroll to bottom on load
  useEffect(() => {
    if (!loading) bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [loading])

  // Count user/assistant turns only for stats
  const userTurns = messages.filter((m) => m.role === "user").length
  const assistantTurns = messages.filter((m) => m.role === "assistant").length
  const lastMsg = messages.at(-1)
  const lastCost = messages
    .filter((m) => m.role === "assistant")
    .reduce((sum, m) => sum + (m.usage?.cost?.total ?? 0), 0)

  return (
    <div className="flex h-[calc(100vh-var(--header-height))] flex-col">
      {/* Stats bar */}
      <div className="border-b bg-background/80 backdrop-blur-sm px-4 py-2 flex items-center gap-4 text-[11px] text-muted-foreground/60 shrink-0">
        <span className="font-mono truncate max-w-[280px]" title={sessionKey ?? sessionId}>
          {sessionKey ?? sessionId}
        </span>
        <span className="ml-auto flex items-center gap-3">
          {userTurns > 0 && (
            <span className="flex items-center gap-1">
              <UserIcon className="size-3" />
              {userTurns} turns
            </span>
          )}
          {lastCost > 0 && (
            <span className="flex items-center gap-1">
              <CoinsIcon className="size-3" />
              {formatCost(lastCost)} total
            </span>
          )}
          {lastMsg?.timestamp && (
            <span className="flex items-center gap-1">
              <ClockIcon className="size-3" />
              {formatTime(lastMsg.timestamp)}
            </span>
          )}
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground/50">
            <LoaderIcon className="size-4 animate-spin" />
            <span className="text-sm">Loading session…</span>
          </div>
        )}
        {!loading && error && (
          <div className="flex items-center justify-center gap-2 py-20 text-red-400/70">
            <AlertCircleIcon className="size-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}
        {!loading && !error && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/40">
            <BotIcon className="size-8 mb-2 opacity-30" />
            <span className="text-sm">No messages in this session</span>
          </div>
        )}
        {!loading && !error && messages.map((msg, i) => (
          <MessageRow key={i} msg={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Footer */}
      <div className="border-t bg-background/80 backdrop-blur-sm px-4 py-2 flex items-center justify-between shrink-0">
        <span className="text-[11px] text-muted-foreground/40">
          Read-only view · {messages.length} messages
        </span>
        <button
          onClick={() => {
            setLoading(true)
            setMessages([])
            setError(null)
            // Re-trigger the effect by remounting — simplest approach
            window.location.reload()
          }}
          className="flex items-center gap-1.5 text-[11px] text-muted-foreground/50 hover:text-foreground transition-colors"
        >
          <RefreshCwIcon className="size-3" />
          Refresh
        </button>
      </div>
    </div>
  )
}
