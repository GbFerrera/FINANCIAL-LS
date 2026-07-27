import type { ProjectStatus } from "@prisma/client"

export type ClientCategory =
  | "desenvolvimento_ativo"
  | "somente_assinante"
  | "historico_sem_ativo"
  | "sem_vinculo"

const ACTIVE_PROJECT = new Set<ProjectStatus>(["PLANNING", "IN_PROGRESS", "ON_HOLD"])
const INACTIVE_PROJECT = new Set<ProjectStatus>(["COMPLETED", "CANCELLED"])

export type SyncProject = {
  id: string
  name: string
  status: ProjectStatus
  description: string | null
  startDate: Date
  endDate: Date | null
  budget: number | null
}

export type SyncSubscription = {
  plan: string
  group: string
  status: string
  price: number
}

export type SyncClient = {
  id: string
  name: string
  email: string
  phone: string | null
  company: string | null
  projects: SyncProject[]
  subscriptions: SyncSubscription[]
  category: ClientCategory
  activeProjects: SyncProject[]
  inactiveProjects: SyncProject[]
}

export function classifyClient(
  projects: SyncProject[],
  subscriptions: SyncSubscription[]
): Pick<SyncClient, "category" | "activeProjects" | "inactiveProjects"> {
  const activeProjects = projects.filter((p) => ACTIVE_PROJECT.has(p.status))
  const inactiveProjects = projects.filter((p) => INACTIVE_PROJECT.has(p.status))
  const hasActiveSub = subscriptions.some((s) => s.status === "ACTIVE")
  const hasAnyProject = projects.length > 0
  const hasActiveProject = activeProjects.length > 0

  let category: ClientCategory
  if (hasActiveProject) {
    category = "desenvolvimento_ativo"
  } else if (hasAnyProject && !hasActiveProject) {
    category = "historico_sem_ativo"
  } else if (hasActiveSub) {
    category = "somente_assinante"
  } else {
    category = "sem_vinculo"
  }

  return { category, activeProjects, inactiveProjects }
}

export function categoryLabel(category: ClientCategory): string {
  switch (category) {
    case "desenvolvimento_ativo":
      return "Desenvolvimento ativo"
    case "somente_assinante":
      return "Somente assinante"
    case "historico_sem_ativo":
      return "Histórico — sem projeto ativo"
    case "sem_vinculo":
      return "Sem projeto e sem assinatura"
  }
}
