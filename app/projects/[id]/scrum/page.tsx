'use client'

import { Suspense } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SprintBoard } from '@/components/scrum/SprintBoard'
import { ScrumDashboard } from '@/components/scrum/ScrumDashboard'
import { BurndownChart } from '@/components/scrum/BurndownChart'
import { 
  LayoutDashboard, 
  Kanban, 
  BarChart3
} from 'lucide-react'

interface ProjectScrumPageProps {
  params: { id: string }
  searchParams: { tab?: string; sprint?: string }
}

export default function ProjectScrumPage({ params, searchParams }: ProjectScrumPageProps) {
  const projectId = params.id
  const activeTab = searchParams.tab || 'board'
  const sprintId = searchParams.sprint

  return (
      <Tabs value={activeTab} className="w-full">
      <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:grid-cols-3 mb-6">
        <TabsTrigger value="board" className="flex items-center gap-2">
          <Kanban className="w-4 h-4" />
          Quadro Scrum
        </TabsTrigger>
        <TabsTrigger value="dashboard" className="flex items-center gap-2">
          <LayoutDashboard className="w-4 h-4" />
          Dashboard
        </TabsTrigger>
        <TabsTrigger value="reports" className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4" />
          Relatórios
        </TabsTrigger>
      </TabsList>

      <TabsContent value="board" className="space-y-6">
        <SprintBoard projectId={projectId} sprintId={sprintId} />
      </TabsContent>

      <TabsContent value="dashboard" className="space-y-6">
        <ScrumDashboard projectId={projectId} />
      </TabsContent>

      <TabsContent value="reports" className="space-y-6">
        <ScrumDashboard projectId={projectId} />
      </TabsContent>
      </Tabs>
  )
}
