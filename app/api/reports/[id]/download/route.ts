import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { getReportMeta, readReportFile } from '@/lib/reports/storage'
import { formatMimeType } from '@/lib/reports/types'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id: reportId } = await params
    const inline = new URL(request.url).searchParams.get('inline') === '1'
    const meta = await getReportMeta(session.user.id, reportId)

    if (!meta) {
      return NextResponse.json({ error: 'Relatório não encontrado' }, { status: 404 })
    }

    const file = await readReportFile(session.user.id, reportId, meta.format)
    if (!file) {
      return NextResponse.json({ error: 'Arquivo do relatório não encontrado' }, { status: 404 })
    }

    return new NextResponse(new Uint8Array(file), {
      status: 200,
      headers: {
        'Content-Type': formatMimeType(meta.format),
        'Content-Disposition': inline
          ? `inline; filename="${meta.filename}"`
          : `attachment; filename="${meta.filename}"`,
        'Content-Length': String(file.length),
        'Cache-Control': 'private, no-cache',
      },
    })
  } catch (error) {
    console.error('Erro ao fazer download do relatório:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
