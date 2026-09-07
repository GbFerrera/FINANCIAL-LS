"use client"

import { parseISO } from "date-fns"
import { Clock } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface Activity {
  id: string
  type: "task_completed" | "payment_received" | "comment_added" | "project_updated" | "milestone_reached"
  title: string
  description: string
  user: string
  timestamp: string
  metadata?: {
    projectName?: string
    amount?: number
    taskName?: string
  }
}

interface RecentActivityProps {
  activities: Activity[]
}

const activityLabels: Record<Activity["type"], string> = {
  task_completed: "Tarefa",
  payment_received: "Pagamento",
  comment_added: "Comentário",
  project_updated: "Projeto",
  milestone_reached: "Marco",
}

const VISIBLE_LIMIT = 6

export function RecentActivity({ activities }: RecentActivityProps) {
  const formatTimeAgo = (timestamp: string) => {
    const now = new Date()
    const activityTime = parseISO(timestamp)
    const diffInMinutes = Math.floor((now.getTime() - activityTime.getTime()) / (1000 * 60))

    if (diffInMinutes < 1) return "Agora"
    if (diffInMinutes < 60) return `${diffInMinutes}m`
    const diffInHours = Math.floor(diffInMinutes / 60)
    if (diffInHours < 24) return `${diffInHours}h`
    const diffInDays = Math.floor(diffInHours / 24)
    if (diffInDays < 7) return `${diffInDays}d`
    return activityTime.toLocaleDateString("pt-BR")
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }

  const sortedActivities = [...activities]
    .sort((a, b) => parseISO(b.timestamp).getTime() - parseISO(a.timestamp).getTime())
    .slice(0, VISIBLE_LIMIT)

  const hasMore = activities.length > VISIBLE_LIMIT

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-base font-semibold">Atividades Recentes</CardTitle>
        <button type="button" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
          Ver todas
        </button>
      </CardHeader>

      <CardContent className="space-y-3">
        {sortedActivities.length === 0 ? (
          <div className="py-10 text-center">
            <Clock className="mx-auto h-8 w-8 text-muted-foreground/60" />
            <p className="mt-2 text-sm text-muted-foreground">Nenhuma atividade recente</p>
          </div>
        ) : (
          sortedActivities.map((activity) => (
            <div
              key={activity.id}
              className="rounded-lg border border-border p-3 transition-colors hover:bg-muted/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="font-normal">
                      {activityLabels[activity.type]}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{formatTimeAgo(activity.timestamp)}</span>
                  </div>
                  <p className="text-sm font-medium text-foreground">{activity.title}</p>
                  <p className="line-clamp-2 text-sm text-muted-foreground">{activity.description}</p>
                  {(activity.metadata?.projectName || activity.metadata?.amount) && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs text-muted-foreground">
                      {activity.metadata.projectName && <span>{activity.metadata.projectName}</span>}
                      {activity.metadata.amount != null && (
                        <span className="font-medium tabular-nums text-foreground">
                          {formatCurrency(activity.metadata.amount)}
                        </span>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">{activity.user}</p>
                </div>
              </div>
            </div>
          ))
        )}

        {sortedActivities.length > 0 && (
          <button
            type="button"
            className="w-full rounded-md border border-border bg-background py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            {hasMore ? `Ver mais (${activities.length - VISIBLE_LIMIT})` : "Ver todas as atividades"}
          </button>
        )}
      </CardContent>
    </Card>
  )
}
