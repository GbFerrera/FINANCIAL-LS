'use client'

import { usePresenceHeartbeat } from '@/hooks/usePresenceHeartbeat'

/** Monta heartbeat de presença em qualquer página autenticada. */
export function PresenceTracker() {
  usePresenceHeartbeat('web')
  return null
}
