import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { scheduleLinkBrainSync } from '@/lib/link-brain-sync/trigger'
import { z } from 'zod'

// Schema de validação para cliente
const clientSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email('Email inválido'),
  phone: z.string().optional(),
  company: z.string().optional(),
})

// GET - Listar todos os clientes
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const limitParam = searchParams.get('limit') || '10'
    const fetchAll = limitParam === 'all'
    const parsedLimit = fetchAll ? 0 : parseInt(limitParam)
    const limit = fetchAll ? undefined : parsedLimit
    const skip = fetchAll ? undefined : (page - 1) * parsedLimit

    const where: any = {}
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
      ]
    }
    
    if (status && status !== 'all') {
      where.status = status
    }

    const [clients, total, projectStats] = await Promise.all([
      prisma.client.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          projects: {
            select: {
              id: true,
              name: true,
              status: true,
              budget: true,
            }
          },
          _count: {
            select: {
              projects: true,
            }
          }
        }
      }),
      prisma.client.count({ where }),
      prisma.project.aggregate({
        where: Object.keys(where).length > 0 ? { client: where } : {},
        _count: { id: true },
        _sum: { budget: true },
      }),
    ])

    return NextResponse.json({
      clients,
      pagination: {
        page,
        limit: fetchAll ? total : parsedLimit,
        total,
        pages: fetchAll ? 1 : Math.max(1, Math.ceil(total / parsedLimit))
      },
      summary: {
        totalProjects: projectStats._count.id,
        totalValue: projectStats._sum.budget ?? 0,
      },
    })
  } catch (error) {
    console.error('Erro ao buscar clientes:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// POST - Criar novo cliente
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = clientSchema.parse(body)

    // Verificar se já existe um cliente com o mesmo email
    const existingClient = await prisma.client.findUnique({
      where: { email: validatedData.email }
    })

    if (existingClient) {
      return NextResponse.json(
        { error: 'Já existe um cliente com este email' },
        { status: 400 }
      )
    }

    // Gerar token único para acesso ao portal do cliente
    const accessToken = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const client = await prisma.client.create({
      data: {
        ...validatedData,
        accessToken,
      },
      include: {
        projects: {
          select: {
            id: true,
            name: true,
            status: true,
          }
        },
        _count: {
          select: {
            projects: true,
          }
        }
      }
    })

    scheduleLinkBrainSync('cliente criado')
    return NextResponse.json(client, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Erro ao criar cliente:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
