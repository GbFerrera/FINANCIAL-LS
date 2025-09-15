import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const { id } = params
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') // 'download', 'info', 'versions'
    const version = searchParams.get('version')

    // Buscar arquivo real do banco de dados
    const file = await prisma.projectFile.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            name: true
          }
        }
      }
    })

    if (!file) {
      return NextResponse.json(
        { error: 'Arquivo não encontrado' },
        { status: 404 }
      )
    }

    const fileData = {
      id: file.id,
      name: file.originalName,
      originalName: file.originalName,
      type: 'file',
      size: file.size,
      mimeType: file.mimeType,
      path: file.url,
      url: file.url,
      uploadedBy: 'Usuário',
      uploadedById: session.user.id,
      uploadedAt: file.createdAt.toISOString(),
      lastModified: file.createdAt.toISOString(),
      projectId: file.projectId,
      projectName: file.project?.name || 'Sem projeto',
      shared: false,
      permissions: ['read', 'write'],
      downloadCount: 0
    }

    if (action === 'download') {
      return NextResponse.json({
        downloadUrl: fileData.url,
        fileName: fileData.name,
        mimeType: fileData.mimeType,
        size: fileData.size
      })
    }

    if (action === 'versions') {
      return NextResponse.json({
        versions: [],
        currentVersion: 1
      })
    }

    if (action === 'history') {
      return NextResponse.json({
        history: []
      })
    }

    // Retornar informações completas do arquivo
    return NextResponse.json(fileData)
  } catch (error) {
    console.error('Erro ao buscar arquivo:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
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
    const { name, shared, permissions } = body

    // Buscar arquivo
    const file = await prisma.projectFile.findUnique({
      where: { id }
    })

    if (!file) {
      return NextResponse.json(
        { error: 'Arquivo não encontrado' },
        { status: 404 }
      )
    }

    // Atualizar arquivo (apenas campos permitidos)
    const updatedFile = await prisma.projectFile.update({
      where: { id },
      data: {
        originalName: name || file.originalName
      },
      include: {
        project: {
          select: {
            name: true
          }
        }
      }
    })

    return NextResponse.json({
      id: updatedFile.id,
      name: updatedFile.originalName,
      originalName: updatedFile.originalName,
      type: 'file',
      size: updatedFile.size,
      mimeType: updatedFile.mimeType,
      path: updatedFile.url,
      url: updatedFile.url,
      uploadedBy: 'Usuário',
      uploadedAt: updatedFile.createdAt.toISOString(),
      lastModified: updatedFile.createdAt.toISOString(),
      projectId: updatedFile.projectId,
      projectName: updatedFile.project?.name || 'Sem projeto',
      shared: shared || false,
      permissions: permissions || ['read', 'write']
    })
  } catch (error) {
    console.error('Erro ao atualizar arquivo:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const { id } = params

    // Buscar arquivo
    const file = await prisma.projectFile.findUnique({
      where: { id }
    })

    if (!file) {
      return NextResponse.json(
        { error: 'Arquivo não encontrado' },
        { status: 404 }
      )
    }

    // Deletar arquivo do banco de dados
    await prisma.projectFile.delete({
      where: { id }
    })

    return NextResponse.json({
      message: 'Arquivo deletado com sucesso'
    })
  } catch (error) {
    console.error('Erro ao deletar arquivo:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}