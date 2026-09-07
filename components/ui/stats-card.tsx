import { LucideIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface StatsCardProps {
  title: string
  value: string | number | ReactNode
  change?: {
    value: string
    type: 'increase' | 'decrease' | 'neutral'
  }
  /** @deprecated Ícones coloridos removidos — mantido só por compatibilidade */
  icon?: LucideIcon
  /** @deprecated Cores de destaque removidas — mantido só por compatibilidade */
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple'
  description?: string
  className?: string
}

export function StatsCard({ title, value, change, description, className }: StatsCardProps) {
  const formattedValue =
    typeof value === 'number' ? value.toLocaleString('pt-BR') : value

  return (
    <Card className={cn(className)}>
      <CardContent className="min-w-0 pt-4 pb-4">
        <p className="text-sm text-muted-foreground">{title}</p>
        <div className="mt-2 min-w-0">
          {typeof value === "string" || typeof value === "number" ? (
            <p className="text-2xl font-semibold tracking-tight tabular-nums text-foreground">
              {formattedValue}
            </p>
          ) : (
            value
          )}
        </div>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
        {change && (
          <p className="mt-1 text-xs text-muted-foreground">{change.value}</p>
        )}
      </CardContent>
    </Card>
  )
}
