"use client"

import { useState, useEffect } from "react"
import { 
  Users, 
  ChevronDown, 
  ChevronRight,
  ChevronUp, 
  DollarSign, 
  FolderOpen,
  TrendingUp,
  TrendingDown,
  Building,
  Mail,
  Phone,
  X
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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

interface ClientsFinancialOverviewProps {
  onClientFilter?: (clientId: string | null) => void
}

export function ClientsFinancialOverview({ onClientFilter }: ClientsFinancialOverviewProps) {
  const [clients, setClients] = useState<ClientFinancialData[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set())
  const [selectedClient, setSelectedClient] = useState<string | null>(null)
  const [isCollapsed, setIsCollapsed] = useState(true)

  const selectedClientData = clients.find(c => c.id === selectedClient)

  useEffect(() => {
    fetchClientsFinancialData()
  }, [])

  const fetchClientsFinancialData = async () => {
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
  }

  const toggleClientExpansion = (clientId: string) => {
    const newExpanded = new Set(expandedClients)
    if (newExpanded.has(clientId)) {
      newExpanded.delete(clientId)
    } else {
      newExpanded.add(clientId)
    }
    setExpandedClients(newExpanded)
  }

  const handleClientFilter = (clientId: string) => {
    const newSelectedClient = selectedClient === clientId ? null : clientId
    setSelectedClient(newSelectedClient)
    onClientFilter?.(newSelectedClient)
  }

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

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'paid':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
      case 'in_progress':
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
      case 'cancelled':
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
    }
  }

  const getStatusLabel = (status: string) => {
    const statusMap: { [key: string]: string } = {
      'PLANNING': 'Planejamento',
      'IN_PROGRESS': 'Em Andamento',
      'ON_HOLD': 'Pausado',
      'COMPLETED': 'Concluído',
      'CANCELLED': 'Cancelado',
      'PAID': 'Pago',
      'PENDING': 'Pendente',
      'FAILED': 'Falhou'
    }
    return statusMap[status] || status
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="h-5 w-5 mr-2" />
            Visão Financeira por Cliente
            {selectedClientData && (
              <Badge variant="secondary" className="ml-4 bg-primary/10 text-primary border-primary/20 border">
                Filtrando por: {selectedClientData.name}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <div 
        className="p-6 cursor-pointer hover:bg-muted/50 transition-colors flex items-center justify-between"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="space-y-1.5">
          <CardTitle className="flex items-center">
            <Users className="h-5 w-5 mr-2" />
            Visão Financeira por Cliente
            {selectedClientData && (
              <div 
                className="ml-4 inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary border border-primary/20"
                onClick={(e) => {
                  e.stopPropagation()
                  handleClientFilter(selectedClientData.id)
                }}
              >
                Filtrando por: {selectedClientData.name}
                <div className="ml-1 hover:bg-primary/20 rounded-full p-0.5 cursor-pointer">
                  <X className="h-3 w-3" />
                </div>
              </div>
            )}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Visualize pagamentos e projetos organizados por cliente
          </p>
        </div>
        {isCollapsed ? (
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronUp className="h-5 w-5 text-muted-foreground" />
        )}
      </div>
      {!isCollapsed && (
        <CardContent className="space-y-4 pt-0 border-t">
        {clients.length === 0 ? (
          <div className="text-center py-8">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhum cliente encontrado</p>
          </div>
        ) : (
          clients.map((client) => {
            const isExpanded = expandedClients.has(client.id)
            const isSelected = selectedClient === client.id
            const totalIncome = client.projects.reduce((sum, project) => 
              sum + project.financialEntries
                .filter(entry => entry.type === 'INCOME')
                .reduce((entrySum, entry) => entrySum + entry.amount, 0), 0
            )
            const totalExpenses = client.projects.reduce((sum, project) => 
              sum + project.financialEntries
                .filter(entry => entry.type === 'EXPENSE')
                .reduce((entrySum, entry) => entrySum + entry.amount, 0), 0
            )
            const totalPayments = client.payments.reduce((sum, payment) => sum + payment.amount, 0)

            return (
              <div 
                key={client.id} 
                className={`border rounded-lg p-4 transition-all ${
                  isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleClientExpansion(client.id)}
                      className="p-1"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                    <div>
                      <h3 className="font-medium text-foreground">{client.name}</h3>
                      <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                        {client.company && (
                          <span className="flex items-center">
                            <Building className="h-3 w-3 mr-1" />
                            {client.company}
                          </span>
                        )}
                        <span className="flex items-center">
                          <Mail className="h-3 w-3 mr-1" />
                          {client.email}
                        </span>
                        {client.phone && (
                          <span className="flex items-center">
                            <Phone className="h-3 w-3 mr-1" />
                            {client.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">Projetos</div>
                      <div className="font-medium">{client.totalProjects}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">Valor Total</div>
                      <div className="font-medium text-green-600 dark:text-green-400">{formatCurrency(totalPayments)}</div>
                    </div>
                    <Button
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleClientFilter(client.id)}
                    >
                      {isSelected ? "Limpar Filtro" : "Filtrar"}
                    </Button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-4 space-y-4 border-t pt-4">
                    {/* Resumo Financeiro */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                        <div className="flex items-center">
                          <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400 mr-2" />
                          <span className="text-sm text-green-600 dark:text-green-400">Receitas</span>
                        </div>
                        <div className="text-lg font-semibold text-green-700 dark:text-green-300">
                          {formatCurrency(totalIncome)}
                        </div>
                      </div>
                      <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                        <div className="flex items-center">
                          <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400 mr-2" />
                          <span className="text-sm text-red-600 dark:text-red-400">Despesas</span>
                        </div>
                        <div className="text-lg font-semibold text-red-700 dark:text-red-300">
                          {formatCurrency(totalExpenses)}
                        </div>
                      </div>
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                        <div className="flex items-center">
                          <DollarSign className="h-4 w-4 text-blue-600 dark:text-blue-400 mr-2" />
                          <span className="text-sm text-blue-600 dark:text-blue-400">Pagamentos</span>
                        </div>
                        <div className="text-lg font-semibold text-blue-700 dark:text-blue-300">
                          {formatCurrency(totalPayments)}
                        </div>
                      </div>
                    </div>

                    {/* Projetos */}
                    {client.projects.length > 0 && (
                      <div>
                        <h4 className="font-medium text-foreground mb-2 flex items-center">
                          <FolderOpen className="h-4 w-4 mr-2" />
                          Projetos ({client.projects.length})
                        </h4>
                        <div className="space-y-2">
                          {client.projects.map((project) => (
                            <div key={project.id} className="bg-card p-3 rounded-lg">
                              <div className="flex items-center justify-between">
                                <div>
                                  <span className="font-medium">{project.name}</span>
                                  <Badge className={`ml-2 ${getStatusColor(project.status)}`}>
                                    {getStatusLabel(project.status)}
                                  </Badge>
                                </div>
                                <div className="text-right">
                                  <div className="text-sm text-muted-foreground">Orçamento</div>
                                  <div className="font-medium">{formatCurrency(project.budget)}</div>
                                </div>
                              </div>
                              {project.financialEntries.length > 0 && (
                                <div className="mt-2 text-sm text-muted-foreground">
                                  {project.financialEntries.length} entrada(s) financeira(s)
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Pagamentos Recentes */}
                    {client.payments.length > 0 && (
                      <div>
                        <h4 className="font-medium text-foreground mb-2 flex items-center">
                          <DollarSign className="h-4 w-4 mr-2" />
                          Pagamentos Recentes ({client.payments.length})
                        </h4>
                        <div className="space-y-2">
                          {client.payments.slice(0, 3).map((payment) => (
                            <div key={payment.id} className="bg-card p-3 rounded-lg">
                              <div className="flex items-center justify-between">
                                <div>
                                  <span className="font-medium">{formatCurrency(payment.amount)}</span>
                                  {payment.description && (
                                    <span className="text-sm text-muted-foreground ml-2">
                                      - {payment.description}
                                    </span>
                                  )}
                                </div>
                                <div className="text-right">
                                  <div className="text-sm text-muted-foreground">
                                    {formatDate(payment.paymentDate)}
                                  </div>
                                  <Badge className={getStatusColor(payment.status)}>
                                    {getStatusLabel(payment.status)}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          ))}
                          {client.payments.length > 3 && (
                            <div className="text-sm text-muted-foreground text-center">
                              +{client.payments.length - 3} pagamento(s) adicional(is)
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </CardContent>
      )}
    </Card>
  )
}