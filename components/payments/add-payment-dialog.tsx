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
}

export function AddPaymentDialog({
  open,
  onOpenChange,
  onPaymentAdded,
}: AddPaymentDialogProps) {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    clientId: '',
    amount: '',
    description: '',
    paymentDate: new Date().toISOString().split('T')[0],
    method: 'BANK_TRANSFER'
  })

  useEffect(() => {
    if (open) {
      fetchClients()
    }
  }, [open])

  const fetchClients = async () => {
    try {
      const response = await fetch('/api/clients')
      if (response.ok) {
        const data = await response.json()
        setClients(data)
      }
    } catch (error) {
      console.error('Erro ao carregar clientes:', error)
      toast.error('Erro ao carregar clientes')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.clientId || !formData.amount || !formData.paymentDate) {
      toast.error('Preencha todos os campos obrigatórios')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        toast.success('Pagamento adicionado com sucesso!')
        onPaymentAdded()
        setFormData({
          clientId: '',
          amount: '',
          description: '',
          paymentDate: new Date().toISOString().split('T')[0],
          method: 'BANK_TRANSFER'
        })
      } else {
        const error = await response.json()
        toast.error(error.error || 'Erro ao adicionar pagamento')
      }
    } catch (error) {
      console.error('Erro ao adicionar pagamento:', error)
      toast.error('Erro ao adicionar pagamento')
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
          <DialogTitle>Adicionar Pagamento</DialogTitle>
          <DialogDescription>
            Registre um novo pagamento recebido de um cliente.
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
              type="number"
              step="0.01"
              min="0"
              placeholder="0,00"
              value={formData.amount}
              onChange={(e) => handleInputChange('amount', e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="paymentDate">Data do Pagamento *</Label>
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
              placeholder="Descrição opcional do pagamento"
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
              {loading ? 'Salvando...' : 'Salvar Pagamento'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}