import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'

// Schema de validação para atualização de membro da equipe
const updateTeamMemberSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').optional(),
  email: z.string().email('Email inválido').optional(),
  role: z.nativeEnum(UserRole).optional(),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres').optional(),
  avatar: z.string().optional(),
})

interface RouteParams {
  params: {
    id: string
  }
}

// GET - Buscar membro da equipe por ID
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
        assignedTasks: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            dueDate: true,
            project: {
              select: {
                id: true,
                name: true,
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        teamProjects: {
          select: {
            id: true,
            role: true,
            joinedAt: true,
            project: {
              select: {
                id: true,
                name: true,
                status: true,
                client: {
                  select: {
                    name: true,
                  }
                }
              }
            }
          },
          orderBy: { joinedAt: 'desc' }
        },
        _count: {
          select: {
            assignedTasks: true,
            comments: true,
            teamProjects: true,
            notifications: true,
          }
        }
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Membro da equipe não encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error('Erro ao buscar membro da equipe:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// PUT - Atualizar membro da equipe
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Verificar se o usuário tem permissão para atualizar membros da equipe
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email! },
      select: { id: true, role: true }
    })

    if (!currentUser) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      )
    }

    // Usuários podem atualizar seus próprios dados, admins podem atualizar qualquer um
    const canUpdate = currentUser.role === UserRole.ADMIN || currentUser.id === params.id
    
    if (!canUpdate) {
      return NextResponse.json(
        { error: 'Sem permissão para atualizar este usuário' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validatedData = updateTeamMemberSchema.parse(body)

    // Verificar se o usuário existe
    const existingUser = await prisma.user.findUnique({
      where: { id: params.id }
    })

    if (!existingUser) {
      return NextResponse.json(
        { error: 'Membro da equipe não encontrado' },
        { status: 404 }
      )
    }

    // Se está atualizando o email, verificar se não existe outro usuário com o mesmo email
    if (validatedData.email && validatedData.email !== existingUser.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email: validatedData.email }
      })

      if (emailExists) {
        return NextResponse.json(
          { error: 'Já existe um usuário com este email' },
          { status: 400 }
        )
      }
    }

    // Apenas admins podem alterar roles
    if (validatedData.role && currentUser.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { error: 'Apenas administradores podem alterar funções' },
        { status: 403 }
      )
    }

    // Preparar dados para atualização
    const updateData: any = { ...validatedData }
    
    // Se está atualizando a senha, fazer hash
    if (validatedData.password) {
      updateData.password = await bcrypt.hash(validatedData.password, 12)
    }

    const updatedUser = await prisma.user.update({
      where: { id: params.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            assignedTasks: true,
            comments: true,
            teamProjects: true,
            notifications: true,
          }
        }
      }
    })

    return NextResponse.json(updatedUser)
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

// DELETE - Excluir membro da equipe
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Verificar se o usuário tem permissão para excluir membros da equipe
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email! },
      select: { id: true, role: true }
    })

    if (!currentUser || currentUser.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { error: 'Apenas administradores podem excluir membros da equipe' },
        { status: 403 }
      )
    }

    // Não permitir que o admin exclua a si mesmo
    if (currentUser.id === params.id) {
      return NextResponse.json(
        { error: 'Você não pode excluir sua própria conta' },
        { status: 400 }
      )
    }

    // Verificar se o usuário existe
    const existingUser = await prisma.user.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: {
            assignedTasks: true,
            comments: true,
            teamProjects: true,
          }
        }
      }
    })

    if (!existingUser) {
      return NextResponse.json(
        { error: 'Membro da equipe não encontrado' },
        { status: 404 }
      )
    }

    // Verificar se há dados relacionados
    const hasRelatedData = 
      existingUser._count.assignedTasks > 0 ||
      existingUser._count.comments > 0 ||
      existingUser._count.teamProjects > 0

    if (hasRelatedData) {
      return NextResponse.json(
        { 
          error: 'Não é possível excluir usuário com dados relacionados',
          details: {
            assignedTasks: existingUser._count.assignedTasks,
            comments: existingUser._count.comments,
            teamProjects: existingUser._count.teamProjects,
          }
        },
        { status: 400 }
      )
    }

    await prisma.user.delete({
      where: { id: params.id }
    })

    return NextResponse.json(
      { message: 'Membro da equipe excluído com sucesso' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Erro ao excluir membro da equipe:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}