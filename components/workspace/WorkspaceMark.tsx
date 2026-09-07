import { Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type WorkspaceMarkProps = {
  className?: string
  size?: 'sm' | 'md'
}

export function WorkspaceMark({ className, size = 'md' }: WorkspaceMarkProps) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground shadow-sm',
        size === 'sm' ? 'h-6 w-6' : 'h-10 w-10',
        className
      )}
    >
      <Building2 className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
    </div>
  )
}

export function WorkspaceMarkIcon({ className }: { className?: string }) {
  return <Building2 className={cn('h-4 w-4 shrink-0 text-muted-foreground', className)} />
}
