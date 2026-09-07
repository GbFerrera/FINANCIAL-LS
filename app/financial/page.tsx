"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, subDays } from "date-fns"
import { ptBR } from "date-fns/locale"
import { DateRange } from "react-day-picker"
import { cn } from "@/lib/utils"
import { PageLoadingGate } from '@/components/ui/loading-animation'
import {
  Plus,
  Download,
  Search,
  Calendar as CalendarIcon,
  Edit,
  Trash2,
  Paperclip,
  X,
  Upload,
  FileText,
  Users,
  MoreHorizontal,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react"
import { StatsCard } from "@/components/ui/stats-card"
import { CurrencyAmount } from "@/components/ui/currency-amount"
import { AddEntryModal } from "@/components/financial/add-entry-modal"
import { ClientsFinancialOverviewDialog } from "@/components/financial/clients-financial-overview"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import toast from "react-hot-toast"

interface FinancialEntry {
  id: string
  type: 'INCOME' | 'EXPENSE'
  category: string
  description: string
  amount: number
  date: string
  isRecurring: boolean
  recurringType?: string
  projectName?: string
  paymentId?: string // Novo campo para vincular com pagamento
  collaboratorName?: string | null
  projectDistributions?: Array<{
    projectId: string
    projectName: string
    amount: number
  }>
  attachments?: Array<{
    id: string
    filename: string
    originalName: string
    size: number
    url: string
  }>
  createdAt: string
}

interface FinancialStats {
  totalIncome: number
  totalExpenses: number
  netProfit: number
  monthlyIncome: number
  monthlyExpenses: number
  monthlyProfit: number
}

export default function FinancialPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [entries, setEntries] = useState<FinancialEntry[]>([])
  const [stats, setStats] = useState<FinancialStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  })
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingEntry, setEditingEntry] = useState<FinancialEntry | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [showClientsOverview, setShowClientsOverview] = useState(false)
  const [showAttachmentsModal, setShowAttachmentsModal] = useState(false)
  const [attachmentsEntry, setAttachmentsEntry] = useState<FinancialEntry | null>(null)
  const [existingEntryAttachments, setExistingEntryAttachments] = useState<NonNullable<FinancialEntry['attachments']>>([])
  const [newAttachmentFiles, setNewAttachmentFiles] = useState<File[]>([])
  const [attachmentsLoading, setAttachmentsLoading] = useState(false)

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const openAttachmentsModal = async (entry: FinancialEntry) => {
    try {
      setAttachmentsLoading(true)
      setAttachmentsEntry(entry)
      setShowAttachmentsModal(true)
      const res = await fetch(`/api/financial/${entry.id}`)
      if (!res.ok) throw new Error('Falha ao carregar anexos')
      const data = await res.json()
      setExistingEntryAttachments(data.attachments || [])
      setNewAttachmentFiles([])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao carregar anexos')
    } finally {
      setAttachmentsLoading(false)
    }
  }

  const handleAttachmentFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const valid = files.filter(f => {
      const maxSize = 10 * 1024 * 1024
      if (f.size > maxSize) {
        toast.error(`Arquivo ${f.name} é muito grande. Máximo 10MB.`)
        return false
      }
      return true
    })
    setNewAttachmentFiles(prev => [...prev, ...valid])
  }

  const removeNewAttachmentFile = (index: number) => {
    setNewAttachmentFiles(prev => prev.filter((_, i) => i !== index))
  }

  const removeExistingAttachment = async (attachmentId: string) => {
    if (!attachmentsEntry) return
    try {
      setAttachmentsLoading(true)
      const res = await fetch(`/api/financial/${attachmentsEntry.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ removeAttachmentIds: [attachmentId] })
      })
      if (!res.ok) throw new Error('Falha ao remover anexo')
      setExistingEntryAttachments(prev => prev.filter(a => a.id !== attachmentId))
      toast.success('Anexo removido')
      fetchFinancialData()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao remover anexo')
    } finally {
      setAttachmentsLoading(false)
    }
  }

  const saveNewAttachments = async () => {
    if (!attachmentsEntry || newAttachmentFiles.length === 0) {
      setShowAttachmentsModal(false)
      return
    }
    try {
      setAttachmentsLoading(true)
      const uploaded: Array<{ originalName: string; mimeType: string; size: number; url: string; filename?: string }> = []
      for (const file of newAttachmentFiles) {
        const fd = new FormData()
        fd.append('file', file)
        const uploadRes = await fetch('/api/upload', { method: 'POST', body: fd })
        if (!uploadRes.ok) {
          const err = await uploadRes.json().catch(() => ({} as { error?: string }))
          throw new Error(err.error || `Falha ao enviar arquivo ${file.name}`)
        }
        const data = await uploadRes.json()
        const info = data.file
        uploaded.push({
          originalName: info.originalName,
          mimeType: info.fileType,
          size: info.fileSize,
          url: info.fileUrl,
          filename: info.fileName
        })
      }

      const res = await fetch(`/api/financial/${attachmentsEntry.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addAttachments: uploaded })
      })
      if (!res.ok) throw new Error('Falha ao salvar anexos')
      const updated = await res.json()
      setExistingEntryAttachments(updated.attachments || [])
      setNewAttachmentFiles([])
      toast.success('Anexos adicionados')
      fetchFinancialData()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar anexos')
    } finally {
      setAttachmentsLoading(false)
      setShowAttachmentsModal(false)
    }
  }

  useEffect(() => {
    if (status === "loading") return
    
    if (!session) {
      router.push("/auth/signin")
      return
    }

    fetchFinancialData()
  }, [session, status, router, dateRange, selectedClientId])

  const fetchFinancialData = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.set('page', '1')
      params.set('limit', '100')
      if (dateRange?.from) {
        params.set('startDate', format(dateRange.from, 'yyyy-MM-dd'))
      }
      if (dateRange?.to) {
        params.set('endDate', format(dateRange.to, 'yyyy-MM-dd'))
      }
      if (selectedClientId) {
        params.set('clientId', selectedClientId)
      }
      if (filter === 'income') {
        params.set('type', 'INCOME')
      } else if (filter === 'expense') {
        params.set('type', 'EXPENSE')
      }
      const response = await fetch(`/api/financial?${params.toString()}`)
      
      if (!response.ok) {
        throw new Error('Falha ao carregar dados financeiros')
      }
      
      const data = await response.json()
      setEntries(data.entries)
      setStats(data.stats)
    } catch (error) {
      console.error('Erro ao buscar dados financeiros:', error)
      toast.error('Erro ao carregar dados financeiros')
    } finally {
      setLoading(false)
    }
  }

  const handleEditEntry = (entry: FinancialEntry) => {
    setEditingEntry(entry)
    setShowEditModal(true)
  }

  const handleDeleteEntry = async (entryId: string) => {
    try {
      const response = await fetch(`/api/financial/${entryId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Falha ao excluir entrada')
      }

      toast.success('Entrada excluída com sucesso!')
      fetchFinancialData()
      setShowDeleteConfirm(false)
      setDeletingEntryId(null)
    } catch (error) {
      console.error('Erro ao excluir entrada:', error)
      toast.error('Erro ao excluir entrada')
    }
  }

  const confirmDelete = (entryId: string) => {
    setDeletingEntryId(entryId)
    setShowDeleteConfirm(true)
  }

  const filteredEntries = entries.filter(entry => {
    const matchesFilter = filter === 'all' || 
      (filter === 'income' && entry.type === 'INCOME') ||
      (filter === 'expense' && entry.type === 'EXPENSE')
    
    const matchesSearch = searchTerm === '' ||
      entry.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (entry.projectName && entry.projectName.toLowerCase().includes(searchTerm.toLowerCase()))
    
    return matchesFilter && matchesSearch
  })

  const formatDate = (dateString: string) => {
    const datePart = dateString.split('T')[0]
    const [year, month, day] = datePart.split('-')
    return `${day}/${month}/${year}`
  }

  const projectLabel = (entry: FinancialEntry) => {
    const distributions = entry.projectDistributions ?? []
    if (distributions.length === 0) return entry.projectName || '—'
    if (distributions.length === 1) return distributions[0].projectName
    return `${distributions.length} projetos`
  }

  return (
    <PageLoadingGate loading={status === "loading" || loading}>
      <div className="space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground sm:text-2xl">Fluxo de caixa</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Controle de entradas e saídas financeiras
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowClientsOverview(true)}>
              <Users className="mr-2 h-4 w-4" />
              Por cliente
              {selectedClientId ? (
                <Badge variant="secondary" className="ml-2 h-5 min-w-5 px-1.5 text-[10px] font-normal">
                  1
                </Badge>
              ) : null}
            </Button>
            <Button variant="outline" size="sm" type="button">
              <Download className="mr-2 h-4 w-4" />
              Exportar
            </Button>
            <Button size="sm" onClick={() => setShowAddModal(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nova entrada
            </Button>
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatsCard
              title="Receita total"
              value={<CurrencyAmount value={stats.totalIncome} size="xl" />}
              description="No período selecionado"
            />
            <StatsCard
              title="Despesas total"
              value={<CurrencyAmount value={stats.totalExpenses} size="xl" />}
              description="No período selecionado"
            />
            <StatsCard
              title="Lucro líquido"
              value={<CurrencyAmount value={stats.netProfit} size="xl" />}
              description={`Mês atual: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.monthlyProfit)}`}
            />
            <StatsCard
              title="Margem"
              value={`${stats.totalIncome > 0 ? ((stats.netProfit / stats.totalIncome) * 100).toFixed(1) : 0}%`}
              description="Sobre a receita do período"
            />
          </div>
        )}

        <Card className="gap-0 overflow-hidden py-0 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <CardHeader className="border-b border-border px-4 py-3">
            <div className="space-y-3">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base">Lançamentos</CardTitle>
                  <CardDescription className="mt-0.5">
                    {filteredEntries.length} registro{filteredEntries.length === 1 ? '' : 's'}
                  </CardDescription>
                </div>
                {selectedClientId && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-7 gap-1 self-start text-xs"
                    onClick={() => setSelectedClientId(null)}
                  >
                    Filtro por cliente
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-2 lg:grid-cols-[1fr_140px_minmax(200px,240px)]">
                <div className="relative min-w-0">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar descrição, categoria ou projeto..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-9 pl-9"
                  />
                </div>
                <Select value={filter} onValueChange={(v) => setFilter(v as 'all' | 'income' | 'expense')}>
                  <SelectTrigger size="sm" className="h-9 w-full">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="income">Receitas</SelectItem>
                    <SelectItem value="expense">Despesas</SelectItem>
                  </SelectContent>
                </Select>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="date"
                      variant="outline"
                      size="sm"
                      className={cn(
                        'h-9 w-full justify-start text-left font-normal',
                        !dateRange && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                      <span className="truncate">
                        {dateRange?.from ? (
                          dateRange.to ? (
                            <>
                              {format(dateRange.from, 'dd/MM/yyyy', { locale: ptBR })} –{' '}
                              {format(dateRange.to, 'dd/MM/yyyy', { locale: ptBR })}
                            </>
                          ) : (
                            format(dateRange.from, 'dd/MM/yyyy', { locale: ptBR })
                          )
                        ) : (
                          'Período'
                        )}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <div className="flex flex-col space-y-2 border-b p-2">
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setDateRange({
                              from: startOfMonth(new Date()),
                              to: endOfMonth(new Date()),
                            })
                          }
                          className="justify-start text-xs"
                        >
                          Mês atual
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setDateRange({
                              from: startOfMonth(subMonths(new Date(), 1)),
                              to: endOfMonth(subMonths(new Date(), 1)),
                            })
                          }
                          className="justify-start text-xs"
                        >
                          Mês anterior
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setDateRange({
                              from: subDays(new Date(), 30),
                              to: new Date(),
                            })
                          }
                          className="justify-start text-xs"
                        >
                          30 dias
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setDateRange({
                              from: startOfYear(new Date()),
                              to: endOfYear(new Date()),
                            })
                          }
                          className="justify-start text-xs"
                        >
                          Este ano
                        </Button>
                      </div>
                    </div>
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={dateRange?.from}
                      selected={dateRange}
                      onSelect={setDateRange}
                      numberOfMonths={2}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {filteredEntries.length === 0 ? (
              <div className="px-4 py-16 text-center">
                <ArrowUpRight className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm font-medium text-foreground">Nenhum lançamento encontrado</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {searchTerm || filter !== 'all'
                    ? 'Ajuste os filtros ou limpe a busca.'
                    : 'Adicione a primeira entrada financeira.'}
                </p>
                {!searchTerm && filter === 'all' ? (
                  <Button variant="outline" size="sm" className="mt-4" onClick={() => setShowAddModal(true)}>
                    Nova entrada
                  </Button>
                ) : null}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-2.5 font-medium">Lançamento</th>
                      <th className="px-3 py-2.5 font-medium">Tipo</th>
                      <th className="px-3 py-2.5 font-medium">Valor</th>
                      <th className="px-3 py-2.5 font-medium">Data</th>
                      <th className="px-3 py-2.5 font-medium">Projeto</th>
                      <th className="px-3 py-2.5 text-right font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEntries.map((entry) => {
                      const hasDistributions =
                        entry.projectDistributions && entry.projectDistributions.length > 0
                      const attachmentCount = entry.attachments?.length ?? 0

                      return (
                        <tr
                          key={entry.id}
                          className="border-b border-border transition-colors last:border-b-0 hover:bg-muted/30"
                        >
                          <td className="px-4 py-3">
                            <div className="min-w-0">
                              <p className="truncate font-medium text-foreground">{entry.description}</p>
                              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                                <span className="text-xs text-muted-foreground">{entry.category}</span>
                                {entry.isRecurring ? (
                                  <Badge variant="outline" className="text-[10px] font-normal">
                                    Recorrente
                                  </Badge>
                                ) : null}
                                {entry.collaboratorName ? (
                                  <Badge variant="outline" className="text-[10px] font-normal">
                                    {entry.collaboratorName}
                                  </Badge>
                                ) : null}
                                {hasDistributions ? (
                                  <Badge variant="outline" className="text-[10px] font-normal">
                                    {entry.projectDistributions?.length} projetos
                                  </Badge>
                                ) : null}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <Badge
                              variant={entry.type === 'INCOME' ? 'secondary' : 'outline'}
                              className="gap-1 font-normal"
                            >
                              {entry.type === 'INCOME' ? (
                                <ArrowUpRight className="h-3 w-3" />
                              ) : (
                                <ArrowDownLeft className="h-3 w-3" />
                              )}
                              {entry.type === 'INCOME' ? 'Receita' : 'Despesa'}
                            </Badge>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <span className="inline-flex items-baseline gap-0.5 tabular-nums">
                              <span className="text-xs text-muted-foreground">
                                {entry.type === 'INCOME' ? '+' : '−'}
                              </span>
                              <CurrencyAmount value={Math.abs(entry.amount)} size="sm" />
                            </span>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">
                            {formatDate(entry.date)}
                          </td>
                          <td className="max-w-[160px] truncate px-3 py-3 text-muted-foreground">
                            {projectLabel(entry)}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex justify-end">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-44">
                                  <DropdownMenuItem onClick={() => openAttachmentsModal(entry)}>
                                    <Paperclip className="mr-2 h-4 w-4" />
                                    Anexos{attachmentCount > 0 ? ` (${attachmentCount})` : ''}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleEditEntry(entry)}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    Editar
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    variant="destructive"
                                    onClick={() => confirmDelete(entry.id)}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Excluir
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <ClientsFinancialOverviewDialog
          open={showClientsOverview}
          onOpenChange={setShowClientsOverview}
          selectedClientId={selectedClientId}
          onClientFilter={(clientId) => setSelectedClientId(clientId)}
        />
        <AddEntryModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSuccess={fetchFinancialData}
        />

        {/* Edit Entry Modal */}
        {editingEntry && (
          <AddEntryModal
            isOpen={showEditModal}
            onClose={() => {
              setShowEditModal(false)
              setEditingEntry(null)
            }}
            onSuccess={() => {
              fetchFinancialData()
              setShowEditModal(false)
              setEditingEntry(null)
            }}
            editingEntry={editingEntry}
          />
        )}

        {/* Attachments Modal */}
        <Dialog open={showAttachmentsModal} onOpenChange={setShowAttachmentsModal}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Anexos da Entrada</DialogTitle>
              <DialogDescription>Adicione ou remova anexos desta entrada financeira.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-medium flex items-center">
                  <Upload className="h-4 w-4 mr-1" />
                  Adicionar anexos
                </Label>
                <div className="border-2 border-dashed border-input rounded-lg p-4 text-center hover:border-primary transition-colors">
                  <input
                    type="file"
                    multiple
                    onChange={handleAttachmentFileSelect}
                    className="hidden"
                    id="attach-files"
                    accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar,.xml"
                  />
                  <label htmlFor="attach-files" className="cursor-pointer">
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Clique para selecionar arquivos</p>
                    <p className="text-xs text-muted-foreground mt-1">PDF e imagens (máx. 10MB cada)</p>
                  </label>
                </div>
                {newAttachmentFiles.length > 0 && (
                  <div className="space-y-2 mt-2">
                    <p className="text-sm font-medium text-foreground">Novos anexos:</p>
                    {newAttachmentFiles.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-primary/10 rounded border border-primary/20">
                        <div className="flex items-center space-x-2">
                          <FileText className="h-4 w-4 text-primary" />
                          <span className="text-sm">{file.name}</span>
                          <span className="text-xs text-muted-foreground">({formatFileSize(file.size)})</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeNewAttachmentFile(idx)}
                          className="text-destructive hover:text-destructive/80"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="text-sm font-medium text-foreground">Anexos existentes:</p>
                {existingEntryAttachments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum anexo.</p>
                ) : (
                  <div className="space-y-2">
                    {existingEntryAttachments.map(att => (
                      <div key={att.id} className="flex items-center justify-between p-2 bg-card rounded border border-border">
                        <div className="flex items-center space-x-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <a href={att.url} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">
                            {att.originalName}
                          </a>
                          <span className="text-xs text-muted-foreground">({formatFileSize(att.size)})</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeExistingAttachment(att.id)}
                          className="text-destructive hover:text-destructive/80"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <Button variant="outline" onClick={() => setShowAttachmentsModal(false)}>Cancelar</Button>
                <Button onClick={saveNewAttachments} disabled={attachmentsLoading || newAttachmentFiles.length === 0}>
                  Salvar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Modal */}
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir esta entrada financeira? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {
                setShowDeleteConfirm(false)
                setDeletingEntryId(null)
              }}>
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction onClick={() => deletingEntryId && handleDeleteEntry(deletingEntryId)} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PageLoadingGate>
  )
}
