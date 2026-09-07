import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isDefaultTeamChannel } from '@/lib/team-chat'
import { z } from 'zod'

const updateChannelSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(200).nullable().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = await params
    const existing = await prisma.teamChannel.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Canal não encontrado' }, { status: 404 })
    }

    if (isDefaultTeamChannel(existing.id, existing.commsRoomId)) {
      return NextResponse.json({ error: 'Canais padrão não podem ser editados' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = updateChannelSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }

    const channel = await prisma.teamChannel.update({
      where: { id },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.description !== undefined
          ? { description: parsed.data.description }
          : {}),
      },
    })

    return NextResponse.json({
      channel: {
        id: channel.id,
        name: channel.name,
        type: channel.type,
        description: channel.description,
        unreadCount: 0,
      },
    })
  } catch (error) {
    console.error('Erro ao atualizar canal:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
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
    const existing = await prisma.teamChannel.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Canal não encontrado' }, { status: 404 })
    }

    if (isDefaultTeamChannel(existing.id, existing.commsRoomId)) {
      return NextResponse.json({ error: 'Canais padrão não podem ser excluídos' }, { status: 403 })
    }

    await prisma.teamChannel.delete({ where: { id } })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Erro ao excluir canal:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
