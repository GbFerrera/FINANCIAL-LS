'use client'

import { useEffect, useLayoutEffect, useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Menu, LogOut, Search, Bell, PanelLeft } from 'lucide-react'
import { WorkspaceSidebar } from './WorkspaceSidebar'
import { ModeToggle } from '@/components/mode-toggle'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { WorkspaceDTO } from '@/lib/workspace-utils'

type WorkspaceShellProps = {
  workspace: WorkspaceDTO
  children: React.ReactNode
}

export function WorkspaceShell({ workspace, children }: WorkspaceShellProps) {
  const [workspaces, setWorkspaces] = useState<WorkspaceDTO[]>([workspace])
  const [mobileOpen, setMobileOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [sidebarHidden, setSidebarHidden] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const { data: session } = useSession()
  const router = useRouter()

  useLayoutEffect(() => {
    const savedCollapsed = localStorage.getItem('workspaceSidebarCollapsed')
    const savedHidden = localStorage.getItem('workspaceSidebarHidden')
    if (savedCollapsed !== null) setSidebarCollapsed(JSON.parse(savedCollapsed))
    if (savedHidden !== null) setSidebarHidden(JSON.parse(savedHidden))
    setHydrated(true)
  }, [])

  const toggleSidebarCollapsed = () => {
    const next = !sidebarCollapsed
    setSidebarCollapsed(next)
    setSidebarHidden(false)
    localStorage.setItem('workspaceSidebarCollapsed', JSON.stringify(next))
    localStorage.setItem('workspaceSidebarHidden', JSON.stringify(false))
  }

  const toggleSidebarHidden = () => {
    const next = !sidebarHidden
    setSidebarHidden(next)
    localStorage.setItem('workspaceSidebarHidden', JSON.stringify(next))
  }

  useEffect(() => {
    fetch('/api/workspaces')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) setWorkspaces(data)
      })
      .catch(() => {})
  }, [])

  const handleSignOut = async () => {
    await signOut({ redirect: false })
    router.push('/auth/signin')
  }

  return (
    <TooltipProvider>
    <div className="flex h-screen overflow-hidden bg-card">
      <div
        className={cn(
          'hidden shrink-0 overflow-hidden md:flex',
          hydrated ? 'transition-all duration-300' : '',
          sidebarHidden ? 'w-0' : sidebarCollapsed ? 'w-14' : 'w-[252px]'
        )}
      >
        {!sidebarHidden && (
          <WorkspaceSidebar
            workspace={workspace}
            workspaces={workspaces}
            collapsed={sidebarCollapsed}
            onToggleCollapse={toggleSidebarCollapsed}
          />
        )}
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="relative z-10 h-full">
            <WorkspaceSidebar workspace={workspace} workspaces={workspaces} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 items-center justify-between border-b border-border bg-card px-4">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              className="rounded-md p-2 hover:bg-muted md:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="hidden rounded-md p-2 text-muted-foreground hover:bg-muted md:inline-flex"
                  onClick={toggleSidebarHidden}
                  aria-label={sidebarHidden ? 'Abrir sidebar' : 'Fechar sidebar'}
                >
                  <PanelLeft className={cn('h-4 w-4', sidebarHidden && 'opacity-60')} />
                </button>
              </TooltipTrigger>
              <TooltipContent>{sidebarHidden ? 'Abrir sidebar' : 'Fechar sidebar'}</TooltipContent>
            </Tooltip>
            <span className="truncate text-sm font-medium text-foreground">{workspace.name}</span>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" className="rounded-md p-2 text-muted-foreground hover:bg-muted" aria-label="Buscar">
              <Search className="h-4 w-4" />
            </button>
            <Link href="/notifications" className="rounded-md p-2 text-muted-foreground hover:bg-muted">
              <Bell className="h-4 w-4" />
            </Link>
            <ModeToggle />
            <Avatar className="h-8 w-8">
              <AvatarImage src={session?.user?.image || ''} />
              <AvatarFallback>{session?.user?.name?.[0] || 'U'}</AvatarFallback>
            </Avatar>
            <button type="button" onClick={handleSignOut} className="rounded-md p-2 text-muted-foreground hover:bg-muted">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto bg-background">
          <div className="min-h-full">{children}</div>
        </main>
      </div>
    </div>
    </TooltipProvider>
  )
}
