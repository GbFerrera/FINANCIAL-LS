import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const { id } = params
    const body = await request.json()
    const { read } = body

    if (typeof read !== 'boolean') {
      return NextResponse.json(
        { error: 'Campo "read" deve ser um boolean' },
        { status: 400 }
      )
    }

    // Simular atualização da notificação
    // Em uma implementação real, atualizaria no banco de dados
    const updatedNotification = {
      id,
      read,
      updatedAt: new Date().toISOString()
    }

    return NextResponse.json({
      notification: updatedNotification
    })
  } catch (error) {
    console.error('Erro ao atualizar notificação:', error)
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
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const { id } = params

    // Simular exclusão da notificação
    // Em uma implementação real, removeria do banco de dados
    
    return NextResponse.json({
      message: 'Notificação excluída com sucesso',
      deletedId: id
    })
  } catch (error) {
    console.error('Erro ao excluir notificação:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}