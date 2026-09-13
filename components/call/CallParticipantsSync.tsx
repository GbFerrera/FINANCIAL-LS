'use client'

import { useEffect } from 'react'
import { useParticipants } from '@livekit/components-react'
import { useCallSessionOptional } from '@/contexts/CallSessionContext'

/** Espelha participantes LiveKit no contexto (sidebar estilo Discord). */
export function CallParticipantsSync() {
  const participants = useParticipants()
  const setParticipants = useCallSessionOptional()?.setParticipants

  useEffect(() => {
    if (!setParticipants) return
    setParticipants(
      participants.map((p) => ({
        id: p.identity,
        name: p.name?.trim() || p.identity,
        avatar: null,
      }))
    )
  }, [participants, setParticipants])

  return null
}
