import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { startOfDay, endOfDay } from 'date-fns'

const prisma = new PrismaClient()

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params

    // Buscar colaborador pelo token
    const collaborator = await prisma.user.findUnique({
      where: { accessToken: token },
      select: {
        id: true,
        name: true,
        email: true,
      }
    })

    if (!collaborator) {
      return NextResponse.json(
        { error: 'Token inválido' },
        { status: 404 }
      )
    }

    console.log('Buscando tarefas simples para colaborador:', collaborator.id)

    // Buscar tarefas com critério mais simples e inclusivo
    const tasks = await prisma.task.findMany({
      where: {
        assigneeId: collaborator.id,
        // Mostrar tarefas que não foram completadas há mais de 1 dia
        NOT: {
          AND: [
            { status: 'COMPLETED' },
            {
              updatedAt: {
                lt: new Date(Date.now() - 24 * 60 * 60 * 1000)
              }
            }
          ]
        }
      },
      include: {
        project: {
          select: {
            id: true,
            name: true
          }
        },
        sprint: {
          select: {
            id: true,
            name: true,
            status: true
          }
        }
      },
      orderBy: [
        { status: 'asc' }, // IN_PROGRESS primeiro
        { startTime: 'asc' }, // Horário de início primeiro
        { startDate: 'asc' }, // Data de início
        { dueDate: 'asc' }, // Data de vencimento
        { priority: 'desc' }, // URGENT primeiro
        { createdAt: 'desc' }
      ]
    })

    console.log('Tarefas simples encontradas:', tasks.length)

    return NextResponse.json({
      collaborator,
      tasks,
      date: new Date().toISOString(),
      totalTasks: tasks.length,
      message: 'Versão simplificada - mostra tarefas ativas'
    })

  } catch (error) {
    console.error('Erro ao buscar tarefas simples:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
