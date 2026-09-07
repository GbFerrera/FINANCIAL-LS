import { prisma } from '@/lib/prisma'
import { mapWorkspace, workspaceInclude } from '@/lib/workspace-utils'
import { WorkspacePage } from '@/components/workspace/WorkspacePage'
import { WorkspaceHomeView } from '@/components/workspace/WorkspaceHomeView'

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

  const [taskStats, sprintCount, projectDetails] = await Promise.all([
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
    Promise.all(
      workspace.projects.map(async ({ project }) => {
        const [stats, teamCount, projectSprintCount] = await Promise.all([
          prisma.task.groupBy({
            by: ['status'],
            where: { projectId: project.id, isArchived: false },
            _count: true,
          }),
          prisma.projectTeam.count({ where: { projectId: project.id } }),
          prisma.sprint.count({
            where: {
              isArchived: false,
              projects: { some: { projectId: project.id } },
            },
          }),
        ])

        const countByStatus = Object.fromEntries(stats.map((s) => [s.status, s._count]))
        const total = stats.reduce((acc, s) => acc + s._count, 0)

        return {
          id: project.id,
          name: project.name,
          status: project.status,
          client: project.client,
          total,
          drafts: countByStatus.DRAFT ?? 0,
          inProgress: (countByStatus.IN_PROGRESS ?? 0) + (countByStatus.IN_REVIEW ?? 0),
          completed: countByStatus.COMPLETED ?? 0,
          todo: countByStatus.TODO ?? 0,
          teamCount,
          sprintCount: projectSprintCount,
        }
      })
    ),
  ])

  const totalTasks = taskStats.reduce((acc, s) => acc + s._count, 0)
  const completed = taskStats.find((s) => s.status === 'COMPLETED')?._count || 0
  const drafts = taskStats.find((s) => s.status === 'DRAFT')?._count || 0

  return (
    <WorkspacePage size="full">
      <WorkspaceHomeView
        data={{
          slug,
          name: workspace.name,
          description: workspace.description,
          icon: workspace.icon,
          projectCount: workspace.projects.length,
          sprintCount,
          drafts,
          completed,
          totalTasks,
          taskStats: taskStats.map((s) => ({ status: s.status, count: s._count })),
          projects: projectDetails,
        }}
      />
    </WorkspacePage>
  )
}
