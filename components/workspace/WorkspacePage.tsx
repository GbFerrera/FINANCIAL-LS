import { cn } from '@/lib/utils'

export function WorkspacePage({
  children,
  className,
  size = 'default',
}: {
  children: React.ReactNode
  className?: string
  size?: 'default' | 'narrow'
}) {
  return (
    <div
      className={cn(
        'mx-auto w-full px-5 py-5 md:px-8 md:py-6',
        size === 'narrow' ? 'max-w-4xl' : 'max-w-5xl',
        className
      )}
    >
      {children}
    </div>
  )
}

export function WorkspaceCompactCard({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)]',
        className
      )}
    >
      {children}
    </div>
  )
}
