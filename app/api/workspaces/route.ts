import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { mapWorkspace, slugifyWorkspace, workspaceInclude } from '@/lib/workspace-utils'

async function requireSession() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return null
  return session
}

export async function GET() {
  try {
    const session = await requireSession()
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const rows = await prisma.workspace.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: workspaceInclude,
    })

    return NextResponse.json(rows.map(mapWorkspace))
  } catch (error) {
    console.error('Erro ao listar workspaces:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession()
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Permissão insuficiente' }, { status: 403 })
    }

    const body = await request.json()
    const name = String(body.name || '').trim()
    if (!name) {
      return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
    }

    let slug = body.slug ? slugifyWorkspace(String(body.slug)) : slugifyWorkspace(name)
    const base = slug
    let n = 1
    while (await prisma.workspace.findUnique({ where: { slug } })) {
      slug = `${base}-${n++}`
    }

    const projectIds: string[] = Array.isArray(body.projectIds)
      ? body.projectIds.filter((id: unknown) => typeof id === 'string')
      : []

    const workspace = await prisma.$transaction(async (tx) => {
      const created = await tx.workspace.create({
        data: {
          name,
          slug,
          icon: body.icon ? String(body.icon) : null,
          description: body.description ? String(body.description) : null,
          sortOrder: Number(body.sortOrder) || 0,
        },
      })

      if (projectIds.length > 0) {
        await tx.workspaceProject.createMany({
          data: projectIds.map((projectId, index) => ({
            workspaceId: created.id,
            projectId,
            sortOrder: index,
          })),
        })
      }

      return tx.workspace.findUniqueOrThrow({
        where: { id: created.id },
        include: workspaceInclude,
      })
    })

    return NextResponse.json(mapWorkspace(workspace), { status: 201 })
  } catch (error) {
    console.error('Erro ao criar workspace:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
