import { PrismaClient, TaskStatus } from '@prisma/client'
import {
  DEMO_PROJECTS,
  DEMO_TEAM,
  DEMO_WORKSPACE_DRAFTS,
  DEMO_WORKSPACES,
} from '../data/industrial-automation-demo'

function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

export async function seedIndustrialWorkspaceDrafts(prisma: PrismaClient) {
  console.log('📝 Rascunhos por espaço de trabalho...')

  const projectKeys = new Set(DEMO_PROJECTS.map((p) => p.key))
  const projectNames = Object.fromEntries(
    DEMO_PROJECTS.map((p) => [p.key, p.name])
  ) as Record<string, string>

  const projects = await prisma.project.findMany({
    where: { name: { in: Object.values(projectNames) } },
    select: { id: true, name: true },
  })

  const projectIdByKey: Record<string, string> = {}
  for (const [key, name] of Object.entries(projectNames)) {
    const row = projects.find((p) => p.name === name)
    if (row) projectIdByKey[key] = row.id
  }

  if (Object.keys(projectIdByKey).length === 0) {
    console.log('   Nenhum projeto demo — rode seed industrial primeiro')
    return { drafts: 0, workspaces: 0 }
  }

  const projectIds = Object.values(projectIdByKey)
  await prisma.task.deleteMany({
    where: {
      projectId: { in: projectIds },
      status: TaskStatus.DRAFT,
    },
  })

  const teamUsers = await prisma.user.findMany({
    where: { email: { in: DEMO_TEAM.map((t) => t.email) } },
    select: { id: true, email: true },
  })
  const userByEmail = Object.fromEntries(teamUsers.map((u) => [u.email, u.id]))

  const defaultAssignees = teamUsers.map((u) => u.id)
  let draftCount = 0
  let workspaceCount = 0

  for (const ws of DEMO_WORKSPACE_DRAFTS) {
    const workspaceMeta = DEMO_WORKSPACES.find((w) => w.slug === ws.workspaceSlug)
    if (!workspaceMeta) continue

    const workspace = await prisma.workspace.findFirst({
      where: { slug: ws.workspaceSlug },
    })
    if (!workspace) {
      console.log(`   Espaço não encontrado: ${ws.workspaceSlug}`)
      continue
    }

    workspaceCount++
    let orderInWorkspace = 0

    for (const draft of ws.drafts) {
      if (!projectKeys.has(draft.projectKey)) continue
      const projectId = projectIdByKey[draft.projectKey]
      if (!projectId) continue

      const order =
        (await prisma.task.count({ where: { projectId } })) + 1 + orderInWorkspace
      orderInWorkspace++

      const assigneeId = draft.assigneeEmail
        ? userByEmail[draft.assigneeEmail] ??
          defaultAssignees[orderInWorkspace % defaultAssignees.length]
        : defaultAssignees[orderInWorkspace % defaultAssignees.length]

      await prisma.task.create({
        data: {
          title: draft.title,
          description: draft.description,
          status: TaskStatus.DRAFT,
          priority: draft.priority,
          projectId,
          assigneeId: assigneeId ?? null,
          order,
          storyPoints: draft.priority === 'URGENT' ? 5 : draft.priority === 'HIGH' ? 3 : 2,
          updatedAt: daysAgo(orderInWorkspace % 5),
          createdAt: daysAgo(3 + (orderInWorkspace % 7)),
        },
      })
      draftCount++
    }

    console.log(`   ${workspaceMeta.icon ?? ''} ${workspaceMeta.name}: ${ws.drafts.length} rascunhos`)
  }

  return { drafts: draftCount, workspaces: workspaceCount }
}
