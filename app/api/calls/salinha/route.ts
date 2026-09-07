import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildRoomName, isLiveKitConfigured } from '@/lib/call/livekit'

export const SALINHA_LINK_TITLE = 'Salinha Link System'

/** Entra na salinha permanente — reutiliza sala ativa ou cria uma nova. */
export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    let room = await prisma.callRoom.findFirst({
      where: { title: SALINHA_LINK_TITLE, endedAt: null },
      orderBy: { startedAt: 'asc' },
    })

    if (!room) {
      room = await prisma.callRoom.create({
        data: {
          roomName: buildRoomName('salinha-link'),
          title: SALINHA_LINK_TITLE,
          type: 'video',
          createdById: session.user.id,
        },
      })
    }

    return NextResponse.json({
      room,
      joinPath: `/team/call/${room.id}`,
      livekitConfigured: isLiveKitConfigured(),
    })
  } catch (error) {
    console.error('calls salinha POST:', error)
    return NextResponse.json({ error: 'Erro ao abrir salinha' }, { status: 500 })
  }
}
