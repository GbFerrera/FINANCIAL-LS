'use client'

import { use } from 'react'
import { WeeklySprintView } from '@/components/collaborator/WeeklySprintView'
import { TaskListView } from '@/components/collaborator/TaskListView'
import { ReportTaskModal } from '@/components/collaborator/ReportTaskModal'
import { Button } from '@/components/ui/button'
import { Target, Calendar, List } from 'lucide-react'
import { useState } from 'react'

interface PageProps {
  params: Promise<{
    token: string
  }>
}

export default function CollaboratorPortalPage({ params }: PageProps) {
  const { token } = use(params)
  const [viewMode, setViewMode] = useState<'weekly' | 'list'>('list')

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Portal do Colaborador</h1>
              <p className="text-gray-600">
                Organize suas tarefas por sprint e dia da semana
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <ReportTaskModal collaboratorToken={token} />
                <Button
                  variant={viewMode === 'weekly' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('weekly')}
                  className="flex items-center gap-2"
                >
                  <Calendar className="h-4 w-4" />
                  Semanal
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="flex items-center gap-2"
                >
                  <List className="h-4 w-4" />
                  Lista
                </Button>
                <Button
                  onClick={() => window.location.href = `/collaborator-portal/${token}/sprints`}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Target className="h-4 w-4" />
                  Sprints
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        {viewMode === 'weekly' ? (
          <WeeklySprintView token={token} />
        ) : (
          <TaskListView token={token} />
        )}
      </div>
    </div>
  )
}
