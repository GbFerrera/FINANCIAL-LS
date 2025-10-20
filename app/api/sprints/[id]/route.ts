import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { notifySprintStatusChange } from '@/lib/notifications'

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

    // Buscar sprint usando raw SQL
    const sprintData = await prisma.$queryRaw`
      SELECT 
        id,
        name,
        description,
        status,
        "startDate",
        "endDate",
        goal,
        capacity,
        "createdAt",
        "updatedAt"
      FROM sprints
      WHERE id = ${sprintId}
    ` as any[]

    if (sprintData.length === 0) {
      return NextResponse.json({ error: 'Sprint não encontrada' }, { status: 404 })
    }

    const sprint = sprintData[0]

    // Buscar tarefas da sprint
    const tasks = await prisma.$queryRaw`
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
        u.id as assignee_id,
        u.name as assignee_name,
        u.email as assignee_email,
        u.avatar as assignee_avatar
      FROM tasks t
      LEFT JOIN users u ON t."assigneeId" = u.id
      WHERE t."sprintId" = ${sprintId}
      ORDER BY t."order" ASC
    ` as any[]

    // Formatar tarefas
    const formattedTasks = tasks.map((task: any) => ({
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
      assignee: task.assignee_id ? {
        id: task.assignee_id,
        name: task.assignee_name,
        email: task.assignee_email,
        avatar: task.assignee_avatar
      } : null
    }))

    // Buscar projetos da sprint
    const projects = await prisma.$queryRaw`
      SELECT 
        p.id,
        p.name,
        c.id as client_id,
        c.name as client_name
      FROM sprint_projects sp
      JOIN projects p ON sp."projectId" = p.id
      JOIN clients c ON p."clientId" = c.id
      WHERE sp."sprintId" = ${sprintId}
    ` as any[]

    const formattedProjects = projects.map((p: any) => ({
      id: p.id,
      name: p.name,
      client: {
        id: p.client_id,
        name: p.client_name
      }
    }))

    // Retornar sprint com tarefas e projetos
    const result = {
      ...sprint,
      tasks: formattedTasks,
      projects: formattedProjects,
      // Manter compatibilidade com frontend antigo
      project: formattedProjects.length > 0 ? formattedProjects[0] : null
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Erro ao buscar sprint:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, status, startDate, endDate, goal, capacity } = body

    // Buscar sprint atual para comparar status
    const currentSprint = await prisma.sprint.findUnique({
      where: { id: params.id }
    })

    if (!currentSprint) {
      return NextResponse.json({ error: 'Sprint não encontrada' }, { status: 404 })
    }

    const oldStatus = currentSprint.status

    const sprint = await prisma.sprint.update({
      where: { id: params.id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(status && { status }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
        ...(goal !== undefined && { goal }),
        ...(capacity !== undefined && { capacity })
      },
      include: {
        tasks: {
          include: {
            assignee: {
              select: { id: true, name: true, email: true, avatar: true }
            }
          }
        },
        project: {
          select: { id: true, name: true }
        }
      }
    })

    // Enviar notificação se o status mudou
    if (status && status !== oldStatus) {
      notifySprintStatusChange(params.id, oldStatus, status).catch(console.error)
    }

    return NextResponse.json(sprint)
  } catch (error) {
    console.error('Erro ao atualizar sprint:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Primeiro, remove todas as tarefas da sprint (move para backlog)
    await prisma.task.updateMany({
      where: { sprintId: params.id },
      data: { sprintId: null }
    })

    // Depois deleta a sprint
    await prisma.sprint.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ message: 'Sprint deletada com sucesso' })
  } catch (error) {
    console.error('Erro ao deletar sprint:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
