/**
 * Standalone — roda no container de produção (sem imports @/lib).
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

type KanbanCol = { id: string; title: string; status: string }

function internalProjectId(settings: unknown): string | null {
  if (!settings || typeof settings !== 'object') return null
  const id = (settings as { internalProjectId?: string }).internalProjectId
  return typeof id === 'string' && id.trim() ? id.trim() : null
}

function todoColumnId(settings: unknown): string | null {
  if (!settings || typeof settings !== 'object') return null
  const cols = (settings as { kanbanColumns?: KanbanCol[] }).kanbanColumns
  if (!Array.isArray(cols)) return null
  const aFazer = cols.find(
    (c) =>
      c.title?.toLowerCase().includes('a fazer') ||
      c.title?.toLowerCase().includes('backlog')
  )
  if (aFazer?.id) return aFazer.id
  return cols.find((c) => c.status === 'TODO')?.id ?? null
}

async function syncLinks(
  tx: Pick<PrismaClient, 'taskProject'>,
  taskId: string,
  primaryProjectId: string,
  extra: string[]
) {
  const ids = [...new Set([primaryProjectId, ...extra.filter(Boolean)])]
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

async function main() {
  const sourceSlug = process.env.SOURCE_WORKSPACE_SLUG || 'esteira-a'
  const targetSlug = process.env.TARGET_WORKSPACE_SLUG || 'ceo'

  const source = await prisma.workspace.findFirst({
    where: { slug: sourceSlug },
    include: { projects: { select: { projectId: true } } },
  })
  const target = await prisma.workspace.findFirst({
    where: { slug: targetSlug },
    select: { name: true, settings: true },
  })

  if (!source || !target) throw new Error('Workspace não encontrado')

  const targetProjectId = internalProjectId(target.settings)
  if (!targetProjectId) throw new Error('CEO sem internalProjectId')

  const sourceProjectIds = source.projects.map((p) => p.projectId)
  const kanbanColumnId = todoColumnId(target.settings)

  const tasks = await prisma.task.findMany({
    where: {
      isArchived: false,
      OR: [
        { projectId: { in: sourceProjectIds } },
        { linkedProjects: { some: { projectId: { in: sourceProjectIds } } } },
      ],
    },
    select: {
      id: true,
      title: true,
      projectId: true,
      linkedProjects: { select: { projectId: true } },
    },
  })

  console.log(`Mover ${tasks.length} tasks → CEO (TODO)`)

  for (const task of tasks) {
    const preserveLinks = task.linkedProjects
      .map((lp) => lp.projectId)
      .filter(
        (id) =>
          id !== task.projectId &&
          id !== targetProjectId &&
          !sourceProjectIds.includes(id)
      )

    await prisma.$transaction(async (tx) => {
      await tx.task.update({
        where: { id: task.id },
        data: {
          projectId: targetProjectId,
          status: 'TODO',
          sprintId: null,
          kanbanColumnId,
          completedAt: null,
          updatedAt: new Date(),
        },
      })
      await syncLinks(tx, task.id, targetProjectId, preserveLinks)
    })
    console.log(`✓ ${task.title}`)
  }

  console.log(`Concluído: ${tasks.length}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
