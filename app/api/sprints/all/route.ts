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

        // Buscar tarefas da sprint
        const sprintTasks = await prisma.$queryRaw`
          SELECT 
            id,
            "storyPoints",
            status
          FROM tasks
          WHERE "sprintId" = ${sprint.id}
        ` as any[]

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
            storyPoints: t.storyPoints,
            status: t.status
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
