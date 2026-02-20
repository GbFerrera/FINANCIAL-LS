import { UserRole } from "@prisma/client"

export type RouteItem = {
  key: string
  label: string
  path: string
}

export const ROUTE_REGISTRY: RouteItem[] = [
  { key: "dashboard", label: "Dashboard", path: "/dashboard" },
  { key: "projects", label: "Projetos", path: "/projects" },
  { key: "projects_backlog", label: "Projetos • Backlog", path: "/projects/backlog" },
  { key: "projects_sprints", label: "Projetos • Sprints", path: "/projects/sprints" },
  { key: "projects_notes", label: "Projetos • Docs", path: "/projects/notes" },
  { key: "financial", label: "Financeiro", path: "/financial" },
  { key: "financial_commissions", label: "Financeiro • Comissões", path: "/financial/commissions" },
  { key: "clients", label: "Clientes", path: "/clients" },
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
    "/projects/backlog",
    "/projects/sprints",
    "/projects/notes",
    "/team",
    "/team/agenda",
    "/team/chat",
    "/team/performance",
    "/pipeline",
    "/files",
    "/notifications",
    "/reports",
    "/profile",
    "/sprints",
    "/tasks",
    "/excalidraw",
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
