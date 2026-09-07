'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useParticipants,
} from '@livekit/components-react'
import '@livekit/components-styles'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CallChatPanel } from './CallChatPanel'
import { CallRoomShell } from './CallRoomShell'
import { LinkVideoConference } from './LinkVideoConference'
import { usePresenceHeartbeat } from '@/hooks/usePresenceHeartbeat'

type LinkCallRoomProps = {
  roomId: string
  roomTitle: string
  callType: 'audio' | 'video'
  isHost?: boolean
  isGuest?: boolean
  guestName?: string
  onLeave: () => void
  onEndForAll?: () => void
}

function participantLabel(count: number): string {
  if (count === 0) return 'Conectando…'
  if (count === 1) return 'Só você na reunião'
  return `${count} participantes`
}

function CallRoomContent({
  roomId,
  roomTitle,
  isHost,
  isGuest,
  guestIdentity,
  onLeave,
  onEndForAll,
}: Omit<LinkCallRoomProps, 'callType' | 'guestName'> & { guestIdentity?: string }) {
  const count = useParticipants().length

  return (
    <CallRoomShell
      title={roomTitle}
      roomId={roomId}
      isHost={isHost}
      isGuest={isGuest}
      participantHint={participantLabel(count)}
      onLeave={onLeave}
      onEndForAll={onEndForAll}
      sidebar={
        <CallChatPanel
          roomId={roomId}
          className="h-full"
          guestIdentity={guestIdentity}
          readOnly={isGuest}
        />
      }
    >
      <LinkVideoConference />
      <RoomAudioRenderer />
    </CallRoomShell>
  )
}

export function LinkCallRoom(props: LinkCallRoomProps) {
  usePresenceHeartbeat('call')

  const [token, setToken] = useState<string | null>(null)
  const [serverUrl, setServerUrl] = useState<string | null>(null)
  const [guestIdentity, setGuestIdentity] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchToken = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/calls/${props.roomId}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(props.guestName ? { guestName: props.guestName } : {}),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(
          data.hint ? `${data.error}. ${data.hint}` : (data.error ?? 'Não foi possível entrar na reunião')
        )
        return
      }
      setToken(data.token)
      setServerUrl(data.serverUrl)
      if (data.identity) {
        setGuestIdentity(data.identity as string)
      }
    } catch {
      setError('Falha de rede ao conectar na reunião')
    } finally {
      setLoading(false)
    }
  }, [props.roomId, props.guestName])

  useEffect(() => {
    fetchToken()
  }, [fetchToken])

  if (loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-background p-6 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm">Entrando na reunião…</p>
      </div>
    )
  }

  if (error || !token || !serverUrl) {
    return (
      <div className="flex h-full items-center justify-center bg-background p-6">
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-center shadow-sm">
          <h3 className="font-semibold text-foreground">Reunião indisponível</h3>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <p className="mt-3 text-xs text-muted-foreground">
            Local: <code className="rounded bg-muted px-1 py-0.5">npm run call:up</code> e reinicie o dev server.
          </p>
          <Button type="button" variant="outline" className="mt-4" onClick={props.onLeave}>
            Voltar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <LiveKitRoom
      token={token}
      serverUrl={serverUrl}
      connect
      video={props.callType === 'video'}
      audio
      onDisconnected={props.onLeave}
      options={{
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
          resolution: { width: 1280, height: 720, frameRate: 24 },
        },
      }}
      data-lk-theme="default"
      className="link-call-room h-full"
      style={{ height: '100%' }}
    >
      <CallRoomContent
        roomId={props.roomId}
        roomTitle={props.roomTitle}
        isHost={props.isHost}
        isGuest={props.isGuest}
        guestIdentity={guestIdentity ?? undefined}
        onLeave={props.onLeave}
        onEndForAll={props.onEndForAll}
      />
    </LiveKitRoom>
  )
}
