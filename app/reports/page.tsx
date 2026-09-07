'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { DateRange } from 'react-day-picker'
import { StatsCard } from '@/components/ui/stats-card'
import { PageLoadingGate } from '@/components/ui/loading-animation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  ReportDateRangeField,
  defaultReportDateRange,
  dateRangeToApi,
} from '@/components/reports/ReportDateRangeField'
import { ReportPreviewDialog } from '@/components/reports/ReportPreviewDialog'
import { toast } from 'react-hot-toast'
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Calendar,
  Search,
  Trash2,
  Plus,
  DollarSign,
  FolderOpen,
  Users,
  MoreHorizontal,
  Loader2,
} from 'lucide-react'

interface Report {
  id: string
  name: string
  type: 'financial' | 'projects' | 'team' | 'clients'
  format: 'pdf' | 'excel' | 'csv'
  status: 'generating' | 'ready' | 'failed'
  createdAt: string
  downloadUrl?: string
  size?: string
  description: string
}

interface ReportTemplate {
  id: string
  name: string
  type: 'financial' | 'projects' | 'team' | 'clients'
  description: string
  fields: string[]
}

type ReportType = Report['type']
type ReportFormat = Report['format']

const TYPE_LABELS: Record<ReportType, string> = {
  financial: 'Financeiro',
  projects: 'Projetos',
  team: 'Equipe',
  clients: 'Clientes',
}

const FORMAT_LABELS: Record<ReportFormat, string> = {
  pdf: 'PDF',
  excel: 'Excel',
  csv: 'CSV',
}

const STATUS_LABELS: Record<Report['status'], string> = {
  ready: 'Pronto',
  generating: 'Gerando',
  failed: 'Falhou',
}

function getTypeIcon(type: ReportType) {
  switch (type) {
    case 'financial':
      return DollarSign
    case 'projects':
      return FolderOpen
    case 'team':
    case 'clients':
      return Users
    default:
      return FileText
  }
}

function statusBadgeVariant(status: Report['status']) {
  switch (status) {
    case 'ready':
      return 'secondary' as const
    case 'generating':
      return 'outline' as const
    case 'failed':
      return 'destructive' as const
  }
}

const LIST_PAGE_SIZE = 10

