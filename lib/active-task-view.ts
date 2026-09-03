'use client'

let activeTaskViewId: string | null = null

export function setActiveTaskViewId(taskId: string | null) {
  activeTaskViewId = taskId
}

export function getActiveTaskViewId() {
  return activeTaskViewId
}

export const OPEN_TASK_EVENT = 'pm:open-task'

export function dispatchOpenTask(taskId: string, projectId?: string) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent(OPEN_TASK_EVENT, {
      detail: { taskId, projectId },
    })
  )
}
