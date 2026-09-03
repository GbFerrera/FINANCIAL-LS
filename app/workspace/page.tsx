import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'

export default async function WorkspaceIndexPage() {
  const first = await prisma.workspace.findFirst({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: { slug: true },
  })

  if (first) {
    redirect(`/workspace/${first.slug}`)
  }

  redirect('/settings/workspaces')
}
