'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
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
import { parseISO } from 'date-fns'
import {
  Settings,
  User,
  Bell,
  Shield,
  Database,
  Palette,
  Globe,
  Mail,
  Key,
  Download,
  Upload,
  Trash2,
  Save,
  Eye,
  EyeOff,
  Check,
  X,
  AlertTriangle,
  Info
} from 'lucide-react'

interface UserSettings {
  profile: {
    name: string
    email: string
    avatar?: string
    timezone: string
    language: string
  }
  notifications: {
    email: boolean
    push: boolean
    reports: boolean
    projects: boolean
    financial: boolean
  }
  security: {
    twoFactor: boolean
    sessionTimeout: number
    passwordExpiry: number
  }
  appearance: {
    theme: 'light' | 'dark' | 'system'
    sidebarCollapsed: boolean
    density: 'comfortable' | 'compact'
  }
  system: {
    autoBackup: boolean
    backupFrequency: 'daily' | 'weekly' | 'monthly'
    dataRetention: number
    apiAccess: boolean
  }
}

interface SystemInfo {
  version: string
  lastBackup: string
  storageUsed: string
  storageTotal: string
  activeUsers: number
  uptime: string
}

export default function SettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [settings, setSettings] = useState<UserSettings>({
    profile: {
      name: '',
      email: '',
      timezone: 'America/Sao_Paulo',
      language: 'pt-BR'
    },
    notifications: {
      email: true,
      push: true,
      reports: true,
      projects: true,
      financial: true
    },
    security: {
      twoFactor: false,
      sessionTimeout: 30,
      passwordExpiry: 90
    },
    appearance: {
      theme: 'light',
      sidebarCollapsed: false,
      density: 'comfortable'
    },
    system: {
      autoBackup: true,
      backupFrequency: 'daily',
      dataRetention: 365,
      apiAccess: false
    }
  })
  const [systemInfo, setSystemInfo] = useState<SystemInfo>({
    version: '1.0.0',
    lastBackup: '2024-01-15T10:30:00Z',
    storageUsed: '2.5 GB',
    storageTotal: '10 GB',
    activeUsers: 12,
    uptime: '15 dias'
  })
  const [activeTab, setActiveTab] = useState('profile')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isBackupDialogOpen, setIsBackupDialogOpen] = useState(false)

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/auth/signin')
      return
    }
    fetchSettings()
  }, [session, status, router])

  const fetchSettings = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/settings')
      
      if (!response.ok) {
        throw new Error('Falha ao carregar configurações')
      }
      
      const data = await response.json()
      setSettings(data.settings)
      setSystemInfo(data.systemInfo)
    } catch (error) {
      console.error('Erro ao carregar configurações:', error)
      toast.error('Erro ao carregar configurações')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveSettings = async () => {
    try {
      setSaving(true)
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings)
      })

      if (!response.ok) {
        throw new Error('Falha ao salvar configurações')
      }

      toast.success('Configurações salvas com sucesso!')
    } catch (error) {
      console.error('Erro ao salvar configurações:', error)
      toast.error('Erro ao salvar configurações')
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error('As senhas não coincidem')
      return
    }
    if (newPassword.length < 8) {
      toast.error('A senha deve ter pelo menos 8 caracteres')
      return
    }
    try {
      // Simular alteração de senha
      await new Promise(resolve => setTimeout(resolve, 1000))
      setNewPassword('')
      setConfirmPassword('')
      toast.success('Senha alterada com sucesso!')
    } catch (error) {
      console.error('Erro ao alterar senha:', error)
      toast.error('Erro ao alterar senha')
    }
  }

  const handleBackupNow = async () => {
    try {
      toast.success('Backup iniciado!')
      setIsBackupDialogOpen(false)
      
      const response = await fetch('/api/system/backup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (!response.ok) {
        throw new Error('Falha ao iniciar backup')
      }

      const data = await response.json()
      setSystemInfo(prev => ({
        ...prev,
        lastBackup: data.timestamp || new Date().toISOString()
      }))
      toast.success('Backup concluído com sucesso!')
    } catch (error) {
      console.error('Erro ao fazer backup:', error)
      toast.error('Erro ao fazer backup')
    }
  }

  const tabs = [
    { id: 'profile', name: 'Perfil', icon: User },
    { id: 'notifications', name: 'Notificações', icon: Bell },
    { id: 'security', name: 'Segurança', icon: Shield },
    { id: 'appearance', name: 'Aparência', icon: Palette },
    { id: 'system', name: 'Sistema', icon: Database }
  ]

  const stats = [
    {
      title: 'Usuários Ativos',
      value: systemInfo.activeUsers,
      icon: User,
      color: 'blue' as const,
      change: {
        value: 'Online agora',
        type: 'neutral' as const
      }
    },
    {
      title: 'Armazenamento',
      value: systemInfo.storageUsed,
      icon: Database,
      color: 'green' as const,
      change: {
        value: `de ${systemInfo.storageTotal}`,
        type: 'neutral' as const
      }
    },
    {
      title: 'Último Backup',
      value: parseISO(systemInfo.lastBackup).toLocaleDateString('pt-BR'),
      icon: Download,
      color: 'purple' as const,
      change: {
        value: 'Automático',
        type: 'neutral' as const
      }
    },
    {
      title: 'Tempo Online',
      value: systemInfo.uptime,
      icon: Globe,
      color: 'yellow' as const,
      change: {
        value: 'Estável',
        type: 'neutral' as const
      }
    }
  ]

  if (loading) {
    return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Carregando configurações...</p>
          </div>
        </div>
    )
  }

  return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Configurações</h1>
            <p className="text-muted-foreground">
              Gerencie suas preferências e configurações do sistema
            </p>
          </div>
          <button
            onClick={handleSaveSettings}
            disabled={saving}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, index) => (
            <StatsCard key={index} {...stat} />
          ))}
        </div>

        {/* Settings Content */}
        <div className="bg-card shadow sm:rounded-lg">
          <div className="border-b border-muted">
            <nav className="-mb-px flex space-x-8 px-6">
              {tabs.map((tab) => {
                const IconComponent = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-muted-foreground hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <IconComponent className="h-4 w-4 mr-2" />
                    {tab.name}
                  </button>
                )
              })}
            </nav>
          </div>

          <div className="p-6">
            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-foreground mb-4">Informações do Perfil</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                      <input
                        type="text"
                        value={settings.profile.name}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          profile: { ...prev.profile, name: e.target.value }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input
                        type="email"
                        value={settings.profile.email}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          profile: { ...prev.profile, email: e.target.value }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Fuso Horário</label>
                      <select
                        value={settings.profile.timezone}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          profile: { ...prev.profile, timezone: e.target.value }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="America/Sao_Paulo">São Paulo (GMT-3)</option>
                        <option value="America/New_York">Nova York (GMT-5)</option>
                        <option value="Europe/London">Londres (GMT+0)</option>
                        <option value="Asia/Tokyo">Tóquio (GMT+9)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Idioma</label>
                      <select
                        value={settings.profile.language}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          profile: { ...prev.profile, language: e.target.value }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="pt-BR">Português (Brasil)</option>
                        <option value="en-US">English (US)</option>
                        <option value="es-ES">Español</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-foreground mb-4">Alterar Senha</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nova Senha</label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Mínimo 8 caracteres"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center"
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4 text-gray-400" />
                          ) : (
                            <Eye className="h-4 w-4 text-gray-400" />
                          )}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar Senha</label>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Confirme a nova senha"
                      />
                    </div>
                  </div>
                  {(newPassword || confirmPassword) && (
                    <button
                      onClick={handleChangePassword}
                      className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                    >
                      <Key className="h-4 w-4 mr-2" />
                      Alterar Senha
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-foreground mb-4">Preferências de Notificação</h3>
                  <div className="space-y-4">
                    {[
                      { key: 'email', label: 'Notificações por Email', description: 'Receber notificações importantes por email' },
                      { key: 'push', label: 'Notificações Push', description: 'Notificações no navegador em tempo real' },
                      { key: 'reports', label: 'Relatórios', description: 'Notificar quando relatórios estiverem prontos' },
                      { key: 'projects', label: 'Projetos', description: 'Atualizações sobre status de projetos' },
                      { key: 'financial', label: 'Financeiro', description: 'Alertas sobre movimentações financeiras' }
                    ].map((item) => (
                      <div key={item.key} className="flex items-center justify-between py-3 border-b border-muted last:border-b-0">
                        <div>
                          <p className="text-sm font-medium text-foreground">{item.label}</p>
                          <p className="text-sm text-muted-foreground">{item.description}</p>
                        </div>
                        <button
                          onClick={() => setSettings(prev => ({
                            ...prev,
                            notifications: {
                              ...prev.notifications,
                              [item.key]: !prev.notifications[item.key as keyof typeof prev.notifications]
                            }
                          }))}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            settings.notifications[item.key as keyof typeof settings.notifications]
                              ? 'bg-blue-600'
                              : 'bg-gray-200'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-card transition-transform ${
                              settings.notifications[item.key as keyof typeof settings.notifications]
                                ? 'translate-x-6'
                                : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Security Tab */}
            {activeTab === 'security' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-foreground mb-4">Configurações de Segurança</h3>
                  <div className="space-y-6">
                    <div className="flex items-center justify-between py-3 border-b border-muted">
                      <div>
                        <p className="text-sm font-medium text-foreground">Autenticação de Dois Fatores</p>
                        <p className="text-sm text-muted-foreground">Adicione uma camada extra de segurança à sua conta</p>
                      </div>
                      <button
                        onClick={() => setSettings(prev => ({
                          ...prev,
                          security: { ...prev.security, twoFactor: !prev.security.twoFactor }
                        }))}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          settings.security.twoFactor ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-card transition-transform ${
                            settings.security.twoFactor ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Timeout da Sessão (minutos)</label>
                      <select
                        value={settings.security.sessionTimeout}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          security: { ...prev.security, sessionTimeout: parseInt(e.target.value) }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value={15}>15 minutos</option>
                        <option value={30}>30 minutos</option>
                        <option value={60}>1 hora</option>
                        <option value={120}>2 horas</option>
                        <option value={480}>8 horas</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Expiração da Senha (dias)</label>
                      <select
                        value={settings.security.passwordExpiry}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          security: { ...prev.security, passwordExpiry: parseInt(e.target.value) }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value={30}>30 dias</option>
                        <option value={60}>60 dias</option>
                        <option value={90}>90 dias</option>
                        <option value={180}>180 dias</option>
                        <option value={365}>1 ano</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Appearance Tab */}
            {activeTab === 'appearance' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-foreground mb-4">Personalização da Interface</h3>
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">Tema</label>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { value: 'light', label: 'Claro' },
                          { value: 'dark', label: 'Escuro' },
                          { value: 'system', label: 'Sistema' }
                        ].map((theme) => (
                          <button
                            key={theme.value}
                            onClick={() => setSettings(prev => ({
                              ...prev,
                              appearance: { ...prev.appearance, theme: theme.value as any }
                            }))}
                            className={`p-3 border rounded-lg text-sm font-medium ${
                              settings.appearance.theme === theme.value
                                ? 'border-blue-500 bg-blue-50 text-blue-700'
                                : 'border-gray-300 text-gray-700 hover:bg-card'
                            }`}
                          >
                            {theme.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">Densidade</label>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { value: 'comfortable', label: 'Confortável' },
                          { value: 'compact', label: 'Compacto' }
                        ].map((density) => (
                          <button
                            key={density.value}
                            onClick={() => setSettings(prev => ({
                              ...prev,
                              appearance: { ...prev.appearance, density: density.value as any }
                            }))}
                            className={`p-3 border rounded-lg text-sm font-medium ${
                              settings.appearance.density === density.value
                                ? 'border-blue-500 bg-blue-50 text-blue-700'
                                : 'border-gray-300 text-gray-700 hover:bg-card'
                            }`}
                          >
                            {density.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between py-3 border-b border-muted">
                      <div>
                        <p className="text-sm font-medium text-foreground">Sidebar Recolhida</p>
                        <p className="text-sm text-muted-foreground">Manter a barra lateral recolhida por padrão</p>
                      </div>
                      <button
                        onClick={() => setSettings(prev => ({
                          ...prev,
                          appearance: { ...prev.appearance, sidebarCollapsed: !prev.appearance.sidebarCollapsed }
                        }))}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          settings.appearance.sidebarCollapsed ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-card transition-transform ${
                            settings.appearance.sidebarCollapsed ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* System Tab */}
            {activeTab === 'system' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-foreground mb-4">Configurações do Sistema</h3>
                  <div className="space-y-6">
                    <div className="flex items-center justify-between py-3 border-b border-muted">
                      <div>
                        <p className="text-sm font-medium text-foreground">Backup Automático</p>
                        <p className="text-sm text-muted-foreground">Fazer backup automático dos dados do sistema</p>
                      </div>
                      <button
                        onClick={() => setSettings(prev => ({
                          ...prev,
                          system: { ...prev.system, autoBackup: !prev.system.autoBackup }
                        }))}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          settings.system.autoBackup ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-card transition-transform ${
                            settings.system.autoBackup ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Frequência do Backup</label>
                      <select
                        value={settings.system.backupFrequency}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          system: { ...prev.system, backupFrequency: e.target.value as any }
                        }))}
                        disabled={!settings.system.autoBackup}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-muted-foreground"
                      >
                        <option value="daily">Diário</option>
                        <option value="weekly">Semanal</option>
                        <option value="monthly">Mensal</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Retenção de Dados (dias)</label>
                      <select
                        value={settings.system.dataRetention}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          system: { ...prev.system, dataRetention: parseInt(e.target.value) }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value={90}>90 dias</option>
                        <option value={180}>180 dias</option>
                        <option value={365}>1 ano</option>
                        <option value={730}>2 anos</option>
                        <option value={-1}>Indefinido</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between py-3 border-b border-muted">
                      <div>
                        <p className="text-sm font-medium text-foreground">Acesso à API</p>
                        <p className="text-sm text-muted-foreground">Permitir acesso programático via API</p>
                      </div>
                      <button
                        onClick={() => setSettings(prev => ({
                          ...prev,
                          system: { ...prev.system, apiAccess: !prev.system.apiAccess }
                        }))}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          settings.system.apiAccess ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-card transition-transform ${
                            settings.system.apiAccess ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    <div className="bg-card p-4 rounded-lg">
                      <h4 className="text-sm font-medium text-foreground mb-3">Ações do Sistema</h4>
                      <div className="flex flex-wrap gap-3">
                        <Dialog open={isBackupDialogOpen} onOpenChange={setIsBackupDialogOpen}>
                          <DialogTrigger asChild>
                            <button className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-card hover:bg-card">
                              <Download className="h-4 w-4 mr-2" />
                              Fazer Backup Agora
                            </button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Confirmar Backup</DialogTitle>
                              <DialogDescription>
                                Tem certeza que deseja fazer um backup completo do sistema agora?
                              </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                              <button
                                onClick={() => setIsBackupDialogOpen(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                              >
                                Cancelar
                              </button>
                              <button
                                onClick={handleBackupNow}
                                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
                              >
                                Fazer Backup
                              </button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                        <button className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-card hover:bg-card">
                          <Upload className="h-4 w-4 mr-2" />
                          Restaurar Backup
                        </button>
                      </div>
                    </div>

                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <div className="flex">
                        <AlertTriangle className="h-5 w-5 text-yellow-400" />
                        <div className="ml-3">
                          <h4 className="text-sm font-medium text-yellow-800">Informações do Sistema</h4>
                          <div className="mt-2 text-sm text-yellow-700">
                            <p>Versão: {systemInfo.version}</p>
                            <p>Último backup: {new Date(systemInfo.lastBackup).toLocaleString('pt-BR')}</p>
                            <p>Armazenamento: {systemInfo.storageUsed} de {systemInfo.storageTotal}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
  )
}