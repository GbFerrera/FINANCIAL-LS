 'use client'
 
 import { CreateTaskModal } from '@/components/scrum/CreateTaskModal'
 
 interface Milestone {
   id: string
   name: string
 }
 
 interface Task {
  id: string
  title: string
  description?: string | null
  status: 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'COMPLETED'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  storyPoints?: number | null
  assigneeId?: string | null
  milestoneId?: string | null
  dueDate?: string | null
  startDate?: string | null
  startTime?: string | null
  estimatedMinutes?: number | null
}

interface ProjectCreateTaskModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  milestones: Milestone[]
  onSuccess: () => void
  onEditingTaskSync?: (patch: Partial<Task>) => void
  editingTask?: Task | null
}

export function ProjectCreateTaskModal({
  isOpen,
  onClose,
  projectId,
  milestones,
  onSuccess,
  onEditingTaskSync,
  editingTask,
}: ProjectCreateTaskModalProps) {
  const mappedMilestones = (milestones || []).map((m) => ({
    id: m.id,
    title: m.name,
  }))

  return (
    <CreateTaskModal
      isOpen={isOpen}
      onClose={onClose}
      projectId={projectId}
      sprintId={null}
      milestones={mappedMilestones}
      onSuccess={onSuccess}
      onEditingTaskSync={onEditingTaskSync}
      editingTask={editingTask}
    />
  )
}
