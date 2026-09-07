'use client'

import { useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { PRESENCE_HEARTBEAT_MS } from '@/lib/presence/constants'

export function usePresenceHeartbeat(source: 'web' | 'call' = 'web') {
  const { data: session } = useSession()
  const sourceRef = useRef(source)
  sourceRef.current = source

  useEffect(() => {
    if (!session?.user?.id) return

    let active = true

    const ping = async () => {
      if (!active) return
      try {
        await fetch('/api/presence/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source: sourceRef.current }),
          keepalive: true,
        })
      } catch {
        // rede instável — próximo tick tenta de novo
      }
    }

    const leave = () => {
      const payload = JSON.stringify({})
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/presence/leave', payload)
      } else {
        fetch('/api/presence/leave', { method: 'POST', keepalive: true }).catch(() => {})
      }
    }

    ping()
    const interval = setInterval(ping, PRESENCE_HEARTBEAT_MS)
    window.addEventListener('beforeunload', leave)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') ping()
    })

    return () => {
      active = false
      clearInterval(interval)
      window.removeEventListener('beforeunload', leave)
      leave()
    }
  }, [session?.user?.id])
}
