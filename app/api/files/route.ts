import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const path = searchParams.get('path') || '/'
    const type = searchParams.get('type') // 'all', 'files', 'folders'
    const projectId = searchParams.get('projectId')

    // Buscar arquivos reais do banco de dados
    const files = await prisma.projectFile.findMany({
      where: projectId ? {
        projectId: projectId
      } : {},
      include: {
        project: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Transformar dados para o formato esperado pelo frontend
    const formattedFiles = files.map(file => ({
      id: file.id,
      name: file.originalName,
      type: 'file',
      path: file.url,
      size: file.size,
      mimeType: file.mimeType,
      url: file.url,
      uploadedBy: 'Usuário',
      uploadedAt: file.createdAt.toISOString(),
      lastModified: file.createdAt.toISOString(),
      projectId: file.projectId,
      projectName: file.project?.name || 'Sem projeto',
      shared: false,
      permissions: ['read', 'write']
    }))

    return NextResponse.json({
      files: formattedFiles,
      path,
      totalSize: formattedFiles.reduce((acc, f) => acc + (f.size || 0), 0)
    })
  } catch (error) {
    console.error('Erro ao buscar arquivos:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const formData = await request.formData()
    const files = formData.getAll('files') as File[]
    const path = formData.get('path') as string || '/'
    const projectId = formData.get('projectId') as string
    const comment = formData.get('comment') as string

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum arquivo fornecido' },
        { status: 400 }
      )
    }

    const uploadedFiles = []
    const uploadDir = join(process.cwd(), 'public', 'uploads')

    // Criar diretório de upload se não existir
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    for (const file of files) {
      // Validar tamanho do arquivo (máximo 50MB)
      if (file.size > 50 * 1024 * 1024) {
        return NextResponse.json(
          { error: `Arquivo ${file.name} é muito grande. Máximo 50MB.` },
          { status: 400 }
        )
      }

      // Validar tipo de arquivo
      const allowedTypes = [
        'image/', 'application/pdf', 'application/msword',
        'application/vnd.openxmlformats-officedocument',
        'text/', 'application/zip', 'application/x-rar'
      ]
      
      const isAllowed = allowedTypes.some(type => file.type.startsWith(type))
      if (!isAllowed) {
        return NextResponse.json(
          { error: `Tipo de arquivo não permitido: ${file.type}` },
          { status: 400 }
        )
      }

      // Gerar nome único para o arquivo
      const timestamp = Date.now()
      const fileName = `${timestamp}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
      const filePath = join(uploadDir, fileName)

      // Salvar arquivo
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      await writeFile(filePath, buffer)

      // Simular salvamento no banco de dados
      const fileRecord = {
        id: `file_${timestamp}`,
        name: file.name,
        originalName: file.name,
        fileName: fileName,
        type: 'file',
        size: file.size,
        mimeType: file.type,
        path: path,
        url: `/uploads/${fileName}`,
        downloadUrl: `/api/files/download/file_${timestamp}`,
        uploadedBy: session.user.name || 'Usuário',
        uploadedById: session.user.id,
        uploadedAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        projectId: projectId || null,
        shared: false,
        permissions: ['read', 'write'],
        versions: [
          {
            id: 'v1',
            version: 1,
            uploadedBy: session.user.name || 'Usuário',
            uploadedAt: new Date().toISOString(),
            size: file.size,
            comment: comment || 'Upload inicial',
            url: `/api/files/download/file_${timestamp}/v1`,
            fileName: fileName
          }
        ]
      }

      uploadedFiles.push(fileRecord)
    }

    return NextResponse.json({
      files: uploadedFiles,
      message: `${uploadedFiles.length} arquivo(s) enviado(s) com sucesso`
    })
  } catch (error) {
    console.error('Erro no upload:', error)
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
    const fileId = searchParams.get('id')

    if (!fileId) {
      return NextResponse.json(
        { error: 'ID do arquivo é obrigatório' },
        { status: 400 }
      )
    }

    // Verificar permissões
    // Em uma implementação real, verificaria se o usuário tem permissão para deletar
    
    // Simular exclusão do arquivo
    // Em uma implementação real, removeria do banco de dados e sistema de arquivos
    
    return NextResponse.json({
      message: 'Arquivo excluído com sucesso',
      deletedId: fileId
    })
  } catch (error) {
    console.error('Erro ao excluir arquivo:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}