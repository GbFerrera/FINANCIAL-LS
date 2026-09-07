import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { getReportMeta, getReportPreview } from '@/lib/reports/storage'

const DEFAULT_LIMIT = 10
const MAX_LIMIT = 50

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
    const meta = await getReportMeta(session.user.id, reportId)

    if (!meta) {
      return NextResponse.json({ error: 'Relatório não encontrado' }, { status: 404 })
    }

    const payload = await getReportPreview(session.user.id, reportId)
    if (!payload) {
      return NextResponse.json(
        {
          error: 'Preview indisponível para este relatório',
          meta: {
            id: meta.id,
            name: meta.name,
            type: meta.type,
            format: meta.format === 'xlsx' ? 'excel' : meta.format,
            createdAt: meta.createdAt,
            size: meta.size,
          },
          hasPreview: false,
        },
        { status: 404 }
      )
    }

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT)
    )

    const totalRows = payload.rows.length
    const totalPages = Math.max(1, Math.ceil(totalRows / limit))
    const safePage = Math.min(page, totalPages)
    const start = (safePage - 1) * limit
    const rows = payload.rows.slice(start, start + limit)

    return NextResponse.json({
      hasPreview: true,
      meta: {
        id: meta.id,
        name: meta.name,
        type: meta.type,
        format: meta.format === 'xlsx' ? 'excel' : meta.format,
        createdAt: meta.createdAt,
        size: meta.size,
        filename: meta.filename,
      },
      title: payload.title,
      generatedAt: payload.generatedAt,
      generatedBy: payload.generatedBy,
      dateRange: payload.dateRange,
      columns: payload.columns,
      summary: payload.summary ?? {},
      rows,
      pagination: {
        page: safePage,
        limit,
        totalRows,
        totalPages,
      },
      inlineUrl: `/api/reports/${reportId}/download?inline=1`,
    })
  } catch (error) {
    console.error('Erro ao buscar preview do relatório:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
