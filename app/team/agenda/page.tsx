'use client'

import { useState, useEffect, useCallback } from 'react'
import { Calendar, dateFnsLocalizer, View, Views } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay, addMinutes, isSameDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { 
  Plus, 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight,
  Clock,
  User as UserIcon,
  MoreVertical,
  X
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import toast from 'react-hot-toast'

const locales = {
  'pt-BR': ptBR,
}

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
})

interface TeamMember {
  id: string
  name: string
  avatar?: string
}

interface Appointment {
  id: string
  title: string
  description?: string
  start: Date
  end: Date
  userId: string
  status: string
  type: string
  user: {
    id: string
    name: string
    avatar?: string
  }
}

export default function AgendaPage() {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState(new Date())
  const [view, setView] = useState<View>(Views.DAY)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState<Partial<Appointment> | null>(null)
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    start: '',
    startTime: '09:00',
    endTime: '10:00',
    userId: '',
    status: 'scheduled',
    type: 'meeting'
  })

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const [membersRes, appointmentsRes] = await Promise.all([
        fetch('/api/team?limit=100'),
        fetch('/api/appointments')
      ])

      const membersData = await membersRes.json()
      const appointmentsData = await appointmentsRes.json()

      if (membersRes.ok) {
        setMembers(membersData.users || [])
      }

      if (appointmentsRes.ok && Array.isArray(appointmentsData)) {
        setAppointments(appointmentsData.map((app: any) => ({
          ...app,
          start: new Date(app.start),
          end: new Date(app.end)
        })))
      } else if (!appointmentsRes.ok) {
        console.error('Erro na API de agendamentos:', appointmentsData.error)
      }
    } catch (error) {
      console.error('Erro ao buscar dados:', error)
      toast.error('Erro ao carregar dados da agenda')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSelectSlot = ({ start, end, resourceId }: any) => {
    setFormData({
      title: '',
      description: '',
      start: format(start, 'yyyy-MM-dd'),
      startTime: format(start, 'HH:mm'),
      endTime: format(end, 'HH:mm'),
      userId: resourceId || '',
      status: 'scheduled',
      type: 'meeting'
    })
    setSelectedAppointment(null)
    setIsModalOpen(true)
  }

  const handleSelectEvent = (event: Appointment) => {
    setSelectedAppointment(event)
    setFormData({
      title: event.title,
      description: event.description || '',
      start: format(event.start, 'yyyy-MM-dd'),
      startTime: format(event.start, 'HH:mm'),
      endTime: format(event.end, 'HH:mm'),
      userId: event.userId,
      status: event.status,
      type: event.type || 'meeting'
    })
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const startDateTime = new Date(`${formData.start}T${formData.startTime}`)
    const endDateTime = new Date(`${formData.start}T${formData.endTime}`)

    const data = {
      title: formData.title,
      description: formData.description,
      start: startDateTime.toISOString(),
      end: endDateTime.toISOString(),
      userId: formData.userId,
      status: formData.status,
      type: formData.type
    }

    try {
      let response
      if (selectedAppointment?.id) {
        response = await fetch(`/api/appointments/${selectedAppointment.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        })
      } else {
        response = await fetch('/api/appointments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        })
      }

      if (!response.ok) throw new Error('Erro ao salvar agendamento')

      toast.success(selectedAppointment?.id ? 'Agendamento atualizado' : 'Agendamento criado')
      setIsModalOpen(false)
      fetchData()
    } catch (error) {
      console.error('Erro:', error)
      toast.error('Erro ao salvar agendamento')
    }
  }

  const handleDelete = async () => {
    if (!selectedAppointment?.id) return
    if (!confirm('Tem certeza que deseja excluir este agendamento?')) return

    try {
      const response = await fetch(`/api/appointments/${selectedAppointment.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Erro ao excluir')

      toast.success('Agendamento excluído')
      setIsModalOpen(false)
      fetchData()
    } catch (error) {
      console.error('Erro:', error)
      toast.error('Erro ao excluir agendamento')
    }
  }

  const eventStyleGetter = (event: Appointment) => {
    let backgroundColor = '#6b7280' // Cinza neutro padrão
    let color = 'white'
    
    const type = event.type || 'other'

    if (type === 'meeting') {
      backgroundColor = '#2563EB' // Azul
    } else if (type === 'visit') {
      backgroundColor = '#F97316' // Laranja
    } else if (type === 'integration') {
      backgroundColor = '#7C3AED' // Roxo
    } else if (type === 'interval') {
      backgroundColor = '#E5E7EB' // Cinza
      color = '#374151' // Texto escuro para fundo claro
    } else if (type === 'creative') {
      backgroundColor = '#EC4899' // Rosa
    } else if (type === 'support') {
      backgroundColor = '#16A34A' // Verde
    }

    return {
      style: {
        backgroundColor,
        borderRadius: '4px',
        color,
        border: 'none',
        display: 'block'
      }
    }
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full space-y-4 p-6 bg-gray-50/50">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Agenda de Atendimento</h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-1">
              <div className="flex items-center space-x-1.5">
                <div className="w-3 h-3 rounded-full bg-[#2563EB]" />
                <span className="text-xs text-gray-500 font-medium">Reunião</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <div className="w-3 h-3 rounded-full bg-[#F97316]" />
                <span className="text-xs text-gray-500 font-medium">Visita Técnica</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <div className="w-3 h-3 rounded-full bg-[#7C3AED]" />
                <span className="text-xs text-gray-500 font-medium">Integração de App</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <div className="w-3 h-3 rounded-full bg-[#E5E7EB] border border-gray-300" />
                <span className="text-xs text-gray-500 font-medium">Intervalo</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <div className="w-3 h-3 rounded-full bg-[#EC4899]" />
                <span className="text-xs text-gray-500 font-medium">Gestão criativa</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <div className="w-3 h-3 rounded-full bg-[#16A34A]" />
                <span className="text-xs text-gray-500 font-medium">Suporte técnico</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <div className="w-3 h-3 rounded-full bg-[#6b7280]" />
                <span className="text-xs text-gray-500 font-medium">Outros</span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" onClick={() => setDate(new Date())}>Hoje</Button>
            <div className="flex items-center border rounded-md bg-white">
              <Button variant="ghost" size="icon" onClick={() => setDate(d => new Date(d.setDate(d.getDate() - 1)))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="px-4 font-medium">
                {format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </span>
              <Button variant="ghost" size="icon" onClick={() => setDate(d => new Date(d.setDate(d.getDate() + 1)))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Button onClick={() => {
              setFormData({
                ...formData,
                start: format(new Date(), 'yyyy-MM-dd'),
                userId: members[0]?.id || ''
              })
              setSelectedAppointment(null)
              setIsModalOpen(true)
            }}>
              <Plus className="mr-2 h-4 w-4" /> Novo Agendamento
            </Button>
          </div>
        </div>

        <Card className="flex-1 overflow-hidden shadow-sm border-none bg-white">
          <CardContent className="p-0 h-[calc(100vh-200px)]">
            <Calendar
              localizer={localizer}
              events={appointments}
              startAccessor="start"
              endAccessor="end"
              style={{ height: '100%' }}
              view={view}
              onView={(v) => setView(v)}
              date={date}
              onNavigate={(d) => setDate(d)}
              culture="pt-BR"
              messages={{
                next: 'Próximo',
                previous: 'Anterior',
                today: 'Hoje',
                month: 'Mês',
                week: 'Semana',
                day: 'Dia',
                agenda: 'Agenda',
                date: 'Data',
                time: 'Hora',
                event: 'Evento',
                noEventsInRange: 'Não há agendamentos neste período.',
                allDay: 'Dia todo'
              }}
              resources={members}
              resourceIdAccessor="id"
              resourceTitleAccessor="name"
              resourceAccessor="userId"
              selectable
              onSelectSlot={handleSelectSlot}
              onSelectEvent={handleSelectEvent}
              eventPropGetter={eventStyleGetter}
              components={{
                resourceHeader: ({ label, resource }: any) => (
                  <div className="flex items-center justify-center py-4 space-x-3">
                    <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                      <AvatarImage src={resource.avatar} />
                      <AvatarFallback className="bg-gray-100 text-gray-600 font-bold">
                        {label.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-bold text-sm text-gray-700">{label}</span>
                  </div>
                ),
                event: ({ event }: any) => (
                  <div className="text-[11px] leading-tight">
                    <div className="font-bold truncate">{event.title}</div>
                    {event.description && (
                      <div className="opacity-80 truncate mb-0.5">{event.description}</div>
                    )}
                    {(event.type || event.status) !== 'interval' && (
                      <div className="opacity-90 font-medium">
                        {format(event.start, 'HH:mm')} - {format(event.end, 'HH:mm')}
                      </div>
                    )}
                  </div>
                )
              }}
              min={new Date(0, 0, 0, 8, 0, 0)} // Start at 8 AM
              max={new Date(0, 0, 0, 20, 0, 0)} // End at 8 PM
              step={30}
              timeslots={2}
            />
          </CardContent>
        </Card>

        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>
                  {selectedAppointment ? 'Editar Agendamento' : 'Novo Agendamento'}
                </DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="title">Título / Serviço</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Ex: Corte de Cabelo"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="userId">Profissional</Label>
                  <Select
                    value={formData.userId}
                    onValueChange={(value) => setFormData({ ...formData, userId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um profissional" />
                    </SelectTrigger>
                    <SelectContent>
                      {members.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="start">Data</Label>
                    <Input
                      id="start"
                      type="date"
                      value={formData.start}
                      onChange={(e) => setFormData({ ...formData, start: e.target.value })}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                  <Label htmlFor="type">Tipo de Agendamento</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => setFormData({ ...formData, type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="meeting">Reunião (Azul)</SelectItem>
                      <SelectItem value="visit">Visita Técnica (Laranja)</SelectItem>
                      <SelectItem value="integration">Integração de App (Roxo)</SelectItem>
                      <SelectItem value="interval">Intervalo (Cinza)</SelectItem>
                      <SelectItem value="creative">Gestão criativa (Rosa)</SelectItem>
                      <SelectItem value="support">Suporte técnico (Verde)</SelectItem>
                      <SelectItem value="other">Outros (Cinza Escuro)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Observação</Label>
                  <Textarea
                     id="description"
                     value={formData.description}
                     onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, description: e.target.value })}
                     placeholder="Detalhes do agendamento..."
                   />
                </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="startTime">Início</Label>
                    <Input
                      id="startTime"
                      type="time"
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="endTime">Fim</Label>
                    <Input
                      id="endTime"
                      type="time"
                      value={formData.endTime}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>
              <DialogFooter className="flex justify-between sm:justify-between w-full">
                {selectedAppointment && (
                  <Button type="button" variant="destructive" onClick={handleDelete}>
                    Excluir
                  </Button>
                )}
                <div className="flex space-x-2">
                  <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">Salvar</Button>
                </div>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <style jsx global>{`
          .rbc-calendar {
            font-family: inherit;
          }
          .rbc-header {
            padding: 16px 0;
            font-weight: 600;
            background-color: white;
            border-bottom: 1px solid #f3f4f6;
            border-left: 1px solid #f3f4f6;
          }
          .rbc-time-view {
            border: 1px solid #f3f4f6;
            border-radius: 8px;
            overflow: hidden;
            background-color: white;
          }
          .rbc-timeslot-group {
            min-height: 64px;
            border-bottom: 1px solid #f9fafb;
          }
          .rbc-day-slot .rbc-time-slot {
            border-top: 1px solid #f3f4f6;
          }
          .rbc-current-time-indicator {
            background-color: #166534; /* Darker green */
            height: 2px;
            z-index: 5;
          }
          .rbc-current-time-indicator::before {
            content: '';
            position: absolute;
            background-color: #166534;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            left: -6px;
            top: -5px;
          }
          .rbc-current-time-indicator::after {
            content: '${format(new Date(), 'HH:mm')}';
            position: absolute;
            right: 0;
            top: -10px;
            background: #166534;
            color: white;
            font-size: 10px;
            padding: 2px 4px;
            border-radius: 4px;
            font-weight: bold;
          }
          .rbc-event {
            padding: 4px 8px;
            box-shadow: 0 1px 2px rgba(0,0,0,0.1);
            border: none;
            transition: all 0.2s;
          }
          .rbc-event:hover {
            filter: brightness(0.9);
            box-shadow: 0 2px 4px rgba(0,0,0,0.15);
          }
          .rbc-selected-cell {
            background-color: rgba(0, 0, 0, 0.02);
          }
          .rbc-day-slot {
            background-color: white;
          }
          .rbc-time-content {
            background-color: white;
            border-top: none;
          }
          .rbc-time-header {
            background-color: white;
          }
          .rbc-off-range-bg {
            background-color: #f9fafb;
          }
          .rbc-time-column {
            background-color: white;
          }
          .rbc-label {
            padding: 0 8px;
            font-size: 12px;
            color: #9ca3af;
          }
          .rbc-time-gutter {
            background-color: white;
          }
          .rbc-toolbar button {
            color: #6b7280;
            border: 1px solid #e5e7eb;
            background-color: white;
          }
          .rbc-toolbar button:active, .rbc-toolbar button.rbc-active {
            background-color: #f3f4f6;
            box-shadow: none;
            color: #111827;
          }
          .rbc-toolbar button:hover {
            background-color: #f9fafb;
            color: #111827;
          }
        `}</style>
      </div>
    </DashboardLayout>
  )
}
