/**
 * Popula demo OTIMIZE AUTOMAÇÃO INDUSTRIAL (clientes, projetos, espaços, finanças).
 * Uso: npx tsx scripts/seed-industrial-automation-demo.ts
 */
import { PrismaClient, UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'
import {
  DEMO_CLIENTS,
  DEMO_COMPANY,
  DEMO_PROJECTS,
  DEMO_TEAM,
  DEMO_WORKSPACES,
} from './data/industrial-automation-demo'
import { seedIndustrialWorkspaceDrafts } from './lib/seed-industrial-drafts'
import { seedIndustrialTeamChat } from './lib/seed-industrial-team-chat'
import { seedIndustrialFinancial } from './lib/seed-industrial-financial'

const prisma = new PrismaClient()

function token(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

async function resetBusinessData() {
  console.log('🧹 Limpando dados de negócio (mantém admin)...')

  await prisma.taskChecklistItem.deleteMany()
  await prisma.taskChecklistGroup.deleteMany()
  await prisma.timeEntry.deleteMany()
  await prisma.timerEvent.deleteMany()
  await prisma.comment.deleteMany()
  await prisma.task.deleteMany()
  await prisma.milestone.deleteMany()
  await prisma.financialAttachment.deleteMany()
  await prisma.financialEntry.deleteMany()
  await prisma.paymentProject.deleteMany()
  await prisma.paymentReminderSendLog.deleteMany()
  await prisma.payment.deleteMany()
  await prisma.expenseBill.deleteMany()
  await prisma.subscriptionReminderSendLog.deleteMany()
  await prisma.subscriptionReminderTemplateRecipient.deleteMany()
  await prisma.subscriptionGroupReminderTemplate.deleteMany()
  await prisma.clientSubscription.deleteMany()
  await prisma.subscription.deleteMany()
  await prisma.subscriptionGroup.deleteMany()
  await prisma.workspaceProject.deleteMany()
  await prisma.workspace.deleteMany()
  await prisma.projectTeam.deleteMany()
  await prisma.projectClient.deleteMany()
  await prisma.projectFile.deleteMany()
  await prisma.sprintProject.deleteMany()
  await prisma.sprint.deleteMany()
  await prisma.proposal.deleteMany()
  await prisma.project.deleteMany()
  await prisma.client.deleteMany()

  await prisma.user.deleteMany({
    where: {
      email: { in: DEMO_TEAM.map((u) => u.email) },
    },
  })

  console.log('   OK')
}

async function ensureAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL || 'business.gabrielferreira@gmail.com'
  const admin = await prisma.user.findUnique({ where: { email } })
  if (!admin) {
    throw new Error(`Admin ${email} não encontrado — rode db:seed primeiro`)
  }
  await prisma.user.update({
    where: { id: admin.id },
    data: { name: DEMO_COMPANY.adminName },
  })
  return admin
}

async function seedTeam() {
  console.log('👥 Equipe OTIMIZE...')
  const users: Record<string, string> = {}
  for (const member of DEMO_TEAM) {
    const hash = await bcrypt.hash(member.password, 12)
    const user = await prisma.user.create({
      data: {
        email: member.email,
        name: member.name,
        password: hash,
        role: member.role,
      },
    })
    users[member.email] = user.id
  }
  return users
}

async function seedClients() {
  console.log('🏭 Clientes industriais...')
  const clients: Record<string, string> = {}
  for (const c of DEMO_CLIENTS) {
    const client = await prisma.client.create({
      data: {
        name: c.name,
        company: c.company,
        email: c.email,
        phone: c.phone,
        accessToken: token('client'),
      },
    })
    clients[c.key] = client.id
  }
  return clients
}

async function seedProjects(
  clients: Record<string, string>,
  teamIds: string[],
  adminId: string
) {
  console.log('📋 Projetos e pipeline...')
  const projects: Record<string, string> = {}
  const assignees = [...teamIds, adminId]

  for (const p of DEMO_PROJECTS) {
    const clientId = clients[p.clientKey]
    if (!clientId) continue

    const project = await prisma.project.create({
      data: {
        name: p.name,
        description: p.description,
        status: p.status,
        budget: p.budget,
        startDate: daysAgo(90),
        endDate: p.status === 'COMPLETED' ? daysAgo(7) : null,
        clientId,
        team: {
          create: [{ userId: adminId }],
        },
      },
    })
    projects[p.key] = project.id

    const milestoneIds: string[] = []
    for (let mi = 0; mi < p.milestones.length; mi++) {
      const m = p.milestones[mi]
      const milestone = await prisma.milestone.create({
        data: {
          name: m.name,
          status: m.status,
          order: mi + 1,
          projectId: project.id,
          dueDate: daysAgo(-30 + mi * 15),
          completedAt: m.status === 'COMPLETED' ? daysAgo(20 - mi * 3) : null,
        },
      })
      milestoneIds.push(milestone.id)
    }

    const activeMilestone =
      milestoneIds[
        p.milestones.findIndex((m) => m.status === 'IN_PROGRESS') >= 0
          ? p.milestones.findIndex((m) => m.status === 'IN_PROGRESS')
          : 0
      ] ?? null

    for (const t of p.tasks) {
      await createTask(project.id, activeMilestone, t, assignees)
    }
  }

  return projects
}

async function createTask(
  projectId: string,
  milestoneId: string | null,
  t: (typeof DEMO_PROJECTS)[0]['tasks'][0],
  assignees: string[]
) {
  const order =
    (await prisma.task.count({ where: { projectId } })) + 1
  await prisma.task.create({
    data: {
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      projectId,
      milestoneId,
      assigneeId: assignees[order % assignees.length],
      order,
      storyPoints: t.priority === 'URGENT' ? 5 : t.priority === 'HIGH' ? 3 : 2,
      dueDate: t.status === 'COMPLETED' ? daysAgo(5) : daysAgo(-14),
      completedAt: t.status === 'COMPLETED' ? daysAgo(3) : null,
    },
  })
}

async function seedWorkspaces(projects: Record<string, string>) {
  console.log('🗂️ Espaços (pipelines descentralizados)...')
  for (let i = 0; i < DEMO_WORKSPACES.length; i++) {
    const ws = DEMO_WORKSPACES[i]
    const workspace = await prisma.workspace.create({
      data: {
        name: ws.name,
        slug: ws.slug,
        description: ws.description,
        icon: ws.icon ?? null,
        sortOrder: i,
      },
    })

    let sort = 0
    for (const key of ws.projectKeys) {
      const projectId = projects[key]
      if (!projectId) continue
      await prisma.workspaceProject.create({
        data: {
          workspaceId: workspace.id,
          projectId,
          sortOrder: sort++,
        },
      })
    }
  }
}

async function main() {
  console.log(`\n🏭 Seed demo — ${DEMO_COMPANY.name}\n`)

  const admin = await ensureAdmin()
  await resetBusinessData()
  await seedTeam()
  const clients = await seedClients()
  const teamIds = (
    await prisma.user.findMany({
      where: { email: { in: DEMO_TEAM.map((t) => t.email) } },
      select: { id: true },
    })
  ).map((u) => u.id)
  const projects = await seedProjects(clients, teamIds, admin.id)
  await seedWorkspaces(projects)
  await seedIndustrialWorkspaceDrafts(prisma)
  await seedIndustrialTeamChat(prisma)
  await seedIndustrialFinancial(prisma)

  console.log('\n✅ Demo OTIMIZE pronta!')
  console.log(`   Empresa: ${DEMO_COMPANY.name}`)
  console.log(`   Espaços: ${DEMO_WORKSPACES.map((w) => w.name).join(' · ')}`)
  console.log(`   Clientes: ${DEMO_CLIENTS.length} · Projetos: ${DEMO_PROJECTS.length}`)
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
