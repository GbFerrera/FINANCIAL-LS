import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const updated = await prisma.notification.updateMany({
      where: { id: params.id, userId: session.user.id },
      data: { isRead: true },
    })

    if (updated.count === 0) {
      return NextResponse.json({ error: 'Notificação não encontrada' }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Erro ao marcar notificação como lida:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
