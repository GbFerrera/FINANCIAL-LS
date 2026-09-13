'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'

export type CallSessionInfo = {
  roomId: string
  roomTitle: string
  callType: 'audio' | 'video'
}

export type CallParticipant = {
  id: string
  name: string
  avatar?: string | null
}

type CallSessionContextValue = {
  active: boolean
  session: CallSessionInfo | null
  participants: CallParticipant[]
  pipMinimized: boolean
  startSession: (info: CallSessionInfo) => void
  endSession: () => void
  setPipMinimized: (value: boolean) => void
  setParticipants: (participants: CallParticipant[]) => void
  registerHost: (el: HTMLElement | null) => void
  hostEl: HTMLElement | null
}

const CallSessionContext = createContext<CallSessionContextValue | null>(null)

export function CallSessionProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState(false)
  const [session, setSession] = useState<CallSessionInfo | null>(null)
  const [pipMinimized, setPipMinimized] = useState(false)
  const [participants, setParticipants] = useState<CallParticipant[]>([])
  const [hostEl, setHostEl] = useState<HTMLElement | null>(null)
  const startSession = useCallback((info: CallSessionInfo) => {
    if (!info.roomId) return
    setActive(true)
    setPipMinimized(false)
    setSession(info)
  }, [])

  const endSession = useCallback(() => {
    setActive(false)
    setSession(null)
    setPipMinimized(false)
    setParticipants([])
    setHostEl(null)
  }, [])

  const registerHost = useCallback((el: HTMLElement | null) => {
    setHostEl((prev) => (prev === el ? prev : el))
  }, [])

  const value = useMemo(
    () => ({
      active,
      session,
      participants,
      pipMinimized,
      startSession,
      endSession,
      setPipMinimized,
      setParticipants,
      registerHost,
      hostEl,
    }),
    [
      active,
      session,
      participants,
      pipMinimized,
      startSession,
      endSession,
      registerHost,
      hostEl,
    ]
  )

  return <CallSessionContext.Provider value={value}>{children}</CallSessionContext.Provider>
}

export function useCallSessionOptional() {
  return useContext(CallSessionContext)
}
