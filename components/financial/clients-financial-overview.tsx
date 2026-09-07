"use client"

import { useState, useEffect, useCallback } from "react"
import { LoadingAnimation } from '@/components/ui/loading-animation'
import {
  Users,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Building,
  Mail,
  Phone,
  X,
  FolderOpen,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { CurrencyAmount } from "@/components/ui/currency-amount"
import { cn } from "@/lib/utils"
import toast from "react-hot-toast"

interface ClientFinancialData {
  id: string
  name: string
  email: string
  phone?: string
  company?: string
  totalProjects: number
  totalValue: number
  projects: Array<{
    id: string
    name: string
    budget: number
    status: string
    financialEntries: Array<{
      id: string
      type: 'INCOME' | 'EXPENSE'
      amount: number
      description: string
      category: string
      date: string
    }>
  }>
  payments: Array<{
    id: string
    amount: number
    description?: string
    paymentDate: string
    method: string
    status: string
  }>
}

interface ClientsFinancialOverviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onClientFilter?: (clientId: string | null) => void
  selectedClientId?: string | null
}

function getStatusBadgeClass(status: string) {
  switch (status.toLowerCase()) {
    case 'completed':
    case 'paid':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
    case 'in_progress':
    case 'pending':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
    case 'cancelled':
    case 'failed':
      return 'border-destructive/30 bg-destructive/10 text-destructive'
    default:
      return 'border-border bg-muted text-muted-foreground'
  }
}

function getStatusLabel(status: string) {
  const statusMap: Record<string, string> = {
    PLANNING: 'Planejamento',
    IN_PROGRESS: 'Em Andamento',
    ON_HOLD: 'Pausado',
    COMPLETED: 'Concluído',
    CANCELLED: 'Cancelado',
    PAID: 'Pago',
    PENDING: 'Pendente',
    FAILED: 'Falhou',
  }
  return statusMap[status] || status
}

function formatDate(dateString: string) {
  const datePart = dateString.split('T')[0]
  const [year, month, day] = datePart.split('-')
  return `${day}/${month}/${year}`
}

