import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { mapWorkspace, workspaceInclude } from '@/lib/workspace-utils'

type RouteParams = { params: Promise<{ id: string }> }

const taskInclude = {
  project: { select: { id: true, name: true } },
  assignee: { select: { id: true, name: true, avatar: true } },
} as const

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = await params
    const row = await prisma.workspace.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      include: workspaceInclude,
    })

    if (!row) {
      return NextResponse.json({ error: 'Espaço não encontrado' }, { status: 404 })
    }

    const workspace = mapWorkspace(row)
    const projectIds = workspace.projectIds

    if (projectIds.length === 0) {
      return NextResponse.json({ workspace, pending: [], approved: [] })
    }

    const baseWhere = {
      projectId: { in: projectIds },
      isArchived: false,
    }

    const [pending, approved] = await Promise.all([
      prisma.task.findMany({
        where: { ...baseWhere, status: 'DRAFT' },
        include: taskInclude,
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      }),
      prisma.task.findMany({
        where: {
          ...baseWhere,
          status: 'TODO',
          sprintId: null,
        },
        include: taskInclude,
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      }),
    ])

    return NextResponse.json({ workspace, pending, approved })
  } catch (error) {
    console.error('Erro ao buscar rascunhos do workspace:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
