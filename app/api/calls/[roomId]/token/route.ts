import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createLiveKitToken, getLiveKitUrl, isLiveKitConfigured } from '@/lib/call/livekit'
import { isValidGuestName, normalizeGuestName } from '@/lib/call/guest'
import { z } from 'zod'

const guestTokenSchema = z.object({
  guestName: z.string().min(2).max(40),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    if (!isLiveKitConfigured()) {
      return NextResponse.json(
        {
          error: 'LiveKit não configurado',
          hint: 'Defina LIVEKIT_URL, LIVEKIT_API_KEY e LIVEKIT_API_SECRET no .env',
        },
        { status: 503 }
      )
    }

    const { roomId } = await params
    const room = await prisma.callRoom.findUnique({ where: { id: roomId } })
    if (!room || room.endedAt) {
      return NextResponse.json({ error: 'Sala não encontrada ou encerrada' }, { status: 404 })
    }

    const session = await getServerSession(authOptions)

    if (session?.user?.id) {
      const token = await createLiveKitToken(
        room.roomName,
        session.user.id,
        session.user.name ?? session.user.email ?? 'Participante'
      )

      return NextResponse.json({
        token,
        serverUrl: getLiveKitUrl(),
        roomName: room.roomName,
        identity: session.user.id,
        displayName: session.user.name,
      })
    }

    const body = await request.json().catch(() => ({}))
    const parsed = guestTokenSchema.safeParse({
      guestName: normalizeGuestName(String(body?.guestName ?? '')),
    })
    if (!parsed.success || !isValidGuestName(parsed.data.guestName)) {
      return NextResponse.json({ error: 'Informe um nome válido para entrar como convidado' }, { status: 400 })
    }

    const identity = `guest-${crypto.randomUUID()}`
    const token = await createLiveKitToken(room.roomName, identity, parsed.data.guestName)

    return NextResponse.json({
      token,
      serverUrl: getLiveKitUrl(),
      roomName: room.roomName,
      identity,
      displayName: parsed.data.guestName,
      isGuest: true,
    })
  } catch (error) {
    console.error('call token:', error)
    return NextResponse.json({ error: 'Erro ao gerar token' }, { status: 500 })
  }
}
