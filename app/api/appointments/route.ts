import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const appointmentSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório'),
  description: z.string().optional(),
  start: z.string().or(z.date()),
  end: z.string().or(z.date()),
  userId: z.string().min(1, 'Usuário é obrigatório'),
  status: z.string().default('scheduled'),
  type: z.string().default('meeting'),
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const start = searchParams.get('start')
    const end = searchParams.get('end')
    const userId = searchParams.get('userId')

    const where: any = {}
    if (start && end) {
      where.start = {
        gte: new Date(start),
      }
      where.end = {
        lte: new Date(end),
      }
    }
    if (userId) {
      where.userId = userId
    }

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
      orderBy: {
        start: 'asc',
      },
    })

    return NextResponse.json(appointments)
  } catch (error) {
    console.error('Erro ao buscar agendamentos:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = appointmentSchema.parse(body)

    const appointment = await prisma.appointment.create({
      data: {
        title: validatedData.title,
        description: validatedData.description,
        start: new Date(validatedData.start),
        end: new Date(validatedData.end),
        user: {
          connect: { id: validatedData.userId }
        },
        status: validatedData.status,
        type: validatedData.type,
      },
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
    console.error('Erro ao criar agendamento:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
