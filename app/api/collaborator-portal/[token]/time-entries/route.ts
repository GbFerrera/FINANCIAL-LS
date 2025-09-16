import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  try {
    const { token } = params
    
    if (!token) {
      return NextResponse.json({ error: 'Token é obrigatório' }, { status: 400 })
    }

    // Buscar usuário pelo token
    const user = await prisma.user.findFirst({
      where: { accessToken: token }
    })

    if (!user) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
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
        const duration = Math.floor((new Date().getTime() - new Date(entry.startTime).getTime()) / (1000 * 60))
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
              actualHours: (relatedTask.actualHours || 0) + (duration / 60)
            }
          })
        }
      }

      // Criar nova entrada de tempo
      const timeEntry = await prisma.timeEntry.create({
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

      return NextResponse.json(timeEntry)
    }

    if (action === 'pause') {
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

      // Calcular tempo acumulado até agora
      const currentTime = new Date()
      const elapsedTime = Math.floor((currentTime.getTime() - new Date(activeEntry.startTime).getTime()) / (1000 * 60))
      const totalDuration = (activeEntry.duration || 0) + elapsedTime

      const updatedEntry = await prisma.timeEntry.update({
        where: { id: activeEntry.id },
        data: {
          duration: totalDuration,
          pausedAt: currentTime,
          isPaused: true
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

      const updatedEntry = await prisma.timeEntry.update({
        where: { id: pausedEntry.id },
        data: {
          startTime: new Date(), // Novo tempo de início
          pausedAt: null,
          isPaused: false
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

      let duration
      if (activeEntry.isPaused) {
        // Se estava pausado, usar a duração já calculada
        duration = activeEntry.duration || 0
      } else {
        // Se estava ativo, calcular duração total
        const elapsedTime = Math.floor((new Date().getTime() - new Date(activeEntry.startTime).getTime()) / (1000 * 60))
        duration = (activeEntry.duration || 0) + elapsedTime
      }
      
      const updatedEntry = await prisma.timeEntry.update({
        where: { id: activeEntry.id },
        data: {
          endTime: new Date(),
          duration,
          isActive: false,
          isPaused: false,
          pausedAt: null
        }
      })

      // Atualizar actualHours da tarefa
      await prisma.task.update({
        where: { id: taskId },
        data: {
          actualHours: (task.actualHours || 0) + (duration / 60)
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

export async function GET(request: NextRequest, { params }: { params: { token: string } }) {
  try {
    const { token } = params
    
    if (!token) {
      return NextResponse.json({ error: 'Token é obrigatório' }, { status: 400 })
    }

    // Buscar usuário pelo token
    const user = await prisma.user.findFirst({
      where: { accessToken: token }
    })

    if (!user) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
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