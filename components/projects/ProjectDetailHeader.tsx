'use client'

import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  ArrowLeft,
  Calendar,
  DollarSign,
  Edit,
  MoreHorizontal,
  PenLine,
  User,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

const PROJECT_STATUS: Record<string, { label: string; className: string }> = {
  IN_PROGRESS: {
    label: 'Em andamento',
    className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/25',
  },
  COMPLETED: {
    label: 'Concluído',
    className: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/25',
  },
  PLANNING: {
    label: 'Planejamento',
    className: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/25',
  },
  ON_HOLD: {
    label: 'Pausado',
    className: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/25',
  },
  CANCELLED: {
    label: 'Cancelado',
    className: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/25',
  },
}

function ProgressRing({ value, size = 88 }: { value: number; size?: number }) {
  const stroke = 7
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-muted/50"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="text-primary transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold tabular-nums text-foreground">{value}%</span>
        <span className="text-[10px] text-muted-foreground">progresso</span>
      </div>
    </div>
  )
}

type ProjectDetailHeaderProps = {
  name: string
  description?: string | null
  status: string
  startDate: string
  endDate?: string | null
  budget?: number
  clientName: string
  progress: number
  isAdmin?: boolean
  onBack: () => void
  onCanvas: () => void
  onEdit?: () => void
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export function ProjectDetailHeader({
  name,
  description,
  status,
  startDate,
  endDate,
  budget,
  clientName,
  progress,
  isAdmin,
  onBack,
  onCanvas,
  onEdit,
}: ProjectDetailHeaderProps) {
  const statusMeta = PROJECT_STATUS[status] ?? {
    label: status,
    className: 'bg-muted text-muted-foreground border-border',
  }

  const meta = [
    { icon: User, label: 'Cliente', value: clientName },
    {
      icon: Calendar,
      label: 'Início',
      value: format(parseISO(startDate), 'dd/MM/yyyy', { locale: ptBR }),
    },
    ...(endDate
      ? [
          {
            icon: Calendar,
            label: 'Fim',
            value: format(parseISO(endDate), 'dd/MM/yyyy', { locale: ptBR }),
          },
        ]
      : []),
    ...(isAdmin && budget != null
      ? [{ icon: DollarSign, label: 'Orçamento', value: formatCurrency(budget) }]
      : []),
  ]

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      <div className="border-b border-border/80 bg-gradient-to-br from-muted/50 via-card to-card px-5 py-4 sm:px-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Voltar aos Projetos
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm" aria-label="Mais ações">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={onCanvas}>
                <PenLine className="h-4 w-4" />
                Canvas
              </DropdownMenuItem>
              {isAdmin && onEdit && (
                <DropdownMenuItem onClick={onEdit}>
                  <Edit className="h-4 w-4" />
                  Editar projeto
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
                  statusMeta.className
                )}
              >
                {statusMeta.label}
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{name}</h1>
            {description && (
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">{description}</p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {meta.map((item) => {
                const Icon = item.icon
                return (
                  <div
                    key={item.label}
                    className="inline-flex items-center gap-2 rounded-lg border border-border/80 bg-background/80 px-3 py-2 text-xs shadow-sm"
                  >
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-medium text-foreground">{item.value}</span>
                  </div>
                )
              })}
            </div>
          </div>
          <ProgressRing value={progress} />
        </div>
      </div>
    </div>
  )
}
