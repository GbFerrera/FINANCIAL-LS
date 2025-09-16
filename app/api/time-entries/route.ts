import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const taskId = searchParams.get('taskId')
    const active = searchParams.get('active')

    let whereClause: any = { userId: user.id }
    
    if (taskId) {
      whereClause.taskId = taskId
    }
    
    if (active === 'true') {
      whereClause.isActive = true
    }

    const timeEntries = await prisma.timeEntry.findMany({
      where: whereClause,
      include: {
        task: {
          select: {
            id: true,
            title: true,
            project: {
              select: {
                name: true,
                client: {
                  select: {
                    name: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(timeEntries)
  } catch (error) {
    console.error('Erro ao buscar entradas de tempo:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    const { taskId, action, description } = await request.json()

    if (!taskId || !action) {
      return NextResponse.json(
        { error: 'taskId e action são obrigatórios' },
        { status: 400 }
      )
    }

    // Verificar se a tarefa existe e pertence ao usuário
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        assigneeId: user.id
      }
    })

    if (!task) {
      return NextResponse.json(
        { error: 'Tarefa não encontrada ou não atribuída ao usuário' },
        { status: 404 }
      )
    }

    if (action === 'start') {
      // Parar qualquer cronômetro ativo do usuário
      const activeEntries = await prisma.timeEntry.findMany({
        where: {
          userId: user.id,
          isActive: true
        }
      })

      for (const entry of activeEntries) {
        const duration = Math.floor((new Date().getTime() - new Date(entry.startTime).getTime()) / 1000) // Duração em segundos
        await prisma.timeEntry.update({
          where: { id: entry.id },
          data: {
            endTime: new Date(),
            duration,
            isActive: false
          }
        })

        // Atualizar actualHours da tarefa
        const relatedTask = await prisma.task.findUnique({
          where: { id: entry.taskId }
        })
        
        if (relatedTask) {
          await prisma.task.update({
            where: { id: entry.taskId },
            data: {
              actualHours: (relatedTask.actualHours || 0) + (duration / 3600) // Converter segundos para horas
            }
          })
        }
      }

      // Criar nova entrada de tempo
      const newEntry = await prisma.timeEntry.create({
        data: {
          taskId,
          userId: user.id,
          startTime: new Date(),
          description,
          isActive: true
        },
        include: {
          task: {
            select: {
              id: true,
              title: true
            }
          }
        }
      })

      return NextResponse.json(newEntry)
    }

    if (action === 'pause') {
      // Encontrar entrada ativa para esta tarefa
      const activeEntry = await prisma.timeEntry.findFirst({
        where: {
          taskId,
          userId: user.id,
          isActive: true,
          isPaused: false
        }
      })

      if (!activeEntry) {
        return NextResponse.json(
          { error: 'Nenhum cronômetro ativo encontrado para esta tarefa' },
          { status: 404 }
        )
      }

      const updatedEntry = await prisma.timeEntry.update({
        where: { id: activeEntry.id },
        data: {
          isPaused: true,
          pausedAt: new Date()
        }
      })

      return NextResponse.json(updatedEntry)
    }

    if (action === 'resume') {
      // Encontrar entrada pausada para esta tarefa
      const pausedEntry = await prisma.timeEntry.findFirst({
        where: {
          taskId,
          userId: user.id,
          isActive: true,
          isPaused: true
        }
      })

      if (!pausedEntry) {
        return NextResponse.json(
          { error: 'Nenhum cronômetro pausado encontrado para esta tarefa' },
          { status: 404 }
        )
      }

      // Calcular tempo pausado
      const pauseDuration = Math.floor((new Date().getTime() - new Date(pausedEntry.pausedAt!).getTime()) / 1000)
      
      const updatedEntry = await prisma.timeEntry.update({
        where: { id: pausedEntry.id },
        data: {
          isPaused: false,
          pausedAt: null,
          pausedTime: pausedEntry.pausedTime + pauseDuration
        }
      })

      return NextResponse.json(updatedEntry)
    }

    if (action === 'stop') {
      // Encontrar entrada ativa para esta tarefa
      const activeEntry = await prisma.timeEntry.findFirst({
        where: {
          taskId,
          userId: user.id,
          isActive: true
        }
      })

      if (!activeEntry) {
        return NextResponse.json(
          { error: 'Nenhum cronômetro ativo encontrado para esta tarefa' },
          { status: 404 }
        )
      }

      // Calcular duração total considerando pausas
      let totalDuration = Math.floor((new Date().getTime() - new Date(activeEntry.startTime).getTime()) / 1000)
      
      // Se estiver pausado, adicionar o tempo da pausa atual
      if (activeEntry.isPaused && activeEntry.pausedAt) {
        const currentPauseDuration = Math.floor((new Date().getTime() - new Date(activeEntry.pausedAt).getTime()) / 1000)
        totalDuration = totalDuration - (activeEntry.pausedTime + currentPauseDuration)
      } else {
        totalDuration = totalDuration - activeEntry.pausedTime
      }
      
      const updatedEntry = await prisma.timeEntry.update({
        where: { id: activeEntry.id },
        data: {
          endTime: new Date(),
          duration: totalDuration,
          isActive: false,
          isPaused: false,
          pausedAt: null
        }
      })

      // Atualizar actualHours da tarefa
      await prisma.task.update({
        where: { id: taskId },
        data: {
          actualHours: (task.actualHours || 0) + (totalDuration / 3600) // Converter segundos para horas
        }
      })

      return NextResponse.json(updatedEntry)
    }

    return NextResponse.json(
      { error: 'Ação inválida. Use "start", "pause", "resume" ou "stop"' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Erro ao gerenciar entrada de tempo:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const entryId = searchParams.get('id')

    if (!entryId) {
      return NextResponse.json(
        { error: 'ID da entrada é obrigatório' },
        { status: 400 }
      )
    }

    // Verificar se a entrada pertence ao usuário
    const timeEntry = await prisma.timeEntry.findFirst({
      where: {
        id: entryId,
        userId: user.id
      },
      include: {
        task: true
      }
    })

    if (!timeEntry) {
      return NextResponse.json(
        { error: 'Entrada de tempo não encontrada' },
        { status: 404 }
      )
    }

    // Se a entrada tinha duração, subtrair das horas atuais da tarefa
    if (timeEntry.duration) {
      await prisma.task.update({
        where: { id: timeEntry.taskId },
        data: {
          actualHours: Math.max(0, (timeEntry.task.actualHours || 0) - (timeEntry.duration / 3600))
        }
      })
    }

    await prisma.timeEntry.delete({
      where: { id: entryId }
    })

    return NextResponse.json({ message: 'Entrada de tempo removida com sucesso' })
  } catch (error) {
    console.error('Erro ao remover entrada de tempo:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}