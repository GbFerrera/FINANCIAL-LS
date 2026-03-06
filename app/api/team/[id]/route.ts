import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { UserRole } from '@prisma/client'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
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
        skillsMastered: true,
        skillsReinforcement: true,
        skillsInterests: true,
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    return NextResponse.json(user)
  } catch (error) {
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z.nativeEnum(UserRole).optional(),
  password: z.string().min(6).optional()
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    if (session.user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: 'Apenas administradores podem editar membros' }, { status: 403 })
    }

    const body = await request.json()
    const data = updateSchema.parse(body)

    const updates: any = {}
    if (data.name) updates.name = data.name
    if (data.email) updates.email = data.email
    if (data.role) updates.role = data.role
    if (data.password) {
      updates.password = await bcrypt.hash(data.password, 12)
    }

    const user = await prisma.user.update({
      where: { id: params.id },
      data: updates,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatar: true,
        accessToken: true,
        createdAt: true,
        updatedAt: true
      }
    })

    return NextResponse.json(user)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    if (session.user.role !== UserRole.ADMIN) {
      return NextResponse.json({ error: 'Apenas administradores podem excluir membros' }, { status: 403 })
    }

    const userId = params.id

    const existing = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    // Resolver FKs que não têm cascade: tarefas e entradas financeiras
    await prisma.$transaction(async (tx) => {
      // Desatribuir tarefas
      await tx.task.updateMany({
        where: { assigneeId: userId },
        data: { assigneeId: null }
      })

      // Limpar colaborador de entradas financeiras
      await tx.financialEntry.updateMany({
        where: { collaboratorId: userId },
        data: { collaboratorId: null }
      })

      // Remover relações auxiliares (idempotentes)
      await tx.projectTeam.deleteMany({ where: { userId } })
      await tx.userPageAccess.deleteMany({ where: { userId } })
      await tx.compensationProfile.deleteMany({ where: { userId } })
      await tx.noteAccess.deleteMany({ where: { userId } })
      await tx.notification.deleteMany({ where: { userId } })
      await tx.timeEntry.deleteMany({ where: { userId } })
      await tx.timerEvent.deleteMany({ where: { userId } })

      // Finalmente, excluir usuário
      await tx.user.delete({ where: { id: userId } })
    })

    return NextResponse.json({ message: 'Usuário excluído com sucesso' }, { status: 200 })
  } catch (error) {
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
