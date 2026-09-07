'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import { LoadingScreen } from '@/components/ui/loading-animation'
import { LinkCallRoom } from '@/components/call/LinkCallRoom'
import { CallGuestJoin } from '@/components/call/CallGuestJoin'
import { Button } from '@/components/ui/button'
import { loadStoredGuestName } from '@/lib/call/guest'

type CallRoomData = {
  id: string
  title: string | null
  type: string
  endedAt: string | null
  createdById: string
}

export default function TeamCallRoomPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const roomId = params?.roomId as string
  const [room, setRoom] = useState<CallRoomData | null>(null)
  const [loading, setLoading] = useState(true)
  const [guestName, setGuestName] = useState<string | null>(null)
  const [guestReady, setGuestReady] = useState(false)
  const [leftCall, setLeftCall] = useState(false)

  const isAuthenticated = status === 'authenticated' && Boolean(session)

  useEffect(() => {
    if (!roomId) return

    fetch(`/api/calls/${roomId}`)
      .then((r) => r.json())
      .then((data) => setRoom(data.room ?? null))
      .finally(() => setLoading(false))
  }, [roomId])

  useEffect(() => {
    if (isAuthenticated) return
    const stored = loadStoredGuestName()
    if (stored) {
      setGuestName(stored)
      setGuestReady(true)
    }
  }, [isAuthenticated])

  const leave = () => {
    if (isAuthenticated) {
      router.push('/team/chat')
      return
    }
    setLeftCall(true)
  }

  const endForAll = () => {
    fetch(`/api/calls/${roomId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'end' }),
    }).catch(() => {})
    router.push('/team/chat')
  }

  if (loading || status === 'loading') return <LoadingScreen />

  if (!room) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center">
        <div>
          <p className="text-muted-foreground">Sala não encontrada ou link inválido.</p>
          {isAuthenticated ? (
            <Button className="mt-4" variant="outline" onClick={() => router.push('/team/chat')}>
              Voltar ao chat
            </Button>
          ) : null}
        </div>
      </div>
    )
  }

  if (room.endedAt) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center">
        <div>
          <p className="text-muted-foreground">Esta call já foi encerrada.</p>
          {isAuthenticated ? (
            <Button className="mt-4" onClick={() => router.push('/team/chat')}>
              Voltar às salas
            </Button>
          ) : null}
        </div>
      </div>
    )
  }

  if (leftCall) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center">
        <div>
          <p className="font-medium text-foreground">Você saiu da reunião</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Pode fechar esta aba ou entrar novamente pelo mesmo link.
          </p>
          <Button
            className="mt-4"
            onClick={() => {
              setLeftCall(false)
              if (guestName) setGuestReady(true)
            }}
          >
            Entrar de novo
          </Button>
        </div>
      </div>
    )
  }

  const isHost = isAuthenticated && room.createdById === session?.user?.id
  const canJoin = isAuthenticated || guestReady

  if (!canJoin) {
    return (
      <CallGuestJoin
        roomTitle={room.title ?? 'Reunião Link Call'}
        onJoin={(name) => {
          setGuestName(name)
          setGuestReady(true)
        }}
      />
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <LinkCallRoom
        roomId={room.id}
        roomTitle={room.title ?? 'Reunião Link Call'}
        callType={room.type === 'audio' ? 'audio' : 'video'}
        isHost={isHost}
        guestName={isAuthenticated ? undefined : guestName ?? undefined}
        isGuest={!isAuthenticated}
        onLeave={leave}
        onEndForAll={isHost ? endForAll : undefined}
      />
    </div>
  )
}
