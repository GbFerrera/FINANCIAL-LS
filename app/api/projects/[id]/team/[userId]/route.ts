import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

interface RouteParams {
  params: {
    id: string
    userId: string
  }
}

const teamMemberUpdateSchema = z.object({
  role: z.string().min(1, 'Função é obrigatória')
})

// PUT - Atualizar função do membro da equipe
export async function PUT(
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
    const validatedData = teamMemberUpdateSchema.parse(body)

    // Verificar se o membro existe na equipe do projeto
    const existingMember = await prisma.projectTeam.findFirst({
      where: {
        projectId: params.id,
        userId: params.userId
      }
    })

    if (!existingMember) {
      return NextResponse.json({ error: 'Membro não encontrado na equipe do projeto' }, { status: 404 })
    }

    // Atualizar a função do membro
    const updatedMember = await prisma.projectTeam.update({
      where: { id: existingMember.id },
      data: { role: validatedData.role },
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
      }
    })

    return NextResponse.json(updatedMember)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Erro ao atualizar membro da equipe:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// DELETE - Remover membro da equipe
export async function DELETE(
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

    // Verificar se o membro existe na equipe do projeto
    const existingMember = await prisma.projectTeam.findFirst({
      where: {
        projectId: params.id,
        userId: params.userId
      }
    })

    if (!existingMember) {
      return NextResponse.json({ error: 'Membro não encontrado na equipe do projeto' }, { status: 404 })
    }

    // Remover o membro da equipe
    await prisma.projectTeam.delete({
      where: { id: existingMember.id }
    })

    return NextResponse.json({ message: 'Membro removido da equipe com sucesso' })
  } catch (error) {
    console.error('Erro ao remover membro da equipe:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}