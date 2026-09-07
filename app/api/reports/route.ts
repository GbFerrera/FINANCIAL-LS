import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { fetchReportPayload } from '@/lib/reports/fetch-data'
import { generateReportBuffer } from '@/lib/reports/generate'
import {
  deleteReport,
  listUserReports,
  saveReportFile,
  saveReportMeta,
  saveReportPreview,
} from '@/lib/reports/storage'
import {
  ReportType,
  formatExtension,
  formatMimeType,
  normalizeFormat,
} from '@/lib/reports/types'
import { randomUUID } from 'crypto'

const REPORT_TEMPLATES = [
  {
    id: '1',
    name: 'Relatório Financeiro Mensal',
    type: 'financial' as const,
    description: 'Receitas, despesas e lucro líquido do período',
    fields: ['data', 'tipo', 'categoria', 'valor', 'projeto'],
  },
  {
    id: '2',
    name: 'Status de Projetos',
    type: 'projects' as const,
    description: 'Progresso, orçamento e prazos dos projetos',
    fields: ['nome', 'status', 'progresso', 'orcamento', 'prazo'],
  },
  {
    id: '3',
    name: 'Performance da Equipe',
    type: 'team' as const,
    description: 'Produtividade e métricas dos membros da equipe',
    fields: ['nome', 'tarefas_concluidas', 'horas_registradas', 'projetos'],
  },
  {
    id: '4',
    name: 'Relatório de Clientes',
    type: 'clients' as const,
    description: 'Informações e histórico dos clientes',
    fields: ['nome', 'email', 'projetos', 'valor_total', 'status'],
  },
]

const VALID_TYPES: ReportType[] = ['financial', 'projects', 'team', 'clients']

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const stored = await listUserReports(session.user.id)
    const reports = stored.map((meta) => ({
      id: meta.id,
      name: meta.name,
      type: meta.type,
      format: meta.format === 'xlsx' ? 'excel' : meta.format,
      status: 'ready' as const,
      createdAt: meta.createdAt,
      downloadUrl: `/api/reports/${meta.id}/download`,
      size: `${Math.max(1, Math.round(meta.size / 1024))} KB`,
      description: meta.description,
    }))

    return NextResponse.json({ reports, templates: REPORT_TEMPLATES })
  } catch (error) {
    console.error('Erro ao buscar relatórios:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const reportId = searchParams.get('id')
    if (!reportId) {
      return NextResponse.json({ error: 'ID do relatório é obrigatório' }, { status: 400 })
    }

    const deleted = await deleteReport(session.user.id, reportId)
    if (!deleted) {
      return NextResponse.json({ error: 'Relatório não encontrado' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao excluir relatório:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { name, type, format: rawFormat, dateRange, filters } = body

    const format = normalizeFormat(rawFormat)
    if (!type || !format) {
      return NextResponse.json(
        { error: 'Tipo de relatório e formato são obrigatórios' },
        { status: 400 }
      )
    }

    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json({ error: 'Tipo de relatório inválido' }, { status: 400 })
    }

    const payload = await fetchReportPayload(type, session.user.name ?? 'Usuário', {
      dateRange,
      filters,
    })

    const buffer = await generateReportBuffer(format, payload)
    const reportId = randomUUID()
    const ext = formatExtension(format)
    const safeName = (name || payload.title)
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '_')
      .slice(0, 80) || 'relatorio'
    const filename = `${safeName}_${new Date().toISOString().split('T')[0]}.${ext}`

    await saveReportFile(session.user.id, reportId, format, buffer)
    await saveReportPreview(session.user.id, reportId, payload)
    await saveReportMeta({
      id: reportId,
      name: name || payload.title,
      type,
      format,
      filename,
      size: buffer.length,
      createdAt: new Date().toISOString(),
      description: `${payload.title} — ${payload.rows.length} registro(s)`,
      userId: session.user.id,
      rowCount: payload.rows.length,
      dateRange: payload.dateRange,
      generatedBy: payload.generatedBy,
    })

    return NextResponse.json(
      {
        report: {
          id: reportId,
          type,
          format: format === 'xlsx' ? 'excel' : format,
          filename,
          downloadUrl: `/api/reports/${reportId}/download`,
          mimeType: formatMimeType(format),
          size: buffer.length,
          generatedAt: payload.generatedAt,
          rowCount: payload.rows.length,
        },
        message: 'Relatório gerado com sucesso',
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Erro ao gerar relatório:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
