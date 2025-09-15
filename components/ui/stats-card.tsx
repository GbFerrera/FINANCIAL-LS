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
}

const colorClasses = {
  blue: {
    bg: 'bg-blue-500',
    text: 'text-blue-600',
    lightBg: 'bg-blue-50'
  },
  green: {
    bg: 'bg-green-500',
    text: 'text-green-600',
    lightBg: 'bg-green-50'
  },
  yellow: {
    bg: 'bg-yellow-500',
    text: 'text-yellow-600',
    lightBg: 'bg-yellow-50'
  },
  red: {
    bg: 'bg-red-500',
    text: 'text-red-600',
    lightBg: 'bg-red-50'
  },
  purple: {
    bg: 'bg-purple-500',
    text: 'text-purple-600',
    lightBg: 'bg-purple-50'
  }
}

export function StatsCard({ title, value, change, icon: Icon, color = 'blue' }: StatsCardProps) {
  const colors = colorClasses[color]
  
  return (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div className={`${colors.lightBg} rounded-md p-3`}>
              <Icon className={`h-6 w-6 ${colors.text}`} />
            </div>
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 truncate">{title}</dt>
              <dd className="flex items-baseline">
                <div className="text-2xl font-semibold text-gray-900">
                  {typeof value === 'number' ? value.toLocaleString('pt-BR') : value}
                </div>
                {change && (
                  <div className={`ml-2 flex items-baseline text-sm font-semibold ${
                    change.type === 'increase' 
                      ? 'text-green-600' 
                      : change.type === 'decrease' 
                      ? 'text-red-600' 
                      : 'text-gray-600'
                  }`}>
                    {change.type === 'increase' && '↗'}
                    {change.type === 'decrease' && '↘'}
                    {change.value}
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