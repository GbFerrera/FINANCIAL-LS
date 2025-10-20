import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json({ error: 'projectId é obrigatório' }, { status: 400 })
    }

    // Buscar milestones do projeto usando raw SQL
    const milestones = await prisma.$queryRaw`
      SELECT 
        id,
        name as title,
        description,
        "dueDate",
        status,
        "projectId",
        "createdAt",
        "updatedAt"
      FROM milestones
      WHERE "projectId" = ${projectId}
      ORDER BY "dueDate" ASC, "createdAt" ASC
    ` as any[]

    return NextResponse.json(milestones)
  } catch (error) {
    console.error('Erro ao buscar milestones:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { title, description, dueDate, projectId } = await request.json()

    if (!title || !projectId) {
      return NextResponse.json({ 
        error: 'Título e projectId são obrigatórios' 
      }, { status: 400 })
    }

    // Criar milestone usando raw SQL
    const milestoneId = `milestone_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    await prisma.$executeRaw`
      INSERT INTO milestones (id, title, description, "dueDate", status, "projectId", "createdAt", "updatedAt")
      VALUES (
        ${milestoneId},
        ${title},
        ${description || null},
        ${dueDate ? new Date(dueDate) : null},
        'ACTIVE'::"MilestoneStatus",
        ${projectId},
        NOW(),
        NOW()
      )
    `

    // Buscar a milestone criada
    const createdMilestone = await prisma.$queryRaw`
      SELECT 
        id,
        title,
        description,
        "dueDate",
        status,
        "projectId",
        "createdAt",
        "updatedAt"
      FROM milestones
      WHERE id = ${milestoneId}
    ` as any[]

    return NextResponse.json(createdMilestone[0])
  } catch (error) {
    console.error('Erro ao criar milestone:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
