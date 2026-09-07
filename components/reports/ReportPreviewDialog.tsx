'use client'

import { useCallback, useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ChevronLeft, ChevronRight, Download, Loader2 } from 'lucide-react'
import { toast } from 'react-hot-toast'

interface ReportPreviewColumn {
  key: string
  label: string
}

interface ReportPreviewData {
  hasPreview: boolean
  title: string
  generatedAt: string
  generatedBy: string
  dateRange?: { start?: string; end?: string }
  columns: ReportPreviewColumn[]
  summary: Record<string, string | number>
  rows: Record<string, string | number | null>[]
  pagination: {
    page: number
    limit: number
    totalRows: number
    totalPages: number
  }
  inlineUrl?: string
  meta: {
    id: string
    name: string
    format: string
  }
}

interface ReportPreviewDialogProps {
  reportId: string | null
  reportName: string
  reportFormat: 'pdf' | 'excel' | 'csv'
  open: boolean
  onOpenChange: (open: boolean) => void
  onDownload: () => void
}

const ROWS_PER_PAGE = 10

function formatCellValue(value: string | number | null | undefined): string {
  if (value == null || value === '') return '—'
  if (typeof value === 'number') {
    return value.toLocaleString('pt-BR')
  }
  return String(value)
}

function formatPeriod(dateRange?: { start?: string; end?: string }) {
  if (!dateRange?.start && !dateRange?.end) return null
  const start = dateRange.start
    ? format(parseISO(dateRange.start), 'dd/MM/yyyy', { locale: ptBR })
    : '—'
  const end = dateRange.end
    ? format(parseISO(dateRange.end), 'dd/MM/yyyy', { locale: ptBR })
    : '—'
  return `${start} — ${end}`
}

