import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const appointmentSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório').optional(),
  description: z.string().optional(),
  start: z.string().or(z.date()).optional(),
  end: z.string().or(z.date()).optional(),
  userId: z.string().min(1, 'Usuário é obrigatório').optional(),
  status: z.string().optional(),
  type: z.string().optional(),
})

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const validatedData = appointmentSchema.parse(body)

    const updateData: any = {}
    if (validatedData.title) updateData.title = validatedData.title
    if (validatedData.description !== undefined) updateData.description = validatedData.description
    if (validatedData.start) updateData.start = new Date(validatedData.start)
    if (validatedData.end) updateData.end = new Date(validatedData.end)
    if (validatedData.userId) {
      updateData.user = {
        connect: { id: validatedData.userId }
      }
    }
    if (validatedData.status) updateData.status = validatedData.status
    if (validatedData.type) updateData.type = validatedData.type

    const appointment = await prisma.appointment.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    })

    return NextResponse.json(appointment)
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    console.error('Erro ao atualizar agendamento:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
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

    const { id } = await params
    await prisma.appointment.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Agendamento excluído com sucesso' })
  } catch (error) {
    console.error('Erro ao excluir agendamento:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
