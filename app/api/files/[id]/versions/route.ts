import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const { id } = params
    const formData = await request.formData()
    const file = formData.get('file') as File
    const comment = formData.get('comment') as string

    if (!file) {
      return NextResponse.json(
        { error: 'Arquivo é obrigatório' },
        { status: 400 }
      )
    }

    // Validar tamanho do arquivo (máximo 50MB)
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Arquivo é muito grande. Máximo 50MB.' },
        { status: 400 }
      )
    }

    // Buscar arquivo original para validar tipo
    // Em uma implementação real, buscaria do banco de dados
    const originalFile = {
      id: id,
      name: 'Proposta_Comercial_v2.pdf',
      mimeType: 'application/pdf',
      currentVersion: 2
    }

    // Validar se o tipo do arquivo é compatível
    if (file.type !== originalFile.mimeType) {
      return NextResponse.json(
        { error: `Tipo de arquivo deve ser ${originalFile.mimeType}` },
        { status: 400 }
      )
    }

    const uploadDir = join(process.cwd(), 'public', 'uploads')

    // Criar diretório de upload se não existir
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    // Gerar nome único para a nova versão
    const newVersion = originalFile.currentVersion + 1
    const timestamp = Date.now()
    const fileName = `${id}_v${newVersion}_${originalFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
    const filePath = join(uploadDir, fileName)

    // Salvar arquivo
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    // Criar registro da nova versão
    const newVersionRecord = {
      id: `v${newVersion}`,
      version: newVersion,
      uploadedBy: session.user.name || 'Usuário',
      uploadedById: session.user.id,
      uploadedAt: new Date().toISOString(),
      size: file.size,
      comment: comment || `Versão ${newVersion}`,
      url: `/api/files/download/${id}/v${newVersion}`,
      fileName: fileName,
      downloadCount: 0
    }

    // Criar entrada no histórico
    const historyEntry = {
      id: `h_${timestamp}`,
      action: 'version_upload',
      version: newVersion,
      performedBy: session.user.name || 'Usuário',
      performedAt: new Date().toISOString(),
      comment: comment || `Nova versão ${newVersion} enviada`,
      details: {
        size: file.size,
        previousVersion: originalFile.currentVersion,
        fileName: fileName
      }
    }

    // Simular atualização no banco de dados
    // Em uma implementação real, salvaria a nova versão e atualizaria o arquivo principal

    return NextResponse.json({
      version: newVersionRecord,
      history: historyEntry,
      message: `Versão ${newVersion} criada com sucesso`
    })
  } catch (error) {
    console.error('Erro ao criar nova versão:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

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
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Buscar versões do arquivo do banco de dados
    // TODO: Implementar modelo FileVersion no Prisma
    // Por enquanto, retornar array vazio até implementar o modelo
    const versions: any[] = []
    
    // Em uma implementação real, seria algo como:
    // const versions = await prisma.fileVersion.findMany({
    //   where: { fileId: id },
    //   orderBy: { version: 'desc' },
    //   skip: offset,
    //   take: limit,
    //   include: {
    //     uploadedBy: {
    //       select: { name: true }
    //     }
    //   }
    // })

    return NextResponse.json({
      versions: versions,
      total: versions.length,
      currentVersion: versions.length > 0 ? Math.max(...versions.map(v => v.version)) : 1,
      hasMore: false
    })
  } catch (error) {
    console.error('Erro ao buscar versões:', error)
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
    const { searchParams } = new URL(request.url)
    const version = searchParams.get('version')

    if (!version) {
      return NextResponse.json(
        { error: 'Versão é obrigatória' },
        { status: 400 }
      )
    }

    const versionNumber = parseInt(version)
    if (isNaN(versionNumber) || versionNumber < 1) {
      return NextResponse.json(
        { error: 'Versão inválida' },
        { status: 400 }
      )
    }

    // Verificar se não é a versão ativa
    // Em uma implementação real, verificaria no banco de dados
    const currentVersion = 2
    if (versionNumber === currentVersion) {
      return NextResponse.json(
        { error: 'Não é possível excluir a versão ativa' },
        { status: 400 }
      )
    }

    // Verificar permissões
    // Em uma implementação real, verificaria se o usuário tem permissão

    // Simular exclusão da versão
    // Em uma implementação real, removeria do banco de dados e sistema de arquivos

    // Criar entrada no histórico
    const historyEntry = {
      id: `h_${Date.now()}`,
      action: 'version_delete',
      version: versionNumber,
      performedBy: session.user.name || 'Usuário',
      performedAt: new Date().toISOString(),
      comment: `Versão ${versionNumber} excluída`,
      details: {
        deletedVersion: versionNumber
      }
    }

    return NextResponse.json({
      message: `Versão ${versionNumber} excluída com sucesso`,
      deletedVersion: versionNumber,
      history: historyEntry
    })
  } catch (error) {
    console.error('Erro ao excluir versão:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}