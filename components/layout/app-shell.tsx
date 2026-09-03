'use client'

import { PageLoadingGate } from '@/components/ui/loading-animation'
import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { DashboardLayout } from "./dashboard-layout"
import { isPathAllowed, firstAllowedPath, firstAllowedFromRole } from "@/lib/access-control"

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || ""
  const router = useRouter()
  const { data: session, status } = useSession()
  const [allowedPaths, setAllowedPaths] = useState<string[] | null>(null)
  const [checking, setChecking] = useState(false)

  const excludedPrefixes = ["/auth", "/collaborator-portal", "/client-portal", "/task-portal", "/proposta"]
  const isExcluded = excludedPrefixes.some(prefix => pathname.startsWith(prefix))
  const isWorkspace = pathname.startsWith("/workspace")

  useEffect(() => {
    if (isExcluded) return
    if (status === "loading") return
    const userId = session?.user?.id
    if (!userId) return

    let cancelled = false
    async function loadPermissions() {
      try {
        setChecking(true)
        const res = await fetch(`/api/users/${userId}/permissions`)
        if (!res.ok) {
          if (!cancelled) setAllowedPaths([])
          return
        }
        const data = await res.json()
        if (!cancelled) {
          setAllowedPaths(data.allowedPaths || [])
        }
      } finally {
        if (!cancelled) setChecking(false)
      }
    }
    if (allowedPaths === null) {
      loadPermissions()
    }
    return () => { cancelled = true }
  }, [session?.user?.id, status, isExcluded, allowedPaths])

  useEffect(() => {
    if (isExcluded) return
    if (status === "loading") return
    if (!session) return
    if (!allowedPaths) return
    const ok = isPathAllowed(pathname, allowedPaths)
    if (!ok) {
      const dest = firstAllowedPath(allowedPaths) || firstAllowedFromRole(session.user.role) || "/auth/signin"
      router.replace(dest)
    }
  }, [allowedPaths, pathname, session, status, isExcluded, router])

  if (isExcluded) {
    return <>{children}</>
  }

  const initialLoading =
    status === "loading" ||
    (!!session?.user?.id && allowedPaths === null)

  return (
    <PageLoadingGate loading={initialLoading}>
      {isWorkspace ? children : <DashboardLayout>{children}</DashboardLayout>}
    </PageLoadingGate>
  )
}
