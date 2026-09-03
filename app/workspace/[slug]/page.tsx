import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { mapWorkspace, workspaceInclude } from '@/lib/workspace-utils'
import { Button } from '@/components/ui/button'
import { RotateCcw, FolderGit2 } from 'lucide-react'
import { WorkspaceCompactCard, WorkspacePage } from '@/components/workspace/WorkspacePage'

type Props = { params: Promise<{ slug: string }> }

export default async function WorkspaceHomePage({ params }: Props) {
  const { slug } = await params
  const row = await prisma.workspace.findUnique({
    where: { slug },
    include: workspaceInclude,
  })
  if (!row) return null

  const workspace = mapWorkspace(row)
  const projectIds = workspace.projectIds

  const [taskStats, sprintCount] = await Promise.all([
    projectIds.length
      ? prisma.task.groupBy({
          by: ['status'],
          where: { projectId: { in: projectIds }, isArchived: false },
          _count: true,
        })
      : Promise.resolve([]),
    projectIds.length
      ? prisma.sprint.count({
          where: { isArchived: false, projects: { some: { projectId: { in: projectIds } } } },
        })
      : Promise.resolve(0),
  ])

  const totalTasks = taskStats.reduce((acc, s) => acc + s._count, 0)
  const completed = taskStats.find((s) => s.status === 'COMPLETED')?._count || 0

  return (
    <WorkspacePage className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground md:text-2xl">{workspace.name}</h1>
        {workspace.description && (
          <p className="mt-1 text-sm text-muted-foreground">{workspace.description}</p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Projetos', value: workspace.projects.length },
          { label: 'Ciclos (Sprints)', value: sprintCount },
          { label: 'Tarefas concluídas', value: `${completed}/${totalTasks}` },
        ].map((stat) => (
          <WorkspaceCompactCard key={stat.label} className="p-4">
            <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{stat.value}</p>
          </WorkspaceCompactCard>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" className="h-8 bg-primary hover:bg-primary/90">
          <Link href={`/workspace/${slug}/cycles`}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Ver ciclos
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="h-8">
          <Link href="/pipeline">
            <FolderGit2 className="mr-2 h-4 w-4" />
            Pipeline
          </Link>
        </Button>
      </div>

      <WorkspaceCompactCard>
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Projetos neste espaço</h2>
        </div>
        <div className="divide-y divide-[#ececef]">
          {workspace.projects.length === 0 ? (
            <p className="px-4 py-4 text-sm text-muted-foreground">
              Nenhum projeto vinculado.{' '}
              <Link href="/settings/workspaces" className="text-foreground underline underline-offset-2">
                Configurar espaço
              </Link>
            </p>
          ) : (
            workspace.projects.map(({ project }) => (
              <Link
                key={project.id}
                href={`/workspace/${slug}/projects/${project.id}/items`}
                className="flex items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-muted"
              >
                <span className="font-medium text-foreground">{project.name}</span>
                <span className="text-xs text-muted-foreground">{project.client.name}</span>
              </Link>
            ))
          )}
        </div>
      </WorkspaceCompactCard>
    </WorkspacePage>
  )
}
