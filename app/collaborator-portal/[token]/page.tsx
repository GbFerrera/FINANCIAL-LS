'use client'

import { use, useEffect, useState } from 'react'
import { WeeklySprintView } from '@/components/collaborator/WeeklySprintView'
import { TaskListView } from '@/components/collaborator/TaskListView'
import { ReportTaskModal } from '@/components/collaborator/ReportTaskModal'
import { ContributionHeatmap } from '@/components/dashboard/contribution-heatmap'
import { Button } from '@/components/ui/button'
import NextLink from 'next/link'
import { Target, Calendar, List, User } from 'lucide-react'

interface PageProps {
  params: Promise<{
    token: string
  }>
}

export default function CollaboratorPortalPage({ params }: PageProps) {
  const { token } = use(params)
  const [viewMode, setViewMode] = useState<'weekly' | 'list'>('list')
  const [collaboratorName, setCollaboratorName] = useState<string>('')
  
  useEffect(() => {
    // Buscar informações do colaborador
    const fetchCollaboratorInfo = async () => {
      try {
        const response = await fetch(`/api/collaborator-portal/${token}`)
        if (response.ok) {
          const data = await response.json()
          setCollaboratorName(data.user?.name || '')
        }
      } catch (error) {
        console.error('Erro ao buscar informações do colaborador:', error)
      }
    }
    
    fetchCollaboratorInfo()
  }, [token])

  return (
    <div className="min-h-screen bg-card py-8">
      <div className="container mx-auto px-4 space-y-6">

        {/* Header */}
        <div className="bg-card rounded-lg shadow-sm p-6">

   
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Portal do Colaborador</h1>
              {collaboratorName && (
                <div className="flex items-center gap-2 mt-1 mb-1">
                  <User className="h-4 w-4 text-muted-foreground dark:text-muted-foreground" />
                  <span className="font-medium text-primary">{collaboratorName}</span>
                </div>
              )}
              <p className="text-muted-foreground">
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
                <NextLink href={`/collaborator-portal/${token}/tasks`}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <Calendar className="h-4 w-4" />
                    Período
                  </Button>
                </NextLink>
              </div>
            </div>
          </div>
        </div>

        {/* Produtividade Diária */}
        <ContributionHeatmap 
          token={token}
          title="Minha Produtividade Diária"
          showStats={true}
        />

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
