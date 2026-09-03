'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { UseFormRegister, UseFormSetValue, UseFormWatch } from 'react-hook-form'
import { DateRange } from 'react-day-picker'
import { ptBR } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import {
  Calendar as CalendarIcon,
  Clock,
  Tag,
  User,
  Briefcase,
  Target,
  CheckSquare,
  Pencil,
} from 'lucide-react'

type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'

export type TaskMetadataFormValues = {
  priority: Priority
  storyPoints?: number
  hasBonus?: boolean
  assigneeId?: string
  milestoneId?: string
  dueDate?: string
  startDate?: string
  startTime?: string
  estimatedMinutes?: number
}

type PanelId = 'labels' | 'members' | 'dates' | 'milestone' | 'project'

type TeamMember = { id: string; name: string; email: string }
type Milestone = { id: string; title: string }
type SprintProject = {
  id: string
  name: string
  client: { name: string }
}

const PRIORITY_OPTIONS: {
  value: Priority
  label: string
  bar: string
  pill: string
}[] = [
  {
    value: 'LOW',
    label: 'Baixa',
    bar: 'bg-slate-400 hover:bg-slate-500',
    pill: 'bg-slate-500/20 text-slate-800 dark:text-slate-200',
  },
  {
    value: 'MEDIUM',
    label: 'Média',
    bar: 'bg-blue-500 hover:bg-blue-600',
    pill: 'bg-blue-500/20 text-blue-800 dark:text-blue-200',
  },
  {
    value: 'HIGH',
    label: 'Alta',
    bar: 'bg-orange-500 hover:bg-orange-600',
    pill: 'bg-orange-500/20 text-orange-800 dark:text-orange-200',
  },
  {
    value: 'URGENT',
    label: 'Urgente',
    bar: 'bg-red-500 hover:bg-red-600',
    pill: 'bg-red-500/20 text-red-800 dark:text-red-200',
  },
]

const popoverFocusHandlers = {
  onOpenAutoFocus: (e: Event) => e.preventDefault(),
  onCloseAutoFocus: (e: Event) => e.preventDefault(),
}

