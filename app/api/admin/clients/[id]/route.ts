import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, email, phone, company } = body
    const clientId = params.id

    if (!name || !email) {
      return NextResponse.json(
        { error: 'Nome e email são obrigatórios' },
        { status: 400 }
      )
    }

    // Verificar se o cliente existe
    const existingClient = await prisma.client.findUnique({
      where: { id: clientId }
    })

    if (!existingClient) {
      return NextResponse.json(
        { error: 'Cliente não encontrado' },
        { status: 404 }
      )
    }

    // Verificar se já existe outro cliente com este email
    const emailConflict = await prisma.client.findFirst({
      where: {
        email,
        id: { not: clientId }
      }
    })

    if (emailConflict) {
      return NextResponse.json(
        { error: 'Já existe outro cliente com este email' },
        { status: 400 }
      )
    }

    const updatedClient = await prisma.client.update({
      where: { id: clientId },
      data: {
        name,
        email,
        phone: phone || null,
        company: company || null
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        company: true,
        accessToken: true,
        createdAt: true,
        projects: {
          select: {
            id: true
          }
        }
      }
    })

    return NextResponse.json({
      client: {
        ...updatedClient,
        createdAt: updatedClient.createdAt.toISOString(),
        projectsCount: updatedClient.projects.length
      }
    })
  } catch (error) {
    console.error('Erro ao atualizar cliente:', error)
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
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 403 }
      )
    }

    const clientId = params.id

    // Verificar se o cliente existe
    const existingClient = await prisma.client.findUnique({
      where: { id: clientId },
      include: {
        projects: true
      }
    })

    if (!existingClient) {
      return NextResponse.json(
        { error: 'Cliente não encontrado' },
        { status: 404 }
      )
    }

    // Verificar se o cliente tem projetos associados
    if (existingClient.projects.length > 0) {
      return NextResponse.json(
        { error: 'Não é possível excluir cliente com projetos associados' },
        { status: 400 }
      )
    }

    await prisma.client.delete({
      where: { id: clientId }
    })

    return NextResponse.json({
      message: 'Cliente excluído com sucesso'
    })
  } catch (error) {
    console.error('Erro ao excluir cliente:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}