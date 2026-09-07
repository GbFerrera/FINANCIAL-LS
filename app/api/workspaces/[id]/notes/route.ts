import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { mapWorkspace, workspaceInclude } from '@/lib/workspace-utils'
import type { NoteVisibility, Prisma } from '@prisma/client'

type Params = { params: Promise<{ id: string }> }

const noteInclude = {
  project: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true, email: true, image: true } },
  access: {
    include: { user: { select: { id: true, name: true, email: true } } },
  },
} as const

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = await params
    const workspace = await prisma.workspace.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      include: workspaceInclude,
    })
    if (!workspace) {
      return NextResponse.json({ error: 'Espaço não encontrado' }, { status: 404 })
    }

    const projectIds = workspace.projects.map((p) => p.projectId)
    const workspaceProjectIdSet = new Set(projectIds)
    if (projectIds.length === 0) {
      return NextResponse.json({ notes: [], workspace: mapWorkspace(workspace) })
    }

    const { searchParams } = new URL(request.url)
    const tabParam = searchParams.get('tab')
    const tab =
      tabParam === 'private' ? 'private' : tabParam === 'public' ? 'public' : 'all'
    const q = searchParams.get('q')?.trim() || ''
    const projectIdParam = searchParams.get('projectId') || undefined
    const projectId =
      projectIdParam && workspaceProjectIdSet.has(projectIdParam) ? projectIdParam : undefined

    const isAdmin = session.user.role === 'ADMIN'
    let teamProjectIds = projectIds

    if (!isAdmin) {
      const memberships = await prisma.projectTeam.findMany({
        where: { userId: session.user.id, projectId: { in: projectIds } },
        select: { projectId: true },
      })
      teamProjectIds = memberships.map((m) => m.projectId)
    }

    const scopedProjectIds = projectId ? [projectId] : projectIds

    const where: Prisma.NoteWhereInput = {
      projectId: { in: scopedProjectIds },
      ...(q ? { title: { contains: q, mode: 'insensitive' } } : {}),
    }

    if (tab === 'public') {
      where.visibility = 'PUBLIC'
      if (!isAdmin) {
        const publicProjectIds = scopedProjectIds.filter((id) => teamProjectIds.includes(id))
        if (publicProjectIds.length === 0) {
          return NextResponse.json({ notes: [], workspace: mapWorkspace(workspace) })
        }
        where.projectId = { in: publicProjectIds }
      }
    } else if (tab === 'private') {
      where.visibility = 'PRIVATE'
      if (!isAdmin) {
        where.createdById = session.user.id
      }
    } else {
      // Todas as anotações visíveis neste espaço (projetos do workspace)
      if (!isAdmin) {
        where.OR = [
          {
            visibility: 'PUBLIC',
            projectId: { in: scopedProjectIds.filter((id) => teamProjectIds.includes(id)) },
          },
          {
            visibility: 'PRIVATE',
            createdById: session.user.id,
            projectId: { in: scopedProjectIds },
          },
          {
            access: { some: { userId: session.user.id } },
            projectId: { in: scopedProjectIds },
          },
        ]
      }
    }

    let notes = await prisma.note.findMany({
      where,
      include: noteInclude,
      orderBy: { updatedAt: 'desc' },
    })

    // Garantia: só projetos deste espaço
    notes = notes.filter((note) => workspaceProjectIdSet.has(note.projectId))

    return NextResponse.json({
      workspace: mapWorkspace(workspace),
      notes,
    })
  } catch (error) {
    console.error('Erro ao buscar anotações do workspace:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = await params
    const workspace = await prisma.workspace.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      include: workspaceInclude,
    })
    if (!workspace) {
      return NextResponse.json({ error: 'Espaço não encontrado' }, { status: 404 })
    }

    const projectIds = new Set(workspace.projects.map((p) => p.projectId))
    const body = (await request.json()) as {
      title?: string
      content?: string
      projectId?: string
      visibility?: NoteVisibility
    }

    if (!body.title?.trim() || !body.projectId) {
      return NextResponse.json({ error: 'Título e projeto são obrigatórios' }, { status: 400 })
    }
    if (!projectIds.has(body.projectId)) {
      return NextResponse.json({ error: 'Projeto não pertence a este espaço' }, { status: 400 })
    }

    const visibility: NoteVisibility = body.visibility === 'PUBLIC' ? 'PUBLIC' : 'PRIVATE'

    const note = await prisma.note.create({
      data: {
        title: body.title.trim(),
        content: body.content ?? '',
        projectId: body.projectId,
        createdById: session.user.id,
        visibility,
      },
      include: noteInclude,
    })

    await prisma.noteAccess.create({
      data: { noteId: note.id, userId: session.user.id },
    })

    return NextResponse.json(note, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar anotação:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
