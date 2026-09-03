import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { mapWorkspace, workspaceInclude } from '@/lib/workspace-utils'
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell'

type Props = {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}

export default async function WorkspaceLayout({ children, params }: Props) {
  const { slug } = await params
  const row = await prisma.workspace.findUnique({
    where: { slug },
    include: workspaceInclude,
  })

  if (!row) notFound()

  const workspace = mapWorkspace(row)

  return <WorkspaceShell workspace={workspace}>{children}</WorkspaceShell>
}
