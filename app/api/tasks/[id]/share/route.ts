import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  buildTaskAgentApiUrl,
  buildTaskShareUrl,
  disableTaskShare,
  enableTaskShare,
} from '@/lib/task-share'

async function assertTaskAccess(taskId: string, userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  })
  const isAdmin = user?.role === 'ADMIN'

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      project: { include: { team: true } },
    },
  })

  if (!task) {
    return { error: NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 }) }
  }

  const isProjectMember = task.project.team.some((m) => m.userId === userId)
  if (!isAdmin && !isProjectMember) {
    return { error: NextResponse.json({ error: 'Sem permissão' }, { status: 403 }) }
  }

  return { task }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = await params
    const access = await assertTaskAccess(id, session.user.id)
    if (access.error) return access.error

    const task = await prisma.task.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        shareToken: true,
        shareEnabled: true,
      },
    })

    const origin = process.env.NEXTAUTH_URL || ''
    const shareUrl = task?.shareEnabled && task.shareToken
      ? buildTaskShareUrl(task.shareToken, origin)
      : null
    const agentApiUrl = task?.shareEnabled && task.shareToken
      ? buildTaskAgentApiUrl(task.shareToken, origin)
      : null

    return NextResponse.json({
      shareEnabled: Boolean(task?.shareEnabled),
      shareToken: task?.shareToken || null,
      shareUrl,
      agentApiUrl,
    })
  } catch (error) {
    console.error('Erro ao buscar share da task:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = await params
    const access = await assertTaskAccess(id, session.user.id)
    if (access.error) return access.error

    const body = await request.json().catch(() => ({}))
    const action = body.action === 'disable' ? 'disable' : 'enable'

    const updated = action === 'disable'
      ? await disableTaskShare(id)
      : await enableTaskShare(id)

    if (!updated) {
      return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 })
    }

    const origin = process.env.NEXTAUTH_URL || request.nextUrl.origin
    const shareUrl = updated.shareEnabled && updated.shareToken
      ? buildTaskShareUrl(updated.shareToken, origin)
      : null
    const agentApiUrl = updated.shareEnabled && updated.shareToken
      ? buildTaskAgentApiUrl(updated.shareToken, origin)
      : null

    return NextResponse.json({
      message: action === 'disable' ? 'Link desativado' : 'Link gerado com sucesso',
      shareEnabled: updated.shareEnabled,
      shareToken: updated.shareToken,
      shareUrl,
      agentApiUrl,
    })
  } catch (error) {
    console.error('Erro ao gerar share da task:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = await params
    const access = await assertTaskAccess(id, session.user.id)
    if (access.error) return access.error

    const updated = await disableTaskShare(id)
    return NextResponse.json({
      message: 'Link desativado',
      shareEnabled: updated.shareEnabled,
    })
  } catch (error) {
    console.error('Erro ao revogar share da task:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
