import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

interface RouteParams {
  params: {
    id: string
  }
}

const teamMemberSchema = z.object({
  userId: z.string().min(1, 'ID do usuário é obrigatório'),
  role: z.string().min(1, 'Função é obrigatória')
})

// POST - Adicionar membro à equipe do projeto
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Verificar se o usuário tem permissão (apenas ADMIN)
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = teamMemberSchema.parse(body)

    // Verificar se o projeto existe
    const project = await prisma.project.findUnique({
      where: { id: params.id },
      select: { id: true }
    })

    if (!project) {
      return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 })
    }

    // Verificar se o usuário existe
    const user = await prisma.user.findUnique({
      where: { id: validatedData.userId },
      select: { id: true, name: true, email: true }
    })

    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    // Verificar se o usuário já está na equipe do projeto
    const existingMember = await prisma.projectTeam.findFirst({
      where: {
        projectId: params.id,
        userId: validatedData.userId
      }
    })

    if (existingMember) {
      return NextResponse.json({ error: 'Usuário já está na equipe do projeto' }, { status: 400 })
    }

    // Adicionar membro à equipe
    const teamMember = await prisma.projectTeam.create({
      data: {
        projectId: params.id,
        userId: validatedData.userId,
        role: validatedData.role
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true
          }
        }
      }
    })

    return NextResponse.json(teamMember, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Erro ao adicionar membro à equipe:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// GET - Listar membros da equipe do projeto
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Verificar se o projeto existe
    const project = await prisma.project.findUnique({
      where: { id: params.id },
      select: { id: true }
    })

    if (!project) {
      return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 })
    }

    const teamMembers = await prisma.projectTeam.findMany({
      where: { projectId: params.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            role: true
          }
        }
      },
      orderBy: { joinedAt: 'asc' }
    })

    return NextResponse.json(teamMembers)
  } catch (error) {
    console.error('Erro ao buscar membros da equipe:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}