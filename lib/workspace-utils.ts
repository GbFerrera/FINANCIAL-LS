export function slugifyWorkspace(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'workspace'
}

export type WorkspaceProjectLink = {
  id: string
  sortOrder: number
  project: {
    id: string
    name: string
    status: string
    client: { id: string; name: string }
  }
}

export type WorkspaceDTO = {
  id: string
  name: string
  slug: string
  icon: string | null
  description: string | null
  sortOrder: number
  projects: WorkspaceProjectLink[]
  projectIds: string[]
}

export function mapWorkspace(row: {
  id: string
  name: string
  slug: string
  icon: string | null
  description: string | null
  sortOrder: number
  projects: Array<{
    id: string
    sortOrder: number
    project: {
      id: string
      name: string
      status: string
      client: { id: string; name: string }
    }
  }>
}): WorkspaceDTO {
  const projects = [...row.projects].sort((a, b) => a.sortOrder - b.sortOrder || a.project.name.localeCompare(b.project.name))
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    icon: row.icon,
    description: row.description,
    sortOrder: row.sortOrder,
    projects,
    projectIds: projects.map((p) => p.project.id),
  }
}

export const workspaceInclude = {
  projects: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          status: true,
          client: { select: { id: true, name: true } },
        },
      },
    },
  },
}
