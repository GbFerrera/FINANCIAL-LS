import PDFDocument from 'pdfkit'
import { existsSync } from 'fs'
import {
  PDF_THEME,
  formatReportTypeLabel,
  formatSummaryLabel,
  getReportBranding,
} from './branding'
import { ReportPayload } from './types'

const MARGIN = 48
const HEADER_BAND = 88
const FOOTER_BAND = 36
const ROW_HEIGHT = 22
const MAX_ROWS = 500

type PdfDoc = InstanceType<typeof PDFDocument>

type PageContext = {
  pageNumber: number
}

function cellValue(value: string | number | null | undefined) {
  if (value == null) return '—'
  return String(value)
}

function formatPeriod(range?: { start?: string; end?: string }) {
  const fmt = (value: string) =>
    new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })

  if (range?.start && range?.end) return `${fmt(range.start)} – ${fmt(range.end)}`
  if (range?.start) return `A partir de ${fmt(range.start)}`
  if (range?.end) return `Até ${fmt(range.end)}`
  return 'Período completo'
}

function computeColumnWidths(columns: ReportPayload['columns'], availableWidth: number) {
  const weights = columns.map((col) => {
    const sample = col.label.length
    if (col.key.includes('descricao') || col.key.includes('email')) return Math.max(sample, 22)
    if (col.key.includes('nome') || col.key.includes('projeto')) return Math.max(sample, 16)
    return Math.max(sample, 10)
  })
  const total = weights.reduce((sum, w) => sum + w, 0)
  return weights.map((w) => (w / total) * availableWidth)
}

function contentBottom(doc: PdfDoc) {
  return doc.page.height - MARGIN - FOOTER_BAND
}

function drawFooter(doc: PdfDoc, pageNumber: number) {
  const branding = getReportBranding()
  const y = doc.page.height - MARGIN - 8
  const left = MARGIN
  const right = doc.page.width - MARGIN
  const savedY = doc.y

  doc.save()
  doc.strokeColor(PDF_THEME.border)
  doc.lineWidth(0.5)
  doc.moveTo(left, y - 10)
  doc.lineTo(right, y - 10)
  doc.stroke()
  doc.restore()

  doc.font('Helvetica').fontSize(8).fillColor(PDF_THEME.muted)
  // Sem `width` no rodapé — PDFKit cria páginas extras quando width + y baixo
  doc.text(`${branding.name} · ${branding.siteUrl}`, left, y, { lineBreak: false })
  const pageLabel = `Página ${pageNumber}`
  doc.text(pageLabel, right - doc.widthOfString(pageLabel), y, { lineBreak: false })

  doc.x = left
  doc.y = savedY
}

function drawHeader(doc: PdfDoc, payload: ReportPayload) {
  const branding = getReportBranding()
  const pageWidth = doc.page.width
  const left = MARGIN
  const right = pageWidth - MARGIN

  doc.save()
  doc.rect(0, 0, pageWidth, HEADER_BAND).fill(PDF_THEME.headerBg)

  const logoSize = 36
  const logoY = 22
  let titleX = left

  if (branding.logoPath && existsSync(branding.logoPath)) {
    try {
      doc.image(branding.logoPath, left, logoY, { width: logoSize, height: logoSize })
      titleX = left + logoSize + 12
    } catch {
      titleX = left
    }
  }

  doc.fillColor(PDF_THEME.headerText).font('Helvetica-Bold').fontSize(16)
  doc.text(branding.name, titleX, logoY + 2, { lineBreak: false })

  doc.font('Helvetica').fontSize(9).fillColor('#d4d4d8')
  doc.text(branding.tagline, titleX, logoY + 22, { lineBreak: false })

  doc.font('Helvetica-Bold').fontSize(11).fillColor(PDF_THEME.headerText)
  doc.text(payload.title, left, logoY + 2, {
    width: right - left,
    align: 'right',
    lineBreak: false,
  })

  doc.font('Helvetica').fontSize(9).fillColor('#d4d4d8')
  doc.text(formatReportTypeLabel(payload.type), left, logoY + 20, {
    width: right - left,
    align: 'right',
    lineBreak: false,
  })

  doc.restore()
  doc.x = left
  doc.y = HEADER_BAND + 20
}

