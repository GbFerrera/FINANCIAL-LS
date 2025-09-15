'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { StatsCard } from '@/components/ui/stats-card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { toast } from 'react-hot-toast'
import {
  BarChart3,
  Download,
  FileText,
  Calendar,
  Filter,
  Search,
  Eye,
  Trash2,
  Plus,
  TrendingUp,
  DollarSign,
  Users,
  FolderOpen,
  Clock,
  CheckCircle
} from 'lucide-react'

interface Report {
  id: string
  name: string
  type: 'financial' | 'projects' | 'team' | 'clients'
  format: 'pdf' | 'excel' | 'csv'
  status: 'generating' | 'ready' | 'failed'
  createdAt: string
  downloadUrl?: string
  size?: string
  description: string
}

interface ReportTemplate {
  id: string
  name: string
  type: 'financial' | 'projects' | 'team' | 'clients'
  description: string
  fields: string[]
}

interface NewReport {
  name: string
  type: 'financial' | 'projects' | 'team' | 'clients'
  format: 'pdf' | 'excel' | 'csv'
  dateRange: {
    start: string
    end: string
  }
  filters: {
    status?: string
    department?: string
    client?: string
  }
}

export default function ReportsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [reports, setReports] = useState<Report[]>([])
  const [templates, setTemplates] = useState<ReportTemplate[]>([])
  const [isGenerateReportOpen, setIsGenerateReportOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedType, setSelectedType] = useState<string>('all')
  const [newReport, setNewReport] = useState<NewReport>({
    name: '',
    type: 'financial',
    format: 'pdf',
    dateRange: {
      start: '',
      end: ''
    },
    filters: {}
  })

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/auth/signin')
      return
    }
    fetchData()
  }, [session, status, router])

  const fetchData = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/reports')
      
      if (!response.ok) {
        throw new Error('Falha ao carregar relatórios')
      }
      
      const data = await response.json()
      setReports(data.reports)
      setTemplates(data.templates)
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
      toast.error('Erro ao carregar relatórios')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateReport = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const reportId = Date.now().toString()
      const newReportData: Report = {
        id: reportId,
        name: newReport.name,
        type: newReport.type,
        format: newReport.format,
        status: 'generating',
        createdAt: new Date().toISOString(),
        description: `Relatório ${newReport.type} gerado automaticamente`
      }

      setReports(prev => [newReportData, ...prev])
      setIsGenerateReportOpen(false)
      
      toast.success('Relatório sendo gerado!')

      // Chamar API para gerar relatório
      const response = await fetch('/api/reports/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: newReport.type,
          format: newReport.format,
          dateRange: newReport.dateRange,
          filters: newReport.filters
        })
      })

      if (response.ok) {
        const result = await response.json()
        setReports(prev => prev.map(report => 
          report.id === reportId 
            ? { 
                ...report, 
                status: 'ready' as const, 
                downloadUrl: result.report.downloadUrl,
                size: `${Math.round(result.report.size / 1024)} KB`
              }
            : report
        ))
        toast.success('Relatório gerado com sucesso!')
      } else {
        setReports(prev => prev.map(report => 
          report.id === reportId 
            ? { ...report, status: 'failed' as const }
            : report
        ))
        toast.error('Erro ao gerar relatório')
      }

      setNewReport({
        name: '',
        type: 'financial',
        format: 'pdf',
        dateRange: { start: '', end: '' },
        filters: {}
      })
    } catch (error) {
      console.error('Erro ao gerar relatório:', error)
      toast.error('Erro ao gerar relatório')
    }
  }

  const handleDownloadReport = (report: Report) => {
    if (report.status === 'ready' && report.downloadUrl) {
      // Iniciar download real
      const link = document.createElement('a')
      link.href = report.downloadUrl
      link.download = `${report.name}.${report.format}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      toast.success(`Download do relatório "${report.name}" iniciado`)
    } else {
      toast.error('Relatório não está pronto para download')
    }
  }

  const handleDeleteReport = (reportId: string) => {
    setReports(prev => prev.filter(report => report.id !== reportId))
    toast.success('Relatório excluído com sucesso')
  }

  const filteredReports = reports.filter(report => {
    const matchesSearch = report.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesType = selectedType === 'all' || report.type === selectedType
    return matchesSearch && matchesType
  })

  const getStatusColor = (status: Report['status']) => {
    switch (status) {
      case 'ready': return 'bg-green-100 text-green-800'
      case 'generating': return 'bg-yellow-100 text-yellow-800'
      case 'failed': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getTypeIcon = (type: Report['type']) => {
    switch (type) {
      case 'financial': return DollarSign
      case 'projects': return FolderOpen
      case 'team': return Users
      case 'clients': return Users
      default: return FileText
    }
  }

  const stats = [
    {
      title: 'Total de Relatórios',
      value: reports.length,
      icon: FileText,
      color: 'blue' as const,
      change: {
        value: `${reports.filter(r => r.status === 'ready').length} prontos`,
        type: 'neutral' as const
      }
    },
    {
      title: 'Relatórios Prontos',
      value: reports.filter(r => r.status === 'ready').length,
      icon: CheckCircle,
      color: 'green' as const,
      change: {
        value: 'Para download',
        type: 'neutral' as const
      }
    },
    {
      title: 'Em Geração',
      value: reports.filter(r => r.status === 'generating').length,
      icon: Clock,
      color: 'yellow' as const,
      change: {
        value: 'Processando',
        type: 'neutral' as const
      }
    },
    {
      title: 'Templates Disponíveis',
      value: templates.length,
      icon: BarChart3,
      color: 'purple' as const,
      change: {
        value: 'Modelos',
        type: 'neutral' as const
      }
    }
  ]

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Carregando relatórios...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Relatórios</h1>
            <p className="text-gray-600">
              Gere e gerencie relatórios do sistema
            </p>
          </div>
          <Dialog open={isGenerateReportOpen} onOpenChange={setIsGenerateReportOpen}>
            <DialogTrigger asChild>
              <button className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-2" />
                Gerar Relatório
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Gerar Novo Relatório</DialogTitle>
                <DialogDescription>
                  Configure os parâmetros para gerar um novo relatório
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleGenerateReport} className="space-y-4">
                <div className="grid gap-4 py-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Relatório</label>
                    <input
                      type="text"
                      value={newReport.name}
                      onChange={(e) => setNewReport({...newReport, name: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Ex: Relatório Financeiro - Janeiro 2024"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                      <select
                        value={newReport.type}
                        onChange={(e) => setNewReport({...newReport, type: e.target.value as NewReport['type']})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="financial">Financeiro</option>
                        <option value="projects">Projetos</option>
                        <option value="team">Equipe</option>
                        <option value="clients">Clientes</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Formato</label>
                      <select
                        value={newReport.format}
                        onChange={(e) => setNewReport({...newReport, format: e.target.value as NewReport['format']})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="pdf">PDF</option>
                        <option value="excel">Excel</option>
                        <option value="csv">CSV</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Data Início</label>
                      <input
                        type="date"
                        value={newReport.dateRange.start}
                        onChange={(e) => setNewReport({...newReport, dateRange: {...newReport.dateRange, start: e.target.value}})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Data Fim</label>
                      <input
                        type="date"
                        value={newReport.dateRange.end}
                        onChange={(e) => setNewReport({...newReport, dateRange: {...newReport.dateRange, end: e.target.value}})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <button
                    type="button"
                    onClick={() => setIsGenerateReportOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
                  >
                    Gerar Relatório
                  </button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, index) => (
            <StatsCard key={index} {...stat} />
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Buscar relatórios..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Todos os Tipos</option>
            <option value="financial">Financeiro</option>
            <option value="projects">Projetos</option>
            <option value="team">Equipe</option>
            <option value="clients">Clientes</option>
          </select>
        </div>

        {/* Reports List */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {filteredReports.length === 0 ? (
              <li className="px-6 py-8 text-center text-gray-500">
                <FileText className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhum relatório encontrado</h3>
                <p className="mt-1 text-sm text-gray-500">Comece gerando seu primeiro relatório.</p>
              </li>
            ) : (
              filteredReports.map((report) => {
                const IconComponent = getTypeIcon(report.type)
                return (
                  <li key={report.id}>
                    <div className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                            <IconComponent className="h-5 w-5 text-blue-600" />
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="flex items-center">
                            <p className="text-sm font-medium text-gray-900">{report.name}</p>
                            <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(report.status)}`}>
                              {report.status === 'ready' && 'Pronto'}
                              {report.status === 'generating' && 'Gerando'}
                              {report.status === 'failed' && 'Falhou'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500">{report.description}</p>
                          <div className="flex items-center mt-1 text-xs text-gray-400">
                            <Calendar className="h-3 w-3 mr-1" />
                            {new Date(report.createdAt).toLocaleDateString('pt-BR')}
                            {report.size && (
                              <>
                                <span className="mx-2">•</span>
                                <span>{report.size}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {report.status === 'ready' && (
                          <button
                            onClick={() => handleDownloadReport(report)}
                            className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200"
                          >
                            <Download className="h-3 w-3 mr-1" />
                            Download
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteReport(report.id)}
                          className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-red-700 bg-red-100 hover:bg-red-200"
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Excluir
                        </button>
                      </div>
                    </div>
                  </li>
                )
              })
            )}
          </ul>
        </div>

        {/* Templates Section */}
        <div className="bg-white shadow sm:rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Templates de Relatórios</h3>
            <p className="mt-1 text-sm text-gray-500">
              Modelos pré-configurados para geração rápida de relatórios
            </p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {templates.map((template) => {
                const IconComponent = getTypeIcon(template.type)
                return (
                  <div key={template.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center mb-3">
                      <div className="h-8 w-8 rounded bg-blue-100 flex items-center justify-center">
                        <IconComponent className="h-4 w-4 text-blue-600" />
                      </div>
                      <h4 className="ml-3 text-sm font-medium text-gray-900">{template.name}</h4>
                    </div>
                    <p className="text-xs text-gray-500 mb-3">{template.description}</p>
                    <div className="flex flex-wrap gap-1 mb-3">
                      {template.fields.slice(0, 3).map((field) => (
                        <span key={field} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                          {field}
                        </span>
                      ))}
                      {template.fields.length > 3 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                          +{template.fields.length - 3}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setNewReport(prev => ({ ...prev, type: template.type, name: template.name }))
                        setIsGenerateReportOpen(true)
                      }}
                      className="w-full text-xs font-medium text-blue-600 hover:text-blue-500"
                    >
                      Usar Template
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}