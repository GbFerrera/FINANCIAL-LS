import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { broadcastTaskEvent, serializeTaskForSocket } from '@/lib/task-socket-server'
import { prisma } from '@/lib/prisma'
import { syncTaskLinkedProjects } from '@/lib/task-projects'
import { extractTaskLabels, syncTaskLabels, taskLabelsInclude } from '@/lib/task-labels'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    console.log('Dados recebidos para criar tarefa:', body)
    
    const { 
      title, 
      description, 
      projectId, 
      sprintId, 
      priority, 
      storyPoints, 
      assigneeId, 
      milestoneId,
      dueDate,
      startDate,
      startTime,
      estimatedMinutes,
      hasBonus,
      status: requestedStatus,
      linkedProjectIds,
      labelIds,
    } = body

    if (!title || !projectId) {
      return NextResponse.json({ 
        error: 'Título e ID do projeto são obrigatórios' 
      }, { status: 400 })
    }

    // Verificar se o projeto existe
    const project = await prisma.project.findUnique({
      where: { id: projectId }
    })

    if (!project) {
      return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 })
    }

    // Calcular a próxima ordem
    const lastTask = await prisma.task.findFirst({
      where: { 
        projectId,
        sprintId: sprintId || null
      },
      orderBy: { order: 'desc' }
    })

    const nextOrder = (lastTask?.order || 0) + 1
    console.log('Criando tarefa com order:', nextOrder, 'para projeto:', projectId)

    const initialStatus = ['DRAFT', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED'].includes(requestedStatus)
      ? requestedStatus
      : 'TODO'

    const extraLinks = Array.isArray(linkedProjectIds)
      ? linkedProjectIds.filter((id: string) => id && id !== projectId)
      : []

    let task
    try {
      task = await prisma.$transaction(async (tx) => {
        const created = await tx.task.create({
          data: {
            title,
            description,
            projectId,
            sprintId: sprintId || null,
            priority: priority || 'MEDIUM',
            storyPoints,
            assigneeId: assigneeId || null,
            milestoneId: milestoneId || null,
            dueDate: dueDate ? new Date(dueDate) : null,
            startDate: startDate ? new Date(startDate) : null,
            startTime: startTime || null,
            estimatedMinutes: estimatedMinutes || null,
            ...(hasBonus !== undefined ? ({ hasBonus: !!hasBonus } as any) : {}),
            order: nextOrder,
            status: initialStatus,
          },
        })

        await syncTaskLinkedProjects(tx, created.id, projectId, extraLinks)

        if (Array.isArray(labelIds) && labelIds.length > 0) {
          const userId = (session.user as { id?: string }).id
          if (userId) {
            await syncTaskLabels(tx, created.id, labelIds.filter(Boolean), userId)
          }
        }

        await tx.taskStatusHistory.create({
          data: {
            taskId: created.id,
            fromStatus: null,
            toStatus: initialStatus,
            changedById: (session.user as { id?: string }).id || null,
          },
        })

        return tx.task.findUnique({
          where: { id: created.id },
          include: {
            assignee: {
              select: { id: true, name: true, email: true, avatar: true },
            },
            project: {
              select: { id: true, name: true },
            },
            sprint: {
              select: { id: true, name: true, status: true },
            },
            linkedProjects: {
              include: {
                project: { select: { id: true, name: true } },
              },
            },
            ...taskLabelsInclude,
          },
        })
      })
    } catch (e) {
      if (e instanceof Error && e.message === 'INVALID_PROJECTS') {
        return NextResponse.json({ error: 'Projetos vinculados inválidos' }, { status: 400 })
      }
      if (e instanceof Error && e.message === 'INVALID_LABELS') {
        return NextResponse.json({ error: 'Etiquetas inválidas' }, { status: 400 })
      }
      throw e
    }

    if (!task) {
      return NextResponse.json({ error: 'Erro ao criar tarefa' }, { status: 500 })
    }

    console.log('Tarefa criada com sucesso:', task.id, task.title)

    if (session.user) {
      broadcastTaskEvent({
        action: 'created',
        taskId: task.id,
        projectId: task.projectId,
        userId: (session.user as { id?: string }).id || 'unknown',
        userName: (session.user as { name?: string }).name,
        task: serializeTaskForSocket(task as Record<string, unknown>),
      }).catch(console.error)
    }

    const labels = extractTaskLabels(
      task.labelAssignments,
      (session.user as { id?: string }).id || ''
    )

    return NextResponse.json({ ...task, labels }, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar tarefa:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
