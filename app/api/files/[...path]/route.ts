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
    const filePath = params.path.join('/')
    const uploadsDir = path.join(process.cwd(), 'uploads')
    const publicDir = path.join(process.cwd(), 'public')
    let fullPath = path.join(uploadsDir, filePath)

    // Fallback para a pasta public se não existir em uploads
    if (!existsSync(fullPath)) {
      const publicPath = path.join(publicDir, filePath)
      if (existsSync(publicPath)) {
        fullPath = publicPath
      } else {
        return NextResponse.json({ error: 'Arquivo não encontrado' }, { status: 404 })
      }
    }

    // Segurança: garantir que está dentro de uploads OU public
    if (!(fullPath.startsWith(uploadsDir) || fullPath.startsWith(publicDir))) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    // Ler o arquivo
    const fileBuffer = await readFile(fullPath)
    
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
      case '.doc':
        contentType = 'application/msword'
        break
      case '.docx':
        contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        break
      case '.xls':
        contentType = 'application/vnd.ms-excel'
        break
      case '.xlsx':
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        break
      case '.txt':
        contentType = 'text/plain'
        break
      case '.zip':
        contentType = 'application/zip'
        break
      case '.rar':
        contentType = 'application/x-rar-compressed'
        break
      case '.xml':
        contentType = 'application/xml'
        break
    }

    // Retornar o arquivo com headers apropriados
    return new Response(fileBuffer, {
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
