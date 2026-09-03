import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { read } = body

    if (typeof read !== 'boolean') {
      return NextResponse.json({ error: 'Campo "read" deve ser um boolean' }, { status: 400 })
    }

    const updated = await prisma.notification.updateMany({
      where: { id: params.id, userId: session.user.id },
      data: { isRead: read },
    })

    if (updated.count === 0) {
      return NextResponse.json({ error: 'Notificação não encontrada' }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Erro ao atualizar notificação:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const deleted = await prisma.notification.deleteMany({
      where: { id: params.id, userId: session.user.id },
    })

    if (deleted.count === 0) {
      return NextResponse.json({ error: 'Notificação não encontrada' }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Erro ao excluir notificação:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
