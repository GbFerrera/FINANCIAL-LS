import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getServerSession } from 'next-auth'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Buscar sprints básicas primeiro
    const sprintsBasic = await prisma.$queryRaw`
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
    ` as any[]

    // Para cada sprint, buscar projetos e tarefas separadamente
    const sprints = await Promise.all(
      sprintsBasic.map(async (sprint: any) => {
        // Buscar projetos da sprint
        const sprintProjects = await prisma.$queryRaw`
          SELECT 
            p.id,
            p.name,
            c.id as client_id,
            c.name as client_name
          FROM sprint_projects sp
          JOIN projects p ON sp."projectId" = p.id
          JOIN clients c ON p."clientId" = c.id
          WHERE sp."sprintId" = ${sprint.id}
        ` as any[]

        // Extrair IDs dos projetos
        const projectIds = sprintProjects.map((p: any) => p.id)

        // Buscar tarefas da sprint (incluindo tarefas sem sprint mas com data dentro do range e do projeto da sprint)
        const sprintTasks = await prisma.task.findMany({
          where: {
            OR: [
              { sprintId: sprint.id },
              {
                AND: [
                  { sprintId: null },
                  { projectId: { in: projectIds } },
                  { dueDate: { gte: new Date(sprint.startDate), lte: new Date(sprint.endDate) } }
                ]
              }
            ]
          },
          select: {
            id: true,
            title: true,
            storyPoints: true,
            status: true,
            dueDate: true
          }
        })

        return {
          ...sprint,
          projects: sprintProjects.map((p: any) => ({
            id: p.id,
            name: p.name,
            client: {
              id: p.client_id,
              name: p.client_name
            }
          })),
          tasks: sprintTasks.map((t: any) => ({
            id: t.id,
            title: t.title,
            storyPoints: t.storyPoints,
            status: t.status,
            dueDate: t.dueDate
          }))
        }
      })
    )

    // Transformar dados para o formato esperado pelo frontend
    const transformedSprints = sprints.map((sprint: any) => ({
      ...sprint,
      projects: sprint.projects || [],
      tasks: sprint.tasks || [],
      // Para compatibilidade com o frontend antigo, usar o primeiro projeto como "project"
      project: sprint.projects && sprint.projects.length > 0 ? sprint.projects[0] : null
    }))

    // Ordenar no JavaScript
    const sortedSprints = transformedSprints.sort((a: any, b: any) => {
      // Primeiro por status (ACTIVE, PLANNING, COMPLETED, outros)
      const statusOrder = { 'ACTIVE': 1, 'PLANNING': 2, 'COMPLETED': 3 }
      const aOrder = statusOrder[a.status as keyof typeof statusOrder] || 4
      const bOrder = statusOrder[b.status as keyof typeof statusOrder] || 4
      
      if (aOrder !== bOrder) {
        return aOrder - bOrder
      }
      
      // Depois por data de início (mais recente primeiro)
      return new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
    })

    console.log('Retornando sprints:', sortedSprints.length, 'sprints encontradas')
    return NextResponse.json(sortedSprints)
  } catch (error) {
    console.error('Erro ao buscar todas as sprints:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
