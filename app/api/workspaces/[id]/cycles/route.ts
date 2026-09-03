import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { mapWorkspace, workspaceInclude } from '@/lib/workspace-utils'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
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
    if (projectIds.length === 0) {
      return NextResponse.json({ sprints: [], workspace: mapWorkspace(workspace) })
    }

    const sprints = await prisma.sprint.findMany({
      where: {
        isArchived: false,
        projects: { some: { projectId: { in: projectIds } } },
      },
      include: {
        projects: {
          include: {
            project: {
              select: {
                id: true,
                name: true,
                client: { select: { id: true, name: true } },
              },
            },
          },
        },
        tasks: {
          select: {
            id: true,
            title: true,
            status: true,
            storyPoints: true,
            projectId: true,
            dueDate: true,
          },
        },
      },
      orderBy: [{ status: 'asc' }, { startDate: 'desc' }],
    })

    return NextResponse.json({
      workspace: mapWorkspace(workspace),
      sprints,
    })
  } catch (error) {
    console.error('Erro ao buscar ciclos do workspace:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
