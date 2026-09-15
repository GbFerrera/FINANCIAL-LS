import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureManagementInternalProject } from '@/lib/management-workspace'
import {
  defaultManagementSettings,
  mergeWorkspaceSettings,
  normalizeKanbanColumns,
  parseWorkspaceSettings,
} from '@/lib/workspace-settings'
import { mapWorkspace, slugifyWorkspace, workspaceInclude } from '@/lib/workspace-utils'
import {
  canManageWorkspaces,
  filterWorkspacesForUser,
  hasWorkspaceFeatureAccess,
} from '@/lib/workspace-permissions'
import { getUserPermissionsSnapshot } from '@/lib/user-permissions-server'

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

    const isAdmin = session.user.role === 'ADMIN'
    const snapshot = await getUserPermissionsSnapshot(session.user.id)
    if (!snapshot) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    if (!hasWorkspaceFeatureAccess(snapshot.allowedPaths, isAdmin)) {
      return NextResponse.json([])
    }

    const rows = await prisma.workspace.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: workspaceInclude,
    })

    const filtered = filterWorkspacesForUser(rows, snapshot.workspaceAccess, isAdmin)
    return NextResponse.json(filtered.map(mapWorkspace))
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

    const isAdmin = session.user.role === 'ADMIN'
    const snapshot = await getUserPermissionsSnapshot(session.user.id)
    if (!snapshot) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    if (!canManageWorkspaces(snapshot.workspaceAccess, isAdmin)) {
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

    const kind = body.kind === 'MANAGEMENT' ? 'MANAGEMENT' : 'DEFAULT'
    const projectIds: string[] =
      kind === 'MANAGEMENT'
        ? []
        : Array.isArray(body.projectIds)
          ? body.projectIds.filter((id: unknown) => typeof id === 'string')
          : []

    const workspace = await prisma.$transaction(async (tx) => {
      let settings: Record<string, unknown> | undefined
      if (kind === 'MANAGEMENT') {
        const initialSettings = mergeWorkspaceSettings(defaultManagementSettings(), {
          showCalendarAboveBoard:
            body.settings?.showCalendarAboveBoard !== undefined
              ? Boolean(body.settings.showCalendarAboveBoard)
              : true,
          kanbanColumns: normalizeKanbanColumns(body.settings?.kanbanColumns),
        })
        settings = initialSettings as Record<string, unknown>
      }

      const created = await tx.workspace.create({
        data: {
          name,
          slug,
          icon: body.icon ? String(body.icon) : null,
          description: body.description ? String(body.description) : null,
          kind,
          ...(settings ? { settings } : {}),
          sortOrder: Number(body.sortOrder) || 0,
        },
      })

      if (kind === 'MANAGEMENT') {
        const { projectId, settings: nextSettings } = await ensureManagementInternalProject(
          tx,
          name,
          settings
        )
        await tx.workspace.update({
          where: { id: created.id },
          data: { settings: nextSettings as object },
        })
        await tx.workspaceProject.create({
          data: { workspaceId: created.id, projectId, sortOrder: 0 },
        })
      } else if (projectIds.length > 0) {
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
