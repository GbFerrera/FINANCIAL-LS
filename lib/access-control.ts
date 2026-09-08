import { UserRole } from "@prisma/client"

export type RouteItem = {
  key: string
  label: string
  path: string
}

export type RouteGroup = {
  id: string
  label: string
  keys: string[]
}

export const ROUTE_GROUPS: RouteGroup[] = [
  {
    id: "main",
    label: "Principal",
    keys: ["dashboard", "agent_pm", "pipeline", "profile", "notifications"],
  },
  {
    id: "projects",
    label: "Projetos",
    keys: [
      "projects",
      "projects_backlog",
      "projects_sprints",
      "projects_scrum",
      "projects_notes",
    ],
  },
  {
    id: "comms",
    label: "Chat e comunicação",
    keys: ["team_chat", "team_office", "team_call"],
  },
  {
    id: "clients",
    label: "Clientes e vendas",
    keys: ["clients", "clients_proposals", "subscriptions", "payments"],
  },
  {
    id: "financial",
    label: "Financeiro",
    keys: [
      "financial",
      "financial_calendar",
      "financial_commissions",
      "financial_reminders",
      "financial_whatsapp",
    ],
  },
  {
    id: "team",
    label: "Equipe",
    keys: ["team", "team_agenda", "team_performance"],
  },
  {
    id: "workspace",
    label: "Espaços de trabalho",
    keys: ["workspace", "settings_workspaces"],
  },
  {
    id: "other",
    label: "Outros",
    keys: [
      "mkt",
      "files",
      "reports",
      "settings",
      "supervisor_dashboard",
      "excalidraw",
      "admin_clients",
      "admin_collaborators",
      "admin_integrations",
    ],
  },
]

export const ROUTE_REGISTRY: RouteItem[] = [
  { key: "dashboard", label: "Dashboard", path: "/dashboard" },
  { key: "projects", label: "Projetos", path: "/projects" },
  { key: "agent_pm", label: "Agente PM", path: "/agent" },
  { key: "projects_backlog", label: "Projetos • Backlog", path: "/projects/backlog" },
  { key: "projects_sprints", label: "Projetos • Sprints", path: "/projects/sprints" },
  { key: "projects_scrum", label: "Projetos • Scrum", path: "/projects/scrum" },
  { key: "projects_notes", label: "Projetos • Docs", path: "/projects/notes" },
  { key: "mkt", label: "MKT", path: "/mkt" },
  { key: "financial", label: "Financeiro", path: "/financial" },
  { key: "financial_calendar", label: "Financeiro • Cobranças", path: "/financial/calendar" },
  { key: "financial_commissions", label: "Financeiro • Comissões", path: "/financial/commissions" },
  { key: "financial_reminders", label: "Financeiro • Lembretes", path: "/financial/reminders" },
  { key: "financial_whatsapp", label: "Financeiro • WhatsApp", path: "/financial/whatsapp" },
  { key: "clients", label: "Clientes", path: "/clients" },
  { key: "clients_proposals", label: "Clientes • Propostas", path: "/clients/proposals" },
  { key: "subscriptions", label: "Assinaturas", path: "/subscriptions" },
  { key: "team", label: "Equipe • Membros", path: "/team" },
  { key: "team_agenda", label: "Equipe • Agenda", path: "/team/agenda" },
  { key: "team_chat", label: "Chat", path: "/team/chat" },
  { key: "team_call", label: "Calls / salas", path: "/team/call" },
  { key: "team_office", label: "Escritório 2D", path: "/team/office" },
  { key: "team_performance", label: "Equipe • Performance", path: "/team/performance" },
  { key: "pipeline", label: "Pipeline", path: "/pipeline" },
  { key: "files", label: "Arquivos", path: "/files" },
  { key: "payments", label: "Pagamentos", path: "/payments" },
  { key: "reports", label: "Relatórios", path: "/reports" },
  { key: "notifications", label: "Notificações", path: "/notifications" },
  { key: "settings", label: "Configurações", path: "/settings" },
  { key: "settings_workspaces", label: "Espaços de trabalho", path: "/settings/workspaces" },
  { key: "workspace", label: "Espaços", path: "/workspace" },
  { key: "supervisor_dashboard", label: "Supervisor • Dashboard", path: "/supervisor/dashboard" },
  { key: "excalidraw", label: "Excalidraw", path: "/excalidraw" },
  { key: "profile", label: "Perfil", path: "/profile" },
  // Admin area
  { key: "admin_clients", label: "Admin • Clientes", path: "/admin/clients" },
  { key: "admin_collaborators", label: "Admin • Colaboradores", path: "/admin/collaborators" },
  { key: "admin_integrations", label: "Admin • Integrações", path: "/admin/integrations" },
]

export function routesByGroup(): { group: RouteGroup; routes: RouteItem[] }[] {
  const byKey = new Map(ROUTE_REGISTRY.map((r) => [r.key, r]))
  const groupedKeys = new Set(ROUTE_GROUPS.flatMap((g) => g.keys))

  const groups = ROUTE_GROUPS.map((group) => ({
    group,
    routes: group.keys
      .map((key) => byKey.get(key))
      .filter((r): r is RouteItem => Boolean(r)),
  }))

  const orphans = ROUTE_REGISTRY.filter((r) => !groupedKeys.has(r.key))
  if (orphans.length > 0) {
    groups.push({
      group: {
        id: "uncategorized",
        label: "Outras páginas",
        keys: orphans.map((r) => r.key),
      },
      routes: orphans,
    })
  }

  return groups
}

