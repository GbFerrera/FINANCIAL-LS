import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { filterWorkspacesForUser, hasWorkspaceFeatureAccess } from '@/lib/workspace-permissions'
import { getUserPermissionsSnapshot } from '@/lib/user-permissions-server'

export default async function WorkspaceIndexPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect('/auth/signin')
  }

  const isAdmin = session.user.role === 'ADMIN'
  const snapshot = await getUserPermissionsSnapshot(session.user.id)

  if (!snapshot || !hasWorkspaceFeatureAccess(snapshot.allowedPaths, isAdmin)) {
    redirect('/dashboard')
  }

  const rows = await prisma.workspace.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: { id: true, slug: true },
  })

  const allowed = filterWorkspacesForUser(rows, snapshot.workspaceAccess, isAdmin)
  if (allowed[0]) {
    redirect(`/workspace/${allowed[0].slug}`)
  }

  if (snapshot.workspaceAccess.canCreateWorkspaces || isAdmin) {
    redirect('/settings/workspaces')
  }

  redirect('/dashboard')
}
