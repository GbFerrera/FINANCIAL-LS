import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface RouteParams {
  params: {
    id: string
  }
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const sprintId = params.id
    console.log('Buscando projetos para sprintId:', sprintId)

    // Primeiro, verificar se existem registros na tabela sprint_projects
    const sprintProjectsCheck = await prisma.$queryRaw`
      SELECT * FROM sprint_projects WHERE "sprintId" = ${sprintId}
    ` as any[]
    
    console.log('Registros em sprint_projects:', sprintProjectsCheck.length, sprintProjectsCheck)

    // Buscar projetos da sprint usando raw SQL
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

    console.log('Projetos encontrados na API:', projects.length, projects)

    // Transformar para o formato esperado
    const formattedProjects = projects.map((p: any) => ({
      id: p.id,
      name: p.name,
      client: {
        id: p.client_id,
        name: p.client_name
      }
    }))

    return NextResponse.json(formattedProjects)
  } catch (error) {
    console.error('Erro ao buscar projetos da sprint:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