function formatDateLabel(isoDate?: string) {
  if (!isoDate) return null
  const d = new Date(isoDate + (isoDate.includes('T') ? '' : 'T12:00:00'))
  if (Number.isNaN(d.getTime())) return isoDate
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function toIsoDate(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function fromIsoDate(s?: string) {
  if (!s) return undefined
  const d = new Date(`${s}T12:00:00`)
  return Number.isNaN(d.getTime()) ? undefined : d
}

function ActionChip({
  children,
  active,
  className,
  ...props
}: React.ComponentProps<'button'> & {
  active?: boolean
}) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center h-8 gap-1.5 px-3 rounded-md text-sm font-normal',
        'bg-muted/70 hover:bg-muted text-foreground transition-colors',
        active && 'ring-1 ring-primary/40 bg-muted',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

function SummaryPopoverRow({
  open,
  onOpenChange,
  title,
  children,
  emptyHint,
  hasContent,
  content,
  contentClassName,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  children: React.ReactNode
  emptyHint: string
  hasContent: boolean
  content: React.ReactNode
  contentClassName?: string
}) {
  return (
    <Popover modal={false} open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="grid w-full grid-cols-[120px_1fr] items-start gap-3 border-b border-border/50 py-3 text-left transition-colors last:border-0 hover:bg-muted/30"
        >
          <span className="text-sm text-muted-foreground">{title}</span>
          <div className="min-w-0 text-sm">
            {hasContent ? children : <span className="text-muted-foreground/70">{emptyHint}</span>}
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        collisionPadding={16}
        className={contentClassName}
        {...popoverFocusHandlers}
      >
        {content}
      </PopoverContent>
    </Popover>
  )
}

function SummaryBlock({
  title,
  onEdit,
  children,
  emptyHint,
  hasContent,
  planeLayout,
}: {
  title: string
  onEdit: () => void
  children: React.ReactNode
  emptyHint: string
  hasContent: boolean
  planeLayout?: boolean
}) {
  if (planeLayout) {
    return (
      <button
        type="button"
        onClick={onEdit}
        className="grid w-full grid-cols-[120px_1fr] items-start gap-3 border-b border-border/50 py-3 text-left transition-colors last:border-0 hover:bg-muted/30"
      >
        <span className="text-sm text-muted-foreground">{title}</span>
        <div className="min-w-0 text-sm">
          {hasContent ? children : <span className="text-muted-foreground/70">{emptyHint}</span>}
        </div>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onEdit}
      className="w-full text-left rounded-lg px-2 py-2 -mx-2 hover:bg-muted/50 transition-colors group"
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <h4 className="text-xs font-semibold text-muted-foreground">{title}</h4>
        <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />
      </div>
      {hasContent ? (
        children
      ) : (
        <p className="text-sm text-muted-foreground/80">{emptyHint}</p>
      )}
    </button>
  )
}

type TaskMetadataControlsProps = {
  watch: UseFormWatch<TaskMetadataFormValues>
  setValue: UseFormSetValue<TaskMetadataFormValues>
  register: UseFormRegister<TaskMetadataFormValues>
  teamMembers: TeamMember[]
  milestones: Milestone[]
  sprintProjects: SprintProject[]
  selectedProjectId: string
  onProjectChange: (id: string) => void
  estimatedEndTime: string
  showSummary?: boolean
  hideToolbar?: boolean
  className?: string
  onDatesCommit?: (dates: {
    startDate?: string
    dueDate?: string
  }) => void | Promise<void>
}

export function TaskMetadataControls({
  watch,
  setValue,
  register,
  teamMembers,
  milestones,
  sprintProjects,
  selectedProjectId,
  onProjectChange,
  estimatedEndTime,
  showSummary = false,
  hideToolbar = false,
  className,
  onDatesCommit,
}: TaskMetadataControlsProps) {
  const [openPanel, setOpenPanel] = useState<PanelId | null>(null)
  const [summaryOpen, setSummaryOpen] = useState<PanelId | null>(null)
  const [draftRange, setDraftRange] = useState<DateRange | undefined>()
  const [datesSaving, setDatesSaving] = useState(false)
  const datesPanelWasOpenRef = useRef(false)

  const setPanel = (panel: PanelId | null) => setOpenPanel(panel)
  const setSummaryPanel = (panel: PanelId | null) => setSummaryOpen(panel)
  const isOpen = (panel: PanelId) => openPanel === panel
  const isSummaryOpen = (panel: PanelId) => summaryOpen === panel

  const priority = watch('priority')
  const storyPoints = watch('storyPoints')
  const hasBonus = watch('hasBonus')
  const assigneeId = watch('assigneeId')
  const milestoneId = watch('milestoneId')
  const startDate = watch('startDate')
  const dueDate = watch('dueDate')
  const startTime = watch('startTime')
  const estimatedMinutes = watch('estimatedMinutes')

  const dateRange = useMemo((): DateRange | undefined => {
    const from = fromIsoDate(startDate)
    const to = fromIsoDate(dueDate)
    if (!from && !to) return undefined
    return { from, to: to ?? from }
  }, [startDate, dueDate])

  const draftDatesPayload = useMemo((): {
    startDate?: string
    dueDate?: string
  } | null => {
    if (!draftRange?.from) {
      return { startDate: undefined, dueDate: undefined }
    }
    if (!draftRange.to) return null
    return {
      startDate: toIsoDate(draftRange.from),
      dueDate: toIsoDate(draftRange.to),
    }
  }, [draftRange])

  const datesDraftDirty = useMemo(() => {
    if (draftDatesPayload === null) return false
    const savedStart = startDate || undefined
    const savedDue = dueDate || undefined
    return (
      draftDatesPayload.startDate !== savedStart ||
      draftDatesPayload.dueDate !== savedDue
    )
  }, [draftDatesPayload, startDate, dueDate])

  const canApplyDates = draftDatesPayload !== null

  const datesPanelOpen = isOpen('dates') || isSummaryOpen('dates')

  useEffect(() => {
    if (datesPanelOpen && !datesPanelWasOpenRef.current) {
      setDraftRange(dateRange)
    }
    datesPanelWasOpenRef.current = datesPanelOpen
  }, [datesPanelOpen, dateRange])

  useEffect(() => {
    if (!datesPanelOpen || datesDraftDirty) return
    setDraftRange(dateRange)
  }, [startDate, dueDate, datesPanelOpen, datesDraftDirty, dateRange])

  const assignee = teamMembers.find((m) => m.id === assigneeId)
  const milestone = milestones.find((m) => m.id === milestoneId)
  const priorityMeta = PRIORITY_OPTIONS.find((p) => p.value === priority)

  const hasDates = !!(startDate || dueDate || startTime || estimatedMinutes)
  const hasLabels =
    !!priorityMeta || (storyPoints ?? 0) > 0 || !!hasBonus

  const labelsEditor = (
    <>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
        Prioridade
      </p>
      <div className="space-y-1.5">
        {PRIORITY_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setValue('priority', opt.value)}
            className={cn(
              'w-full rounded-md py-2 px-3 text-left text-sm font-medium text-white transition-opacity',
              opt.bar,
              priority === opt.value &&
                'ring-2 ring-offset-2 ring-offset-popover ring-foreground/30'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <div className="pt-3 mt-3 border-t space-y-2">
        <Label className="text-xs text-muted-foreground flex items-center gap-1">
          <Target className="w-3 h-3" /> Story points
        </Label>
        <Input
          type="number"
          min={0}
          max={100}
          className="h-8"
          {...register('storyPoints', { valueAsNumber: true })}
        />
      </div>
      <div className="flex items-center justify-between pt-2">
        <Label className="text-xs text-muted-foreground">Preço bônus</Label>
        <div className="flex gap-1">
          <Button
            type="button"
            size="sm"
            variant={hasBonus ? 'default' : 'outline'}
            className="h-7 text-xs"
            onClick={() => setValue('hasBonus', true)}
          >
            Sim
          </Button>
          <Button
            type="button"
            size="sm"
            variant={!hasBonus ? 'secondary' : 'outline'}
            className="h-7 text-xs"
            onClick={() => setValue('hasBonus', false)}
          >
            Não
          </Button>
        </div>
      </div>
    </>
  )

  const membersEditor = (
    <>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 py-1">
        Atribuir membro
      </p>
      <div className="max-h-56 overflow-y-auto">
        <button
          type="button"
          onClick={() => setValue('assigneeId', undefined)}
          className={cn(
            'w-full flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted text-left',
            !assigneeId && 'bg-muted'
          )}
        >
          <span className="text-muted-foreground">Ninguém</span>
        </button>
        {teamMembers.map((member) => (
          <button
            key={member.id}
            type="button"
            onClick={() => setValue('assigneeId', member.id)}
            className={cn(
              'w-full flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted text-left',
              assigneeId === member.id && 'bg-muted'
            )}
          >
            <Avatar className="h-7 w-7">
              <AvatarFallback className="text-xs bg-primary/10">
                {member.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="truncate">{member.name}</span>
          </button>
        ))}
      </div>
    </>
  )

  const setDateField = (
    field: 'startDate' | 'dueDate',
    value: string | undefined
  ) => {
    setValue(field, value ?? '', { shouldDirty: true, shouldTouch: true })
  }

  const handleDateRangeSelect = (range: DateRange | undefined) => {
    setDraftRange(range)
  }

  const applyDraftDates = async () => {
    if (!draftDatesPayload) return

    const { startDate: nextStart, dueDate: nextDue } = draftDatesPayload
    setDateField('startDate', nextStart)
    setDateField('dueDate', nextDue)

    if (!onDatesCommit) return

    setDatesSaving(true)
    try {
      await onDatesCommit({ startDate: nextStart, dueDate: nextDue })
    } finally {
      setDatesSaving(false)
    }
  }

  const datesEditor = (
    <>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
        Início e entrega
      </p>
      <Calendar
        mode="range"
        locale={ptBR}
        selected={draftRange}
        defaultMonth={draftRange?.from ?? draftRange?.to ?? dateRange?.from}
        onSelect={handleDateRangeSelect}
        numberOfMonths={1}
        className="rounded-md border bg-background p-2 mx-auto"
      />
      {draftDatesPayload === null && draftRange?.from && (
        <p className="mt-2 text-xs text-muted-foreground text-center">
          Selecione a data de entrega para concluir o intervalo.
        </p>
      )}
      {(draftRange?.from || startDate || dueDate) && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-2 h-7 w-full text-xs text-muted-foreground"
          onClick={() => setDraftRange(undefined)}
        >
          Limpar seleção
        </Button>
      )}
      <Button
        type="button"
        size="sm"
        className="mt-3 w-full"
        disabled={!canApplyDates || !datesDraftDirty || datesSaving}
        onClick={() => void applyDraftDates()}
      >
        {datesSaving ? 'Salvando...' : 'Atualizar'}
      </Button>
      <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" /> Hora
          </Label>
          <Input type="time" className="h-8 text-xs" {...register('startTime')} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Estimado (min)</Label>
          <Input
            type="number"
            min={0}
            className="h-8 text-xs"
            placeholder="0"
            {...register('estimatedMinutes', { valueAsNumber: true })}
          />
        </div>
      </div>
      {estimatedEndTime && (
        <p className="text-xs text-muted-foreground border-t pt-2 mt-3">
          Término previsto:{' '}
          <span className="font-medium text-foreground">{estimatedEndTime}</span>
        </p>
      )}
    </>
  )

  const toolbar = (
    <div className="flex flex-wrap gap-2">
      <Popover
        modal={false}
        open={isOpen('labels')}
        onOpenChange={(open) => setPanel(open ? 'labels' : null)}
      >
        <PopoverTrigger asChild>
          <ActionChip active={isOpen('labels') || hasLabels}>
            <Tag className="w-3.5 h-3.5 opacity-70" />
            Etiquetas
          </ActionChip>
        </PopoverTrigger>
        <PopoverContent align="start" side="bottom" collisionPadding={16} className="w-64" {...popoverFocusHandlers}>
          {labelsEditor}
        </PopoverContent>
      </Popover>

      <Popover
        modal={false}
        open={isOpen('members')}
        onOpenChange={(open) => setPanel(open ? 'members' : null)}
      >
        <PopoverTrigger asChild>
          <ActionChip active={isOpen('members') || !!assigneeId}>
            <User className="w-3.5 h-3.5 opacity-70" />
            Membros
          </ActionChip>
        </PopoverTrigger>
        <PopoverContent align="start" side="bottom" collisionPadding={16} className="w-72 p-2" {...popoverFocusHandlers}>
          {membersEditor}
        </PopoverContent>
      </Popover>

      <Popover
        modal={false}
        open={isOpen('dates')}
        onOpenChange={(open) => setPanel(open ? 'dates' : null)}
      >
        <PopoverTrigger asChild>
          <ActionChip active={isOpen('dates') || hasDates}>
            <CalendarIcon className="w-3.5 h-3.5 opacity-70" />
            Datas
          </ActionChip>
        </PopoverTrigger>
        <PopoverContent align="start" side="bottom" collisionPadding={16} className="w-auto max-w-[calc(100vw-2rem)] p-3" {...popoverFocusHandlers}>
          {datesEditor}
        </PopoverContent>
      </Popover>

      {milestones.length > 0 && (
        <Popover
          modal={false}
          open={isOpen('milestone')}
          onOpenChange={(open) => setPanel(open ? 'milestone' : null)}
        >
          <PopoverTrigger asChild>
            <ActionChip active={isOpen('milestone') || !!milestoneId}>
              <CheckSquare className="w-3.5 h-3.5 opacity-70" />
              Milestone
            </ActionChip>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 p-2" {...popoverFocusHandlers}>
            <button
              type="button"
              onClick={() => setValue('milestoneId', undefined)}
              className={cn(
                'w-full rounded-md px-2 py-2 text-sm text-left hover:bg-muted',
                !milestoneId && 'bg-muted'
              )}
            >
              Nenhuma
            </button>
            {milestones.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setValue('milestoneId', m.id)}
                className={cn(
                  'w-full rounded-md px-2 py-2 text-sm text-left hover:bg-muted truncate',
                  milestoneId === m.id && 'bg-muted'
                )}
              >
                {m.title}
              </button>
            ))}
          </PopoverContent>
        </Popover>
      )}

      {sprintProjects.length > 0 && (
        <Popover
          modal={false}
          open={isOpen('project')}
          onOpenChange={(open) => setPanel(open ? 'project' : null)}
        >
          <PopoverTrigger asChild>
            <ActionChip active={isOpen('project') || !!selectedProjectId}>
              <Briefcase className="w-3.5 h-3.5 opacity-70" />
              Projeto
            </ActionChip>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 p-2" {...popoverFocusHandlers}>
            {sprintProjects.map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => onProjectChange(project.id)}
                className={cn(
                  'w-full rounded-md px-2 py-2 text-sm text-left hover:bg-muted',
                  selectedProjectId === project.id && 'bg-muted'
                )}
              >
                <span className="font-medium block truncate">{project.name}</span>
                <span className="text-xs text-muted-foreground">{project.client.name}</span>
              </button>
            ))}
          </PopoverContent>
        </Popover>
      )}
    </div>
  )

  const summary = (showSummary || hideToolbar) && (
    <div className={cn('space-y-0', !hideToolbar && 'mt-4 border-t border-border/50 pt-3')}>
      {hideToolbar ? (
        <>
          <SummaryPopoverRow
            open={isSummaryOpen('labels')}
            onOpenChange={(open) => setSummaryPanel(open ? 'labels' : null)}
            title="Estado"
            hasContent={hasLabels}
            emptyHint="Definir prioridade"
            content={labelsEditor}
            contentClassName="w-64"
          >
            <div className="flex flex-wrap gap-1.5 pointer-events-none">
              {priorityMeta && (
                <span
                  className={cn(
                    'text-xs font-semibold px-2.5 py-1 rounded-md min-w-[4.5rem] text-center',
                    priorityMeta.pill
                  )}
                >
                  {priorityMeta.label}
                </span>
              )}
              {(storyPoints ?? 0) > 0 && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-amber-500/20 text-amber-900 dark:text-amber-100">
                  SP {storyPoints}
                </span>
              )}
              {hasBonus && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-800 dark:text-emerald-200">
                  Bônus
                </span>
              )}
            </div>
          </SummaryPopoverRow>

          <SummaryPopoverRow
            open={isSummaryOpen('members')}
            onOpenChange={(open) => setSummaryPanel(open ? 'members' : null)}
            title="Responsáveis"
            hasContent={!!assigneeId}
            emptyHint="Adicionar responsáveis"
            content={membersEditor}
            contentClassName="w-72 p-2"
          >
            <div className="flex items-center gap-2 pointer-events-none">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs bg-primary/10">
                  {(assignee?.name ?? '?').charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium">{assignee?.name ?? 'Membro atribuído'}</span>
            </div>
          </SummaryPopoverRow>

          <SummaryPopoverRow
            open={isSummaryOpen('dates')}
            onOpenChange={(open) => setSummaryPanel(open ? 'dates' : null)}
            title="Datas"
            hasContent={hasDates}
            emptyHint="Adicionar data de início"
            content={datesEditor}
            contentClassName="w-auto max-w-[calc(100vw-2rem)] p-3"
          >
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm pointer-events-none">
              {startDate && (
                <span>
                  <span className="text-muted-foreground">Início: </span>
                  {formatDateLabel(startDate)}
                </span>
              )}
              {dueDate && (
                <span>
                  <span className="text-muted-foreground">Entrega: </span>
                  {formatDateLabel(dueDate)}
                </span>
              )}
              {startTime && (
                <span>
                  <span className="text-muted-foreground">Hora: </span>
                  {startTime}
                </span>
              )}
              {estimatedMinutes != null && estimatedMinutes > 0 && (
                <span>
                  <span className="text-muted-foreground">Estimado: </span>
                  {estimatedMinutes} min
                </span>
              )}
            </div>
          </SummaryPopoverRow>

          {milestone && (
            <SummaryPopoverRow
              open={isSummaryOpen('milestone')}
              onOpenChange={(open) => setSummaryPanel(open ? 'milestone' : null)}
              title="Milestone"
              hasContent
              emptyHint=""
              content={
                <>
                  <button
                    type="button"
                    onClick={() => setValue('milestoneId', undefined)}
                    className={cn(
                      'w-full rounded-md px-2 py-2 text-sm text-left hover:bg-muted',
                      !milestoneId && 'bg-muted'
                    )}
                  >
                    Nenhuma
                  </button>
                  {milestones.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setValue('milestoneId', m.id)}
                      className={cn(
                        'w-full rounded-md px-2 py-2 text-sm text-left hover:bg-muted truncate',
                        milestoneId === m.id && 'bg-muted'
                      )}
                    >
                      {m.title}
                    </button>
                  ))}
                </>
              }
              contentClassName="w-64 p-2"
            >
              <p className="text-sm pointer-events-none">{milestone.title}</p>
            </SummaryPopoverRow>
          )}
        </>
      ) : (
        <>
          <SummaryBlock
            title="Estado"
            onEdit={() => setPanel('labels')}
            hasContent={hasLabels}
            emptyHint="Definir prioridade"
          >
            <div className="flex flex-wrap gap-1.5 pointer-events-none">
              {priorityMeta && (
                <span
                  className={cn(
                    'text-xs font-semibold px-2.5 py-1 rounded-md min-w-[4.5rem] text-center',
                    priorityMeta.pill
                  )}
                >
                  {priorityMeta.label}
                </span>
              )}
              {(storyPoints ?? 0) > 0 && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-amber-500/20 text-amber-900 dark:text-amber-100">
                  SP {storyPoints}
                </span>
              )}
              {hasBonus && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-800 dark:text-emerald-200">
                  Bônus
                </span>
              )}
            </div>
          </SummaryBlock>

          <SummaryBlock
            title="Responsáveis"
            onEdit={() => setPanel('members')}
            hasContent={!!assigneeId}
            emptyHint="Adicionar responsáveis"
          >
            <div className="flex items-center gap-2 pointer-events-none">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs bg-primary/10">
                  {(assignee?.name ?? '?').charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium">
                {assignee?.name ?? 'Membro atribuído'}
              </span>
            </div>
          </SummaryBlock>

          <SummaryBlock
            title="Datas"
            onEdit={() => setPanel('dates')}
            hasContent={hasDates}
            emptyHint="Adicionar data de início"
          >
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm pointer-events-none">
              {startDate && (
                <span>
                  <span className="text-muted-foreground">Início: </span>
                  {formatDateLabel(startDate)}
                </span>
              )}
              {dueDate && (
                <span>
                  <span className="text-muted-foreground">Entrega: </span>
                  {formatDateLabel(dueDate)}
                </span>
              )}
              {startTime && (
                <span>
                  <span className="text-muted-foreground">Hora: </span>
                  {startTime}
                </span>
              )}
              {estimatedMinutes != null && estimatedMinutes > 0 && (
                <span>
                  <span className="text-muted-foreground">Estimado: </span>
                  {estimatedMinutes} min
                </span>
              )}
            </div>
          </SummaryBlock>

          {milestone && (
            <SummaryBlock
              title="Milestone"
              onEdit={() => setPanel('milestone')}
              hasContent
              emptyHint=""
            >
              <p className="text-sm pointer-events-none">{milestone.title}</p>
            </SummaryBlock>
          )}
        </>
      )}
    </div>
  )

  return (
    <div className={className}>
      {!hideToolbar && toolbar}
      {summary}
    </div>
  )
}
