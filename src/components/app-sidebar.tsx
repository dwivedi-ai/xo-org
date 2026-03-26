"use client"

import * as React from "react"
import { useState, useEffect, useCallback, useRef } from "react"
import { usePathname, useRouter } from "next/navigation"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import { ContextSwitcher } from "@/components/xo/context-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import {
  LayoutDashboardIcon,
  TargetIcon,
  UsersIcon,
  Settings2Icon,
  CircleHelpIcon,
  FolderIcon,
  FileIcon,
  FileTextIcon,
  FileCodeIcon,
  CommandIcon,
  MessageSquareIcon,
  CircleIcon,
  LoaderIcon,
  XCircleIcon,
  PlusIcon,
} from "lucide-react"

// ─── Static nav data ─────────────────────────────────────────

const data = {
  user: {
    name: "xo",
    email: "admin@xo.dev",
    avatar: "",
  },
  orgNav: [
    { title: "Dashboard", url: "/", icon: <LayoutDashboardIcon /> },
    { title: "Agents", url: "/agents", icon: <UsersIcon /> },
    { title: "Objectives", url: "/objectives", icon: <TargetIcon /> },
  ],
  navSecondary: [
    { title: "Settings", url: "#", icon: <Settings2Icon /> },
    { title: "Get Help", url: "#", icon: <CircleHelpIcon /> },
  ],
}

function getAgentNav(agentId: string) {
  return [
    { title: "Chat", url: `/agent/${agentId}/chat`, icon: <MessageSquareIcon /> },
    { title: "Dashboard", url: `/agent/${agentId}`, icon: <LayoutDashboardIcon /> },
    { title: "Objectives", url: `/agent/${agentId}/objectives`, icon: <TargetIcon /> },
  ]
}

// ─── Helpers ──────────────────────────────────────────────────

function formatRelative(updatedAt: number): string {
  const diffMs = Date.now() - updatedAt
  const minutes = Math.floor(diffMs / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return "just now"
}

function sessionLabel(session: GatewaySession): string {
  if (session.origin?.label) return session.origin.label
  if (session.origin?.provider) {
    const provider = session.origin.provider
    const type = session.chatType === "group" ? "group" : "direct"
    return `${provider} · ${type}`
  }
  // Fall back to the last segment of the session key
  const parts = session.key.split(":")
  return parts.at(-1) ?? session.key
}

// ─── Types ────────────────────────────────────────────────────

type GatewaySession = {
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
}

type FSEntry = {
  name: string
  type: "folder" | "file"
  extension: string
}

// ─── OpenClaw sessions hook ───────────────────────────────────

function useGatewaySessions() {
  const [sessions, setSessions] = useState<GatewaySession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Use a ref to track if we've done the initial load
  const initialLoad = useRef(true)

  const refresh = useCallback((silent = false) => {
    if (!silent) setLoading(true)
    fetch("/api/openclaw/sessions")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.sessions)) {
          setSessions([...data.sessions].sort((a, b) => b.updatedAt - a.updatedAt))
          setError(null)
        } else if (data.error) {
          setError(data.error)
        }
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    // Initial load
    refresh(false)
    initialLoad.current = false

    // Silent background poll every 15s (matches Gateway tick interval)
    const interval = setInterval(() => refresh(true), 15000)
    return () => clearInterval(interval)
  }, [refresh])

  return { sessions, loading, error, refresh }
}

// ─── Workspace entries hook ────────────────────────────────────

function useWorkspaceEntries() {
  const [entries, setEntries] = useState<FSEntry[]>([])

  useEffect(() => {
    fetch("/api/storage?path=")
      .then((r) => r.json())
      .then((data) => { if (data.entries) setEntries(data.entries) })
      .catch(() => {})
  }, [])

  return entries
}

function getEntryIcon(entry: FSEntry) {
  if (entry.type === "folder") return FolderIcon
  switch (entry.extension) {
    case "md": case "txt": case "pdf": return FileTextIcon
    case "ts": case "tsx": case "js": case "jsx":
    case "py": case "json": case "yml": case "yaml": case "toml":
      return FileCodeIcon
    default: return FileIcon
  }
}

