'use client'

import { useCallback, useEffect, useState } from 'react'

export type ScrumTeamMember = {
  id: string
  name: string
}

export type ScrumProjectData = {
  sprints: Array<{
    id: string
    name: string
    status: string
    startDate: string
    endDate: string
    capacity?: number
    tasks: Array<{
      id: string
      status: string
      storyPoints?: number
      assigneeId?: string | null
      completedAt?: string | null
    }>
  }>
  tasks: Array<{
    id: string
    status: string
    storyPoints?: number
    assigneeId?: string | null
    priority?: string
  }>
  teamMembers: ScrumTeamMember[]
  metrics: {
    totalSprints: number
    activeSprints: number
    completedSprints: number
    totalTasks: number
    completedTasks: number
    totalStoryPoints: number
    completedStoryPoints: number
    averageVelocity: number
  }
}

function normalizeTeamMembers(raw: unknown): ScrumTeamMember[] {
  if (!Array.isArray(raw)) return []

  const seen = new Set<string>()
  const members: ScrumTeamMember[] = []

  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue

    const row = entry as {
      id?: string
      userId?: string
      user?: { id?: string; name?: string | null }
    }

    const id = row.user?.id ?? row.userId ?? row.id
    if (!id || seen.has(id)) continue

    seen.add(id)
    members.push({
      id,
      name: row.user?.name?.trim() || 'Membro',
    })
  }

  return members
}

function calculateAverageVelocity(completedSprints: ScrumProjectData['sprints']) {
  if (completedSprints.length === 0) return 0

  const totalVelocity = completedSprints.reduce((sum, sprint) => {
    const sprintPoints = sprint.tasks
      .filter((t) => t.status === 'COMPLETED')
      .reduce((taskSum, t) => taskSum + (t.storyPoints || 0), 0)
    return sum + sprintPoints
  }, 0)

  return Math.round(totalVelocity / completedSprints.length)
}

export function useScrumProjectData(projectId: string) {
  const [data, setData] = useState<ScrumProjectData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true)
      setError(false)

      const [sprintsRes, backlogRes, teamRes] = await Promise.all([
        fetch(`/api/sprints?projectId=${projectId}`),
        fetch(`/api/backlog?projectId=${projectId}`),
        fetch(`/api/projects/${projectId}/team`),
      ])

      const sprints = await sprintsRes.json()
      const backlog = await backlogRes.json()
      const teamMembers = normalizeTeamMembers(await teamRes.json())

      const allTasks = [...sprints.flatMap((s: { tasks: unknown[] }) => s.tasks), ...backlog]

      const metrics = {
        totalSprints: sprints.length,
        activeSprints: sprints.filter((s: { status: string }) => s.status === 'ACTIVE').length,
        completedSprints: sprints.filter((s: { status: string }) => s.status === 'COMPLETED').length,
        totalTasks: allTasks.length,
        completedTasks: allTasks.filter((t: { status: string }) => t.status === 'COMPLETED').length,
        totalStoryPoints: allTasks.reduce(
          (sum: number, t: { storyPoints?: number }) => sum + (t.storyPoints || 0),
          0
        ),
        completedStoryPoints: allTasks
          .filter((t: { status: string }) => t.status === 'COMPLETED')
          .reduce((sum: number, t: { storyPoints?: number }) => sum + (t.storyPoints || 0), 0),
        averageVelocity: calculateAverageVelocity(
          sprints.filter((s: { status: string }) => s.status === 'COMPLETED')
        ),
      }

      setData({ sprints, tasks: allTasks, teamMembers, metrics })
    } catch (err) {
      console.error('Erro ao carregar dados scrum:', err)
      setError(true)
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchDashboardData()
  }, [fetchDashboardData])

  return { data, loading, error, refresh: fetchDashboardData }
}