export function ClientsFinancialOverviewDialog({
  open,
  onOpenChange,
  onClientFilter,
  selectedClientId = null,
}: ClientsFinancialOverviewDialogProps) {
  const [clients, setClients] = useState<ClientFinancialData[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set())

  const selectedClientData = clients.find((c) => c.id === selectedClientId)

  const fetchClientsFinancialData = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/clients/financial-overview')

      if (!response.ok) {
        throw new Error('Falha ao carregar dados financeiros dos clientes')
      }

      const data = await response.json()
      setClients(data.clients)
    } catch (error) {
      console.error('Erro ao buscar dados financeiros dos clientes:', error)
      toast.error('Erro ao carregar dados dos clientes')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      fetchClientsFinancialData()
    }
  }, [open, fetchClientsFinancialData])

  const toggleClientExpansion = (clientId: string) => {
    setExpandedClients((prev) => {
      const next = new Set(prev)
      if (next.has(clientId)) next.delete(clientId)
      else next.add(clientId)
      return next
    })
  }

  const handleClientFilter = (clientId: string) => {
    const next = selectedClientId === clientId ? null : clientId
    onClientFilter?.(next)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[92vh] max-h-[92vh] w-[96vw] max-w-[96vw] flex-col gap-0 p-0 sm:max-w-[96vw]">
        <DialogHeader className="shrink-0 space-y-1 border-b border-border px-6 py-4 text-left">
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            Visão financeira por cliente
            {selectedClientData && (
              <Badge
                variant="secondary"
                className="cursor-pointer gap-1 font-normal"
                onClick={() => onClientFilter?.(null)}
              >
                Filtrando: {selectedClientData.name}
                <X className="h-3 w-3" />
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Pagamentos e projetos organizados por cliente. Use &quot;Filtrar&quot; para refinar a tabela de entradas.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <LoadingAnimation size="md" />
            </div>
          ) : clients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Users className="mb-3 h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nenhum cliente encontrado</p>
            </div>
          ) : (
            <div className="space-y-3">
              {clients.map((client) => {
                const isExpanded = expandedClients.has(client.id)
                const isSelected = selectedClientId === client.id
                const totalIncome = client.projects.reduce(
                  (sum, project) =>
                    sum +
                    project.financialEntries
                      .filter((entry) => entry.type === 'INCOME')
                      .reduce((entrySum, entry) => entrySum + entry.amount, 0),
                  0
                )
                const totalExpenses = client.projects.reduce(
                  (sum, project) =>
                    sum +
                    project.financialEntries
                      .filter((entry) => entry.type === 'EXPENSE')
                      .reduce((entrySum, entry) => entrySum + entry.amount, 0),
                  0
                )
                const totalPayments = client.payments.reduce((sum, payment) => sum + payment.amount, 0)

                return (
                  <div
                    key={client.id}
                    className={cn(
                      'rounded-lg border bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors',
                      isSelected ? 'border-primary/40 bg-primary/5' : 'border-border hover:border-border/80'
                    )}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex min-w-0 items-start gap-2">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => toggleClientExpansion(client.id)}
                          aria-label={isExpanded ? 'Recolher cliente' : 'Expandir cliente'}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                        <div className="min-w-0">
                          <h3 className="truncate font-medium text-foreground">{client.name}</h3>
                          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            {client.company && (
                              <span className="inline-flex items-center gap-1">
                                <Building className="h-3 w-3 shrink-0" />
                                {client.company}
                              </span>
                            )}
                            <span className="inline-flex items-center gap-1">
                              <Mail className="h-3 w-3 shrink-0" />
                              {client.email}
                            </span>
                            {client.phone && (
                              <span className="inline-flex items-center gap-1">
                                <Phone className="h-3 w-3 shrink-0" />
                                {client.phone}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-wrap items-center gap-4 lg:justify-end">
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Projetos</p>
                          <p className="text-sm font-medium tabular-nums text-foreground">{client.totalProjects}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Pagamentos</p>
                          <CurrencyAmount value={totalPayments} size="sm" />
                        </div>
                        <Button
                          variant={isSelected ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => handleClientFilter(client.id)}
                        >
                          {isSelected ? 'Limpar filtro' : 'Filtrar'}
                        </Button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-4 space-y-4 border-t border-border pt-4">
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div className="rounded-lg border border-border bg-muted/30 p-3">
                            <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                              <TrendingUp className="h-3.5 w-3.5" />
                              Receitas
                            </div>
                            <CurrencyAmount value={totalIncome} size="md" />
                          </div>
                          <div className="rounded-lg border border-border bg-muted/30 p-3">
                            <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                              <TrendingDown className="h-3.5 w-3.5" />
                              Despesas
                            </div>
                            <CurrencyAmount value={totalExpenses} size="md" />
                          </div>
                          <div className="rounded-lg border border-border bg-muted/30 p-3">
                            <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                              <DollarSign className="h-3.5 w-3.5" />
                              Pagamentos
                            </div>
                            <CurrencyAmount value={totalPayments} size="md" />
                          </div>
                        </div>

                        {client.projects.length > 0 && (
                          <div>
                            <h4 className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
                              <FolderOpen className="h-4 w-4 text-muted-foreground" />
                              Projetos ({client.projects.length})
                            </h4>
                            <div className="space-y-2">
                              {client.projects.map((project) => (
                                <div
                                  key={project.id}
                                  className="flex flex-col gap-2 rounded-md border border-border bg-background px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                                >
                                  <div className="min-w-0">
                                    <span className="font-medium text-foreground">{project.name}</span>
                                    <Badge
                                      variant="outline"
                                      className={cn('ml-2 align-middle', getStatusBadgeClass(project.status))}
                                    >
                                      {getStatusLabel(project.status)}
                                    </Badge>
                                    {project.financialEntries.length > 0 && (
                                      <p className="mt-1 text-xs text-muted-foreground">
                                        {project.financialEntries.length} entrada(s) financeira(s)
                                      </p>
                                    )}
                                  </div>
                                  <div className="shrink-0 text-left sm:text-right">
                                    <p className="text-xs text-muted-foreground">Orçamento</p>
                                    <CurrencyAmount value={project.budget} size="sm" />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {client.payments.length > 0 && (
                          <div>
                            <h4 className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
                              <DollarSign className="h-4 w-4 text-muted-foreground" />
                              Pagamentos recentes ({client.payments.length})
                            </h4>
                            <div className="space-y-2">
                              {client.payments.slice(0, 5).map((payment) => (
                                <div
                                  key={payment.id}
                                  className="flex flex-col gap-2 rounded-md border border-border bg-background px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                                >
                                  <div className="min-w-0">
                                    <CurrencyAmount value={payment.amount} size="sm" />
                                    {payment.description && (
                                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                        {payment.description}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
                                    <span className="text-xs text-muted-foreground">
                                      {formatDate(payment.paymentDate)}
                                    </span>
                                    <Badge
                                      variant="outline"
                                      className={getStatusBadgeClass(payment.status)}
                                    >
                                      {getStatusLabel(payment.status)}
                                    </Badge>
                                  </div>
                                </div>
                              ))}
                              {client.payments.length > 5 && (
                                <p className="text-center text-xs text-muted-foreground">
                                  +{client.payments.length - 5} pagamento(s) adicional(is)
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