// ─── Sidebar component ────────────────────────────────────────

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const router = useRouter()
  const isAgentMode = pathname.startsWith("/agent")
  const agentId = isAgentMode ? pathname.split("/")[2] : null
  const defaultAgentId = agentId || "aria"

  const { sessions, loading: sessionsLoading, error: sessionsError } = useGatewaySessions()
  const workspaceEntries = useWorkspaceEntries()

  const navItems = isAgentMode && agentId ? getAgentNav(agentId) : data.orgNav

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <ContextSwitcher />
      </SidebarHeader>

      <SidebarContent>
        <NavMain items={navItems} />

        {/* Workspace Folders */}
        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel>Folders</SidebarGroupLabel>
          <SidebarMenu>
            {workspaceEntries.length === 0 ? (
              <SidebarMenuItem>
                <SidebarMenuButton className="text-sidebar-foreground/40" disabled>
                  <FolderIcon className="size-3 text-sidebar-foreground/30" />
                  <span className="text-xs">Empty workspace</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ) : workspaceEntries.map((entry) => {
              const Icon = getEntryIcon(entry)
              const url = entry.type === "folder"
                ? `/storage?path=${encodeURIComponent(entry.name)}`
                : `/storage`
              return (
                <SidebarMenuItem key={entry.name}>
                  <SidebarMenuButton render={<a href={url} />}>
                    <Icon className="size-4" />
                    <span>{entry.name}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>

        {/* Sessions — live from OpenClaw Gateway */}
        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel className="flex items-center gap-1">
            Sessions
            {!sessionsLoading && !sessionsError && sessions.length > 0 && (
              <span className="text-[10px] text-muted-foreground/50 tabular-nums">
                {sessions.length}
              </span>
            )}
            {/* New Session button */}
            <button
              onClick={() => {
                // Sessions are created automatically when the first message is
                // sent via the OpenClaw Gateway. Navigate to agent chat which
                // will create a new session on first message.
                router.push(`/agent/${defaultAgentId}/chat`)
              }}
              className="ml-auto flex size-5 items-center justify-center rounded-md text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
              title="New chat session"
            >
              <PlusIcon className="size-3.5" />
            </button>
          </SidebarGroupLabel>

          <SidebarMenu>
            {/* Loading state */}
            {sessionsLoading && (
              <SidebarMenuItem>
                <SidebarMenuButton className="text-sidebar-foreground/40" disabled>
                  <LoaderIcon className="size-3 animate-spin text-sidebar-foreground/30" />
                  <span className="text-xs">Loading…</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}

            {/* Error state */}
            {!sessionsLoading && sessionsError && (
              <SidebarMenuItem>
                <SidebarMenuButton
                  className="text-sidebar-foreground/40"
                  disabled
                  title={sessionsError}
                >
                  <XCircleIcon className="size-3 text-red-400/60" />
                  <span className="text-xs text-red-400/60">Gateway unreachable</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}

            {/* Empty state */}
            {!sessionsLoading && !sessionsError && sessions.length === 0 && (
              <SidebarMenuItem>
                <SidebarMenuButton className="text-sidebar-foreground/40" disabled>
                  <CircleIcon className="size-3 text-sidebar-foreground/30" />
                  <span className="text-xs">No active sessions</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}

            {/* Session list */}
            {sessions.map((session) => {
              const isActive = pathname === `/view/${session.sessionId}`
              const label = sessionLabel(session)
              const time = formatRelative(session.updatedAt)
              const usagePct = session.contextTokens
                ? Math.round((session.totalTokens / session.contextTokens) * 100)
                : null
              const modelShort = session.model?.split("/").pop()

              return (
                <SidebarMenuItem key={session.key}>
                  <SidebarMenuButton
                    className={cn("h-auto py-1.5", isActive && "bg-sidebar-accent")}
                    render={<a href={`/view/${session.sessionId}`} />}
                    title={session.key}
                  >
                    <MessageSquareIcon className="size-3 text-primary shrink-0 mt-0.5" />
                    <div className="flex flex-col min-w-0 gap-0">
                      <span className="truncate text-xs leading-tight">{label}</span>
                      <span className="text-[10px] text-muted-foreground/40 font-mono truncate">
                        {time}
                        {usagePct !== null ? ` · ${usagePct}% ctx` : ""}
                        {modelShort ? ` · ${modelShort}` : ""}
                      </span>
                    </div>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>

        <NavSecondary items={data.navSecondary} className="mt-auto" />

        {/* Command Palette shortcut */}
        <SidebarGroup className="group-data-[collapsible=icon]:hidden px-2 pb-1">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                className="text-sidebar-foreground/50 hover:text-sidebar-foreground/70"
                tooltip="Command Palette"
                onClick={() =>
                  window.dispatchEvent(
                    new KeyboardEvent("keydown", {
                      key: "k",
                      code: "KeyK",
                      metaKey: true,
                      bubbles: true,
                    })
                  )
                }
              >
                <CommandIcon className="size-4" />
                <span>Command</span>
                <kbd className="ml-auto inline-flex h-5 items-center gap-0.5 rounded border border-sidebar-border bg-sidebar-accent px-1.5 text-[10px] font-medium text-sidebar-foreground/50">
                  ⌘K
                </kbd>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
