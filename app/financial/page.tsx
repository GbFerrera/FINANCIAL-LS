"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { parseISO, format } from "date-fns"
import {
  Plus,
  Download,
  Filter,
  Search,
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Eye,
  Edit,
  Trash2,
  Paperclip,
  X
} from "lucide-react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { StatsCard } from "@/components/ui/stats-card"
import { AddEntryModal } from "@/components/financial/add-entry-modal"
import { ClientsFinancialOverview } from "@/components/financial/clients-financial-overview"
import { SyncPaymentsButton } from "@/components/financial/sync-payments-button"
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
  const [dateRange, setDateRange] = useState('all') // days
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingEntry, setEditingEntry] = useState<FinancialEntry | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)

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
      let url = `/api/financial?days=${dateRange}`
      
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
    return type === 'INCOME' ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100'
  }

  const getTypeIcon = (type: string) => {
    return type === 'INCOME' ? TrendingUp : TrendingDown
  }

  if (status === "loading" || loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="md:flex md:items-center md:justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
              Gestão Financeira
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Controle completo das entradas e saídas financeiras
            </p>
          </div>
          <div className="mt-4 flex space-x-3 md:mt-0 md:ml-4">
            <SyncPaymentsButton />
            <button className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
              <Download className="-ml-1 mr-2 h-5 w-5" />
              Exportar
            </button>
            <button 
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
            >
              <Plus className="-ml-1 mr-2 h-5 w-5" />
              Nova Entrada
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
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
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              {/* Search */}
              <div className="sm:col-span-2">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Buscar por descrição, categoria ou projeto..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>
              
              {/* Type Filter */}
              <div>
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as 'all' | 'income' | 'expense')}
                  className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md"
                >
                  <option value="all">Todos os tipos</option>
                  <option value="income">Receitas</option>
                  <option value="expense">Despesas</option>
                </select>
              </div>
              
              {/* Date Range */}
              <div>
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md"
                >
                  <option value="all">Todos os períodos</option>
                  <option value="7">Últimos 7 dias</option>
                  <option value="30">Últimos 30 dias</option>
                  <option value="90">Últimos 90 dias</option>
                  <option value="365">Último ano</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Clients Financial Overview */}
        <ClientsFinancialOverview 
          onClientFilter={(clientId) => setSelectedClientId(clientId)}
        />

        {/* Entries Table */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Entradas Financeiras ({filteredEntries.length})
            </h3>
            
            {filteredEntries.length === 0 ? (
              <div className="text-center py-12">
                <DollarSign className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhuma entrada encontrada</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {searchTerm || filter !== 'all' ? 'Tente ajustar os filtros' : 'Comece adicionando uma nova entrada financeira'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tipo
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Descrição
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Categoria
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Valor
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Data
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Projeto
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredEntries.map((entry) => {
                      const TypeIcon = getTypeIcon(entry.type)
                      const hasDistributions = entry.projectDistributions && entry.projectDistributions.length > 0
                      return (
                        <tr key={entry.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeColor(entry.type)}`}>
                                <TypeIcon className="w-3 h-3 mr-1" />
                                {entry.type === 'INCOME' ? 'Receita' : 'Despesa'}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-gray-900">{entry.description}</div>
                            {entry.isRecurring && (
                              <div className="text-xs text-gray-500">Recorrente</div>
                            )}
                            {hasDistributions && (
                              <div className="text-xs text-purple-600 font-medium mt-1">
                                Distribuído entre {entry.projectDistributions.length} projeto{entry.projectDistributions.length > 1 ? 's' : ''}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {entry.category}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={`text-sm font-medium ${entry.type === 'INCOME' ? 'text-green-600' : 'text-red-600'}`}>
                              {entry.type === 'INCOME' ? '+' : '-'}{formatCurrency(Math.abs(entry.amount))}
                            </div>
                            {hasDistributions && (
                              <div className="mt-2 space-y-1">
                                {entry.projectDistributions.map((dist, index) => (
                                  <div key={index} className="text-xs bg-purple-50 px-2 py-1 rounded border border-purple-200">
                                    <span className="font-medium text-purple-700">{dist.projectName}:</span>
                                    <span className="text-purple-600 ml-1">{formatCurrency(dist.amount)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(entry.date)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {hasDistributions ? (
                              <div className="space-y-1">
                                {entry.projectDistributions.map((dist, index) => (
                                  <div key={index} className="text-xs bg-blue-50 px-2 py-1 rounded border border-blue-200">
                                    <span className="text-blue-700 font-medium">{dist.projectName}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              entry.projectName || '-'
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex items-center justify-end space-x-2">
                              {entry.attachments && entry.attachments.length > 0 && (
                                <button 
                                  className="text-indigo-600 hover:text-indigo-900"
                                  title={`${entry.attachments.length} anexo(s)`}
                                >
                                  <Paperclip className="h-4 w-4" />
                                </button>
                              )}
                              <button 
                                onClick={() => handleEditEntry(entry)}
                                className="text-gray-600 hover:text-gray-900"
                                title="Editar"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button 
                                onClick={() => confirmDelete(entry.id)}
                                className="text-red-600 hover:text-red-900"
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
              <AlertDialogAction onClick={() => deletingEntryId && handleDeleteEntry(deletingEntryId)} className="bg-red-600 hover:bg-red-700">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  )
}