import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { mapWorkspace, workspaceInclude } from '@/lib/workspace-utils'
import { WorkspaceNotesView } from '@/components/workspace/WorkspaceNotesView'

type Props = { params: Promise<{ slug: string }> }

export default async function WorkspaceNotesPage({ params }: Props) {
  const { slug } = await params
  const row = await prisma.workspace.findUnique({
    where: { slug },
    include: workspaceInclude,
  })
  if (!row) notFound()

  const workspace = mapWorkspace(row)

  return (
    <WorkspaceNotesView
      slug={slug}
      workspaceName={workspace.name}
      projects={workspace.projects.map(({ project }) => ({
        id: project.id,
        name: project.name,
      }))}
      projectIds={workspace.projectIds}
    />
  )
}
