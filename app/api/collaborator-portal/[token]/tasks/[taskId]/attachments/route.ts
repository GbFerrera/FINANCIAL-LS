import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string; taskId: string } }
) {
  try {
    const { token, taskId } = params

    const user = await prisma.user.findUnique({
      where: { accessToken: token },
      select: { id: true, role: true }
    })
    if (!user || user.role !== 'TEAM') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const task = await prisma.task.findFirst({
      where: { id: taskId, assigneeId: user.id },
      select: { id: true, description: true }
    })
    if (!task) {
      return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 })
    }

    const body = await request.json()
    const attachments = Array.isArray(body?.attachments) ? body.attachments : []

    if (attachments.length > 0) {
      const count = attachments.length
      const header = `📎 Anexos (${count}):`
      const lines = attachments.map((a: any) => {
        const name = a.originalName || a.fileName || ''
        const type = a.fileType || a.mimeType || 'application/octet-stream'
        const path = a.filePath || ''
        return `• ${name} (${type}) - ${path}`
      })

      const existing = task.description || ''
      const parts = existing.split('\n')
      const kept: string[] = []
      let inSection = false
      for (const line of parts) {
        if (line.includes('📎 Anexos (')) {
          inSection = true
          continue
        }
        if (inSection && line.startsWith('• ')) {
          continue
        }
        if (inSection && !line.startsWith('• ')) {
          inSection = false
          if (line.trim() === '') continue
        }
        if (!inSection) kept.push(line)
      }
      const cleaned = kept.join('\n').trim()
      const desc = cleaned ? `${cleaned}\n\n${header}\n${lines.join('\n')}` : `${header}\n${lines.join('\n')}`

      await prisma.task.update({
        where: { id: taskId },
        data: { description: desc }
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao anexar imagens:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { token: string; taskId: string } }
) {
  try {
    const { token, taskId } = params
    const user = await prisma.user.findUnique({
      where: { accessToken: token },
      select: { id: true, role: true }
    })
    if (!user || user.role !== 'TEAM') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const task = await prisma.task.findFirst({
      where: { id: taskId, assigneeId: user.id },
      select: { id: true }
    })
    if (!task) {
      return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 })
    }

    const path = require('path')
    const { readdir, stat } = require('fs/promises')
    const { existsSync } = require('fs')

    const uploadsDir = path.join(process.cwd(), 'uploads', 'tasks', taskId)
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
      const rel = `tasks/${taskId}/${filename}`
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
    console.error('Erro ao listar anexos:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
