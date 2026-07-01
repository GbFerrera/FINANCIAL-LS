'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import toast from "react-hot-toast"

interface Client {
  id: string
  name: string
  email: string
  company?: string
}

interface AddPaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPaymentAdded: () => void
  mode?: 'PAYMENT' | 'CHARGE'
  defaultDate?: string
  paymentToEdit?: {
    id: string
    clientId: string
    amount: number
    description?: string | null
    paymentDate: string
    method?: string | null
  }
}

export function AddPaymentDialog({
  open,
  onOpenChange,
  onPaymentAdded,
  mode = 'PAYMENT',
  defaultDate,
  paymentToEdit,
}: AddPaymentDialogProps) {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    clientId: '',
    amount: '',
    description: '',
    paymentDate: defaultDate || new Date().toISOString().split('T')[0],
    method: 'BANK_TRANSFER'
  })

  const formatCurrencyBRFromDigits = (digits: string) => {
    const cleaned = (digits || '').replace(/\D/g, '')
    const padded = cleaned.replace(/^0+/, '') || '0'
    const cents = parseInt(padded, 10)
    const value = cents / 100
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
  }

  const parseCurrencyBRToNumber = (value: string) => {
    const digits = (value || '').replace(/\D/g, '')
    if (!digits) return null
    const cents = parseInt(digits, 10)
    if (!Number.isFinite(cents)) return null
    return cents / 100
  }

  const dateOnly = (value: string) => {
    const s = String(value || '')
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
    const d = new Date(s)
    if (!Number.isFinite(d.getTime())) return defaultDate || new Date().toISOString().split('T')[0]
    return d.toISOString().split('T')[0]
  }

  const formatCurrencyBRFromNumber = (value: number) => {
    const cents = Math.round((Number(value) || 0) * 100)
    return formatCurrencyBRFromDigits(String(cents))
  }

  useEffect(() => {
    if (open) {
      fetchClients()
      if (paymentToEdit) {
        setFormData({
          clientId: paymentToEdit.clientId || '',
          amount: formatCurrencyBRFromNumber(paymentToEdit.amount),
          description: paymentToEdit.description || '',
          paymentDate: dateOnly(paymentToEdit.paymentDate),
          method: paymentToEdit.method || 'BANK_TRANSFER'
        })
      } else {
        setFormData({
          clientId: '',
          amount: '',
          description: '',
          paymentDate: defaultDate || new Date().toISOString().split('T')[0],
          method: 'BANK_TRANSFER'
        })
      }
    }
  }, [open, defaultDate, paymentToEdit])

  const fetchClients = async () => {
    try {
      const response = await fetch('/api/clients')
      if (response.ok) {
        const data = await response.json()
        if (Array.isArray(data)) {
          setClients(data)
        } else if (data && Array.isArray((data as any).clients)) {
          setClients((data as any).clients)
        } else {
          setClients([])
        }
      } else {
        setClients([])
      }
    } catch (error) {
      console.error('Erro ao carregar clientes:', error)
      toast.error('Erro ao carregar clientes')
      setClients([])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const amountNumber = parseCurrencyBRToNumber(formData.amount)
    if (!formData.clientId || !amountNumber || !formData.paymentDate) {
      toast.error('Preencha todos os campos obrigatórios')
      return
    }

    setLoading(true)

    try {
      const payloadDate = formData.paymentDate + 'T12:00:00.000Z'

      const response = paymentToEdit
        ? await fetch('/api/payments', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              paymentId: paymentToEdit.id,
              update: {
                clientId: formData.clientId,
                amount: String(amountNumber.toFixed(2)),
                description: formData.description.trim() || null,
                paymentDate: payloadDate,
                method: formData.method
              }
            })
          })
        : await fetch('/api/payments', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              ...formData,
              amount: String(amountNumber.toFixed(2)),
              paymentDate: payloadDate,
              status: mode === 'CHARGE' ? 'PENDING' : 'COMPLETED'
            }),
          })

      if (response.ok) {
        toast.success(
          paymentToEdit
            ? mode === 'CHARGE'
              ? 'Cobrança atualizada com sucesso!'
              : 'Pagamento atualizado com sucesso!'
            : mode === 'CHARGE'
              ? 'Cobrança criada com sucesso!'
              : 'Pagamento adicionado com sucesso!'
        )
        onPaymentAdded()
        onOpenChange(false)
      } else {
        const error = await response.json()
        toast.error(
          error.error ||
            (paymentToEdit
              ? mode === 'CHARGE'
                ? 'Erro ao atualizar cobrança'
                : 'Erro ao atualizar pagamento'
              : mode === 'CHARGE'
                ? 'Erro ao criar cobrança'
                : 'Erro ao adicionar pagamento')
        )
      }
    } catch (error) {
      console.error('Erro ao adicionar pagamento:', error)
      toast.error(
        paymentToEdit
          ? mode === 'CHARGE'
            ? 'Erro ao atualizar cobrança'
            : 'Erro ao atualizar pagamento'
          : mode === 'CHARGE'
            ? 'Erro ao criar cobrança'
            : 'Erro ao adicionar pagamento'
      )
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const paymentMethods = [
    { value: 'CASH', label: 'Dinheiro' },
    { value: 'BANK_TRANSFER', label: 'Transferência Bancária' },
    { value: 'CREDIT_CARD', label: 'Cartão de Crédito' },
    { value: 'DEBIT_CARD', label: 'Cartão de Débito' },
    { value: 'PIX', label: 'PIX' },
    { value: 'CHECK', label: 'Cheque' },
    { value: 'OTHER', label: 'Outro' }
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {paymentToEdit
              ? mode === 'CHARGE'
                ? 'Editar cobrança avulsa'
                : 'Editar Pagamento'
              : mode === 'CHARGE'
                ? 'Criar cobrança avulsa'
                : 'Adicionar Pagamento'}
          </DialogTitle>
          <DialogDescription>
            {paymentToEdit
              ? mode === 'CHARGE'
                ? 'Atualize os dados da cobrança.'
                : 'Atualize os dados do pagamento.'
              : mode === 'CHARGE'
                ? 'Crie uma cobrança para receber em um dia específico.'
                : 'Registre um novo pagamento recebido de um cliente.'}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="client">Cliente *</Label>
            <Select
              value={formData.clientId}
              onValueChange={(value) => handleInputChange('clientId', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um cliente" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.company || client.name} ({client.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Valor *</Label>
            <Input
              id="amount"
              type="text"
              inputMode="numeric"
              placeholder="R$ 0,00"
              value={formData.amount}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '')
                handleInputChange('amount', formatCurrencyBRFromDigits(digits))
              }}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="paymentDate">{mode === 'CHARGE' ? 'Data de vencimento *' : 'Data do Pagamento *'}</Label>
            <Input
              id="paymentDate"
              type="date"
              value={formData.paymentDate}
              onChange={(e) => handleInputChange('paymentDate', e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="method">Método de Pagamento</Label>
            <Select
              value={formData.method}
              onValueChange={(value) => handleInputChange('method', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {paymentMethods.map((method) => (
                  <SelectItem key={method.value} value={method.value}>
                    {method.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              placeholder={mode === 'CHARGE' ? 'Descrição opcional da cobrança (ex: Pagamento do projeto X)' : 'Descrição opcional do pagamento'}
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading
                ? 'Salvando...'
                : paymentToEdit
                  ? mode === 'CHARGE'
                    ? 'Salvar cobrança'
                    : 'Salvar alterações'
                  : mode === 'CHARGE'
                    ? 'Criar cobrança'
                    : 'Salvar Pagamento'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
