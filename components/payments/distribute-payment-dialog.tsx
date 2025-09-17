"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import toast from "react-hot-toast"

interface Project {
  id: string
  name: string
  client: {
    name: string
  }
}

interface DistributePaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  payment: {
    id: string
    amount: number
    description?: string
    client: {
      name: string
    }
  }
  onDistributionComplete: () => void
}

interface ProjectDistribution {
  projectId: string
  amount: number
  percentage: number
}

export function DistributePaymentDialog({
  open,
  onOpenChange,
  payment,
  onDistributionComplete
}: DistributePaymentDialogProps) {
  const [projects, setProjects] = useState<Project[]>([])
  const [distributions, setDistributions] = useState<ProjectDistribution[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open && payment) {
      fetchProjects()
    }
  }, [open, payment])

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects')
      if (response.ok) {
        const data = await response.json()
        setProjects(data.projects || [])
      }
    } catch (error) {
      console.error('Erro ao buscar projetos:', error)
      toast.error('Erro ao carregar projetos')
    }
  }

  const addDistribution = () => {
    setDistributions([
      ...distributions,
      { projectId: '', amount: 0, percentage: 0 }
    ])
  }

  const updateDistribution = (index: number, field: keyof ProjectDistribution, value: string | number) => {
    const newDistributions = [...distributions]
    newDistributions[index] = { ...newDistributions[index], [field]: value }
    
    if (field === 'amount' && payment) {
      const percentage = (Number(value) / payment.amount) * 100
      newDistributions[index].percentage = Math.round(percentage * 100) / 100
    } else if (field === 'percentage' && payment) {
      const amount = (Number(value) / 100) * payment.amount
      newDistributions[index].amount = Math.round(amount * 100) / 100
    }
    
    setDistributions(newDistributions)
  }

  const removeDistribution = (index: number) => {
    setDistributions(distributions.filter((_, i) => i !== index))
  }

  const getTotalAmount = () => {
    return distributions.reduce((sum, dist) => sum + dist.amount, 0)
  }

  const getTotalPercentage = () => {
    return distributions.reduce((sum, dist) => sum + dist.percentage, 0)
  }

  const handleSubmit = async () => {
    if (!payment) return

    const totalAmount = getTotalAmount()
    const totalPercentage = getTotalPercentage()

    if (Math.abs(totalAmount - payment.amount) > 0.01) {
      toast.error('A soma das distribuições deve ser igual ao valor total do pagamento')
      return
    }

    if (Math.abs(totalPercentage - 100) > 0.01) {
      toast.error('A soma das porcentagens deve ser igual a 100%')
      return
    }

    const invalidDistributions = distributions.filter(d => !d.projectId || d.amount <= 0)
    if (invalidDistributions.length > 0) {
      toast.error('Todas as distribuições devem ter um projeto selecionado e valor maior que zero')
      return
    }

    try {
      setLoading(true)
      const response = await fetch(`/api/payments/${payment.id}/distribute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          distributions: distributions.map(d => ({
            projectId: d.projectId,
            amount: d.amount
          }))
        }),
      })

      if (response.ok) {
        toast.success('Pagamento distribuído com sucesso!')
        onDistributionComplete()
        onOpenChange(false)
        setDistributions([])
      } else {
        const error = await response.json()
        toast.error(error.error || 'Erro ao distribuir pagamento')
      }
    } catch (error) {
      console.error('Erro ao distribuir pagamento:', error)
      toast.error('Erro ao distribuir pagamento')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Distribuir Pagamento</DialogTitle>
          <DialogDescription>
            Distribua o pagamento entre os projetos do cliente
          </DialogDescription>
        </DialogHeader>

        {payment && (
          <div className="space-y-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-medium mb-2">Detalhes do Pagamento</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Cliente:</span>
                  <span className="ml-2 font-medium">{payment.client.name}</span>
                </div>
                <div>
                  <span className="text-gray-600">Valor Total:</span>
                  <span className="ml-2 font-medium text-green-600">
                    {formatCurrency(payment.amount)}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-600">Descrição:</span>
                  <span className="ml-2">{payment.description}</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-medium">Distribuições</h3>
                <Button onClick={addDistribution} size="sm">
                  Adicionar Distribuição
                </Button>
              </div>

              {distributions.map((distribution, index) => (
                <div key={index} className="border p-4 rounded-lg space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Distribuição {index + 1}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeDistribution(index)}
                    >
                      Remover
                    </Button>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor={`project-${index}`}>Projeto</Label>
                      <Select
                        value={distribution.projectId}
                        onValueChange={(value) => updateDistribution(index, 'projectId', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um projeto" />
                        </SelectTrigger>
                        <SelectContent>
                          {projects.map((project) => (
                            <SelectItem key={project.id} value={project.id}>
                              {project.name} - {project.client.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor={`amount-${index}`}>Valor (R$)</Label>
                      <Input
                        id={`amount-${index}`}
                        type="number"
                        step="0.01"
                        min="0"
                        value={distribution.amount}
                        onChange={(e) => updateDistribution(index, 'amount', parseFloat(e.target.value) || 0)}
                        placeholder="0,00"
                      />
                    </div>

                    <div>
                      <Label htmlFor={`percentage-${index}`}>Porcentagem (%)</Label>
                      <Input
                        id={`percentage-${index}`}
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={distribution.percentage}
                        onChange={(e) => updateDistribution(index, 'percentage', parseFloat(e.target.value) || 0)}
                        placeholder="0,00"
                      />
                    </div>
                  </div>
                </div>
              ))}

              {distributions.length > 0 && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium">Resumo da Distribuição</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Total Distribuído:</span>
                      <span className={`ml-2 font-medium ${
                        Math.abs(getTotalAmount() - payment.amount) > 0.01 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {formatCurrency(getTotalAmount())}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Porcentagem Total:</span>
                      <span className={`ml-2 font-medium ${
                        Math.abs(getTotalPercentage() - 100) > 0.01 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {getTotalPercentage().toFixed(2)}%
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Valor Restante:</span>
                      <span className="ml-2 font-medium">
                        {formatCurrency(payment.amount - getTotalAmount())}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleSubmit} 
                disabled={loading || distributions.length === 0}
              >
                {loading ? 'Distribuindo...' : 'Distribuir Pagamento'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}