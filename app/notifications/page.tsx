"use client"

import { parseISO } from "date-fns"
import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { PageLoadingGate } from '@/components/ui/loading-animation'
import {
  Bell,
  Mail,
  MessageSquare,
  Settings,
  Check,
  Clock,
  CheckCircle,
  Info,
  Trash2,
  CheckCheck,
  UserPlus,
  CalendarClock,
  Milestone,
} from "lucide-react"
import toast from "react-hot-toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

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

type NotificationType =
  | 'TASK_ASSIGNED'
  | 'TASK_COMPLETED'
  | 'PROJECT_UPDATE'
  | 'MILESTONE_COMPLETED'
  | 'CLIENT_COMMENT'
  | 'PAYMENT_RECEIVED'
  | 'DEADLINE_APPROACHING'

interface Notification {
  id: string
  title: string
  message: string
  type: NotificationType | string
  read: boolean
  createdAt: string
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
    weeklyReports: false,
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
      setNotifications(Array.isArray(data.notifications) ? data.notifications : [])
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
    }
  }

  const saveSettings = async () => {
    try {
      setSaving(true)
      const response = await fetch('/api/notifications/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
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
        method: 'PUT',
      })

      if (!response.ok) {
        throw new Error('Falha ao marcar como lida')
      }

      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      )
    } catch (error) {
      console.error('Erro ao marcar como lida:', error)
      toast.error('Erro ao marcar como lida')
    }
  }

  const markAllAsRead = async () => {
    try {
      const response = await fetch('/api/notifications/read-all', {
        method: 'PUT',
      })

      if (!response.ok) {
        throw new Error('Falha ao marcar todas como lidas')
      }

      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      toast.success('Todas as notificações foram marcadas como lidas')
    } catch (error) {
      console.error('Erro ao marcar todas como lidas:', error)
      toast.error('Erro ao marcar todas como lidas')
    }
  }

  const deleteNotification = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Falha ao excluir notificação')
      }

      setNotifications((prev) => prev.filter((n) => n.id !== notificationId))
      toast.success('Notificação excluída')
    } catch (error) {
      console.error('Erro ao excluir notificação:', error)
      toast.error('Erro ao excluir notificação')
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'TASK_ASSIGNED':
        return <UserPlus className="h-5 w-5 text-primary" />
      case 'TASK_COMPLETED':
        return <CheckCircle className="h-5 w-5 text-green-600" />
      case 'DEADLINE_APPROACHING':
        return <CalendarClock className="h-5 w-5 text-amber-600" />
      case 'MILESTONE_COMPLETED':
        return <Milestone className="h-5 w-5 text-green-600" />
      case 'CLIENT_COMMENT':
        return <MessageSquare className="h-5 w-5 text-blue-600" />
      case 'PAYMENT_RECEIVED':
        return <CheckCircle className="h-5 w-5 text-emerald-600" />
      case 'PROJECT_UPDATE':
      default:
        return <Info className="h-5 w-5 text-muted-foreground" />
    }
  }

  const formatTime = (dateString: string) => {
    const date = parseISO(dateString)
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))

    if (diffInMinutes < 1) return 'Agora'
    if (diffInMinutes < 60) return `${diffInMinutes} min atrás`
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h atrás`
    return `${Math.floor(diffInMinutes / 1440)}d atrás`
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <PageLoadingGate loading={status === "loading" || loading}>
      <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Notificações</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Gerencie suas notificações e preferências
            </p>
          </div>
          {unreadCount > 0 && (
            <Badge variant="destructive" className="text-xs">
              {unreadCount} não lida{unreadCount !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>

        <div className="border-b border-border">
          <nav className="-mb-px flex gap-6">
            <button
              type="button"
              onClick={() => setActiveTab('notifications')}
              className={cn(
                'flex items-center gap-2 border-b-2 py-2 text-sm font-medium transition-colors',
                activeTab === 'notifications'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              <Bell className="h-4 w-4" />
              Notificações
              {unreadCount > 0 && (
                <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-[10px]">
                  {unreadCount}
                </Badge>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={cn(
                'flex items-center gap-2 border-b-2 py-2 text-sm font-medium transition-colors',
                activeTab === 'settings'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              <Settings className="h-4 w-4" />
              Configurações
            </button>
          </nav>
        </div>

        {activeTab === 'notifications' ? (
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6">
              <h2 className="text-base font-semibold text-foreground">Suas notificações</h2>
              {unreadCount > 0 && (
                <Button type="button" variant="outline" size="sm" onClick={markAllAsRead}>
                  <CheckCheck className="mr-1.5 h-4 w-4" />
                  Marcar todas como lidas
                </Button>
              )}
            </div>

            <div className="p-4 sm:p-6">
              {notifications.length > 0 ? (
                <div className="space-y-2">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={cn(
                        'rounded-lg border p-4 transition-colors',
                        notification.read
                          ? 'border-border bg-background'
                          : 'border-primary/20 bg-primary/5'
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                          <span className="mt-0.5 shrink-0">{getNotificationIcon(notification.type)}</span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <h3
                                className={cn(
                                  'text-sm font-medium',
                                  notification.read ? 'text-muted-foreground' : 'text-foreground'
                                )}
                              >
                                {notification.title}
                              </h3>
                              <span className="flex shrink-0 items-center text-xs text-muted-foreground">
                                <Clock className="mr-1 h-3 w-3" />
                                {formatTime(notification.createdAt)}
                              </span>
                            </div>
                            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                              {notification.message}
                            </p>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-1">
                          {!notification.read && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              title="Marcar como lida"
                              onClick={() => markAsRead(notification.id)}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            title="Excluir notificação"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => deleteNotification(notification.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <Bell className="mx-auto h-12 w-12 text-muted-foreground/40" />
                  <h3 className="mt-3 text-sm font-medium text-foreground">Nenhuma notificação</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Você está em dia. Não há notificações pendentes.
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card shadow-sm p-4 sm:p-6">
            <h2 className="mb-6 text-base font-semibold text-foreground">Configurações de notificação</h2>

            <div className="space-y-8">
              <section>
                <h3 className="mb-4 text-sm font-medium text-foreground">Canais</h3>
                <div className="space-y-4">
                  {[
                    { key: 'emailEnabled' as const, icon: Mail, label: 'E-mail', desc: 'Receber notificações por e-mail' },
                    { key: 'whatsappEnabled' as const, icon: MessageSquare, label: 'WhatsApp', desc: 'Receber via WhatsApp' },
                    { key: 'pushEnabled' as const, icon: Bell, label: 'Push no navegador', desc: 'Alertas em tempo real no PM' },
                  ].map(({ key, icon: Icon, label, desc }) => (
                    <label key={key} className="flex cursor-pointer items-center justify-between gap-4">
                      <span className="flex items-center gap-3">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                        <span>
                          <span className="block text-sm font-medium">{label}</span>
                          <span className="block text-sm text-muted-foreground">{desc}</span>
                        </span>
                      </span>
                      <input
                        type="checkbox"
                        checked={settings[key]}
                        onChange={(e) => setSettings((prev) => ({ ...prev, [key]: e.target.checked }))}
                        className="h-4 w-4 rounded border-border"
                      />
                    </label>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="mb-4 text-sm font-medium text-foreground">Tipos</h3>
                <div className="space-y-4">
                  {[
                    { key: 'projectUpdates', label: 'Atualizações de projetos', desc: 'Mudanças de status e marcos' },
                    { key: 'taskDeadlines', label: 'Prazos de tarefas', desc: 'Lembretes de vencimento' },
                    { key: 'teamMessages', label: 'Mensagens da equipe', desc: 'Comentários em tarefas' },
                    { key: 'clientMessages', label: 'Mensagens de clientes', desc: 'Solicitações no portal' },
                    { key: 'systemAlerts', label: 'Alertas do sistema', desc: 'Avisos importantes' },
                    { key: 'weeklyReports', label: 'Relatórios semanais', desc: 'Resumo semanal' },
                  ].map((item) => (
                    <label key={item.key} className="flex cursor-pointer items-center justify-between gap-4">
                      <span>
                        <span className="block text-sm font-medium">{item.label}</span>
                        <span className="block text-sm text-muted-foreground">{item.desc}</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={settings[item.key as keyof NotificationSettings] as boolean}
                        onChange={(e) => setSettings((prev) => ({ ...prev, [item.key]: e.target.checked }))}
                        className="h-4 w-4 rounded border-border"
                      />
                    </label>
                  ))}
                </div>
              </section>

              <div className="border-t border-border pt-4">
                <Button type="button" onClick={saveSettings} disabled={saving}>
                  {saving ? 'Salvando...' : 'Salvar configurações'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageLoadingGate>
  )
}
