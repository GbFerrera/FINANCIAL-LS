import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  DEFAULT_COMMS_ROOM_ID,
  getDefaultChannelsForRoom,
} from '@/lib/team-chat'
import { z } from 'zod'

async function ensureDefaultChannels(commsRoomId: string) {
  for (const channel of getDefaultChannelsForRoom(commsRoomId)) {
    await prisma.teamChannel.upsert({
      where: { id: channel.id },
      create: {
        id: channel.id,
        name: channel.name,
        description: channel.description,
        type: channel.type,
        commsRoomId,
      },
      update: {},
    })
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const commsRoomId =
      request.nextUrl.searchParams.get('commsRoomId')?.trim() || DEFAULT_COMMS_ROOM_ID

    await ensureDefaultChannels(commsRoomId)

    const channels = await prisma.teamChannel.findMany({
      where: { commsRoomId },
      orderBy: { createdAt: 'asc' },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            author: { select: { id: true, name: true, email: true, role: true, avatar: true } },
          },
        },
      },
    })

    return NextResponse.json({
      commsRoomId,
      channels: channels.map((channel) => {
        const last = channel.messages[0]
        return {
          id: channel.id,
          name: channel.name,
          type: channel.type,
          description: channel.description,
          commsRoomId: channel.commsRoomId,
          unreadCount: 0,
          lastMessage: last
            ? {
                content: last.content || (last.type === 'IMAGE' ? '📷 Imagem' : '📎 Arquivo'),
                createdAt: last.createdAt.toISOString(),
                author: last.author,
              }
            : null,
        }
      }),
    })
  } catch (error) {
    console.error('Erro ao buscar canais:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

const createChannelSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(200).optional(),
  type: z.enum(['GENERAL', 'PROJECT', 'DIRECT']).default('GENERAL'),
  commsRoomId: z.string().min(1).default(DEFAULT_COMMS_ROOM_ID),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = createChannelSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }

    const slug = parsed.data.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40)

    const id = `${slug}-${Date.now().toString(36)}`

    const channel = await prisma.teamChannel.create({
      data: {
        id,
        name: parsed.data.name,
        description: parsed.data.description,
        type: parsed.data.type,
        commsRoomId: parsed.data.commsRoomId,
      },
    })

    return NextResponse.json({
      channel: {
        id: channel.id,
        name: channel.name,
        type: channel.type,
        description: channel.description,
        commsRoomId: channel.commsRoomId,
        unreadCount: 0,
      },
    })
  } catch (error) {
    console.error('Erro ao criar canal:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
