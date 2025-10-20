import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getServerSession } from 'next-auth'

const prisma = new PrismaClient()

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const sprintId = params.id

    console.log('Buscando backlog para sprint:', sprintId)

    // Buscar todos os projetos vinculados à sprint
    const sprintProjects = await prisma.$queryRaw`
      SELECT p.id
      FROM sprint_projects sp
      JOIN projects p ON sp."projectId" = p.id
      WHERE sp."sprintId" = ${sprintId}
    ` as any[]

    if (sprintProjects.length === 0) {
      console.log('Nenhum projeto encontrado para a sprint:', sprintId)
      return NextResponse.json([])
    }

    const projectIds = sprintProjects.map(p => p.id)
    console.log('Projetos da sprint:', projectIds)

    // Buscar tarefas do backlog de todos os projetos da sprint
    // Usar uma abordagem diferente para compatibilidade com diferentes versões do PostgreSQL
    const projectIdsList = projectIds.map(id => `'${id}'`).join(',')
    
    const backlogTasks = await prisma.$queryRawUnsafe(`
      SELECT 
        t.id,
        t.title,
        t.description,
        t.status,
        t.priority,
        t."storyPoints",
        t."assigneeId",
        t."dueDate",
        t."startDate",
        t."startTime",
        t."estimatedMinutes",
        t."order",
        t."projectId",
        t."milestoneId",
        u.id as assignee_id,
        u.name as assignee_name,
        u.email as assignee_email,
        u.avatar as assignee_avatar,
        p.id as project_id,
        p.name as project_name
      FROM tasks t
      LEFT JOIN users u ON t."assigneeId" = u.id
      LEFT JOIN projects p ON t."projectId" = p.id
      WHERE t."projectId" IN (${projectIdsList})
        AND t."sprintId" IS NULL
      ORDER BY t."order" ASC
    `) as any[]

    // Formatar tarefas
    const formattedTasks = backlogTasks.map((task: any) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      storyPoints: task.storyPoints,
      assigneeId: task.assigneeId,
      dueDate: task.dueDate,
      startDate: task.startDate,
      startTime: task.startTime,
      estimatedMinutes: task.estimatedMinutes,
      order: task.order,
      projectId: task.projectId,
      milestoneId: task.milestoneId,
      assignee: task.assignee_id ? {
        id: task.assignee_id,
        name: task.assignee_name,
        email: task.assignee_email,
        avatar: task.assignee_avatar
      } : null,
      project: task.project_id ? {
        id: task.project_id,
        name: task.project_name
      } : null
    }))

    console.log('Tarefas encontradas no backlog da sprint:', formattedTasks.length)
    console.log('Títulos das tarefas:', formattedTasks.map(t => `${t.title} (Projeto: ${t.project?.name})`))

    return NextResponse.json(formattedTasks)
  } catch (error) {
    console.error('Erro ao buscar backlog da sprint:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
