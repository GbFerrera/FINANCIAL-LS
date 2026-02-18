import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import path from 'path'
import { readdir, stat } from 'fs/promises'
import { existsSync } from 'fs'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = params
    const uploadsDir = path.join(process.cwd(), 'uploads', 'notes', id)
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
      const rel = `notes/${id}/${filename}`
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
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
