import { PrismaClient, ProjectStatus } from '@prisma/client'
import {
  DEMO_MKT_CLIENT,
  DEMO_MKT_PROJECT,
  DEMO_MKT_SPRINTS,
} from '../data/industrial-automation-mkt'

function token(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function addDays(base: Date, days: number) {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return d
}

export async function ensureMktProject(
  prisma: PrismaClient,
  adminId: string
): Promise<string> {
  let client = await prisma.client.findFirst({
    where: { email: DEMO_MKT_CLIENT.email },
  })

  if (!client) {
    client = await prisma.client.create({
      data: {
        name: DEMO_MKT_CLIENT.name,
        company: DEMO_MKT_CLIENT.company,
        email: DEMO_MKT_CLIENT.email,
        phone: DEMO_MKT_CLIENT.phone,
        accessToken: token('client'),
      },
    })
  }

  let project = await prisma.project.findFirst({
    where: { name: DEMO_MKT_PROJECT.name },
  })

  if (!project) {
    project = await prisma.project.create({
      data: {
        name: DEMO_MKT_PROJECT.name,
        description: DEMO_MKT_PROJECT.description,
        status: DEMO_MKT_PROJECT.status as ProjectStatus,
        budget: DEMO_MKT_PROJECT.budget,
        startDate: addDays(new Date(), -60),
        clientId: client.id,
        team: { create: [{ userId: adminId }] },
      },
    })
  }

  return project.id
}

export async function seedIndustrialMktSprints(
  prisma: PrismaClient,
  projectId: string,
  adminId: string,
  teamIds: string[]
): Promise<number> {
  console.log('📣 Sprints de Marketing...')
  const assignees = [adminId, ...teamIds]
  let created = 0
  const now = new Date()

  for (const sprint of DEMO_MKT_SPRINTS) {
    const existing = await prisma.sprint.findFirst({
      where: { name: sprint.name },
    })
    if (existing) continue

    const startDate =
      sprint.startDaysAgo !== undefined
        ? addDays(now, -sprint.startDaysAgo)
        : addDays(now, sprint.startDaysFromStart ?? 0)
    const endDate = addDays(startDate, sprint.endDaysFromStart)

    const row = await prisma.sprint.create({
      data: {
        name: sprint.name,
        description: sprint.description,
        status: sprint.status,
        startDate,
        endDate,
        goal: sprint.goal,
        capacity: sprint.capacity,
        projects: {
          create: [{ projectId }],
        },
      },
    })
    created++

    for (let i = 0; i < sprint.tasks.length; i++) {
      const t = sprint.tasks[i]
      await prisma.task.create({
        data: {
          title: t.title,
          description: t.description,
          status: t.status,
          priority: t.priority,
          projectId,
          sprintId: row.id,
          assigneeId: assignees[i % assignees.length],
          order: i + 1,
          storyPoints: 2,
          dueDate: addDays(endDate, -2),
          completedAt: t.status === 'COMPLETED' ? addDays(now, -2) : null,
        },
      })
    }
  }

  console.log(`   ${created} sprints MKT criadas`)
  return created
}

export async function appendIndustrialMktSprints(prisma: PrismaClient) {
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'business.gabrielferreira@gmail.com'
  const admin = await prisma.user.findUnique({ where: { email: adminEmail } })
  if (!admin) throw new Error(`Admin ${adminEmail} não encontrado`)

  const teamIds = (
    await prisma.user.findMany({
      where: { email: { endsWith: '@otimize-automacao.demo' } },
      select: { id: true },
    })
  ).map((u) => u.id)

  const projectId = await ensureMktProject(prisma, admin.id)
  const sprintsCreated = await seedIndustrialMktSprints(
    prisma,
    projectId,
    admin.id,
    teamIds
  )

  return { projectId, sprintsCreated }
}