function startNewPage(doc: PdfDoc, payload: ReportPayload, ctx: PageContext) {
  drawFooter(doc, ctx.pageNumber)
  doc.addPage()
  ctx.pageNumber += 1
  drawHeader(doc, payload)
}

function ensureSpace(
  doc: PdfDoc,
  payload: ReportPayload,
  ctx: PageContext,
  neededHeight: number
) {
  if (doc.y + neededHeight <= contentBottom(doc)) return false
  startNewPage(doc, payload, ctx)
  return true
}

function drawMetaPanel(doc: PdfDoc, payload: ReportPayload) {
  const left = MARGIN
  const right = doc.page.width - MARGIN
  const panelTop = doc.y
  const panelHeight = 54

  doc.save()
  doc.roundedRect(left, panelTop, right - left, panelHeight, 8).fill(PDF_THEME.surface)
  doc.roundedRect(left, panelTop, right - left, panelHeight, 8).lineWidth(0.75).stroke(PDF_THEME.border)
  doc.restore()

  const generatedAt = new Date(payload.generatedAt).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const colWidth = (right - left - 24) / 2
  const textY = panelTop + 14

  doc.font('Helvetica-Bold').fontSize(8).fillColor(PDF_THEME.muted)
  doc.text('PERÍODO', left + 12, textY, { lineBreak: false })
  doc.text('GERAÇÃO', left + 12 + colWidth, textY, { lineBreak: false })

  doc.font('Helvetica').fontSize(10).fillColor(PDF_THEME.ink)
  doc.text(formatPeriod(payload.dateRange), left + 12, textY + 12, {
    width: colWidth,
    lineBreak: false,
    height: 14,
    ellipsis: true,
  })
  doc.text(`Por ${payload.generatedBy} · ${generatedAt}`, left + 12 + colWidth, textY + 12, {
    width: colWidth,
    lineBreak: false,
    height: 14,
    ellipsis: true,
  })

  doc.x = left
  doc.y = panelTop + panelHeight + 18
}

function drawSummaryCards(doc: PdfDoc, payload: ReportPayload, ctx: PageContext) {
  if (!payload.summary || Object.keys(payload.summary).length === 0) return

  const entries = Object.entries(payload.summary)
  const left = MARGIN
  const right = doc.page.width - MARGIN
  const gap = 10
  const cardsPerRow = Math.min(4, entries.length)
  const cardWidth = (right - left - gap * (cardsPerRow - 1)) / cardsPerRow
  const cardHeight = 48
  const sectionTitleHeight = 28

  ensureSpace(doc, payload, ctx, sectionTitleHeight + cardHeight + 20)

  doc.font('Helvetica-Bold').fontSize(11).fillColor(PDF_THEME.ink)
  doc.text('Resumo', left, doc.y, { lineBreak: false })
  doc.y += sectionTitleHeight - 10

  let x = left
  let y = doc.y

  entries.forEach(([key, value], index) => {
    if (index > 0 && index % cardsPerRow === 0) {
      x = left
      y += cardHeight + gap
    }

    if (y + cardHeight > contentBottom(doc)) {
      startNewPage(doc, payload, ctx)
      y = doc.y
      x = left
    }

    doc.save()
    doc.roundedRect(x, y, cardWidth, cardHeight, 6).fill('#ffffff')
    doc.roundedRect(x, y, cardWidth, cardHeight, 6).lineWidth(0.75).stroke(PDF_THEME.border)
    doc.restore()

    doc.font('Helvetica').fontSize(8).fillColor(PDF_THEME.muted)
    doc.text(formatSummaryLabel(key).toUpperCase(), x + 10, y + 10, {
      width: cardWidth - 20,
      lineBreak: false,
    })

    doc.font('Helvetica-Bold').fontSize(12).fillColor(PDF_THEME.ink)
    doc.text(cellValue(value), x + 10, y + 24, { width: cardWidth - 20, lineBreak: false })

    x += cardWidth + gap
  })

  doc.x = left
  doc.y = y + cardHeight + 20
}

