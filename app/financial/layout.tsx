'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { isPathAllowed, redirectForPath } from '@/lib/access-control'
import { useAllowedPaths } from '@/hooks/use-allowed-paths'
import { PageLoadingGate } from '@/components/ui/loading-animation'

export default function FinancialLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname() || ''
  const router = useRouter()
  const { data: session, status } = useSession()
  const isAdmin = session?.user?.role === 'ADMIN'
  const { allowedPaths, loading } = useAllowedPaths(session?.user?.id)

  useEffect(() => {
    if (loading || status === 'loading' || !session || isAdmin || allowedPaths === null) return
    if (!isPathAllowed(pathname, allowedPaths)) {
      router.replace(redirectForPath(pathname, allowedPaths, session.user.role))
    }
  }, [allowedPaths, isAdmin, loading, pathname, router, session, status])

  const ready = status !== 'loading' && (!session?.user?.id || (!loading && allowedPaths !== null))
  const allowed =
    isAdmin ||
    (allowedPaths !== null && isPathAllowed(pathname, allowedPaths))

  return (
    <PageLoadingGate loading={!ready || (!isAdmin && !allowed)}>
      {ready && allowed ? children : null}
    </PageLoadingGate>
  )
}
