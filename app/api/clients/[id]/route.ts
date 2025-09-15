import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Schema de validação para atualização de cliente
const updateClientSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').optional(),
  email: z.string().email('Email inválido').optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  address: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  notes: z.string().optional(),
})

interface RouteParams {
  params: {
    id: string
  }
}

// GET - Buscar cliente por ID
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const client = await prisma.client.findUnique({
      where: { id: params.id },
      include: {
        projects: {
          select: {
            id: true,
            name: true,
            status: true,
            startDate: true,
            endDate: true,
            budget: true,
          },
          orderBy: { createdAt: 'desc' }
        },
        _count: {
          select: {
            projects: true,
            comments: true,
          }
        }
      }
    })

    if (!client) {
      return NextResponse.json(
        { error: 'Cliente não encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json(client)
  } catch (error) {
    console.error('Erro ao buscar cliente:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// PUT - Atualizar cliente
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = updateClientSchema.parse(body)

    // Verificar se o cliente existe
    const existingClient = await prisma.client.findUnique({
      where: { id: params.id }
    })

    if (!existingClient) {
      return NextResponse.json(
        { error: 'Cliente não encontrado' },
        { status: 404 }
      )
    }

    // Se está atualizando o email, verificar se não existe outro cliente com o mesmo email
    if (validatedData.email && validatedData.email !== existingClient.email) {
      const emailExists = await prisma.client.findUnique({
        where: { email: validatedData.email }
      })

      if (emailExists) {
        return NextResponse.json(
          { error: 'Já existe um cliente com este email' },
          { status: 400 }
        )
      }
    }

    const updatedClient = await prisma.client.update({
      where: { id: params.id },
      data: validatedData,
      include: {
        projects: {
          select: {
            id: true,
            name: true,
            status: true,
            startDate: true,
            endDate: true,
            budget: true,
          },
          orderBy: { createdAt: 'desc' }
        },
        _count: {
          select: {
            projects: true,
            comments: true,
          }
        }
      }
    })

    return NextResponse.json(updatedClient)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Erro ao atualizar cliente:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// DELETE - Excluir cliente
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Verificar se o cliente existe
    const existingClient = await prisma.client.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: {
            projects: true
          }
        }
      }
    })

    if (!existingClient) {
      return NextResponse.json(
        { error: 'Cliente não encontrado' },
        { status: 404 }
      )
    }

    // Verificar se o cliente tem projetos associados
    if (existingClient._count.projects > 0) {
      return NextResponse.json(
        { 
          error: 'Não é possível excluir cliente com projetos associados',
          details: `Este cliente possui ${existingClient._count.projects} projeto(s) associado(s)` 
        },
        { status: 400 }
      )
    }

    await prisma.client.delete({
      where: { id: params.id }
    })

    return NextResponse.json(
      { message: 'Cliente excluído com sucesso' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Erro ao excluir cliente:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}