export default function ReportsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [reports, setReports] = useState<Report[]>([])
  const [templates, setTemplates] = useState<ReportTemplate[]>([])
  const [isGenerateReportOpen, setIsGenerateReportOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedType, setSelectedType] = useState<string>('all')

  const [reportName, setReportName] = useState('')
  const [reportType, setReportType] = useState<ReportType>('financial')
  const [reportFormat, setReportFormat] = useState<ReportFormat>('pdf')
  const [reportDateRange, setReportDateRange] = useState<DateRange | undefined>(defaultReportDateRange())
  const [listPage, setListPage] = useState(1)
  const [previewReport, setPreviewReport] = useState<Report | null>(null)

  useEffect(() => {
    setListPage(1)
  }, [searchTerm, selectedType])

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/auth/signin')
      return
    }
    fetchData()
  }, [session, status, router])

  const resetReportForm = () => {
    setReportName('')
    setReportType('financial')
    setReportFormat('pdf')
    setReportDateRange(defaultReportDateRange())
  }

  const openGenerateDialog = (preset?: { name?: string; type?: ReportType }) => {
    resetReportForm()
    if (preset?.name) setReportName(preset.name)
    if (preset?.type) setReportType(preset.type)
    setIsGenerateReportOpen(true)
  }

  const fetchData = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/reports')

      if (!response.ok) {
        throw new Error('Falha ao carregar relatórios')
      }

      const data = await response.json()
      setReports(data.reports)
      setTemplates(data.templates)
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
      toast.error('Erro ao carregar relatórios')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateReport = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!reportDateRange?.from || !reportDateRange?.to) {
      toast.error('Selecione o período completo do relatório')
      return
    }

    const pendingId = `pending-${Date.now()}`
    const newReportData: Report = {
      id: pendingId,
      name: reportName,
      type: reportType,
      format: reportFormat,
      status: 'generating',
      createdAt: new Date().toISOString(),
      description: `Relatório ${TYPE_LABELS[reportType].toLowerCase()} em geração`,
    }

    setReports((prev) => [newReportData, ...prev])
    setIsGenerateReportOpen(false)
    toast.success('Relatório sendo gerado...')

    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: reportName,
          type: reportType,
          format: reportFormat,
          dateRange: dateRangeToApi(reportDateRange),
          filters: {},
        }),
      })

      if (!response.ok) {
        throw new Error('Falha ao gerar relatório')
      }

      const result = await response.json()
      setReports((prev) =>
        prev.map((report) =>
          report.id === pendingId
            ? {
                id: result.report.id,
                name: reportName,
                type: reportType,
                format: reportFormat,
                status: 'ready' as const,
                createdAt: result.report.generatedAt,
                downloadUrl: result.report.downloadUrl,
                size: `${Math.max(1, Math.round(result.report.size / 1024))} KB`,
                description: `${result.report.rowCount} registro(s) exportado(s)`,
              }
            : report
        )
      )
      toast.success('Relatório gerado com sucesso!')
    } catch (error) {
      console.error('Erro ao gerar relatório:', error)
      setReports((prev) =>
        prev.map((report) =>
          report.id === pendingId ? { ...report, status: 'failed' as const } : report
        )
      )
      toast.error('Erro ao gerar relatório')
    }

    resetReportForm()
  }

  const handleDownloadReport = async (report: Report) => {
    if (report.status !== 'ready' || !report.downloadUrl) {
      toast.error('Relatório não está pronto para download')
      return
    }

    try {
      const response = await fetch(report.downloadUrl)
      if (!response.ok) throw new Error('Download falhou')

      const blob = await response.blob()
      const ext = report.format === 'excel' ? 'xlsx' : report.format
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${report.name}.${ext}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      toast.success(`Download de "${report.name}" iniciado`)
    } catch (error) {
      console.error('Erro no download:', error)
      toast.error('Erro ao baixar relatório')
    }
  }

  const handleDeleteReport = async (reportId: string) => {
    if (reportId.startsWith('pending-')) {
      setReports((prev) => prev.filter((report) => report.id !== reportId))
      return
    }

    try {
      const response = await fetch(`/api/reports?id=${encodeURIComponent(reportId)}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Falha ao excluir')
      setReports((prev) => prev.filter((report) => report.id !== reportId))
      toast.success('Relatório excluído com sucesso')
    } catch (error) {
      console.error('Erro ao excluir relatório:', error)
      toast.error('Erro ao excluir relatório')
    }
  }

  const filteredReports = reports.filter((report) => {
    const matchesSearch = report.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesType = selectedType === 'all' || report.type === selectedType
    return matchesSearch && matchesType
  })

  const totalListPages = Math.max(1, Math.ceil(filteredReports.length / LIST_PAGE_SIZE))
  const safeListPage = Math.min(listPage, totalListPages)
  const paginatedReports = filteredReports.slice(
    (safeListPage - 1) * LIST_PAGE_SIZE,
    safeListPage * LIST_PAGE_SIZE
  )
  const listRangeStart =
    filteredReports.length === 0 ? 0 : (safeListPage - 1) * LIST_PAGE_SIZE + 1
  const listRangeEnd = Math.min(safeListPage * LIST_PAGE_SIZE, filteredReports.length)

  const openReportPreview = (report: Report) => {
    if (report.status !== 'ready' || report.id.startsWith('pending-')) {
      toast.error('Relatório ainda não está pronto para visualização')
      return
    }
    setPreviewReport(report)
  }

  return (
    <PageLoadingGate loading={loading}>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
            <p className="text-sm text-muted-foreground">Gere e gerencie relatórios do sistema</p>
          </div>
          <Dialog open={isGenerateReportOpen} onOpenChange={setIsGenerateReportOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={() => openGenerateDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                Gerar relatório
              </Button>
            </DialogTrigger>
            <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[560px]">
              <DialogHeader className="border-b border-border px-6 py-5">
                <DialogTitle>Gerar novo relatório</DialogTitle>
                <DialogDescription>
                  Configure nome, tipo, formato e período de extração.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleGenerateReport} className="flex flex-col">
                <div className="space-y-4 px-6 py-5">
                  <div className="space-y-2">
                    <Label htmlFor="report-name">Nome do relatório</Label>
                    <Input
                      id="report-name"
                      value={reportName}
                      onChange={(e) => setReportName(e.target.value)}
                      placeholder="Ex: Financeiro — março 2026"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Tipo</Label>
                      <Select value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="financial">Financeiro</SelectItem>
                          <SelectItem value="projects">Projetos</SelectItem>
                          <SelectItem value="team">Equipe</SelectItem>
                          <SelectItem value="clients">Clientes</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Formato</Label>
                      <Select value={reportFormat} onValueChange={(v) => setReportFormat(v as ReportFormat)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pdf">PDF</SelectItem>
                          <SelectItem value="excel">Excel</SelectItem>
                          <SelectItem value="csv">CSV</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <ReportDateRangeField value={reportDateRange} onChange={setReportDateRange} />
                </div>

                <DialogFooter className="border-t border-border px-6 py-4">
                  <Button type="button" variant="outline" onClick={() => setIsGenerateReportOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">Gerar relatório</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard
            title="Total de relatórios"
            value={reports.length}
            change={{
              value: `${reports.filter((r) => r.status === 'ready').length} prontos`,
              type: 'neutral',
            }}
          />
          <StatsCard title="Prontos" value={reports.filter((r) => r.status === 'ready').length} />
          <StatsCard title="Em geração" value={reports.filter((r) => r.status === 'generating').length} />
          <StatsCard title="Templates" value={templates.length} />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar relatórios..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="financial">Financeiro</SelectItem>
              <SelectItem value="projects">Projetos</SelectItem>
              <SelectItem value="team">Equipe</SelectItem>
              <SelectItem value="clients">Clientes</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Relatórios gerados</CardTitle>
            <CardDescription>Histórico de exportações e downloads disponíveis</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {filteredReports.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border py-12 text-center">
                <FileText className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">Nenhum relatório encontrado</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Gere seu primeiro relatório para começar.
                </p>
              </div>
            ) : (
              <>
                {paginatedReports.map((report) => {
                const IconComponent = getTypeIcon(report.type)
                const isClickable = report.status === 'ready' && !report.id.startsWith('pending-')
                return (
                  <div
                    key={report.id}
                    role={isClickable ? 'button' : undefined}
                    tabIndex={isClickable ? 0 : undefined}
                    onClick={() => isClickable && openReportPreview(report)}
                    onKeyDown={(e) => {
                      if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault()
                        openReportPreview(report)
                      }
                    }}
                    className={`group flex items-start justify-between gap-3 rounded-lg border border-border p-4 transition-colors hover:bg-muted/30${
                      isClickable ? ' cursor-pointer' : ''
                    }`}
                  >
                    <div className="flex min-w-0 gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/30">
                        <IconComponent className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-medium text-foreground">{report.name}</p>
                          <Badge variant={statusBadgeVariant(report.status)} className="text-[10px] font-normal">
                            {report.status === 'generating' ? (
                              <span className="inline-flex items-center gap-1">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                {STATUS_LABELS[report.status]}
                              </span>
                            ) : (
                              STATUS_LABELS[report.status]
                            )}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] font-normal">
                            {TYPE_LABELS[report.type]}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] font-normal">
                            {FORMAT_LABELS[report.format]}
                          </Badge>
                        </div>
                        <p className="mt-0.5 text-sm text-muted-foreground">{report.description}</p>
                        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {format(parseISO(report.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          {report.size ? <span>· {report.size}</span> : null}
                        </p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 shrink-0 p-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        {report.status === 'ready' && (
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              openReportPreview(report)
                            }}
                          >
                            <FileText className="mr-2 h-4 w-4" />
                            Ver detalhes
                          </DropdownMenuItem>
                        )}
                        {report.status === 'ready' && (
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDownloadReport(report)
                            }}
                          >
                            <Download className="mr-2 h-4 w-4" />
                            Download
                          </DropdownMenuItem>
                        )}
                        {report.status === 'ready' && <DropdownMenuSeparator />}
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteReport(report.id)
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )
              })}

                {filteredReports.length > LIST_PAGE_SIZE && (
                  <div className="flex items-center justify-between gap-3 pt-2">
                    <p className="text-xs text-muted-foreground">
                      {listRangeStart}–{listRangeEnd} de {filteredReports.length} relatório(s)
                    </p>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={safeListPage <= 1}
                        onClick={() => setListPage((p) => Math.max(1, p - 1))}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Badge variant="outline" className="min-w-[4rem] justify-center font-normal">
                        {safeListPage} / {totalListPages}
                      </Badge>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={safeListPage >= totalListPages}
                        onClick={() => setListPage((p) => Math.min(totalListPages, p + 1))}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <ReportPreviewDialog
          reportId={previewReport?.id ?? null}
          reportName={previewReport?.name ?? ''}
          reportFormat={previewReport?.format ?? 'pdf'}
          open={!!previewReport}
          onOpenChange={(open) => {
            if (!open) setPreviewReport(null)
          }}
          onDownload={() => {
            if (previewReport) handleDownloadReport(previewReport)
          }}
        />

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Templates</CardTitle>
            <CardDescription>Modelos pré-configurados para gerar relatórios rapidamente</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {templates.map((template) => {
                const IconComponent = getTypeIcon(template.type)
                return (
                  <div
                    key={template.id}
                    className="flex flex-col rounded-lg border border-border p-4 transition-colors hover:bg-muted/20"
                  >
                    <div className="mb-3 flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-muted/30">
                        <IconComponent className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{template.name}</p>
                        <p className="text-[11px] text-muted-foreground">{TYPE_LABELS[template.type]}</p>
                      </div>
                    </div>
                    <p className="mb-3 line-clamp-2 flex-1 text-xs text-muted-foreground">
                      {template.description}
                    </p>
                    <div className="mb-3 flex flex-wrap gap-1">
                      {template.fields.slice(0, 3).map((field) => (
                        <Badge key={field} variant="outline" className="text-[10px] font-normal">
                          {field}
                        </Badge>
                      ))}
                      {template.fields.length > 3 && (
                        <Badge variant="outline" className="text-[10px] font-normal">
                          +{template.fields.length - 3}
                        </Badge>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => openGenerateDialog({ name: template.name, type: template.type })}
                    >
                      Usar template
                    </Button>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </PageLoadingGate>
  )
}
