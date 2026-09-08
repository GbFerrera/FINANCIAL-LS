'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react'

type OfficeSessionContextValue = {
  active: boolean
  iframeSrc: string | null
  pipMinimized: boolean
  startSession: (src: string) => void
  endSession: () => void
  setPipMinimized: (value: boolean) => void
  registerHost: (el: HTMLElement | null) => void
  hostEl: HTMLElement | null
}

const OfficeSessionContext = createContext<OfficeSessionContextValue | null>(null)

export function OfficeSessionProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState(false)
  const [iframeSrc, setIframeSrc] = useState<string | null>(null)
  const [pipMinimized, setPipMinimized] = useState(false)
  const [hostEl, setHostEl] = useState<HTMLElement | null>(null)
  const srcLockedRef = useRef<string | null>(null)

  const startSession = useCallback((src: string) => {
    if (!src) return
    setActive(true)
    setPipMinimized(false)
    if (!srcLockedRef.current) {
      srcLockedRef.current = src
      setIframeSrc(src)
    }
  }, [])

  const endSession = useCallback(() => {
    setActive(false)
    setIframeSrc(null)
    setPipMinimized(false)
    srcLockedRef.current = null
  }, [])

  const registerHost = useCallback((el: HTMLElement | null) => {
    setHostEl(el)
  }, [])

  const value = useMemo(
    () => ({
      active,
      iframeSrc,
      pipMinimized,
      startSession,
      endSession,
      setPipMinimized,
      registerHost,
      hostEl,
    }),
    [active, iframeSrc, pipMinimized, startSession, endSession, registerHost, hostEl]
  )

  return (
    <OfficeSessionContext.Provider value={value}>{children}</OfficeSessionContext.Provider>
  )
}

export function useOfficeSession() {
  const ctx = useContext(OfficeSessionContext)
  if (!ctx) {
    throw new Error('useOfficeSession deve ser usado dentro de OfficeSessionProvider')
  }
  return ctx
}

export function useOfficeSessionOptional() {
  return useContext(OfficeSessionContext)
}
