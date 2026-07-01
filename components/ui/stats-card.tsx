import { LucideIcon } from "lucide-react"

interface StatsCardProps {
  title: string
  value: string | number
  change?: {
    value: string
    type: 'increase' | 'decrease' | 'neutral'
  }
  icon: LucideIcon
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple'
  description?: string
}

const colorClasses = {
  blue: {
    bg: 'bg-blue-500',
    text: 'text-blue-600 dark:text-blue-400',
    lightBg: 'bg-blue-50 dark:bg-blue-900/20'
  },
  green: {
    bg: 'bg-green-500',
    text: 'text-green-600 dark:text-green-400',
    lightBg: 'bg-green-50 dark:bg-green-900/20'
  },
  yellow: {
    bg: 'bg-yellow-500',
    text: 'text-yellow-600 dark:text-yellow-400',
    lightBg: 'bg-yellow-50 dark:bg-yellow-900/20'
  },
  red: {
    bg: 'bg-red-500',
    text: 'text-red-600 dark:text-red-400',
    lightBg: 'bg-red-50 dark:bg-red-900/20'
  },
  purple: {
    bg: 'bg-purple-500',
    text: 'text-purple-600 dark:text-purple-400',
    lightBg: 'bg-purple-50 dark:bg-purple-900/20'
  }
}

export function StatsCard({ title, value, change, icon: Icon, color = 'blue', description }: StatsCardProps) {
  const colors = colorClasses[color]
  
  return (
    <div className="bg-card overflow-hidden shadow rounded-lg border border-border">
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <dt className="text-lg font-bold text-card-foreground">{title}</dt>
            {description && (
              <dd className="mt-1 text-xs text-muted-foreground whitespace-pre-line">
                {description}
              </dd>
            )}
          </div>
          <div className="ml-4 flex items-center">
            <div className={`text-right`}>
              <div className="text-2xl font-bold text-card-foreground">
                {typeof value === 'number' ? value.toLocaleString('pt-BR') : value}
              </div>
            </div>
            <div className={`ml-3 ${colors.lightBg} rounded-md p-2`}>
              <Icon className={`h-5 w-5 ${colors.text}`} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}