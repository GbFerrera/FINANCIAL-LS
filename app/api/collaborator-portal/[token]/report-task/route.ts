import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params
    const body = await request.json()
    const { title, description, priority = 'MEDIUM', projectId, sprintId, attachments = [] } = body

    console.log('=== REPORT TASK API ===')
    console.log('Token:', token)
    console.log('Body:', body)

    // Validar dados obrigatórios
    if (!title || title.trim().length === 0) {
      return NextResponse.json({ 
        error: 'Título da tarefa é obrigatório' 
      }, { status: 400 })
    }

    // Buscar colaborador pelo token
    const collaborator = await prisma.user.findFirst({
      where: {
        accessToken: token
      }
    })

    if (!collaborator) {
      return NextResponse.json({ 
        error: 'Token inválido ou colaborador não encontrado' 
      }, { status: 404 })
    }

    console.log('Colaborador encontrado:', collaborator.name)

    // Determinar projeto e sprint de destino
    let targetProjectId = projectId
    let targetSprintId = sprintId

    // Se foi especificada uma sprint, validar se existe
    if (targetSprintId) {
      const sprint = await prisma.sprint.findUnique({
        where: { id: targetSprintId }
      })

      if (!sprint) {
        return NextResponse.json({ 
          error: 'Sprint não encontrada' 
        }, { status: 400 })
      }

      console.log('Sprint selecionada:', sprint.name)
      
      // Se não foi especificado projeto, usar o primeiro projeto disponível
      if (!targetProjectId) {
        const defaultProject = await prisma.project.findFirst()
        if (defaultProject) {
          targetProjectId = defaultProject.id
        }
      }
    } else if (!targetProjectId) {
      // Se não foi especificado projeto nem sprint, usar projeto padrão
      const defaultProject = await prisma.project.findFirst()
      
      if (defaultProject) {
        targetProjectId = defaultProject.id
      } else {
        return NextResponse.json({ 
          error: 'Nenhum projeto encontrado' 
        }, { status: 400 })
      }
    }

    // Buscar o próximo número de ordem
    const lastTask = await prisma.task.findFirst({
      where: {
        projectId: targetProjectId,
        sprintId: targetSprintId || null
      },
      orderBy: { order: 'desc' }
    })

    const nextOrder = lastTask ? lastTask.order + 1 : 0

    // Preparar descrição com anexos se houver
    let taskDescription = description?.trim() || `Tarefa reportada por ${collaborator.name}`
    if (attachments.length > 0) {
      taskDescription += `\n\n📎 Anexos (${attachments.length}):\n`
      attachments.forEach((file: any) => {
        taskDescription += `• ${file.originalName} (${file.fileType})\n`
      })
    }

    // Criar a tarefa reportada
    const reportedTask = await prisma.task.create({
      data: {
        title: title.trim(),
        description: taskDescription,
        status: 'TODO',
        priority: priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT',
        projectId: targetProjectId,
        sprintId: targetSprintId || null, // Vai para sprint específica ou backlog
        order: nextOrder,
        // Não atribuir a ninguém inicialmente - admin vai decidir
        assigneeId: null
      },
      include: {
        project: true,
        assignee: true
      }
    })

    console.log('Tarefa reportada criada:', reportedTask.id)

    return NextResponse.json({
      success: true,
      task: reportedTask,
      message: `Tarefa "${title}" reportada com sucesso! Ela aparecerá no backlog para ser atribuída.`
    })

  } catch (error) {
    console.error('Erro ao reportar tarefa:', error)
    return NextResponse.json({ 
      error: 'Erro interno do servidor' 
    }, { status: 500 })
  }
}
