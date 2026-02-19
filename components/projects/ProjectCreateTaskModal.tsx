 'use client'
 
 import { CreateTaskModal } from '@/components/scrum/CreateTaskModal'
 
 interface Milestone {
   id: string
   name: string
 }
 
 interface Task {
  id: string
  title: string
  description?: string
  status: 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'COMPLETED'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  storyPoints?: number
  assigneeId?: string
  milestoneId?: string
  dueDate?: string
  startDate?: string
  startTime?: string
  estimatedMinutes?: number
}

interface ProjectCreateTaskModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  milestones: Milestone[]
  onSuccess: () => void
  editingTask?: Task | null
}

export function ProjectCreateTaskModal({
  isOpen,
  onClose,
  projectId,
  milestones,
  onSuccess,
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
      editingTask={editingTask}
    />
  )
}