export function ReportPreviewDialog({
  reportId,
  reportName,
  reportFormat,
  open,
  onOpenChange,
  onDownload,
}: ReportPreviewDialogProps) {
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<ReportPreviewData | null>(null)
  const [page, setPage] = useState(1)
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'data' | 'pdf'>('data')

  const fetchPreview = useCallback(
    async (targetPage: number) => {
      if (!reportId) return

      setLoading(true)
      try {
        const response = await fetch(
          `/api/reports/${reportId}/preview?page=${targetPage}&limit=${ROWS_PER_PAGE}`
        )

        if (response.status === 404) {
          const fallback = await response.json()
          setPreview({
            hasPreview: false,
            title: reportName,
            generatedAt: fallback.meta?.createdAt ?? new Date().toISOString(),
            generatedBy: '',
            columns: [],
            summary: {},
            rows: [],
            pagination: { page: 1, limit: ROWS_PER_PAGE, totalRows: 0, totalPages: 1 },
            inlineUrl: `/api/reports/${reportId}/download?inline=1`,
            meta: {
              id: reportId,
              name: reportName,
              format: reportFormat,
            },
          })
          if (reportFormat === 'pdf') setViewMode('pdf')
          return
        }

        if (!response.ok) throw new Error('Falha ao carregar preview')

        const data = (await response.json()) as ReportPreviewData
        setPreview(data)
      } catch (error) {
        console.error('Erro ao carregar preview:', error)
        toast.error('Erro ao carregar detalhes do relatório')
      } finally {
        setLoading(false)
      }
    },
    [reportId, reportName, reportFormat]
  )

  useEffect(() => {
    if (!open || !reportId) {
      setPreview(null)
      setPage(1)
      setViewMode('data')
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl)
        setPdfBlobUrl(null)
      }
      return
    }

    fetchPreview(1)
  }, [open, reportId, fetchPreview])

  useEffect(() => {
    if (!open || !reportId || reportFormat !== 'pdf' || viewMode !== 'pdf') {
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl)
        setPdfBlobUrl(null)
      }
      return
    }

    let cancelled = false

    async function loadPdf() {
      try {
        const response = await fetch(`/api/reports/${reportId}/download?inline=1`)
        if (!response.ok) throw new Error('PDF indisponível')
        const blob = await response.blob()
        if (cancelled) return
        const url = URL.createObjectURL(blob)
        setPdfBlobUrl(url)
      } catch {
        if (!cancelled) toast.error('Não foi possível carregar o PDF')
      }
    }

    loadPdf()

    return () => {
      cancelled = true
    }
  }, [open, reportId, reportFormat, viewMode])

  useEffect(() => {
    return () => {
      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl)
    }
  }, [pdfBlobUrl])

  const handlePageChange = (nextPage: number) => {
    if (!preview || nextPage < 1 || nextPage > preview.pagination.totalPages) return
    setPage(nextPage)
    fetchPreview(nextPage)
  }

  const period = formatPeriod(preview?.dateRange)
  const summaryEntries = Object.entries(preview?.summary ?? {})
  const { page: currentPage, totalPages, totalRows } = preview?.pagination ?? {
    page: 1,
    totalPages: 1,
    totalRows: 0,
  }
  const rangeStart = totalRows === 0 ? 0 : (currentPage - 1) * ROWS_PER_PAGE + 1
  const rangeEnd = Math.min(currentPage * ROWS_PER_PAGE, totalRows)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="border-b border-border px-6 py-5">
          <DialogTitle className="pr-8">{preview?.title ?? reportName}</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2">
            {preview?.generatedAt && (
              <span>
                Gerado em{' '}
                {format(parseISO(preview.generatedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </span>
            )}
            {preview?.generatedBy && <span>· {preview.generatedBy}</span>}
            {period && <span>· Período: {period}</span>}
          </DialogDescription>
        </DialogHeader>

        {reportFormat === 'pdf' && (
          <div className="flex gap-1 border-b border-border px-6 py-2">
            <Button
              type="button"
              variant={viewMode === 'data' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('data')}
              disabled={!preview?.hasPreview && preview !== null}
            >
              Dados
            </Button>
            <Button
              type="button"
              variant={viewMode === 'pdf' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('pdf')}
            >
              Visualizar PDF
            </Button>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {loading && !preview ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Carregando detalhes...
            </div>
          ) : viewMode === 'pdf' && reportFormat === 'pdf' ? (
            <div className="h-[60vh] overflow-hidden rounded-lg border border-border bg-muted/20">
              {pdfBlobUrl ? (
                <iframe
                  src={pdfBlobUrl}
                  title={`Preview ${reportName}`}
                  className="h-full w-full"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Carregando PDF...
                </div>
              )}
            </div>
          ) : preview?.hasPreview === false ? (
            <div className="rounded-lg border border-dashed border-border py-12 text-center">
              <p className="text-sm text-muted-foreground">
                Preview de dados indisponível para relatórios gerados antes desta atualização.
              </p>
              {reportFormat === 'pdf' && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Use a aba &quot;Visualizar PDF&quot; para ver o arquivo no navegador.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {summaryEntries.length > 0 && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {summaryEntries.map(([key, value]) => (
                    <div
                      key={key}
                      className="rounded-lg border border-border bg-muted/20 px-3 py-2"
                    >
                      <p className="text-[11px] text-muted-foreground">{key}</p>
                      <p className="text-sm font-medium text-foreground">
                        {formatCellValue(value)}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <div className="rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {preview?.columns.map((col) => (
                        <TableHead key={col.key} className="whitespace-nowrap">
                          {col.label}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview?.rows.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={preview.columns.length || 1}
                          className="py-8 text-center text-muted-foreground"
                        >
                          Nenhum registro no período selecionado
                        </TableCell>
                      </TableRow>
                    ) : (
                      preview?.rows.map((row, idx) => (
                        <TableRow key={idx}>
                          {preview.columns.map((col) => {
                            const formattedKey = `${col.key}_formatado`
                            const display =
                              row[formattedKey] != null && row[formattedKey] !== ''
                                ? row[formattedKey]
                                : row[col.key]
                            return (
                              <TableCell key={col.key} className="max-w-[200px] truncate">
                                {formatCellValue(display as string | number | null)}
                              </TableCell>
                            )
                          })}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {totalRows > ROWS_PER_PAGE && (
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    {rangeStart}–{rangeEnd} de {totalRows} registro(s)
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={currentPage <= 1 || loading}
                      onClick={() => handlePageChange(currentPage - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Badge variant="outline" className="min-w-[4rem] justify-center font-normal">
                      {currentPage} / {totalPages}
                    </Badge>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={currentPage >= totalPages || loading}
                      onClick={() => handlePageChange(currentPage + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-border px-6 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button type="button" onClick={onDownload}>
            <Download className="mr-2 h-4 w-4" />
            Baixar arquivo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
