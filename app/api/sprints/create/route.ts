import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, projectIds, startDate, endDate, goal, capacity } = body

    if (!name || !projectIds || !Array.isArray(projectIds) || projectIds.length === 0 || !startDate || !endDate) {
      return NextResponse.json({ 
        error: 'Nome, projetos, data de início e fim são obrigatórios' 
      }, { status: 400 })
    }

    // Usar raw SQL para criar a sprint e relacionamentos
    const sprintId = `sprint_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // Criar a sprint
    await prisma.$executeRaw`
      INSERT INTO sprints (id, name, description, "startDate", "endDate", goal, capacity, status, "createdAt", "updatedAt")
      VALUES (${sprintId}, ${name}, ${description || null}, ${new Date(startDate)}, ${new Date(endDate)}, ${goal || null}, ${capacity || null}, 'PLANNING', NOW(), NOW())
    `

    // Criar relacionamentos com projetos
    for (const projectId of projectIds) {
      const relationId = `sp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      await prisma.$executeRaw`
        INSERT INTO sprint_projects (id, "sprintId", "projectId", "createdAt")
        VALUES (${relationId}, ${sprintId}, ${projectId}, NOW())
      `
    }

    // Buscar a sprint criada com relacionamentos
    const createdSprint = await prisma.$queryRaw`
      SELECT 
        s.*,
        json_agg(
          json_build_object(
            'id', p.id,
            'name', p.name,
            'client', json_build_object('name', c.name)
          )
        ) as projects
      FROM sprints s
      LEFT JOIN sprint_projects sp ON s.id = sp."sprintId"
      LEFT JOIN projects p ON sp."projectId" = p.id
      LEFT JOIN clients c ON p."clientId" = c.id
      WHERE s.id = ${sprintId}
      GROUP BY s.id
    ` as any[]

    return NextResponse.json(createdSprint[0])
  } catch (error) {
    console.error('Erro ao criar sprint:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
