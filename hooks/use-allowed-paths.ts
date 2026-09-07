'use client'

import { useCallback, useEffect, useState } from 'react'
import type { WorkspaceAccessConfig } from '@/lib/workspace-permissions'

export function useAllowedPaths(userId?: string | null) {
  const [allowedPaths, setAllowedPaths] = useState<string[] | null>(null)
  const [workspaceAccess, setWorkspaceAccess] = useState<WorkspaceAccessConfig | null>(null)
  const [loading, setLoading] = useState(false)

  const reload = useCallback(async () => {
    if (!userId) {
      setAllowedPaths(null)
      setWorkspaceAccess(null)
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/users/${userId}/permissions`)
      if (!res.ok) {
        setAllowedPaths([])
        setWorkspaceAccess({ workspaceIds: [], canCreateWorkspaces: false })
        return
      }
      const data = await res.json()
      setAllowedPaths(data.allowedPaths || [])
      setWorkspaceAccess(
        data.workspaceAccess ?? { workspaceIds: null, canCreateWorkspaces: false }
      )
    } catch {
      setAllowedPaths([])
      setWorkspaceAccess({ workspaceIds: [], canCreateWorkspaces: false })
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    const handler = () => {
      void reload()
    }
    window.addEventListener('permissionsUpdated', handler)
    return () => window.removeEventListener('permissionsUpdated', handler)
  }, [reload])

  return { allowedPaths, workspaceAccess, loading, reload }
}