export const ROLE_DEFAULTS: Record<UserRole, string[]> = {
  [UserRole.ADMIN]: ["/*"], // Admin pode tudo
  [UserRole.TEAM]: [
    "/dashboard",
    "/projects",
    "/agent",
    "/projects/backlog",
    "/projects/sprints",
    "/projects/scrum",
    "/projects/notes",
    "/mkt",
    "/team",
    "/team/agenda",
    "/team/chat",
    "/team/call",
    "/team/office",
    "/team/performance",
    "/pipeline",
    "/files",
    "/notifications",
    "/reports",
    "/profile",
    "/excalidraw",
    "/workspace",
  ],
  [UserRole.CLIENT]: [
    "/dashboard",
  ],
}

export function getDefaultAllowedPaths(role: UserRole): string[] {
  return ROLE_DEFAULTS[role] ?? []
}

export function isPathAllowed(pathname: string, allowedPaths: string[]): boolean {
  if (allowedPaths.includes("/*")) return true

  const current = pathname.replace(/\/+$/, "") || "/"

  // Pai /financial libera todas as sub-rotas /financial/*
  const hasFinancialRoot = allowedPaths.some(
    (prefix) => prefix.replace(/\/+$/, "") === "/financial"
  )
  if (hasFinancialRoot && (current === "/financial" || current.startsWith("/financial/"))) {
    return true
  }

  // Chat: /team/chat ou /team/call liberam a área de chat
  if (current === '/team/chat' || current.startsWith('/team/chat/')) {
    return allowedPaths.some((p) => p === '/team/chat' || p === '/team/call')
  }

  // Escritório virtual
  if (current === '/team/office' || current.startsWith('/team/office/')) {
    return allowedPaths.some((p) => p === '/team/office')
  }

  // Calls / salas
  if (current === '/team/call' || current.startsWith('/team/call/')) {
    return allowedPaths.some((p) => p === '/team/call' || p === '/team/chat')
  }

  // Demais rotas: match exato ou subpath do prefixo permitido
  return allowedPaths.some((prefix) => {
    const normalized = prefix.replace(/\/+$/, "")
    return current === normalized || current.startsWith(`${normalized}/`)
  })
}

export function registryPaths(): string[] {
  return ROUTE_REGISTRY.map((r) => r.path)
}

export function firstAllowedPath(allowedPaths: string[]): string | null {
  if (allowedPaths.includes("/*")) return "/dashboard"
  const paths = registryPaths()
  for (const p of paths) {
    if (isPathAllowed(p, allowedPaths)) return p
  }
  return null
}

export function firstAllowedFromRole(role: UserRole): string {
  const paths = getDefaultAllowedPaths(role)
  return firstAllowedPath(paths) || "/dashboard"
}

export function firstAllowedPathExcluding(allowedPaths: string[], exclude: string[]): string | null {
  if (allowedPaths.includes("/*")) {
    const paths = registryPaths().filter(p => !exclude.includes(p))
    return paths[0] || "/dashboard"
  }
  const paths = registryPaths()
  for (const p of paths) {
    if (exclude.includes(p)) continue
    if (isPathAllowed(p, allowedPaths)) return p
  }
  return null
}

/** Rotas do menu Financeiro (inclui calendário, que não está no ROUTE_REGISTRY). */
export const FINANCIAL_NAV_PATHS = [
  "/financial/commissions",
  "/financial",
  "/financial/calendar",
  "/subscriptions",
  "/financial/reminders",
] as const

export function firstAllowedFinancialPath(allowedPaths: string[]): string | null {
  if (allowedPaths.includes("/*")) return "/financial"
  for (const path of FINANCIAL_NAV_PATHS) {
    if (isPathAllowed(path, allowedPaths)) return path
  }
  return null
}

export function hasFinancialAccess(allowedPaths: string[] | null, isAdmin = false): boolean {
  if (isAdmin) return true
  if (!allowedPaths) return false
  return firstAllowedFinancialPath(allowedPaths) !== null
}

type NavHrefItem = {
  href: string
  submenu?: { href: string }[]
}

/** Usa a rota principal se permitida; senão, a primeira sub-rota permitida. */
export function resolveNavHref(item: NavHrefItem, allowedPaths: string[] | null, isAdmin = false): string {
  if (isAdmin || !allowedPaths || allowedPaths.includes("/*")) return item.href
  if (isPathAllowed(item.href, allowedPaths)) return item.href
  for (const sub of item.submenu ?? []) {
    if (isPathAllowed(sub.href, allowedPaths)) return sub.href
  }
  return item.href
}

export function redirectForPath(
  pathname: string,
  allowedPaths: string[],
  role: UserRole
): string {
  const current = pathname.replace(/\/+$/, "") || "/"

  const financePrefix =
    current === "/subscriptions" || current.startsWith("/financial")

  if (financePrefix && !isPathAllowed(pathname, allowedPaths)) {
    const financialDest = firstAllowedFinancialPath(allowedPaths)
    if (financialDest && financialDest !== current) {
      return financialDest
    }
  }

  return firstAllowedPath(allowedPaths) || firstAllowedFromRole(role) || "/auth/signin"
}
