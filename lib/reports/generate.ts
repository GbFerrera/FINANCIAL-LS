import * as XLSX from 'xlsx'
import { ReportFormat, ReportPayload } from './types'
import { generatePdf } from './generate-pdf'

function cellValue(value: string | number | null | undefined) {
  if (value == null) return ''
  return String(value)
}

function escapeCsv(value: string) {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function generateCsv(payload: ReportPayload): Buffer {
  const header = payload.columns.map((c) => escapeCsv(c.label)).join(',')
  const lines = payload.rows.map((row) =>
    payload.columns.map((c) => escapeCsv(cellValue(row[c.key]))).join(',')
  )

  const summaryLines: string[] = []
  if (payload.summary) {
    summaryLines.push('')
    summaryLines.push('Resumo')
    for (const [key, value] of Object.entries(payload.summary)) {
      summaryLines.push(`${escapeCsv(key)},${escapeCsv(cellValue(value))}`)
    }
  }

  const content = [header, ...lines, ...summaryLines].join('\n')
  return Buffer.from('\uFEFF' + content, 'utf-8')
}

export function generateXlsx(payload: ReportPayload): Buffer {
  const sheetData = [
    payload.columns.map((c) => c.label),
    ...payload.rows.map((row) =>
      payload.columns.map((c) => row[c.key] ?? '')
    ),
  ]

  if (payload.summary) {
    sheetData.push([])
    sheetData.push(['Resumo'])
    for (const [key, value] of Object.entries(payload.summary)) {
      sheetData.push([key, value])
    }
  }

  const worksheet = XLSX.utils.aoa_to_sheet(sheetData)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Relatório')
  return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }))
}

export { generatePdf } from './generate-pdf'

export async function generateReportBuffer(
  format: ReportFormat,
  payload: ReportPayload
): Promise<Buffer> {
  switch (format) {
    case 'csv':
      return generateCsv(payload)
    case 'xlsx':
      return generateXlsx(payload)
    case 'pdf':
      return generatePdf(payload)
  }
}
