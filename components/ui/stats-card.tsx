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
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div className={`${colors.lightBg} rounded-md p-3`}>
              <Icon className={`h-6 w-6 ${colors.text}`} />
            </div>
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-muted-foreground truncate">{title}</dt>
              <dd className="flex items-baseline">
                <div className="text-2xl font-semibold text-card-foreground">
                  {typeof value === 'number' ? value.toLocaleString('pt-BR') : value}
                </div>
                {change && (
                  <div className={`ml-2 flex items-baseline text-sm font-semibold ${
                    change.type === 'increase' 
                      ? 'text-green-600 dark:text-green-400' 
                      : change.type === 'decrease' 
                      ? 'text-red-600 dark:text-red-400' 
                      : 'text-muted-foreground'
                  }`}>
                    {change.type === 'increase' && '↗'}
                    {change.type === 'decrease' && '↘'}
                    {change.value}
                  </div>
                )}
                {description && !change && (
                  <div className="ml-2 flex items-baseline text-xs font-medium text-muted-foreground">
                    {description}
                  </div>
                )}
              </dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}