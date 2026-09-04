import { UserRole } from "@prisma/client"

export type RouteItem = {
  key: string
  label: string
  path: string
}

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
  { key: "financial_commissions", label: "Financeiro • Comissões", path: "/financial/commissions" },
  { key: "financial_reminders", label: "Financeiro • Lembretes", path: "/financial/reminders" },
  { key: "clients", label: "Clientes", path: "/clients" },
  { key: "subscriptions", label: "Assinaturas", path: "/subscriptions" },
  { key: "team", label: "Equipe", path: "/team" },
  { key: "team_agenda", label: "Equipe • Agenda", path: "/team/agenda" },
  { key: "team_chat", label: "Equipe • Chat", path: "/team/chat" },
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
  // Normaliza para evitar duplicidade de barras
  const current = pathname.replace(/\/+$/, "")
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
  const financePrefix =
    pathname === "/subscriptions" ||
    pathname.startsWith("/financial")

  if (financePrefix) {
    const financialDest = firstAllowedFinancialPath(allowedPaths)
    if (financialDest && financialDest !== pathname.replace(/\/+$/, "")) {
      return financialDest
    }
  }

  return firstAllowedPath(allowedPaths) || firstAllowedFromRole(role) || "/auth/signin"
}
