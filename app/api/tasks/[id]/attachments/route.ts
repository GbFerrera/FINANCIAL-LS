import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  removeAttachmentFromDescription,
} from '@/lib/task-attachments'
import path from 'path'
import { readdir, stat, unlink } from 'fs/promises'
import { existsSync } from 'fs'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = await params
    const uploadsDir = path.join(process.cwd(), 'uploads', 'tasks', id)
    if (!existsSync(uploadsDir)) {
      return NextResponse.json({ attachments: [] })
    }

    const files = await readdir(uploadsDir)
    const mapType = (ext: string) => {
      switch (ext) {
        case '.pdf': return 'application/pdf'
        case '.jpg':
        case '.jpeg': return 'image/jpeg'
        case '.png': return 'image/png'
        case '.gif': return 'image/gif'
        case '.webp': return 'image/webp'
        default: return 'application/octet-stream'
      }
    }

    const attachments = await Promise.all(files.map(async (filename: string) => {
      const full = path.join(uploadsDir, filename)
      const st = await stat(full)
      const ext = path.extname(filename).toLowerCase()
      const rel = `tasks/${id}/${filename}`
      return {
        originalName: filename,
        filename: filename,
        filePath: rel,
        url: `/api/files/${rel}`,
        mimeType: mapType(ext),
        size: st.size
      }
    }))

    return NextResponse.json({ attachments })
  } catch (error) {
    console.error('Erro ao listar anexos (task):', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const filePath = typeof body.filePath === 'string' ? body.filePath : ''
    const filename =
      typeof body.filename === 'string'
        ? body.filename
        : filePath.split('/').pop() || ''

    if (!filename) {
      return NextResponse.json({ error: 'Arquivo não informado' }, { status: 400 })
    }

    const diskPath = path.join(process.cwd(), 'uploads', 'tasks', id, filename)
    if (existsSync(diskPath)) {
      await unlink(diskPath)
    }

    const task = await prisma.task.findUnique({
      where: { id },
      select: { description: true },
    })

    if (task) {
      const description = removeAttachmentFromDescription(task.description, {
        filePath,
        fileName: filename,
        originalName: filename,
      })
      await prisma.task.update({
        where: { id },
        data: { description: description || null },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao remover anexo (task):', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
