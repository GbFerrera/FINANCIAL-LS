type SprintArchiveCandidate = {
  status: string
  endDate: string | Date
  isArchived?: boolean
}

export function isSprintArchivable(sprint: SprintArchiveCandidate): boolean {
  if (sprint.isArchived) return false

  const status = String(sprint.status).toUpperCase()

  if (status === 'COMPLETED' || status === 'CANCELLED' || status === 'PLANNING') {
    return true
  }

  if (status === 'ACTIVE') {
    const end = new Date(sprint.endDate)
    end.setHours(23, 59, 59, 999)
    return end.getTime() < Date.now()
  }

  return false
}

export function sprintArchiveBlockedReason(sprint: SprintArchiveCandidate): string | null {
  if (sprint.isArchived) return 'Sprint já arquivada'
  if (isSprintArchivable(sprint)) return null

  if (String(sprint.status).toUpperCase() === 'ACTIVE') {
    return 'Encerre ou conclua a sprint antes de arquivar'
  }

  return 'Esta sprint não pode ser arquivada'
}
