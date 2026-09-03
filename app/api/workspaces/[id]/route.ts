import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { mapWorkspace, slugifyWorkspace, workspaceInclude } from '@/lib/workspace-utils'

type Params = { params: Promise<{ id: string }> }

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: NextResponse.json({ error: 'Não autorizado' }, { status: 401 }) }
  if (session.user.role !== 'ADMIN') {
    return { error: NextResponse.json({ error: 'Permissão insuficiente' }, { status: 403 }) }
  }
  return { session }
}

async function findWorkspace(idOrSlug: string) {
  return prisma.workspace.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    include: workspaceInclude,
  })
}

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = await params
    const workspace = await findWorkspace(id)
    if (!workspace) {
      return NextResponse.json({ error: 'Espaço não encontrado' }, { status: 404 })
    }

    return NextResponse.json(mapWorkspace(workspace))
  } catch (error) {
    console.error('Erro ao buscar workspace:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const auth = await requireAdmin()
    if ('error' in auth && auth.error) return auth.error

    const { id } = await params
    const existing = await findWorkspace(id)
    if (!existing) {
      return NextResponse.json({ error: 'Espaço não encontrado' }, { status: 404 })
    }

    const body = await request.json()
    let slug = existing.slug
    if (body.slug) {
      slug = slugifyWorkspace(String(body.slug))
      const conflict = await prisma.workspace.findFirst({
        where: { slug, NOT: { id: existing.id } },
      })
      if (conflict) {
        return NextResponse.json({ error: 'Slug já em uso' }, { status: 409 })
      }
    }

    const projectIds: string[] | undefined = Array.isArray(body.projectIds)
      ? body.projectIds.filter((v: unknown) => typeof v === 'string')
      : undefined

    const workspace = await prisma.$transaction(async (tx) => {
      await tx.workspace.update({
        where: { id: existing.id },
        data: {
          ...(body.name !== undefined && { name: String(body.name).trim() }),
          slug,
          ...(body.icon !== undefined && { icon: body.icon ? String(body.icon) : null }),
          ...(body.description !== undefined && {
            description: body.description ? String(body.description) : null,
          }),
          ...(body.sortOrder !== undefined && { sortOrder: Number(body.sortOrder) || 0 }),
        },
      })

      if (projectIds) {
        await tx.workspaceProject.deleteMany({ where: { workspaceId: existing.id } })
        if (projectIds.length > 0) {
          await tx.workspaceProject.createMany({
            data: projectIds.map((projectId, index) => ({
              workspaceId: existing.id,
              projectId,
              sortOrder: index,
            })),
          })
        }
      }

      return tx.workspace.findUniqueOrThrow({
        where: { id: existing.id },
        include: workspaceInclude,
      })
    })

    return NextResponse.json(mapWorkspace(workspace))
  } catch (error) {
    console.error('Erro ao atualizar workspace:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const auth = await requireAdmin()
    if ('error' in auth && auth.error) return auth.error

    const { id } = await params
    const existing = await findWorkspace(id)
    if (!existing) {
      return NextResponse.json({ error: 'Espaço não encontrado' }, { status: 404 })
    }

    await prisma.workspace.delete({ where: { id: existing.id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Erro ao excluir workspace:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
