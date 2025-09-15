'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Settings,
  Plus,
  Download,
  FileText,
  Database,
  Users,
  DollarSign,
  Clock,
  Webhook,
  Key,
  Globe,
  CheckCircle,
  XCircle,
  Calendar,
  Filter
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'

interface Integration {
  id: string
  name: string
  description: string
  type: 'webhook' | 'oauth' | 'api_key'
  enabled: boolean
  config: any
}

interface Report {
  id: string
  type: string
  format: string
  filename: string
  downloadUrl: string
  generatedAt: string
  expiresAt: string
}

export default function IntegrationsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('integrations')
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddIntegration, setShowAddIntegration] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportConfig, setExportConfig] = useState({
    type: 'projects',
    format: 'json',
    dateRange: {
      start: '',
      end: ''
    },
    filters: {}
  })

  useEffect(() => {
    if (status === 'loading') return
    if (!session || session.user.role !== 'ADMIN') {
      router.push('/dashboard')
      return
    }
    fetchData()
  }, [session, status, router])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [integrationsRes] = await Promise.all([
        fetch('/api/integrations')
      ])
      
      if (integrationsRes.ok) {
        const integrationsData = await integrationsRes.json()
        setIntegrations(integrationsData.integrations)
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleExportReport = async () => {
    try {
      const response = await fetch('/api/reports/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(exportConfig)
      })

      if (response.ok) {
        const data = await response.json()
        setReports(prev => [data.report, ...prev])
        setShowExportModal(false)
        
        // Se for JSON, mostrar dados diretamente
        if (exportConfig.format === 'json' && data.report.data) {
          console.log('Dados do relatório:', data.report.data)
        }
        
        alert('Relatório gerado com sucesso!')
      } else {
        alert('Erro ao gerar relatório')
      }
    } catch (error) {
      console.error('Erro ao exportar relatório:', error)
      alert('Erro ao gerar relatório')
    }
  }

  const toggleIntegration = async (id: string, enabled: boolean) => {
    try {
      // Simular toggle da integração
      setIntegrations(prev => 
        prev.map(integration => 
          integration.id === id 
            ? { ...integration, enabled }
            : integration
        )
      )
    } catch (error) {
      console.error('Erro ao alterar integração:', error)
    }
  }

  const getIntegrationIcon = (type: string) => {
    switch (type) {
      case 'webhook': return <Webhook className="h-5 w-5" />
      case 'oauth': return <Globe className="h-5 w-5" />
      case 'api_key': return <Key className="h-5 w-5" />
      default: return <Settings className="h-5 w-5" />
    }
  }

  const getReportIcon = (type: string) => {
    switch (type) {
      case 'projects': return <FileText className="h-5 w-5" />
      case 'tasks': return <CheckCircle className="h-5 w-5" />
      case 'clients': return <Users className="h-5 w-5" />
      case 'financial': return <DollarSign className="h-5 w-5" />
      case 'time_tracking': return <Clock className="h-5 w-5" />
      default: return <Database className="h-5 w-5" />
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Integrações & Relatórios</h1>
            <p className="text-gray-600">Gerencie integrações externas e exporte relatórios</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('integrations')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'integrations'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Settings className="h-4 w-4 inline mr-2" />
              Integrações
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'reports'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <FileText className="h-4 w-4 inline mr-2" />
              Relatórios
            </button>
          </nav>
        </div>

        {/* Integrações Tab */}
        {activeTab === 'integrations' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-medium text-gray-900">Integrações Disponíveis</h2>
              <button
                onClick={() => setShowAddIntegration(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Nova Integração
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {integrations.map((integration) => (
                <div key={integration.id} className="bg-white rounded-lg border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      {getIntegrationIcon(integration.type)}
                      <h3 className="ml-2 text-lg font-medium text-gray-900">{integration.name}</h3>
                    </div>
                    <div className="flex items-center">
                      {integration.enabled ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                    </div>
                  </div>
                  
                  <p className="text-gray-600 text-sm mb-4">{integration.description}</p>
                  
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      integration.type === 'webhook' ? 'bg-blue-100 text-blue-800' :
                      integration.type === 'oauth' ? 'bg-green-100 text-green-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {integration.type.toUpperCase()}
                    </span>
                    
                    <button
                      onClick={() => toggleIntegration(integration.id, !integration.enabled)}
                      className={`inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md ${
                        integration.enabled
                          ? 'text-red-700 bg-red-100 hover:bg-red-200'
                          : 'text-green-700 bg-green-100 hover:bg-green-200'
                      }`}
                    >
                      {integration.enabled ? 'Desativar' : 'Ativar'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Relatórios Tab */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-medium text-gray-900">Exportar Relatórios</h2>
              <button
                onClick={() => setShowExportModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar Relatório
              </button>
            </div>

            {/* Tipos de Relatório */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { type: 'projects', name: 'Projetos', description: 'Relatório completo de todos os projetos' },
                { type: 'tasks', name: 'Tarefas', description: 'Relatório de tarefas e produtividade' },
                { type: 'clients', name: 'Clientes', description: 'Relatório de clientes e relacionamento' },
                { type: 'financial', name: 'Financeiro', description: 'Relatório de receitas e despesas' },
                { type: 'time_tracking', name: 'Controle de Tempo', description: 'Relatório de horas trabalhadas' }
              ].map((reportType) => (
                <div key={reportType.type} className="bg-white rounded-lg border border-gray-200 p-6">
                  <div className="flex items-center mb-4">
                    {getReportIcon(reportType.type)}
                    <h3 className="ml-2 text-lg font-medium text-gray-900">{reportType.name}</h3>
                  </div>
                  
                  <p className="text-gray-600 text-sm mb-4">{reportType.description}</p>
                  
                  <button
                    onClick={() => {
                      setExportConfig(prev => ({ ...prev, type: reportType.type }))
                      setShowExportModal(true)
                    }}
                    className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Exportar
                  </button>
                </div>
              ))}
            </div>

            {/* Relatórios Gerados */}
            {reports.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Relatórios Gerados</h3>
                <div className="bg-white shadow overflow-hidden sm:rounded-md">
                  <ul className="divide-y divide-gray-200">
                    {reports.map((report) => (
                      <li key={report.id}>
                        <div className="px-4 py-4 flex items-center justify-between">
                          <div className="flex items-center">
                            {getReportIcon(report.type)}
                            <div className="ml-3">
                              <p className="text-sm font-medium text-gray-900">{report.filename}</p>
                              <p className="text-sm text-gray-500">
                                Gerado em {new Date(report.generatedAt).toLocaleString('pt-BR')}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {report.format.toUpperCase()}
                            </span>
                            <a
                              href={report.downloadUrl}
                              className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                            >
                              <Download className="h-4 w-4 mr-1" />
                              Download
                            </a>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modal de Exportação */}
        {showExportModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Exportar Relatório</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Relatório</label>
                    <select
                      value={exportConfig.type}
                      onChange={(e) => setExportConfig(prev => ({ ...prev, type: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    >
                      <option value="projects">Projetos</option>
                      <option value="tasks">Tarefas</option>
                      <option value="clients">Clientes</option>
                      <option value="financial">Financeiro</option>
                      <option value="time_tracking">Controle de Tempo</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Formato</label>
                    <select
                      value={exportConfig.format}
                      onChange={(e) => setExportConfig(prev => ({ ...prev, format: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    >
                      <option value="json">JSON</option>
                      <option value="csv">CSV</option>
                      <option value="xlsx">Excel</option>
                      <option value="pdf">PDF</option>
                    </select>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Data Início</label>
                      <input
                        type="date"
                        value={exportConfig.dateRange.start}
                        onChange={(e) => setExportConfig(prev => ({
                          ...prev,
                          dateRange: { ...prev.dateRange, start: e.target.value }
                        }))}
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Data Fim</label>
                      <input
                        type="date"
                        value={exportConfig.dateRange.end}
                        onChange={(e) => setExportConfig(prev => ({
                          ...prev,
                          dateRange: { ...prev.dateRange, end: e.target.value }
                        }))}
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end space-x-2 mt-6">
                  <button
                    onClick={() => setShowExportModal(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleExportReport}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                  >
                    Exportar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}