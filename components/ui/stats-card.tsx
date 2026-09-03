import { LucideIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

interface StatsCardProps {
  title: string
  value: string | number
  change?: {
    value: string
    type: 'increase' | 'decrease' | 'neutral'
  }
  /** @deprecated Ícones coloridos removidos — mantido só por compatibilidade */
  icon?: LucideIcon
  /** @deprecated Cores de destaque removidas — mantido só por compatibilidade */
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple'
  description?: string
}

export function StatsCard({ title, value, change, description }: StatsCardProps) {
  const formattedValue =
    typeof value === 'number' ? value.toLocaleString('pt-BR') : value

  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-foreground">
          {formattedValue}
        </p>
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
