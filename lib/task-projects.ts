import { PrismaClient } from '@prisma/client'

type Tx = Pick<PrismaClient, 'taskProject' | 'project'>

export async function syncTaskLinkedProjects(
  tx: Tx,
  taskId: string,
  primaryProjectId: string,
  linkedProjectIds?: string[]
) {
  const ids = Array.from(
    new Set([primaryProjectId, ...(linkedProjectIds ?? []).filter(Boolean)])
  )

  if (ids.length > 0) {
    const count = await tx.project.count({ where: { id: { in: ids } } })
    if (count !== ids.length) {
      throw new Error('INVALID_PROJECTS')
    }
  }

  await tx.taskProject.deleteMany({ where: { taskId } })

  if (ids.length === 0) return

  await tx.taskProject.createMany({
    data: ids.map((projectId) => ({
      taskId,
      projectId,
      isPrimary: projectId === primaryProjectId,
    })),
  })
}

export function taskProjectFilter(projectIds: string[]) {
  if (projectIds.length === 0) return undefined
  return {
    OR: [
      { projectId: { in: projectIds } },
      { linkedProjects: { some: { projectId: { in: projectIds } } } },
    ],
  }
}
