'use client'

import { useEffect, useState } from 'react'

export type MemberPresence = {
  isOnline: boolean
  activeLabel: string
}

export function useTeamPresence() {
  const [presenceByUser, setPresenceByUser] = useState<Record<string, MemberPresence>>({})
  const [myActiveLabel, setMyActiveLabel] = useState('')

  useEffect(() => {
    let active = true

    const load = async () => {
      try {
        const [onlineRes, dailyRes] = await Promise.all([
          fetch('/api/presence/online'),
          fetch('/api/presence/daily'),
        ])
        if (!active) return

        const map: Record<string, MemberPresence> = {}

        if (dailyRes.ok) {
          const data = await dailyRes.json()
          setMyActiveLabel(data.myActiveLabel ?? '')
          for (const user of data.users ?? []) {
            map[user.id] = {
              isOnline: user.isOnline,
              activeLabel: user.activeLabel,
            }
          }
        }

        if (onlineRes.ok) {
          const data = await onlineRes.json()
          for (const user of data.users ?? []) {
            map[user.id] = {
              isOnline: true,
              activeLabel: user.activeLabelToday ?? map[user.id]?.activeLabel ?? '0min',
            }
          }
        }

        setPresenceByUser(map)
      } catch {
        /* ignore polling errors */
      }
    }

    load()
    const interval = setInterval(load, 60_000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [])

  const onlineCount = Object.values(presenceByUser).filter((p) => p.isOnline).length

  return { presenceByUser, myActiveLabel, onlineCount }
}
