import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import path from 'path'
import { existsSync } from 'fs'
import { readdir, stat } from 'fs/promises'

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ token: string }> }
) {
  const { token } = await ctx.params
  try {
    const client = await prisma.client.findUnique({
      where: { accessToken: token },
      select: { id: true, name: true }
    })

    if (!client) {
      return NextResponse.json({ error: 'Token inválido ou expirado' }, { status: 404 })
    }

    const clientId = client.id
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
    console.error('[client-portal contracts] error', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
