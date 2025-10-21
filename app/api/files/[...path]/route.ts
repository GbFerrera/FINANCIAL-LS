import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { getServerSession } from 'next-auth'

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    console.log('=== FILES API ===')
    console.log('Params path:', params.path)
    
    // Verificar autenticação (temporariamente desabilitado para debug)
    // const session = await getServerSession()
    // if (!session?.user) {
    //   console.log('ERROR: Não autorizado')
    //   return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    // }

    const filePath = params.path.join('/')
    const fullPath = path.join(process.cwd(), 'uploads', filePath)

    console.log('File path construído:', filePath)
    console.log('Full path:', fullPath)
    console.log('Arquivo existe?', existsSync(fullPath))

    // Verificar se o arquivo existe
    if (!existsSync(fullPath)) {
      return NextResponse.json({ error: 'Arquivo não encontrado' }, { status: 404 })
    }

    // Verificar se o caminho está dentro da pasta uploads (segurança)
    const uploadsDir = path.join(process.cwd(), 'uploads')
    if (!fullPath.startsWith(uploadsDir)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    // Ler o arquivo
    const fileBuffer = await readFile(fullPath)
    
    // Determinar o tipo de conteúdo baseado na extensão
    const ext = path.extname(fullPath).toLowerCase()
    let contentType = 'application/octet-stream'
    
    switch (ext) {
      case '.pdf':
        contentType = 'application/pdf'
        break
      case '.jpg':
      case '.jpeg':
        contentType = 'image/jpeg'
        break
      case '.png':
        contentType = 'image/png'
        break
      case '.gif':
        contentType = 'image/gif'
        break
      case '.webp':
        contentType = 'image/webp'
        break
    }

    // Retornar o arquivo com headers apropriados
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'public, max-age=31536000', // Cache por 1 ano
      },
    })

  } catch (error) {
    console.error('Erro ao servir arquivo:', error)
    return NextResponse.json({ 
      error: 'Erro interno do servidor' 
    }, { status: 500 })
  }
}
