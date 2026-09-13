'use client'

import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import type { CallSessionInfo } from '@/contexts/CallSessionContext'

type CallCtx = {
  startSession: (info: CallSessionInfo) => void
} | null | undefined

export function roomIdFromCallPath(path: string) {
  const match = path.match(/\/team\/call\/([^/?#]+)/)
  return match?.[1] ?? null
}

export function navigateToCall(
  router: AppRouterInstance,
  callCtx: CallCtx,
  path: string,
  info: CallSessionInfo
) {
  callCtx?.startSession(info)
  router.push(path)
}
