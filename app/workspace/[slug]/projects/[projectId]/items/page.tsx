import { redirect } from 'next/navigation'

type Props = { params: Promise<{ slug: string; projectId: string }> }

export default async function WorkspaceProjectItemsPage({ params }: Props) {
  const { projectId } = await params
  redirect(`/projects/${projectId}`)
}
