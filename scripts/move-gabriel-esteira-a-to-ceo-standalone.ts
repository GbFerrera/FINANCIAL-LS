/**
 * Move para CEO (TODO) apenas tasks atribuídas a Gabriel nos projetos da Esteira A.
 * Opcional: REVERT_OTHERS=1 — devolve ao projeto de entrega tasks no CEO que não são do Gabriel.
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
  tx: Pick<PrismaClient, 'taskProject' | 'project'>,
  taskId: string,
  primaryProjectId: string,
  extra: string[]
) {
  const ids = [...new Set([primaryProjectId, ...extra.filter(Boolean)])]
  if (ids.length > 0) {
    const count = await tx.project.count({ where: { id: { in: ids } } })
    if (count !== ids.length) throw new Error('INVALID_PROJECTS')
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

async function main() {
  const assigneeEmail = (process.env.ASSIGNEE_EMAIL || 'business.gabrielferreira@gmail.com').trim()
  const sourceSlug = process.env.SOURCE_WORKSPACE_SLUG || 'esteira-a'
  const targetSlug = process.env.TARGET_WORKSPACE_SLUG || 'ceo'
  const revertOthers = process.env.REVERT_OTHERS === '1'

  const assignee = await prisma.user.findFirst({
    where: { email: { equals: assigneeEmail, mode: 'insensitive' } },
    select: { id: true, name: true, email: true },
  })
  if (!assignee) throw new Error(`Usuário não encontrado: ${assigneeEmail}`)

  const source = await prisma.workspace.findFirst({
    where: { slug: sourceSlug },
    include: { projects: { select: { projectId: true, project: { select: { name: true, id: true } } } } },
  })
  const target = await prisma.workspace.findFirst({
    where: { slug: targetSlug },
    select: { name: true, settings: true },
  })
  if (!source || !target) throw new Error('Workspace não encontrado')

  const targetProjectId = internalProjectId(target.settings)
  if (!targetProjectId) throw new Error('CEO sem internalProjectId')

  const sourceProjectIds = source.projects.map((p) => p.projectId)
  const deliveryProjectIds = new Set(sourceProjectIds.filter((id) => id !== targetProjectId))
  const kanbanColumnId = todoColumnId(target.settings)

  console.log(`Assignee: ${assignee.name || assignee.email}`)
  console.log(`Esteira A: ${sourceProjectIds.length} projetos`)

  if (revertOthers) {
    const wronglyOnCeo = await prisma.task.findMany({
      where: {
        projectId: targetProjectId,
        isArchived: false,
        OR: [{ assigneeId: { not: assignee.id } }, { assigneeId: null }],
      },
      include: {
        linkedProjects: { include: { project: { select: { id: true, name: true } } } },
        milestone: { select: { projectId: true } },
        sprint: { select: { projects: { select: { projectId: true } } } },
      },
    })

    let reverted = 0
    for (const task of wronglyOnCeo) {
      const deliveryLink = task.linkedProjects.find((lp) => deliveryProjectIds.has(lp.projectId))
      const sprintProject = task.sprint?.projects?.find((sp) => deliveryProjectIds.has(sp.projectId))
      const milestoneProject =
        task.milestone?.projectId && deliveryProjectIds.has(task.milestone.projectId)
          ? task.milestone.projectId
          : null
      const fallback = source.projects.find((p) => p.projectId !== targetProjectId)
      const restoreId =
        deliveryLink?.projectId ||
        sprintProject?.projectId ||
        milestoneProject ||
        fallback?.projectId
      if (!restoreId || restoreId === targetProjectId) {
        console.log(`? skip revert (sem projeto): ${task.title}`)
        continue
      }
      await prisma.$transaction(async (tx) => {
        await tx.task.update({
          where: { id: task.id },
          data: {
            projectId: restoreId,
            kanbanColumnId: null,
            updatedAt: new Date(),
          },
        })
        await syncLinks(tx, task.id, restoreId, [])
      })
      reverted++
      console.log(`↩ ${task.title}`)
    }
    console.log(`Revertidas (não-Gabriel): ${reverted}`)
  }

  const toMove = await prisma.task.findMany({
    where: {
      assigneeId: assignee.id,
      isArchived: false,
      OR: [
        { projectId: { in: [...sourceProjectIds] } },
        { linkedProjects: { some: { projectId: { in: sourceProjectIds } } } },
      ],
      NOT: { projectId: targetProjectId },
    },
    select: {
      id: true,
      title: true,
      projectId: true,
      linkedProjects: { select: { projectId: true } },
    },
  })

  console.log(`Mover para CEO (TODO): ${toMove.length}`)

  for (const task of toMove) {
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

  const onCeoGabriel = await prisma.task.count({
    where: {
      assigneeId: assignee.id,
      projectId: targetProjectId,
      isArchived: false,
      status: 'TODO',
    },
  })
  console.log(`Gabriel no CEO (A Fazer): ${onCeoGabriel} task(s)`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
