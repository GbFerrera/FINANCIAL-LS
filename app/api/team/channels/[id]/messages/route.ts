import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { serializeTeamMessage } from '@/lib/team-chat'
import { broadcastTeamChatMessage } from '@/lib/team-chat-socket-server'
import { z } from 'zod'

const attachmentSchema = z.object({
  originalName: z.string().min(1),
  fileName: z.string().min(1),
  filePath: z.string().min(1),
  fileUrl: z.string().min(1),
  fileSize: z.number().int().positive(),
  mimeType: z.string().min(1),
})

const messageSchema = z.object({
  content: z.string().max(8000).optional().default(''),
  type: z.enum(['TEXT', 'FILE', 'IMAGE']).optional(),
  attachments: z.array(attachmentSchema).optional().default([]),
})

const messageInclude = {
  author: { select: { id: true, name: true, email: true, role: true, avatar: true } },
  attachments: true,
} as const

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id: channelId } = await params
    const channel = await prisma.teamChannel.findUnique({ where: { id: channelId } })
    if (!channel) {
      return NextResponse.json({ error: 'Canal não encontrado' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const before = searchParams.get('before')
    const limit = Math.min(Number(searchParams.get('limit') ?? 50), 100)

    const messages = await prisma.teamChannelMessage.findMany({
      where: {
        channelId,
        ...(before ? { createdAt: { lt: new Date(before) } } : {}),
      },
      include: messageInclude,
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    const ordered = messages.reverse().map(serializeTeamMessage)

    return NextResponse.json({ messages: ordered })
  } catch (error) {
    console.error('Erro ao buscar mensagens:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
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

    const { id: channelId } = await params
    const channel = await prisma.teamChannel.findUnique({ where: { id: channelId } })
    if (!channel) {
      return NextResponse.json({ error: 'Canal não encontrado' }, { status: 404 })
    }

    const body = await request.json()
    const parsed = messageSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }

    const content = parsed.data.content?.trim() ?? ''
    const attachments = parsed.data.attachments ?? []

    if (!content && attachments.length === 0) {
      return NextResponse.json({ error: 'Mensagem vazia' }, { status: 400 })
    }

    let type = parsed.data.type ?? 'TEXT'
    if (attachments.length > 0) {
      const allImages = attachments.every((a) => a.mimeType.startsWith('image/'))
      type = allImages && !content ? 'IMAGE' : attachments.some((a) => a.mimeType.startsWith('image/')) ? 'IMAGE' : 'FILE'
    }

    const created = await prisma.teamChannelMessage.create({
      data: {
        channelId,
        authorId: session.user.id,
        content,
        type,
        attachments: {
          create: attachments.map((a) => ({
            originalName: a.originalName,
            fileName: a.fileName,
            filePath: a.filePath,
            fileUrl: a.fileUrl,
            fileSize: a.fileSize,
            mimeType: a.mimeType,
          })),
        },
      },
      include: messageInclude,
    })

    const message = serializeTeamMessage(created)

    await broadcastTeamChatMessage({
      action: 'created',
      channelId,
      message,
    })

    return NextResponse.json({ message })
  } catch (error) {
    console.error('Erro ao criar mensagem:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