function drawTable(doc: PdfDoc, payload: ReportPayload, ctx: PageContext) {
  const left = MARGIN
  const right = doc.page.width - MARGIN
  const availableWidth = right - left
  const colWidths = computeColumnWidths(payload.columns, availableWidth)
  const sectionTitleHeight = 24

  ensureSpace(doc, payload, ctx, sectionTitleHeight + ROW_HEIGHT + 8)

  doc.font('Helvetica-Bold').fontSize(11).fillColor(PDF_THEME.ink)
  doc.text('Detalhes', left, doc.y, { lineBreak: false })
  doc.y += sectionTitleHeight

  let needsHeader = true

  const drawTableHeader = () => {
    const y = doc.y
    doc.save()
    doc.rect(left, y, availableWidth, ROW_HEIGHT).fill(PDF_THEME.headerBg)
    doc.restore()

    let x = left
    doc.font('Helvetica-Bold').fontSize(8).fillColor(PDF_THEME.headerText)
    payload.columns.forEach((col, i) => {
      doc.text(col.label.toUpperCase(), x + 6, y + 7, {
        width: colWidths[i] - 10,
        lineBreak: false,
        ellipsis: true,
      })
      x += colWidths[i]
    })

    doc.x = left
    doc.y = y + ROW_HEIGHT
    needsHeader = false
  }

  const startTableContinuation = () => {
    startNewPage(doc, payload, ctx)
    doc.font('Helvetica-Bold').fontSize(11).fillColor(PDF_THEME.ink)
    doc.text('Detalhes (continuação)', left, doc.y, { lineBreak: false })
    doc.y += 20
    needsHeader = true
  }

  const drawRow = (values: string[], rowIndex: number) => {
    if (doc.y + ROW_HEIGHT > contentBottom(doc)) {
      startTableContinuation()
    }
    if (needsHeader) drawTableHeader()

    const y = doc.y
    if (rowIndex % 2 === 0) {
      doc.save()
      doc.rect(left, y, availableWidth, ROW_HEIGHT).fill(PDF_THEME.stripe)
      doc.restore()
    }

    let x = left
    doc.font('Helvetica').fontSize(8).fillColor(PDF_THEME.ink)
    values.forEach((value, i) => {
      doc.text(value, x + 6, y + 7, {
        width: colWidths[i] - 10,
        lineBreak: false,
        ellipsis: true,
      })
      x += colWidths[i]
    })

    doc.x = left
    doc.y = y + ROW_HEIGHT
  }

  drawTableHeader()

  payload.rows.slice(0, MAX_ROWS).forEach((row, index) => {
    drawRow(
      payload.columns.map((col) => cellValue(row[col.key])),
      index
    )
  })

  if (payload.rows.length > MAX_ROWS) {
    ensureSpace(doc, payload, ctx, 18)
    doc.font('Helvetica').fontSize(8).fillColor(PDF_THEME.muted)
    doc.text(`… exibindo ${MAX_ROWS} de ${payload.rows.length} registros`, left, doc.y, {
      lineBreak: false,
    })
    doc.y += 14
  }
}

export function generatePdf(payload: ReportPayload): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
      autoFirstPage: true,
    })

    const ctx: PageContext = { pageNumber: 1 }
    const chunks: Buffer[] = []
    doc.on('data', (chunk) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    drawHeader(doc, payload)
    drawMetaPanel(doc, payload)
    drawSummaryCards(doc, payload, ctx)
    drawTable(doc, payload, ctx)
    drawFooter(doc, ctx.pageNumber)

    doc.end()
  })
}
