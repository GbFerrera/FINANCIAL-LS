'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, CreditCard, DollarSign, Users } from 'lucide-react'
import { AddPaymentDialog } from '@/components/payments/add-payment-dialog'
import { DistributePaymentDialog } from '@/components/payments/distribute-payment-dialog'
import { parseISO } from 'date-fns'

interface Payment {
  id: string
  amount: number
  description?: string
  paymentDate: string
  method: string
  status: string
  client: {
    id: string
    name: string
    email: string
    company?: string
  }
  paymentProjects: Array<{
    id: string
    amount: number
    project: {
      id: string
      name: string
      budget?: number
    }
  }>
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null)
  const [showDistributeDialog, setShowDistributeDialog] = useState(false)

  useEffect(() => {
    fetchPayments()
  }, [])

  const fetchPayments = async () => {
    try {
      const response = await fetch('/api/payments')
      if (response.ok) {
        const data = await response.json()
        // Garantir que data seja um array
        setPayments(Array.isArray(data) ? data : data.payments || [])
      }
    } catch (error) {
      console.error('Erro ao carregar pagamentos:', error)
      setPayments([]) // Garantir que seja um array vazio em caso de erro
    } finally {
      setLoading(false)
    }
  }

  const handlePaymentAdded = () => {
    fetchPayments()
    setShowAddDialog(false)
  }

  const handleDistributePayment = (payment: Payment) => {
    setSelectedPayment(payment)
    setShowDistributeDialog(true)
  }

  const handleDistributionComplete = () => {
    fetchPayments()
    setShowDistributeDialog(false)
    setSelectedPayment(null)
  }

  const getDistributedAmount = (payment: Payment) => {
    return payment.paymentProjects.reduce((sum, pp) => sum + pp.amount, 0)
  }

  const getRemainingAmount = (payment: Payment) => {
    return payment.amount - getDistributedAmount(payment)
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const formatDate = (dateString: string) => {
    return parseISO(dateString).toLocaleDateString('pt-BR')
  }

  const getMethodLabel = (method: string) => {
    const methods: Record<string, string> = {
      CASH: 'Dinheiro',
      BANK_TRANSFER: 'Transferência',
      CREDIT_CARD: 'Cartão de Crédito',
      DEBIT_CARD: 'Cartão de Débito',
      PIX: 'PIX',
      CHECK: 'Cheque',
      OTHER: 'Outro'
    }
    return methods[method] || method
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      PROCESSING: 'bg-blue-100 text-blue-800',
      COMPLETED: 'bg-green-100 text-green-800',
      FAILED: 'bg-red-100 text-red-800',
      CANCELLED: 'bg-gray-100 text-gray-800'
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Carregando pagamentos...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Pagamentos</h1>
          <p className="text-muted-foreground">
            Gerencie pagamentos e distribua entre projetos
          </p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Pagamento
        </Button>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Recebido</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(Array.isArray(payments) ? payments.reduce((sum, p) => sum + p.amount, 0) : 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Distribuído</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(Array.isArray(payments) ? payments.reduce((sum, p) => sum + getDistributedAmount(p), 0) : 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pagamentos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Array.isArray(payments) ? payments.length : 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Pagamentos */}
      <div className="space-y-4">
        {payments.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <CreditCard className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhum pagamento encontrado</h3>
              <p className="text-muted-foreground mb-4">
                Comece adicionando seu primeiro pagamento
              </p>
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Pagamento
              </Button>
            </CardContent>
          </Card>
        ) : (
          Array.isArray(payments) && payments.map((payment) => {
            const distributedAmount = getDistributedAmount(payment)
            const remainingAmount = getRemainingAmount(payment)
            const isFullyDistributed = remainingAmount === 0

            return (
              <Card key={payment.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {payment.client.company || payment.client.name}
                        <Badge className={getStatusColor(payment.status)}>
                          {payment.status}
                        </Badge>
                      </CardTitle>
                      <CardDescription>
                        {payment.description && `${payment.description} • `}
                        {formatDate(payment.paymentDate)} • {getMethodLabel(payment.method)}
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">
                        {formatCurrency(payment.amount)}
                      </div>
                      {distributedAmount > 0 && (
                        <div className="text-sm text-muted-foreground">
                          Distribuído: {formatCurrency(distributedAmount)}
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      {payment.paymentProjects.length > 0 ? (
                        <div className="space-y-2">
                          <div className="text-sm font-medium">Projetos:</div>
                          {payment.paymentProjects.map((pp) => (
                            <div key={pp.id} className="flex justify-between text-sm">
                              <span>{pp.project.name}</span>
                              <span className="font-medium">
                                {formatCurrency(pp.amount)}
                              </span>
                            </div>
                          ))}
                          {remainingAmount > 0 && (
                            <div className="flex justify-between text-sm text-orange-600">
                              <span>Restante</span>
                              <span className="font-medium">
                                {formatCurrency(remainingAmount)}
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">
                          Pagamento não distribuído
                        </div>
                      )}
                    </div>
                    <div className="ml-4">
                      {!isFullyDistributed && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDistributePayment(payment)}
                        >
                          {distributedAmount > 0 ? 'Redistribuir' : 'Distribuir'}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {/* Diálogos */}
      <AddPaymentDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onPaymentAdded={handlePaymentAdded}
      />

      {selectedPayment && (
        <DistributePaymentDialog
          open={showDistributeDialog}
          onOpenChange={setShowDistributeDialog}
          payment={selectedPayment}
          onDistributionComplete={handleDistributionComplete}
        />
      )}
    </div>
  )
}