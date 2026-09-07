import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const messageSchema = z.object({
  content: z.string().min(1).max(4000),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params
    const room = await prisma.callRoom.findUnique({ where: { id: roomId } })
    if (!room) {
      return NextResponse.json({ error: 'Sala não encontrada' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const after = searchParams.get('after')

    const messages = await prisma.callRoomMessage.findMany({
      where: {
        roomId,
        ...(after ? { createdAt: { gt: new Date(after) } } : {}),
      },
      include: {
        user: { select: { id: true, name: true, avatar: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    })

    return NextResponse.json({ messages })
  } catch (error) {
    console.error('call messages GET:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(
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
    if (!room || room.endedAt) {
      return NextResponse.json({ error: 'Sala não encontrada' }, { status: 404 })
    }

    const body = await request.json()
    const parsed = messageSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Mensagem inválida' }, { status: 400 })
    }

    const message = await prisma.callRoomMessage.create({
      data: {
        roomId,
        userId: session.user.id,
        content: parsed.data.content.trim(),
      },
      include: {
        user: { select: { id: true, name: true, avatar: true } },
      },
    })

    return NextResponse.json({ message })
  } catch (error) {
    console.error('call messages POST:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
