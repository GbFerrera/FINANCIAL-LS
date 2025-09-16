"use client"

import { useState, useEffect } from "react"
import { DollarSign, Calendar, Tag, FileText, Repeat, Upload, X } from "lucide-react"
import toast from "react-hot-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface Project {
  id: string
  name: string
}

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
  attachments?: Array<{
    id: string
    filename: string
    originalName: string
    size: number
    url: string
  }>
  createdAt: string
}

interface AddEntryModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  editingEntry?: FinancialEntry
}

// Categorias serão carregadas dinamicamente do banco de dados

const RECURRING_TYPES = [
  { value: 'MONTHLY', label: 'Mensal' },
  { value: 'QUARTERLY', label: 'Trimestral' },
  { value: 'YEARLY', label: 'Anual' }
]

export function AddEntryModal({ isOpen, onClose, onSuccess, editingEntry }: AddEntryModalProps) {
  const [loading, setLoading] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [categories, setCategories] = useState<{INCOME: string[], EXPENSE: string[]}>({INCOME: [], EXPENSE: []})
  const [formData, setFormData] = useState({
    type: 'INCOME' as 'INCOME' | 'EXPENSE',
    category: '',
    description: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    isRecurring: false,
    recurringType: '',
    projectId: ''
  })
  const [attachments, setAttachments] = useState<File[]>([])
  const [existingAttachments, setExistingAttachments] = useState<Array<{
    id: string
    filename: string
    originalName: string
    size: number
    url: string
  }>>([])

  useEffect(() => {
    if (isOpen) {
      fetchProjects()
      fetchCategories()
      
      // Reset formulário para nova entrada ou preencher se editando
      if (editingEntry) {
        setFormData({
          type: editingEntry.type,
          category: editingEntry.category,
          description: editingEntry.description,
          amount: editingEntry.amount.toString(),
          date: editingEntry.date.split('T')[0],
          isRecurring: editingEntry.isRecurring,
          recurringType: editingEntry.recurringType || '',
          projectId: ''
        })
        setExistingAttachments(editingEntry.attachments || [])
      } else {
        // Reset formulário para nova entrada
        setFormData({
          type: 'INCOME',
          category: '',
          description: '',
          amount: '',
          date: new Date().toISOString().split('T')[0],
          isRecurring: false,
          recurringType: '',
          projectId: ''
        })
        setExistingAttachments([])
      }
      setAttachments([])
    }
  }, [isOpen, editingEntry])

  // Separar useEffect para atualizar projectId quando projects carregarem
  useEffect(() => {
    if (editingEntry && projects.length > 0) {
      const project = projects.find(p => p.name === editingEntry.projectName)
      if (project) {
        setFormData(prev => ({ ...prev, projectId: project.id }))
      }
    }
  }, [editingEntry, projects])

  useEffect(() => {
    // Reset category when type changes
    setFormData(prev => ({ ...prev, category: '' }))
  }, [formData.type])

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects')
      if (response.ok) {
        const data = await response.json()
        setProjects(data.projects || [])
      }
    } catch (error) {
      console.error('Erro ao buscar projetos:', error)
    }
  }

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/financial/categories')
      if (response.ok) {
        const data = await response.json()
        setCategories(data.categories)
      } else {
        // Fallback para categorias padrão se a API não existir ainda
        setCategories({
          INCOME: [
            'Pagamento de Cliente',
            'Consultoria', 
            'Desenvolvimento',
            'Manutenção',
            'Licenciamento',
            'Outros'
          ],
          EXPENSE: [
            'Salários',
            'Infraestrutura',
            'Software/Licenças',
            'Marketing',
            'Escritório',
            'Viagem',
            'Impostos',
            'Outros'
          ]
        })
      }
    } catch (error) {
      console.error('Erro ao buscar categorias:', error)
      // Fallback para categorias padrão
      setCategories({
        INCOME: [
          'Pagamento de Cliente',
          'Consultoria',
          'Desenvolvimento', 
          'Manutenção',
          'Licenciamento',
          'Outros'
        ],
        EXPENSE: [
          'Salários',
          'Infraestrutura',
          'Software/Licenças',
          'Marketing',
          'Escritório',
          'Viagem',
          'Impostos',
          'Outros'
        ]
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.type || !formData.category || !formData.description || !formData.amount || !formData.date) {
      toast.error('Preencha todos os campos obrigatórios')
      return
    }

    const amount = parseFloat(formData.amount)
    if (isNaN(amount) || amount <= 0) {
      toast.error('Valor deve ser um número positivo')
      return
    }

    setLoading(true)
    
    try {
      // Converter data para formato ISO datetime
      const dateTime = new Date(formData.date + 'T00:00:00.000Z').toISOString()
      
      const url = editingEntry ? `/api/financial/${editingEntry.id}` : '/api/financial'
      const method = editingEntry ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: formData.type,
          category: formData.category,
          description: formData.description,
          amount: amount,
          date: dateTime,
          isRecurring: formData.isRecurring,
          recurringType: formData.isRecurring && formData.recurringType ? formData.recurringType : null,
          projectId: formData.projectId || null
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || `Erro ao ${editingEntry ? 'atualizar' : 'criar'} entrada`)
      }

      toast.success(`Entrada financeira ${editingEntry ? 'atualizada' : 'criada'} com sucesso!`)
      onSuccess()
      handleClose()
    } catch (error) {
      console.error('Erro ao criar entrada:', error)
      toast.error(error instanceof Error ? error.message : 'Erro ao criar entrada')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setFormData({
      type: 'INCOME',
      category: '',
      description: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      isRecurring: false,
      recurringType: '',
      projectId: ''
    })
    setAttachments([])
    setExistingAttachments([])
    onClose()
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const validFiles = files.filter(file => {
      const maxSize = 10 * 1024 * 1024 // 10MB
      if (file.size > maxSize) {
        toast.error(`Arquivo ${file.name} é muito grande. Máximo 10MB.`)
        return false
      }
      return true
    })
    setAttachments(prev => [...prev, ...validFiles])
  }

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }

  const removeExistingAttachment = (attachmentId: string) => {
    setExistingAttachments(prev => prev.filter(att => att.id !== attachmentId))
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatCurrencyInput = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value)
  }

  const availableCategories = categories[formData.type]

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editingEntry ? 'Editar Entrada Financeira' : 'Nova Entrada Financeira'}</DialogTitle>
          <DialogDescription>
            {editingEntry ? 'Edite os dados da entrada financeira.' : 'Adicione uma nova entrada financeira ao sistema.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type */}
          <div>
            <Label className="text-sm font-medium">
              Tipo *
            </Label>
            <div className="grid grid-cols-2 gap-3 mt-1">
              <Button
                type="button"
                variant={formData.type === 'INCOME' ? 'default' : 'outline'}
                onClick={() => setFormData(prev => ({ ...prev, type: 'INCOME' }))}
                className={`p-3 h-auto flex-col ${
                  formData.type === 'INCOME'
                    ? 'border-green-500 bg-green-50 text-green-700 hover:bg-green-100'
                    : ''
                }`}
              >
                <DollarSign className="h-4 w-4 mb-1" />
                Receita
              </Button>
              <Button
                type="button"
                variant={formData.type === 'EXPENSE' ? 'default' : 'outline'}
                onClick={() => setFormData(prev => ({ ...prev, type: 'EXPENSE' }))}
                className={`p-3 h-auto flex-col ${
                  formData.type === 'EXPENSE'
                    ? 'border-red-500 bg-red-50 text-red-700 hover:bg-red-100'
                    : ''
                }`}
              >
                <DollarSign className="h-4 w-4 mb-1" />
                Despesa
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Category */}
            <div>
              <Label className="text-sm font-medium">
                Categoria *
              </Label>
              <div className="relative mt-1">
                <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 z-10" />
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                >
                  <SelectTrigger className="pl-10">
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCategories.map(category => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Amount */}
            <div>
              <Label className="text-sm font-medium">
                Valor *
              </Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-sm text-gray-500 z-10">R$</span>
                <Input
                  type="text"
                  value={formData.amount ? formatCurrencyInput(parseFloat(formData.amount)) : ''}
                  onChange={(e) => {
                    // Remove tudo exceto números
                    const value = e.target.value.replace(/[^\d]/g, '')
                    if (value === '') {
                      setFormData(prev => ({ ...prev, amount: '' }))
                      return
                    }
                    // Converte centavos para reais
                    const numericValue = (parseFloat(value) / 100).toString()
                    setFormData(prev => ({ ...prev, amount: numericValue }))
                  }}
                  className="pl-10"
                  placeholder="0,00"
                  required
                />
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <Label className="text-sm font-medium">
              Descrição *
            </Label>
            <div className="relative mt-1">
              <FileText className="absolute left-3 top-3 h-4 w-4 text-gray-400 z-10" />
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                className="pl-10"
                placeholder="Descreva a entrada financeira..."
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Date */}
            <div>
              <Label className="text-sm font-medium">
                Data *
              </Label>
              <div className="relative mt-1">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 z-10" />
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            {/* Project */}
            <div>
              <Label className="text-sm font-medium">
                Projeto (opcional)
              </Label>
              <div className="mt-1">
                <Select
                  value={formData.projectId || undefined}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, projectId: value || '' }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhum projeto" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map(project => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Recurring */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isRecurring"
                checked={formData.isRecurring}
                onCheckedChange={(checked) => setFormData(prev => ({ 
                  ...prev, 
                  isRecurring: checked as boolean,
                  recurringType: checked ? prev.recurringType : ''
                }))}
              />
              <Label htmlFor="isRecurring" className="text-sm font-medium flex items-center">
                <Repeat className="h-4 w-4 mr-1" />
                Entrada recorrente
              </Label>
            </div>

            {formData.isRecurring && (
              <div>
                <Label className="text-sm font-medium">
                  Frequência
                </Label>
                <div className="mt-1">
                  <Select
                    value={formData.recurringType}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, recurringType: value }))}
                    required={formData.isRecurring}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a frequência" />
                    </SelectTrigger>
                    <SelectContent>
                      {RECURRING_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          {/* Attachments */}
          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center">
              <Upload className="h-4 w-4 mr-1" />
              Anexos
            </Label>
            
            {/* File Upload */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-gray-400 transition-colors">
              <input
                type="file"
                multiple
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-600">Clique para adicionar arquivos</p>
                <p className="text-xs text-gray-400 mt-1">PDF, DOC, XLS, Imagens (máx. 10MB cada)</p>
              </label>
            </div>

            {/* Existing Attachments */}
            {existingAttachments.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Anexos existentes:</p>
                {existingAttachments.map((attachment) => (
                  <div key={attachment.id} className="flex items-center justify-between p-2 bg-gray-50 rounded border">
                    <div className="flex items-center space-x-2">
                      <FileText className="h-4 w-4 text-gray-500" />
                      <span className="text-sm">{attachment.originalName}</span>
                      <span className="text-xs text-gray-500">({formatFileSize(attachment.size)})</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeExistingAttachment(attachment.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* New Attachments */}
            {attachments.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Novos anexos:</p>
                {attachments.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-blue-50 rounded border border-blue-200">
                    <div className="flex items-center space-x-2">
                      <FileText className="h-4 w-4 text-blue-500" />
                      <span className="text-sm">{file.name}</span>
                      <span className="text-xs text-gray-500">({formatFileSize(file.size)})</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAttachment(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
            >
              {loading 
                ? (editingEntry ? 'Salvando...' : 'Criando...') 
                : (editingEntry ? 'Salvar Alterações' : 'Criar Entrada')
              }
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}