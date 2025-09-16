"use client"

import { parseISO } from "date-fns"
import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import {
  Bell,
  Mail,
  MessageSquare,
  Phone,
  Settings,
  Check,
  X,
  Clock,
  AlertCircle,
  CheckCircle,
  Info,
  Trash2,
  CheckCheck
} from "lucide-react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import toast from "react-hot-toast"

interface NotificationSettings {
  emailEnabled: boolean
  whatsappEnabled: boolean
  pushEnabled: boolean
  projectUpdates: boolean
  taskDeadlines: boolean
  teamMessages: boolean
  clientMessages: boolean
  systemAlerts: boolean
  weeklyReports: boolean
  whatsappNumber?: string
}

interface Notification {
  id: string
  title: string
  message: string
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR'
  read: boolean
  createdAt: string
  actionUrl?: string
  metadata?: {
    projectId?: string
    taskId?: string
    clientId?: string
  }
}

export default function NotificationsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'notifications' | 'settings'>('notifications')
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [settings, setSettings] = useState<NotificationSettings>({
    emailEnabled: true,
    whatsappEnabled: false,
    pushEnabled: true,
    projectUpdates: true,
    taskDeadlines: true,
    teamMessages: true,
    clientMessages: true,
    systemAlerts: true,
    weeklyReports: false
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (status === "loading") return
    
    if (!session) {
      router.push("/auth/signin")
      return
    }

    fetchNotifications()
    fetchSettings()
  }, [session, status, router])

  const fetchNotifications = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/notifications')
      
      if (!response.ok) {
        throw new Error('Falha ao carregar notificações')
      }
      
      const data = await response.json()
      setNotifications(data.notifications)
    } catch (error) {
      console.error('Erro ao buscar notificações:', error)
      toast.error('Erro ao carregar notificações')
    } finally {
      setLoading(false)
    }
  }

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/notifications/settings')
      
      if (!response.ok) {
        throw new Error('Falha ao carregar configurações')
      }
      
      const data = await response.json()
      setSettings(data.settings)
    } catch (error) {
      console.error('Erro ao buscar configurações:', error)
      toast.error('Erro ao carregar configurações')
    }
  }

  const saveSettings = async () => {
    try {
      setSaving(true)
      const response = await fetch('/api/notifications/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
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

  const markAsRead = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'PUT'
      })
      
      if (!response.ok) {
        throw new Error('Falha ao marcar como lida')
      }
      
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      )
    } catch (error) {
      console.error('Erro ao marcar como lida:', error)
      toast.error('Erro ao marcar como lida')
    }
  }

  const markAllAsRead = async () => {
    try {
      const response = await fetch('/api/notifications/read-all', {
        method: 'PUT'
      })
      
      if (!response.ok) {
        throw new Error('Falha ao marcar todas como lidas')
      }
      
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      toast.success('Todas as notificações foram marcadas como lidas')
    } catch (error) {
      console.error('Erro ao marcar todas como lidas:', error)
      toast.error('Erro ao marcar todas como lidas')
    }
  }

  const deleteNotification = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        throw new Error('Falha ao excluir notificação')
      }
      
      setNotifications(prev => prev.filter(n => n.id !== notificationId))
      toast.success('Notificação excluída')
    } catch (error) {
      console.error('Erro ao excluir notificação:', error)
      toast.error('Erro ao excluir notificação')
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'SUCCESS':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'WARNING':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />
      case 'ERROR':
        return <X className="h-5 w-5 text-red-500" />
      default:
        return <Info className="h-5 w-5 text-blue-500" />
    }
  }

  const formatTime = (dateString: string) => {
    const date = parseISO(dateString)
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
    
    if (diffInMinutes < 1) {
      return 'Agora'
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes} min atrás`
    } else if (diffInMinutes < 1440) {
      const hours = Math.floor(diffInMinutes / 60)
      return `${hours}h atrás`
    } else {
      const days = Math.floor(diffInMinutes / 1440)
      return `${days}d atrás`
    }
  }

  const unreadCount = notifications.filter(n => !n.read).length

  if (status === "loading" || loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Notificações</h1>
            <p className="mt-1 text-sm text-gray-500">
              Gerencie suas notificações e preferências
            </p>
          </div>
          <div className="flex items-center space-x-2">
            {unreadCount > 0 && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                {unreadCount} não lida{unreadCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('notifications')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'notifications'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center">
                <Bell className="h-4 w-4 mr-2" />
                Notificações
                {unreadCount > 0 && (
                  <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
                    {unreadCount}
                  </span>
                )}
              </div>
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'settings'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center">
                <Settings className="h-4 w-4 mr-2" />
                Configurações
              </div>
            </button>
          </nav>
        </div>

        {/* Content */}
        {activeTab === 'notifications' ? (
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Suas Notificações
                </h3>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <CheckCheck className="h-4 w-4 mr-1" />
                    Marcar todas como lidas
                  </button>
                )}
              </div>
              
              {notifications.length > 0 ? (
                <div className="space-y-3">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 rounded-lg border transition-colors ${
                        notification.read
                          ? 'bg-gray-50 border-gray-200'
                          : 'bg-blue-50 border-blue-200'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3 flex-1">
                          {getNotificationIcon(notification.type)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h4 className={`text-sm font-medium ${
                                notification.read ? 'text-gray-700' : 'text-gray-900'
                              }`}>
                                {notification.title}
                              </h4>
                              <div className="flex items-center space-x-2">
                                <span className={`text-xs ${
                                  notification.read ? 'text-gray-400' : 'text-gray-500'
                                }`}>
                                  <Clock className="h-3 w-3 inline mr-1" />
                                  {formatTime(notification.createdAt)}
                                </span>
                              </div>
                            </div>
                            <p className={`mt-1 text-sm ${
                              notification.read ? 'text-gray-500' : 'text-gray-700'
                            }`}>
                              {notification.message}
                            </p>
                            {notification.actionUrl && (
                              <button
                                onClick={() => router.push(notification.actionUrl!)}
                                className="mt-2 text-sm text-indigo-600 hover:text-indigo-500"
                              >
                                Ver detalhes →
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 ml-4">
                          {!notification.read && (
                            <button
                              onClick={() => markAsRead(notification.id)}
                              className="p-1 text-gray-400 hover:text-gray-600"
                              title="Marcar como lida"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => deleteNotification(notification.id)}
                            className="p-1 text-gray-400 hover:text-red-600"
                            title="Excluir notificação"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Bell className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhuma notificação</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Você está em dia! Não há notificações pendentes.
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-6">
                Configurações de Notificação
              </h3>
              
              <div className="space-y-6">
                {/* Canais de Notificação */}
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-4">Canais de Notificação</h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Mail className="h-5 w-5 text-gray-400 mr-3" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">Email</p>
                          <p className="text-sm text-gray-500">Receber notificações por email</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.emailEnabled}
                          onChange={(e) => setSettings(prev => ({ ...prev, emailEnabled: e.target.checked }))}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                      </label>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <MessageSquare className="h-5 w-5 text-gray-400 mr-3" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">WhatsApp</p>
                          <p className="text-sm text-gray-500">Receber notificações via WhatsApp</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.whatsappEnabled}
                          onChange={(e) => setSettings(prev => ({ ...prev, whatsappEnabled: e.target.checked }))}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                      </label>
                    </div>
                    
                    {settings.whatsappEnabled && (
                      <div className="ml-8">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Número do WhatsApp
                        </label>
                        <input
                          type="tel"
                          value={settings.whatsappNumber || ''}
                          onChange={(e) => setSettings(prev => ({ ...prev, whatsappNumber: e.target.value }))}
                          placeholder="+55 11 99999-9999"
                          className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        />
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Bell className="h-5 w-5 text-gray-400 mr-3" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">Push Notifications</p>
                          <p className="text-sm text-gray-500">Notificações no navegador</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.pushEnabled}
                          onChange={(e) => setSettings(prev => ({ ...prev, pushEnabled: e.target.checked }))}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                      </label>
                    </div>
                  </div>
                </div>
                
                {/* Tipos de Notificação */}
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-4">Tipos de Notificação</h4>
                  <div className="space-y-4">
                    {[
                      { key: 'projectUpdates', label: 'Atualizações de Projetos', desc: 'Mudanças de status, novos marcos' },
                      { key: 'taskDeadlines', label: 'Prazos de Tarefas', desc: 'Lembretes de tarefas próximas do vencimento' },
                      { key: 'teamMessages', label: 'Mensagens da Equipe', desc: 'Novas mensagens no chat da equipe' },
                      { key: 'clientMessages', label: 'Mensagens de Clientes', desc: 'Comentários e solicitações de clientes' },
                      { key: 'systemAlerts', label: 'Alertas do Sistema', desc: 'Notificações importantes do sistema' },
                      { key: 'weeklyReports', label: 'Relatórios Semanais', desc: 'Resumo semanal de atividades' }
                    ].map((item) => (
                      <div key={item.key} className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{item.label}</p>
                          <p className="text-sm text-gray-500">{item.desc}</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings[item.key as keyof NotificationSettings] as boolean}
                            onChange={(e) => setSettings(prev => ({ ...prev, [item.key]: e.target.checked }))}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Save Button */}
                <div className="pt-4 border-t border-gray-200">
                  <button
                    onClick={saveSettings}
                    disabled={saving}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                  >
                    {saving ? 'Salvando...' : 'Salvar Configurações'}
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