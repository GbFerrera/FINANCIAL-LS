/**
 * Move tasks (Prisma direto) da Esteira A → workspace CEO, sem deploy da API.
 *
 * Uso:
 *   cd /Users/gabrielferreira/Desktop/projects
 *   npx tsx scripts/move-tasks-to-ceo-workspace-prisma.ts
 *
 * Produção (túnel SSH ou DATABASE_URL no .env.local):
 *   DATABASE_URL="postgresql://..." npx tsx scripts/move-tasks-to-ceo-workspace-prisma.ts
 *
 * Opcional: ASSIGNEE_EMAIL=business.gabrielferreira@gmail.com
 */
import { config } from 'dotenv'
import { PrismaClient } from '@prisma/client'

config({ path: '.env.local' })
config()
import { parseWorkspaceSettings } from '../lib/workspace-settings'
import { syncTaskLinkedProjects } from '../lib/task-projects'

const dbUrl = process.env.PROD_DATABASE_URL || process.env.DATABASE_URL
if (!dbUrl) {
  throw new Error(
    'Defina PROD_DATABASE_URL (Coolify → projects → DATABASE_URL) ou DATABASE_URL local.'
  )
}

const prisma = new PrismaClient({
  datasources: { db: { url: dbUrl } },
})

function internalProjectId(settings: unknown): string | null {
  const id = parseWorkspaceSettings(settings).internalProjectId
  return id?.trim() || null
}

async function main() {
  const assigneeEmail = (process.env.ASSIGNEE_EMAIL || 'business.gabrielferreira@gmail.com').trim()
  const sourceSlug = (process.env.SOURCE_WORKSPACE_SLUG || 'esteira-a').trim()
  const targetSlug = (process.env.TARGET_WORKSPACE_SLUG || 'ceo').trim()

  const assignee = await prisma.user.findFirst({
    where: { email: { equals: assigneeEmail, mode: 'insensitive' } },
    select: { id: true, name: true, email: true },
  })
  if (!assignee) throw new Error(`Usuário não encontrado: ${assigneeEmail}`)

  const [source, target] = await Promise.all([
    prisma.workspace.findFirst({
      where: { slug: sourceSlug },
      include: { projects: { select: { projectId: true } } },
    }),
    prisma.workspace.findFirst({
      where: { slug: targetSlug },
      select: { id: true, name: true, slug: true, settings: true },
    }),
  ])

  if (!source) throw new Error(`Workspace origem não encontrado: ${sourceSlug}`)
  if (!target) throw new Error(`Workspace destino não encontrado: ${targetSlug}`)

  const targetProjectId = internalProjectId(target.settings)
  if (!targetProjectId) {
    throw new Error(`Workspace "${target.name}" sem internalProjectId em settings`)
  }

  const targetProject = await prisma.project.findUnique({
    where: { id: targetProjectId },
    select: { id: true, name: true },
  })
  if (!targetProject) throw new Error(`Projeto interno CEO não existe: ${targetProjectId}`)

  const sourceProjectIds = source.projects.map((p) => p.projectId)
  if (sourceProjectIds.length === 0) throw new Error('Esteira A sem projetos vinculados')

  const ceoLabel = await prisma.taskLabel.findFirst({
    where: {
      name: { equals: 'CEO', mode: 'insensitive' },
      workspaceId: source.id,
    },
    select: { id: true },
  })

  const tasks = await prisma.task.findMany({
    where: {
      assigneeId: assignee.id,
      OR: [
        { projectId: { in: sourceProjectIds } },
        { linkedProjects: { some: { projectId: { in: sourceProjectIds } } } },
      ],
    },
    select: {
      id: true,
      title: true,
      projectId: true,
      project: { select: { name: true } },
      labelAssignments: { select: { labelId: true } },
      linkedProjects: { select: { projectId: true } },
    },
  })

  console.log(`Origem: ${source.name} (${source.slug})`)
  console.log(`Destino: ${target.name} → ${targetProject.name}`)
  console.log(`Assignee: ${assignee.name || assignee.email}`)
  console.log(`Tasks: ${tasks.length}`)

  let moved = 0
  let labelsRemoved = 0

  for (const task of tasks) {
    const alreadyThere = task.projectId === targetProjectId
    const otherLinks = task.linkedProjects
      .map((lp) => lp.projectId)
      .filter((id) => id !== task.projectId && id !== targetProjectId)

    await prisma.$transaction(async (tx) => {
      if (ceoLabel) {
        const had = task.labelAssignments.some((a) => a.labelId === ceoLabel.id)
        if (had) {
          await tx.taskLabelAssignment.deleteMany({
            where: { taskId: task.id, labelId: ceoLabel.id },
          })
          labelsRemoved++
        }
      }

      if (!alreadyThere) {
        await tx.task.update({
          where: { id: task.id },
          data: {
            projectId: targetProjectId,
            sprintId: null,
            kanbanColumnId: null,
            updatedAt: new Date(),
          },
        })
        await syncTaskLinkedProjects(tx, task.id, targetProjectId, otherLinks)
        moved++
      }
    })

    console.log(
      alreadyThere
        ? `= ${task.title} (já no CEO)`
        : `✓ ${task.title} (${task.project.name} → ${targetProject.name})`
    )
  }

  console.log(`Concluído: ${moved} movida(s), ${labelsRemoved} etiqueta(s) CEO removida(s).`)
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
