import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { name, path, projectId } = body

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Nome da pasta é obrigatório' },
        { status: 400 }
      )
    }

    // Validar nome da pasta
    const invalidChars = /[<>:"/\\|?*]/
    if (invalidChars.test(name)) {
      return NextResponse.json(
        { error: 'Nome da pasta contém caracteres inválidos' },
        { status: 400 }
      )
    }

    // Simular criação da pasta
    // Em uma implementação real, criaria no banco de dados e sistema de arquivos
    const timestamp = Date.now()
    const folderRecord = {
      id: `folder_${timestamp}`,
      name: name.trim(),
      type: 'folder',
      path: path ? `${path}/${name.trim()}` : `/${name.trim()}`,
      createdBy: session.user.name || 'Usuário',
      createdById: session.user.id,
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      projectId: projectId || null,
      shared: false,
      permissions: ['read', 'write'],
      size: null,
      fileCount: 0,
      folderCount: 0
    }

    return NextResponse.json({
      folder: folderRecord,
      message: 'Pasta criada com sucesso'
    })
  } catch (error) {
    console.error('Erro ao criar pasta:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const folderId = searchParams.get('id')
    const force = searchParams.get('force') === 'true'

    if (!folderId) {
      return NextResponse.json(
        { error: 'ID da pasta é obrigatório' },
        { status: 400 }
      )
    }

    // Verificar se a pasta está vazia (se não for exclusão forçada)
    if (!force) {
      // Simular verificação de conteúdo
      // Em uma implementação real, verificaria se há arquivos ou subpastas
      const hasContent = Math.random() > 0.7 // Simular pasta com conteúdo
      
      if (hasContent) {
        return NextResponse.json(
          { 
            error: 'A pasta não está vazia. Use force=true para excluir com conteúdo.',
            code: 'FOLDER_NOT_EMPTY'
          },
          { status: 400 }
        )
      }
    }

    // Verificar permissões
    // Em uma implementação real, verificaria se o usuário tem permissão para deletar
    
    // Simular exclusão da pasta
    // Em uma implementação real, removeria do banco de dados e sistema de arquivos
    
    return NextResponse.json({
      message: force ? 'Pasta e todo seu conteúdo excluídos com sucesso' : 'Pasta excluída com sucesso',
      deletedId: folderId
    })
  } catch (error) {
    console.error('Erro ao excluir pasta:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}