import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir, readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

const UPLOAD_DIR = path.join(process.cwd(), 'uploads')
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg', 
  'image/png',
  'image/gif',
  'image/webp'
]

export async function POST(request: NextRequest) {
  try {
    console.log('=== UPLOAD API ===')
    
    // Verificar se a pasta uploads existe, se não, criar
    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true })
      console.log('Pasta uploads criada:', UPLOAD_DIR)
    }

    const formData = await request.formData()
    
    const file = formData.get('file') as File
    const taskId = formData.get('taskId') as string

    if (!file) {
      console.log('ERROR: Nenhum arquivo enviado')
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
    }

    if (!(file instanceof File)) {
      console.log('ERROR: Objeto não é um File:', typeof file)
      return NextResponse.json({ error: 'Objeto enviado não é um arquivo válido' }, { status: 400 })
    }

    // Validar tipo de arquivo
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ 
        error: 'Tipo de arquivo não permitido. Apenas PDF e imagens (JPG, PNG, GIF, WebP)' 
      }, { status: 400 })
    }

    // Validar tamanho do arquivo
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ 
        error: 'Arquivo muito grande. Máximo 10MB' 
      }, { status: 400 })
    }

    // Gerar nome único para o arquivo
    const fileExtension = path.extname(file.name)
    const uniqueFileName = `${uuidv4()}${fileExtension}`
    
    // Criar subpasta por tarefa se taskId fornecido
    let uploadPath = UPLOAD_DIR
    let relativePath = uniqueFileName
    
    if (taskId) {
      uploadPath = path.join(UPLOAD_DIR, 'tasks', taskId)
      relativePath = `tasks/${taskId}/${uniqueFileName}`
      
      if (!existsSync(uploadPath)) {
        await mkdir(uploadPath, { recursive: true })
      }
    }

    const filePath = path.join(uploadPath, uniqueFileName)

    // Converter arquivo para buffer e salvar
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    console.log('Arquivo salvo em:', filePath)

    // Retornar informações do arquivo com URL direta para acesso
    const fileInfo = {
      id: uuidv4(),
      originalName: file.name,
      fileName: uniqueFileName,
      filePath: relativePath,
      fileUrl: `/api/files/${relativePath}`, // URL direta para acessar o arquivo
      fileSize: file.size,
      fileType: file.type,
      uploadedAt: new Date().toISOString(),
      taskId: taskId || null
    }

    return NextResponse.json({
      success: true,
      file: fileInfo,
      message: 'Arquivo enviado com sucesso!'
    })

  } catch (error) {
    console.error('Erro no upload:', error)
    return NextResponse.json({ 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 })
  }
}

// API para servir arquivos estáticos (redirecionando para a nova rota)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const filePath = searchParams.get('file')

    if (!filePath) {
      return NextResponse.json({ error: 'Caminho do arquivo não fornecido' }, { status: 400 })
    }

    // Redirecionar para a nova rota de arquivos
    return NextResponse.redirect(new URL(`/api/files/${filePath}`, request.url))

  } catch (error) {
    console.error('Erro ao buscar arquivo:', error)
    return NextResponse.json({ 
      error: 'Erro interno do servidor' 
    }, { status: 500 })
  }
}
