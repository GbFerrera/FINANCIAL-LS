import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params
    const room = await prisma.callRoom.findUnique({
      where: { id: roomId },
      include: {
        createdBy: { select: { id: true, name: true, avatar: true } },
      },
    })

    if (!room) {
      return NextResponse.json({ error: 'Sala não encontrada' }, { status: 404 })
    }

    return NextResponse.json({ room })
  } catch (error) {
    console.error('call room GET:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { roomId } = await params
    const room = await prisma.callRoom.findUnique({ where: { id: roomId } })
    if (!room) {
      return NextResponse.json({ error: 'Sala não encontrada' }, { status: 404 })
    }

    const body = await request.json()
    if (body?.action === 'end') {
      const updated = await prisma.callRoom.update({
        where: { id: roomId },
        data: { endedAt: new Date() },
      })
      return NextResponse.json({ room: updated })
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
  } catch (error) {
    console.error('call room PATCH:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
