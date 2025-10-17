import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getServerSession } from 'next-auth'

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { taskId, destinationSprintId, destinationIndex, sourceSprintId } = body

    if (!taskId || destinationIndex === undefined) {
      return NextResponse.json({ 
        error: 'ID da tarefa e índice de destino são obrigatórios' 
      }, { status: 400 })
    }

    // Inicia uma transação para garantir consistência
    const result = await prisma.$transaction(async (tx) => {
      // 1. Atualiza a tarefa com a nova sprint
      const updatedTask = await tx.task.update({
        where: { id: taskId },
        data: {
          sprintId: destinationSprintId || null,
          order: destinationIndex
        }
      })

      // 2. Reordena as tarefas na sprint de origem (se houver)
      if (sourceSprintId) {
        const sourceTasks = await tx.task.findMany({
          where: { sprintId: sourceSprintId },
          orderBy: { order: 'asc' }
        })

        // Reordena as tarefas restantes
        for (let i = 0; i < sourceTasks.length; i++) {
          if (sourceTasks[i].id !== taskId) {
            await tx.task.update({
              where: { id: sourceTasks[i].id },
              data: { order: i }
            })
          }
        }
      } else {
        // Reordena o backlog se a tarefa veio de lá
        const backlogTasks = await tx.task.findMany({
          where: { 
            projectId: updatedTask.projectId,
            sprintId: null,
            id: { not: taskId }
          },
          orderBy: { order: 'asc' }
        })

        for (let i = 0; i < backlogTasks.length; i++) {
          await tx.task.update({
            where: { id: backlogTasks[i].id },
            data: { order: i }
          })
        }
      }

      // 3. Reordena as tarefas na sprint de destino
      if (destinationSprintId) {
        const destinationTasks = await tx.task.findMany({
          where: { sprintId: destinationSprintId },
          orderBy: { order: 'asc' }
        })

        // Reordena considerando a nova posição
        for (let i = 0; i < destinationTasks.length; i++) {
          if (destinationTasks[i].id !== taskId) {
            const newOrder = i >= destinationIndex ? i + 1 : i
            await tx.task.update({
              where: { id: destinationTasks[i].id },
              data: { order: newOrder }
            })
          }
        }
      } else {
        // Reordena o backlog se a tarefa foi movida para lá
        const backlogTasks = await tx.task.findMany({
          where: { 
            projectId: updatedTask.projectId,
            sprintId: null,
            id: { not: taskId }
          },
          orderBy: { order: 'asc' }
        })

        for (let i = 0; i < backlogTasks.length; i++) {
          const newOrder = i >= destinationIndex ? i + 1 : i
          await tx.task.update({
            where: { id: backlogTasks[i].id },
            data: { order: newOrder }
          })
        }
      }

      return updatedTask
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Erro ao mover tarefa:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
