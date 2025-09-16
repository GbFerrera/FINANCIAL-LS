import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { v4 as uuidv4 } from 'uuid'
import { UserRole } from '@prisma/client'

// Gerar token de acesso para colaborador
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id || session.user.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas administradores podem gerar tokens.' },
        { status: 403 }
      )
    }

    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json(
        { error: 'ID do usuário é obrigatório' },
        { status: 400 }
      )
    }

    // Verificar se o usuário existe e é um colaborador
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        accessToken: true
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      )
    }

    if (user.role !== 'TEAM') {
      return NextResponse.json(
        { error: 'Apenas membros da equipe podem ter tokens de acesso' },
        { status: 403 }
      )
    }

    // Gerar novo token
    const accessToken = uuidv4()

    // Atualizar usuário com o novo token
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        accessToken
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        accessToken: true
      }
    })

    return NextResponse.json({
      message: 'Token gerado com sucesso',
      user: updatedUser,
      portalUrl: `${process.env.NEXTAUTH_URL}/collaborator-portal/${accessToken}`
    })
  } catch (error) {
    console.error('Erro ao gerar token:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// Listar colaboradores e seus tokens
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id || session.user.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas administradores podem visualizar tokens.' },
        { status: 403 }
      )
    }

    const collaborators = await prisma.user.findMany({
      where: {
        role: 'TEAM'
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        accessToken: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    const collaboratorsWithPortalUrl = collaborators.map((collaborator: any) => ({
      ...collaborator,
      portalUrl: collaborator.accessToken 
        ? `${process.env.NEXTAUTH_URL}/collaborator-portal/${collaborator.accessToken}`
        : null
    }))

    return NextResponse.json(collaboratorsWithPortalUrl)
  } catch (error) {
    console.error('Erro ao listar colaboradores:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// Revogar token de acesso
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id || session.user.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas administradores podem revogar tokens.' },
        { status: 403 }
      )
    }

    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json(
        { error: 'ID do usuário é obrigatório' },
        { status: 400 }
      )
    }

    // Remover token do usuário
    await prisma.user.update({
      where: { id: userId },
      data: {
        accessToken: null
      }
    })

    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true
      }
    })

    return NextResponse.json({
      message: 'Token revogado com sucesso',
      user: updatedUser
    })
  } catch (error) {
    console.error('Erro ao revogar token:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}