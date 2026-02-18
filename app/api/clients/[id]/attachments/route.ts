import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import path from 'path'
import { existsSync } from 'fs'
import { readdir, stat } from 'fs/promises'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const clientId = params.id
    const baseDir = path.join(process.cwd(), 'uploads', 'clients', clientId)

    if (!existsSync(baseDir)) {
      return NextResponse.json({ attachments: [] })
    }

    const files = await readdir(baseDir)

    const attachments = await Promise.all(
      files.map(async (file) => {
        const fullPath = path.join(baseDir, file)
        const stats = await stat(fullPath)
        return {
          filename: file,
          url: `/api/files/clients/${clientId}/${file}`,
          size: stats.size,
          uploadedAt: stats.mtime.toISOString(),
        }
      })
    )

    attachments.sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1))

    return NextResponse.json({ attachments })
  } catch (error) {
    console.error('Erro ao listar anexos do cliente:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
