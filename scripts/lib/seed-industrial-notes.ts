import { NoteVisibility, PrismaClient } from '@prisma/client'
import {
  DEMO_PROJECTS,
  DEMO_PROJECT_TRAINING,
  DEMO_WORKSPACE_TRAINING,
} from '../data/industrial-automation-demo'

export async function seedIndustrialTrainingNotes(
  prisma: PrismaClient,
  projects: Record<string, string>,
  adminId: string,
  teamIds: string[]
) {
  console.log('📝 Anotações de treinamento...')
  const accessIds = [adminId, ...teamIds]
  let created = 0

  async function upsertNote(
    projectId: string,
    title: string,
    content: string,
    visibility: NoteVisibility = NoteVisibility.PUBLIC
  ) {
    const existing = await prisma.note.findFirst({
      where: { projectId, title },
    })
    if (existing) return

    const note = await prisma.note.create({
      data: {
        title,
        content,
        visibility,
        projectId,
        createdById: adminId,
      },
    })

    await prisma.noteAccess.createMany({
      data: accessIds.map((userId) => ({ noteId: note.id, userId })),
      skipDuplicates: true,
    })
    created++
  }

  for (const ws of DEMO_WORKSPACE_TRAINING) {
    const projectId = projects[ws.projectKey]
    if (!projectId) continue
    await upsertNote(projectId, ws.title, ws.content)
  }

  for (const n of DEMO_PROJECT_TRAINING) {
    const projectId = projects[n.projectKey]
    if (!projectId) continue
    await upsertNote(
      projectId,
      n.title,
      n.content,
      n.visibility === 'PRIVATE' ? NoteVisibility.PRIVATE : NoteVisibility.PUBLIC
    )
  }

  console.log(`   ${created} anotações criadas`)
  return created
}

/** Adiciona notas sem reset — localiza projetos pelo nome (demo já existente). */
export async function appendIndustrialTrainingNotes(prisma: PrismaClient) {
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'business.gabrielferreira@gmail.com'
  const admin = await prisma.user.findUnique({ where: { email: adminEmail } })
  if (!admin) throw new Error(`Admin ${adminEmail} não encontrado`)

  const projects: Record<string, string> = {}
  for (const p of DEMO_PROJECTS) {
    const row = await prisma.project.findFirst({ where: { name: p.name } })
    if (row) projects[p.key] = row.id
  }

  const teamIds = (
    await prisma.user.findMany({
      where: { email: { endsWith: '@otimize-automacao.demo' } },
      select: { id: true },
    })
  ).map((u) => u.id)

  const count = await seedIndustrialTrainingNotes(prisma, projects, admin.id, teamIds)
  return { projectsFound: Object.keys(projects).length, notesCreated: count }
}
