import { notFound, redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canAccessWorkspaceById, hasWorkspaceFeatureAccess } from '@/lib/workspace-permissions'
import { getUserPermissionsSnapshot } from '@/lib/user-permissions-server'

type Props = {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}

export default async function WorkspaceLayout({ children, params }: Props) {
  const { slug } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect('/auth/signin')
  }

  const row = await prisma.workspace.findUnique({
    where: { slug },
    select: { id: true },
  })

  if (!row) notFound()

  const isAdmin = session.user.role === 'ADMIN'
  const snapshot = await getUserPermissionsSnapshot(session.user.id)
  if (
    !snapshot ||
    !hasWorkspaceFeatureAccess(snapshot.allowedPaths, isAdmin) ||
    !canAccessWorkspaceById(row.id, snapshot.workspaceAccess, isAdmin)
  ) {
    redirect('/dashboard')
  }

  return <>{children}</>
}
