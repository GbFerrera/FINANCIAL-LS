/**
 * Move TODAS as tasks dos projetos do workspace Esteira A → projeto [Gestão] CEO,
 * status TODO (coluna A Fazer / Backlog).
 *
 * Produção na VPS:
 *   docker cp scripts/move-all-esteira-a-tasks-to-ceo.ts <app>:/app/scripts/
 *   docker exec <app> npx tsx scripts/move-all-esteira-a-tasks-to-ceo.ts
 */
import { PrismaClient, TaskStatus } from '@prisma/client'
import { parseWorkspaceSettings } from '../lib/workspace-settings'
import { syncTaskLinkedProjects } from '../lib/task-projects'

const prisma = new PrismaClient()

function todoColumnId(settings: unknown): string | null {
  const cols = parseWorkspaceSettings(settings).kanbanColumns ?? []
  const aFazer = cols.find(
    (c) =>
      c.title.toLowerCase().includes('a fazer') ||
      c.title.toLowerCase().includes('backlog')
  )
  if (aFazer) return aFazer.id
  const todoCol = cols.find((c) => c.status === 'TODO')
  return todoCol?.id ?? null
}

async function main() {
  const sourceSlug = (process.env.SOURCE_WORKSPACE_SLUG || 'esteira-a').trim()
  const targetSlug = (process.env.TARGET_WORKSPACE_SLUG || 'ceo').trim()
  const targetStatus = (process.env.TARGET_STATUS || 'TODO').trim() as TaskStatus

  const source = await prisma.workspace.findFirst({
    where: { slug: sourceSlug },
    include: { projects: { select: { projectId: true } } },
  })
  const target = await prisma.workspace.findFirst({
    where: { slug: targetSlug },
    select: { id: true, name: true, slug: true, settings: true },
  })

  if (!source) throw new Error(`Workspace origem não encontrado: ${sourceSlug}`)
  if (!target) throw new Error(`Workspace destino não encontrado: ${targetSlug}`)

  const targetProjectId = parseWorkspaceSettings(target.settings).internalProjectId?.trim()
  if (!targetProjectId) throw new Error(`CEO sem internalProjectId`)

  const targetProject = await prisma.project.findUnique({
    where: { id: targetProjectId },
    select: { id: true, name: true },
  })
  if (!targetProject) throw new Error(`Projeto interno inexistente: ${targetProjectId}`)

  const sourceProjectIds = source.projects.map((p) => p.projectId)
  if (sourceProjectIds.length === 0) throw new Error('Esteira A sem projetos')

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
      status: true,
      projectId: true,
      project: { select: { name: true } },
      linkedProjects: { select: { projectId: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  console.log(`Origem: ${source.name} — ${sourceProjectIds.length} projetos`)
  console.log(`Destino: ${target.name} → ${targetProject.name}`)
  console.log(`Tasks a mover: ${tasks.length} (status → ${targetStatus})`)

  let moved = 0
  for (const task of tasks) {
    const preserveLinks = task.linkedProjects
      .map((lp) => lp.projectId)
      .filter((id) => id !== task.projectId && id !== targetProjectId && !sourceProjectIds.includes(id))

    await prisma.$transaction(async (tx) => {
      await tx.task.update({
        where: { id: task.id },
        data: {
          projectId: targetProjectId,
          status: targetStatus,
          sprintId: null,
          kanbanColumnId,
          completedAt: targetStatus === 'COMPLETED' ? undefined : null,
          updatedAt: new Date(),
        },
      })
      await syncTaskLinkedProjects(tx, task.id, targetProjectId, preserveLinks)
    })
    moved++
    console.log(`✓ ${task.title}`)
  }

  console.log(`Concluído: ${moved} task(s) no workspace CEO (A Fazer).`)
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
