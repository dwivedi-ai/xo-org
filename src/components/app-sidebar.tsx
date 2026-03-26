"use client"

import * as React from "react"
import { useState, useEffect, useCallback } from "react"

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
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import { getSessionMeta } from "@/lib/session-store"

function formatRelativeSession(updatedAt: number): string {
  const diffMs = Date.now() - updatedAt
  const minutes = Math.floor(diffMs / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return "just now"
}
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
  MoreHorizontalIcon,
  CommandIcon,
  MessageSquareIcon,
  CircleDotIcon,
  CheckCircle2Icon,
  CircleIcon,
  ClockIcon,
  LoaderIcon,
  XCircleIcon,

  SquareIcon,
} from "lucide-react"

// ─── Backend task type ──────────────────────────────────────
type BackendTask = {
  task_id: string
  status: string
  prompt: string
  cwd: string | null
  created_at: number
  started_at: number | null
  completed_at: number | null
  result_text: string
  error: string | null
  cost_usd: number | null
  duration_ms: number | null
}

const TASK_STATUS_ICON: Record<string, React.ReactNode> = {
  pending: <CircleIcon className="size-3 text-muted-foreground/50" />,
  queued: <CircleDotIcon className="size-3 text-blue-400/70" />,
  running: <LoaderIcon className="size-3 text-primary animate-spin" />,
  completed: <CheckCircle2Icon className="size-3 text-primary/60" />,
  failed: <XCircleIcon className="size-3 text-red-400" />,
  stopped: <SquareIcon className="size-3 text-amber-400" />,
}

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

// ─── OpenClaw Gateway session type ──────────────────────────

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

// ─── Backend hooks ──────────────────────────────────────────

function useBackendSessions() {
  const [sessions, setSessions] = useState<GatewaySession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    fetch("/api/openclaw/sessions")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.sessions)) {
          // Sort by most recently updated
          const sorted = [...data.sessions].sort((a, b) => b.updatedAt - a.updatedAt)
          setSessions(sorted)
          setError(null)
        } else if (data.error) {
          setError(data.error)
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    refresh()
    // Poll every 10s for session changes
    const interval = setInterval(refresh, 10000)
    return () => clearInterval(interval)
  }, [refresh])

  return { sessions, loading, error, refresh }
}

function useBackendTasks() {
  const [tasks, setTasks] = useState<BackendTask[]>([])

  useEffect(() => {
    function fetchTasks() {
      fetch("/api/proxy?path=/tasks")
        .then((r) => r.json())
        .then((data) => {
          if (data.tasks) setTasks(data.tasks)
        })
        .catch(() => {})
    }

    fetchTasks()
    const interval = setInterval(fetchTasks, 5000)
    return () => clearInterval(interval)
  }, [])

  return tasks
}

