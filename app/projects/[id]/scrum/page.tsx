'use client'

import { use, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SprintBoard } from '@/components/scrum/SprintBoard'
import { ScrumReports } from '@/components/scrum/ScrumReports'
import { Kanban, BarChart3 } from 'lucide-react'

interface ProjectScrumPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string; sprint?: string }>
}

export default function ProjectScrumPage({ params, searchParams }: ProjectScrumPageProps) {
  const { id: projectId } = use(params)
  const { tab, sprint: sprintId } = use(searchParams)
  const router = useRouter()
  const pathname = usePathname()

  const activeTab = tab === 'reports' || tab === 'dashboard' ? 'reports' : 'board'

  const onTabChange = useCallback(
    (next: string) => {
      const q = new URLSearchParams()
      q.set('tab', next)
      if (sprintId) q.set('sprint', sprintId)
      router.replace(`${pathname}?${q.toString()}`, { scroll: false })
    },
    [pathname, router, sprintId]
  )

  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
      <TabsList className="mb-6 grid w-full grid-cols-2 lg:w-auto lg:grid-cols-2">
        <TabsTrigger value="board" className="flex items-center gap-2">
          <Kanban className="h-4 w-4" />
          Quadro Scrum
        </TabsTrigger>
        <TabsTrigger value="reports" className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          Relatórios
        </TabsTrigger>
      </TabsList>

      <TabsContent value="board" className="space-y-6">
        <SprintBoard projectId={projectId} sprintId={sprintId} />
      </TabsContent>

      <TabsContent value="reports" className="space-y-6">
        <ScrumReports projectId={projectId} />
      </TabsContent>
    </Tabs>
  )
}
