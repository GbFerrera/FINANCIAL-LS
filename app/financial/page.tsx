"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { parseISO, format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, subDays } from "date-fns"
import { ptBR } from "date-fns/locale"
import { DateRange } from "react-day-picker"
import { cn } from "@/lib/utils"
import {
  Plus,
  Download,
  Filter,
  Search,
  Calendar as CalendarIcon,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Eye,
  Edit,
  Trash2,
  Paperclip,
  X,
  Upload,
  FileText
} from "lucide-react"
import { StatsCard } from "@/components/ui/stats-card"
import { AddEntryModal } from "@/components/financial/add-entry-modal"
import { ClientsFinancialOverview } from "@/components/financial/clients-financial-overview"
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
import { Label } from "@/components/ui/label"
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
    from: startOfMonth(subMonths(new Date(), 1)),
    to: endOfMonth(subMonths(new Date(), 1)),
  })
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingEntry, setEditingEntry] = useState<FinancialEntry | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
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

    if (session.user.role !== "ADMIN") {
      toast.error("Acesso negado. Apenas administradores podem acessar o módulo financeiro.")
      router.push("/dashboard")
      return
    }

    fetchFinancialData()
  }, [session, status, router, dateRange, selectedClientId])

  const fetchFinancialData = async () => {
    try {
      setLoading(true)
      let url = `/api/financial?`
      
      if (dateRange?.from) {
        url += `&startDate=${format(dateRange.from, 'yyyy-MM-dd')}`
      }
      if (dateRange?.to) {
        url += `&endDate=${format(dateRange.to, 'yyyy-MM-dd')}`
      }
      
      if (selectedClientId) {
        url += `&clientId=${selectedClientId}`
      }
      
      const response = await fetch(url)
      
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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value)
  }

  const formatDate = (dateString: string) => {
    // Extrair apenas a parte da data (YYYY-MM-DD) sem conversão de fuso horário
    const datePart = dateString.split('T')[0]
    const [year, month, day] = datePart.split('-')
    return `${day}/${month}/${year}`
  }

  const getTypeColor = (type: string) => {
    return type === 'INCOME' 
      ? 'text-green-700 bg-green-100 dark:bg-green-900/30 dark:text-green-300' 
      : 'text-red-700 bg-red-100 dark:bg-red-900/30 dark:text-red-300'
  }

  const getTypeIcon = (type: string) => {
    return type === 'INCOME' ? TrendingUp : TrendingDown
  }

  if (status === "loading" || loading) {
    return (
   
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>

    )
  }

  return (
 <>
      <div className="space-y-6">
        {/* Header */}
        <div className="md:flex md:items-center md:justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold leading-7 text-foreground sm:text-3xl sm:truncate">
              Gestão Financeira
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Controle completo das entradas e saídas financeiras
            </p>
          </div>
          <div className="mt-4 flex space-x-3 md:mt-0 md:ml-4">
            <button className="inline-flex items-center px-4 py-2 border border-input rounded-md shadow-sm text-sm font-medium text-foreground bg-card hover:bg-accent hover:text-accent-foreground">
              <Download className="-ml-1 mr-2 h-5 w-5" />
              Exportar
            </button>
            <button 
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90"
            >
              <Plus className="-ml-1 mr-2 h-5 w-5" />
              Nova Entrada
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-2">
            <StatsCard
              title="Receita Total"
              value={formatCurrency(stats.totalIncome)}
              icon={TrendingUp}
              color="green"
              change={{
                value: formatCurrency(stats.monthlyIncome),
                type: 'neutral'
              }}
            />
            <StatsCard
              title="Despesas Total"
              value={formatCurrency(stats.totalExpenses)}
              icon={TrendingDown}
              color="red"
              change={{
                value: formatCurrency(stats.monthlyExpenses),
                type: 'neutral'
              }}
            />
            <StatsCard
              title="Lucro Líquido"
              value={formatCurrency(stats.netProfit)}
              icon={DollarSign}
              color={stats.netProfit >= 0 ? 'green' : 'red'}
              change={{
                value: formatCurrency(stats.monthlyProfit),
                type: stats.monthlyProfit >= 0 ? 'increase' : 'decrease'
              }}
            />
            <StatsCard
              title="Margem de Lucro"
              value={`${stats.totalIncome > 0 ? ((stats.netProfit / stats.totalIncome) * 100).toFixed(1) : 0}%`}
              icon={TrendingUp}
              color={stats.netProfit >= 0 ? 'blue' : 'red'}
              change={{
                value: `${stats.monthlyIncome > 0 ? ((stats.monthlyProfit / stats.monthlyIncome) * 100).toFixed(1) : 0}% este mês`,
                type: 'neutral'
              }}
            />
          </div>
        )}

        {/* Filters and Search */}
        <div className="bg-card shadow rounded-lg border border-border">
          <div className="px-4 py-5 sm:p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              {/* Search */}
              <div className="sm:col-span-2">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <input
                    type="text"
                    placeholder="Buscar por descrição, categoria ou projeto..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-input rounded-md leading-5 bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                  />
                </div>
              </div>
              
              {/* Type Filter */}
              <div>
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as 'all' | 'income' | 'expense')}
                  className="block w-full pl-3 pr-10 py-2 text-base border-input bg-background focus:outline-none focus:ring-primary focus:border-primary rounded-md"
                >
                  <option value="all">Todos os tipos</option>
                  <option value="income">Receitas</option>
                  <option value="expense">Despesas</option>
                </select>
              </div>
              
              {/* Date Range */}
              <div className="sm:col-span-1">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="date"
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dateRange && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange?.from ? (
                        dateRange.to ? (
                          <>
                            {format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })} -{" "}
                            {format(dateRange.to, "dd/MM/yyyy", { locale: ptBR })}
                          </>
                        ) : (
                          format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })
                        )
                      ) : (
                        <span>Selecione o período</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <div className="flex flex-col space-y-2 p-2 border-b">
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDateRange({
                            from: startOfMonth(new Date()),
                            to: endOfMonth(new Date())
                          })}
                          className="justify-start text-xs"
                        >
                          Mês Atual
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDateRange({
                            from: startOfMonth(subMonths(new Date(), 1)),
                            to: endOfMonth(subMonths(new Date(), 1))
                          })}
                          className="justify-start text-xs"
                        >
                          Mês Anterior
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDateRange({
                            from: subDays(new Date(), 30),
                            to: new Date()
                          })}
                          className="justify-start text-xs"
                        >
                          Últimos 30 dias
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDateRange({
                            from: startOfYear(new Date()),
                            to: endOfYear(new Date())
                          })}
                          className="justify-start text-xs"
                        >
                          Este Ano
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
          </div>
        </div>

        {/* Clients Financial Overview */}
        <ClientsFinancialOverview 
          onClientFilter={(clientId) => setSelectedClientId(clientId)}
        />

        {/* Entries Table */}
        <div className="bg-card shadow rounded-lg overflow-hidden border border-border">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-foreground mb-4">
              Entradas Financeiras ({filteredEntries.length})
            </h3>
            
            {filteredEntries.length === 0 ? (
              <div className="text-center py-12">
                <DollarSign className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-medium text-foreground">Nenhuma entrada encontrada</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {searchTerm || filter !== 'all' ? 'Tente ajustar os filtros' : 'Comece adicionando uma nova entrada financeira'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Tipo
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Descrição
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Categoria
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Valor
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Data
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Projeto
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-card divide-y divide-border">
                    {filteredEntries.map((entry) => {
                      const TypeIcon = getTypeIcon(entry.type)
                      const hasDistributions = entry.projectDistributions && entry.projectDistributions.length > 0
                      return (
                        <tr key={entry.id} className="hover:bg-muted/50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeColor(entry.type)}`}>
                                <TypeIcon className="w-3 h-3 mr-1" />
                                {entry.type === 'INCOME' ? 'Receita' : 'Despesa'}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-foreground">{entry.description}</div>
                            {entry.isRecurring && (
                              <div className="text-xs text-muted-foreground">Recorrente</div>
                            )}
                            {entry.collaboratorName && (
                              <div className="text-xs text-blue-600 dark:text-blue-300 font-medium mt-1">
                                Colaborador: {entry.collaboratorName}
                              </div>
                            )}
                            {hasDistributions && (
                              <div className="text-xs text-purple-600 dark:text-purple-400 font-medium mt-1">
                                Distribuído entre {entry.projectDistributions?.length} projeto{(entry.projectDistributions?.length || 0) > 1 ? 's' : ''}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                            {entry.category}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={`text-sm font-medium ${entry.type === 'INCOME' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                              {entry.type === 'INCOME' ? '+' : '-'}{formatCurrency(Math.abs(entry.amount))}
                            </div>
                            {hasDistributions && (
                              <div className="mt-2 space-y-1">
                                {entry.projectDistributions?.map((dist, index) => (
                                  <div key={index} className="text-xs bg-purple-50 dark:bg-purple-900/20 px-2 py-1 rounded border border-purple-200 dark:border-purple-800">
                                    <span className="font-medium text-purple-700 dark:text-purple-300">{dist.projectName}:</span>
                                    <span className="text-purple-600 dark:text-purple-400 ml-1">{formatCurrency(dist.amount)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                            {formatDate(entry.date)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                            {hasDistributions ? (
                              <div className="space-y-1">
                                {entry.projectDistributions?.map((dist, index) => (
                                  <div key={index} className="text-xs bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded border border-blue-200 dark:border-blue-800">
                                    <span className="text-blue-700 dark:text-blue-300 font-medium">{dist.projectName}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              entry.projectName || '-'
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex items-center justify-end space-x-2">
                              <button 
                                onClick={() => openAttachmentsModal(entry)}
                                className="text-primary hover:text-primary/80"
                                title="Gerenciar anexos"
                              >
                                <Paperclip className="h-4 w-4" />
                              </button>
                              {Array.isArray(entry.attachments) && entry.attachments.length > 0 && (
                                <span className="ml-1 inline-flex items-center rounded px-1.5 py-0.5 text-xs bg-primary/10 text-primary border border-primary/20">
                                  {entry.attachments.length}
                                </span>
                              )}
                              <button 
                                onClick={() => handleEditEntry(entry)}
                                className="text-muted-foreground hover:text-foreground"
                                title="Editar"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button 
                                onClick={() => confirmDelete(entry.id)}
                                className="text-destructive hover:text-destructive/80"
                                title="Excluir"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Add Entry Modal */}
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
    </>
  )
}