function formatDuration(ms: number | null): string {
  if (!ms) return ""
  if (ms < 1000) return `${ms}ms`
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

function truncatePrompt(prompt: string, max = 40): string {
  if (prompt.length <= max) return prompt
  return prompt.slice(0, max) + "…"
}

// ─── Workspace folder entries ────────────────────────────────

type FSEntry = {
  name: string
  type: "folder" | "file"
  extension: string
}

function getEntryIcon(entry: FSEntry) {
  if (entry.type === "folder") return FolderIcon
  switch (entry.extension) {
    case "md":
    case "txt":
    case "pdf":
      return FileTextIcon
    case "ts":
    case "tsx":
    case "js":
    case "jsx":
    case "py":
    case "json":
    case "yml":
    case "yaml":
    case "toml":
      return FileCodeIcon
    default:
      return FileIcon
  }
}

function useWorkspaceEntries() {
  const [entries, setEntries] = useState<FSEntry[]>([])

  useEffect(() => {
    fetch("/api/storage?path=")
      .then((r) => r.json())
      .then((data) => {
        if (data.entries) setEntries(data.entries)
      })
      .catch(() => {})
  }, [])

  return entries
}

// ─── Component ──────────────────────────────────────────────

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const router = useRouter()
  const isAgentMode = pathname.startsWith("/agent")
  const agentId = isAgentMode ? pathname.split("/")[2] : null
  const { sessions, loading: sessionsLoading, error: sessionsError } = useBackendSessions()
  const tasks = useBackendTasks()
  const workspaceEntries = useWorkspaceEntries()

  // Get the default agent id for session chat links
  const defaultAgentId = agentId || "aria"

  const navItems = isAgentMode && agentId
    ? getAgentNav(agentId)
    : data.orgNav

  const activeTasks = tasks.filter((t) => t.status === "running" || t.status === "queued" || t.status === "pending")
  const completedTasks = tasks.filter((t) => t.status === "completed")

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <ContextSwitcher />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navItems} />

        {/* Folders */}
        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel>Folders</SidebarGroupLabel>
          <SidebarMenu>
            {workspaceEntries.map((entry) => {
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
            {workspaceEntries.length === 0 && (
              <SidebarMenuItem>
                <SidebarMenuButton className="text-sidebar-foreground/40" disabled>
                  <FolderIcon className="size-3 text-sidebar-foreground/30" />
                  <span className="text-xs">Empty workspace</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
          </SidebarMenu>
        </SidebarGroup>

        {/* Sessions — loaded live from OpenClaw Gateway */}
        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel className="flex items-center">
            Sessions
            {!sessionsLoading && !sessionsError && sessions.length > 0 && (
              <span className="ml-auto text-[10px] text-muted-foreground/50 tabular-nums">
                {sessions.length}
              </span>
            )}
          </SidebarGroupLabel>
          <SidebarMenu>
            {sessionsLoading && (
              <SidebarMenuItem>
                <SidebarMenuButton className="text-sidebar-foreground/40" disabled>
                  <LoaderIcon className="size-3 animate-spin text-sidebar-foreground/30" />
                  <span className="text-xs">Loading…</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
            {!sessionsLoading && sessionsError && (
              <SidebarMenuItem>
                <SidebarMenuButton className="text-sidebar-foreground/40" disabled title={sessionsError}>
                  <XCircleIcon className="size-3 text-red-400/60" />
                  <span className="text-xs text-red-400/60">Gateway unreachable</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
            {!sessionsLoading && !sessionsError && sessions.length === 0 && (
              <SidebarMenuItem>
                <SidebarMenuButton className="text-sidebar-foreground/40" disabled>
                  <CircleIcon className="size-3 text-sidebar-foreground/30" />
                  <span className="text-xs">No active sessions</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
            {sessions.map((session) => {
              const isActive = pathname.includes(`session=${session.sessionId}`)
              // Derive a human label: prefer origin.label, then provider, then key
              const label =
                session.origin?.label ||
                (session.origin?.provider
                  ? `${session.origin.provider} · ${session.chatType}`
                  : session.key)
              // Format relative time
              const relativeTime = formatRelativeSession(session.updatedAt)
              // Token usage as % of context window
              const usagePct = session.contextTokens
                ? Math.round((session.totalTokens / session.contextTokens) * 100)
                : null

              return (
                <SidebarMenuItem key={session.key}>
                  <SidebarMenuButton
                    className={cn("h-auto py-1.5", isActive && "bg-sidebar-accent")}
                    render={
                      <a href={`/agent/${defaultAgentId}/chat?session=${session.sessionId}`} />
                    }
                    title={session.key}
                  >
                    <MessageSquareIcon className="size-3 text-primary shrink-0 mt-0.5" />
                    <div className="flex flex-col min-w-0 gap-0">
                      <span className="truncate text-xs leading-tight">{label}</span>
                      <span className="text-[10px] text-muted-foreground/40 font-mono truncate">
                        {relativeTime}
                        {usagePct !== null ? ` · ${usagePct}% ctx` : ""}
                        {session.model ? ` · ${session.model.split("/").pop()}` : ""}
                      </span>
                    </div>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>

        {/* Tasks */}
        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel>
            Tasks
            {tasks.length > 0 && (
              <span className="ml-auto text-[10px] text-muted-foreground/50 tabular-nums">
                {activeTasks.length} active · {completedTasks.length} done
              </span>
            )}
          </SidebarGroupLabel>
          <SidebarMenu>
            {tasks.length === 0 && (
              <SidebarMenuItem>
                <SidebarMenuButton className="text-sidebar-foreground/40" disabled>
                  <CircleIcon className="size-3 text-sidebar-foreground/30" />
                  <span className="text-xs">No tasks</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
            {tasks.slice(0, 6).map((task) => (
              <SidebarMenuItem key={task.task_id}>
                <SidebarMenuButton className="h-auto py-1.5" title={task.prompt}>
                  <span className="shrink-0 mt-0.5">
                    {TASK_STATUS_ICON[task.status] ?? TASK_STATUS_ICON.pending}
                  </span>
                  <div className="flex flex-col min-w-0 gap-0.5">
                    <span className="truncate text-xs leading-tight">
                      {truncatePrompt(task.prompt)}
                    </span>
                    <span className="text-[10px] text-muted-foreground/50 tabular-nums">
                      {task.status}
                      {task.duration_ms ? ` · ${formatDuration(task.duration_ms)}` : ""}
                      {task.cost_usd ? ` · $${task.cost_usd.toFixed(2)}` : ""}
                    </span>
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
            {tasks.length > 6 && (
              <SidebarMenuItem>
                <SidebarMenuButton className="text-sidebar-foreground/70">
                  <MoreHorizontalIcon className="text-sidebar-foreground/70" />
                  <span className="text-xs">View all {tasks.length} tasks</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
          </SidebarMenu>
        </SidebarGroup>

        <NavSecondary items={data.navSecondary} className="mt-auto" />
        <SidebarGroup className="group-data-[collapsible=icon]:hidden px-2 pb-1">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                className="text-sidebar-foreground/50 hover:text-sidebar-foreground/70"
                tooltip="Command Palette"
                onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', code: 'KeyK', metaKey: true, bubbles: true }))}
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
