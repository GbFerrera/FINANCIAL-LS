import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildRoomName, isLiveKitConfigured } from '@/lib/call/livekit'
import { DEFAULT_COMMS_ROOM_ID } from '@/lib/team-chat'
import { z } from 'zod'

const createSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  channelId: z.string().optional(),
  commsRoomId: z.string().min(1).default(DEFAULT_COMMS_ROOM_ID),
  projectId: z.string().optional(),
  type: z.enum(['audio', 'video']).default('video'),
})

type ActiveCallRoom = Awaited<
  ReturnType<
    typeof prisma.callRoom.findMany<{
      include: { createdBy: { select: { id: true; name: true; avatar: true } } }
    }>
  >
>[number]

/** Uma call ativa por canal (ou por título quando não há channelId). */
function dedupeActiveCallRooms(rooms: ActiveCallRoom[]): ActiveCallRoom[] {
  const seen = new Map<string, ActiveCallRoom>()
  for (const room of rooms) {
    const key = room.channelId
      ? `ch:${room.commsRoomId}:${room.channelId}`
      : `title:${room.commsRoomId}:${(room.title ?? '').trim().toLowerCase()}`
    if (!seen.has(key)) seen.set(key, room)
  }
  return Array.from(seen.values())
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const commsRoomId =
      request.nextUrl.searchParams.get('commsRoomId')?.trim() || DEFAULT_COMMS_ROOM_ID

    const rooms = await prisma.callRoom.findMany({
      where: {
        endedAt: null,
        commsRoomId,
      },
      include: {
        createdBy: { select: { id: true, name: true, avatar: true } },
      },
      orderBy: { startedAt: 'desc' },
      take: 20,
    })

    return NextResponse.json({
      commsRoomId,
      rooms: dedupeActiveCallRooms(rooms),
      livekitConfigured: isLiveKitConfigured(),
    })
  } catch (error) {
    console.error('calls GET:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }

    const { title, channelId, commsRoomId, projectId, type } = parsed.data

    if (channelId) {
      const existing = await prisma.callRoom.findFirst({
        where: { channelId, commsRoomId, endedAt: null },
        orderBy: { startedAt: 'desc' },
      })
      if (existing) {
        return NextResponse.json({
          room: existing,
          joinPath: `/team/call/${existing.id}`,
          livekitConfigured: isLiveKitConfigured(),
          reused: true,
        })
      }
    }

    const roomName = buildRoomName(
      channelId ? `ch-${channelId.slice(0, 8)}` : `room-${commsRoomId.slice(0, 8)}`
    )

    const room = await prisma.callRoom.create({
      data: {
        roomName,
        title: title ?? (type === 'audio' ? 'Chamada de voz' : 'Reunião'),
        channelId,
        commsRoomId,
        projectId,
        type,
        createdById: session.user.id,
      },
    })

    return NextResponse.json({
      room,
      joinPath: `/team/call/${room.id}`,
      livekitConfigured: isLiveKitConfigured(),
    })
  } catch (error) {
    console.error('calls POST:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
