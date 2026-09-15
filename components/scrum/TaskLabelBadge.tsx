'use client'

import { cn } from '@/lib/utils'
import type { TaskLabelDTO } from '@/lib/task-labels'

export function TaskLabelBadge({
  label,
  className,
}: {
  label: Pick<TaskLabelDTO, 'name' | 'color'>
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center truncate rounded-md px-2 py-0.5 text-[11px] font-medium text-white',
        className
      )}
      style={{ backgroundColor: label.color }}
      title={label.name}
    >
      {label.name}
    </span>
  )
}
