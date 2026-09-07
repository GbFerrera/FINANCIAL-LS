'use client'

import { PageLoadingGate } from '@/components/ui/loading-animation'
import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { DashboardLayout } from './dashboard-layout'
import { isPathAllowed, redirectForPath } from '@/lib/access-control'
import { useAllowedPaths } from '@/hooks/use-allowed-paths'

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || ''
  const router = useRouter()
  const { data: session, status } = useSession()
  const isAdmin = session?.user?.role === 'ADMIN'
  const { allowedPaths, loading: permissionsLoading } = useAllowedPaths(session?.user?.id)

  const excludedPrefixes = ['/auth', '/collaborator-portal', '/client-portal', '/task-portal', '/proposta']
  const isGuestCallRoom = /^\/team\/call\/[^/]+$/.test(pathname)
  const isExcluded =
    excludedPrefixes.some((prefix) => pathname.startsWith(prefix)) || isGuestCallRoom
  useEffect(() => {
    if (isExcluded) return
    if (status === 'loading') return
    if (!session) return
    if (isAdmin) return
    if (permissionsLoading || allowedPaths === null) return

    if (!isPathAllowed(pathname, allowedPaths)) {
      router.replace(redirectForPath(pathname, allowedPaths, session.user.role))
    }
  }, [
    allowedPaths,
    isAdmin,
    isExcluded,
    pathname,
    permissionsLoading,
    router,
    session,
    status,
  ])

  if (isExcluded) {
    return <>{children}</>
  }

  const permissionsReady = !session?.user?.id || (!permissionsLoading && allowedPaths !== null)
  const hasAccess =
    isAdmin ||
    (permissionsReady && allowedPaths !== null && isPathAllowed(pathname, allowedPaths))

  const gateLoading =
    status === 'loading' ||
    !permissionsReady ||
    (!isAdmin && permissionsReady && allowedPaths !== null && !hasAccess)

  return (
    <PageLoadingGate loading={gateLoading}>
      {hasAccess ? <DashboardLayout>{children}</DashboardLayout> : null}
    </PageLoadingGate>
  )
}
