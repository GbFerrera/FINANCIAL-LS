import { prisma } from '@/lib/prisma'
import { emitUserNotification } from '@/lib/user-notification-server'

export interface NotificationData {
  userId: string
  title: string
  message: string
  type: 'TASK_ASSIGNED' | 'TASK_COMPLETED' | 'PROJECT_UPDATE' | 'MILESTONE_COMPLETED' | 'CLIENT_COMMENT' | 'PAYMENT_RECEIVED' | 'DEADLINE_APPROACHING'
  taskId?: string
  projectId?: string
  href?: string
}

export async function createNotification(data: NotificationData) {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId: data.userId,
        title: data.title,
        message: data.message,
        type: data.type,
        isRead: false,
      },
    })

    emitUserNotification(data.userId, {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      taskId: data.taskId,
      projectId: data.projectId,
      href: data.href,
      createdAt: notification.createdAt.toISOString(),
    })

    return notification
  } catch (error) {
    console.error('Erro ao criar notificação:', error)
    throw error
  }
}

export async function createMultipleNotifications(notifications: NotificationData[]) {
  try {
    const created = []
    for (const notification of notifications) {
      created.push(await createNotification(notification))
    }
    return created
  } catch (error) {
    console.error('Erro ao criar notificações:', error)
    throw error
  }
}

export async function notifyTaskStatusChange(taskId: string, oldStatus: string, newStatus: string, userId?: string) {
  try {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignee: true,
        project: {
          include: {
            team: {
              include: {
                user: true,
              },
            },
          },
        },
        sprint: true,
      },
    })

    if (!task) return

    const notifications: NotificationData[] = []

    if (task.assignee && task.assignee.id !== userId) {
      notifications.push({
        userId: task.assignee.id,
        title: 'Status da tarefa alterado',
        message: `A tarefa "${task.title}" mudou de "${getStatusLabel(oldStatus)}" para "${getStatusLabel(newStatus)}"`,
        type: newStatus === 'COMPLETED' ? 'TASK_COMPLETED' : 'PROJECT_UPDATE',
        taskId: task.id,
        projectId: task.projectId,
      })
    }

    const teamMembers = task.project.team
      .filter((member) => member.userId !== userId && member.userId !== task.assigneeId)
      .map((member) => member.user)

    for (const member of teamMembers) {
      notifications.push({
        userId: member.id,
        title: 'Atualização no projeto',
        message: `A tarefa "${task.title}" foi atualizada para "${getStatusLabel(newStatus)}"${task.sprint ? ` na sprint "${task.sprint.name}"` : ''}`,
        type: 'PROJECT_UPDATE',
        taskId: task.id,
        projectId: task.projectId,
      })
    }

    if (notifications.length > 0) {
      await createMultipleNotifications(notifications)
    }
  } catch (error) {
    console.error('Erro ao enviar notificações de mudança de status:', error)
  }
}

export async function notifyTaskAssignment(taskId: string, assigneeId: string, assignedBy?: string) {
  try {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: true,
        sprint: true,
      },
    })

    if (!task || assigneeId === assignedBy) return

    await createNotification({
      userId: assigneeId,
      title: 'Nova tarefa atribuída',
      message: `Você foi atribuído à tarefa "${task.title}"${task.sprint ? ` na sprint "${task.sprint.name}"` : ''}`,
      type: 'TASK_ASSIGNED',
      taskId: task.id,
      projectId: task.projectId,
    })
  } catch (error) {
    console.error('Erro ao enviar notificação de atribuição:', error)
  }
}

export async function notifyTaskComment(
  taskId: string,
  authorId: string,
  authorName: string,
  content: string
) {
  try {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        title: true,
        projectId: true,
        assigneeId: true,
      },
    })

    if (!task?.assigneeId || task.assigneeId === authorId) return

    const preview = content.length > 140 ? `${content.slice(0, 137)}...` : content

    await createNotification({
      userId: task.assigneeId,
      title: 'Novo comentário na tarefa',
      message: `${authorName} comentou em "${task.title}": ${preview}`,
      type: 'PROJECT_UPDATE',
      taskId: task.id,
      projectId: task.projectId,
    })
  } catch (error) {
    console.error('Erro ao enviar notificação de comentário:', error)
  }
}

export async function notifySprintStatusChange(sprintId: string, oldStatus: string, newStatus: string) {
  try {
    const sprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
      include: {
        project: {
          include: {
            team: {
              include: {
                user: true,
              },
            },
          },
        },
        tasks: {
          include: {
            assignee: true,
          },
        },
      },
    })

    if (!sprint) return

    const notifications: NotificationData[] = []
    const teamMembers = sprint.project.team.map((member) => member.user)

    for (const member of teamMembers) {
      let message = ''
      let type: NotificationData['type'] = 'PROJECT_UPDATE'

      switch (newStatus) {
        case 'ACTIVE':
          message = `A sprint "${sprint.name}" foi iniciada!`
          break
        case 'COMPLETED':
          message = `A sprint "${sprint.name}" foi concluída!`
          type = 'MILESTONE_COMPLETED'
          break
        case 'CANCELLED':
          message = `A sprint "${sprint.name}" foi cancelada.`
          break
        default:
          message = `A sprint "${sprint.name}" teve seu status alterado para "${getSprintStatusLabel(newStatus)}"`
      }

      notifications.push({
        userId: member.id,
        title: 'Atualização da Sprint',
        message,
        type,
        projectId: sprint.projectId,
      })
    }

    if (notifications.length > 0) {
      await createMultipleNotifications(notifications)
    }
  } catch (error) {
    console.error('Erro ao enviar notificações de mudança de sprint:', error)
  }
}

export async function notifyDeadlineApproaching(taskId: string) {
  try {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignee: true,
        project: {
          include: {
            team: {
              include: {
                user: true,
              },
            },
          },
        },
      },
    })

    if (!task || !task.dueDate) return

    const notifications: NotificationData[] = []

    if (task.assignee) {
      notifications.push({
        userId: task.assignee.id,
        title: 'Prazo se aproximando',
        message: `A tarefa "${task.title}" vence em breve (${task.dueDate.toLocaleDateString('pt-BR')})`,
        type: 'DEADLINE_APPROACHING',
        taskId: task.id,
        projectId: task.projectId,
      })
    }

    const projectManagers = task.project.team
      .filter((member) => member.role === 'MANAGER')
      .map((member) => member.user)

    for (const manager of projectManagers) {
      if (manager.id !== task.assigneeId) {
        notifications.push({
          userId: manager.id,
          title: 'Prazo se aproximando',
          message: `A tarefa "${task.title}" vence em breve e está atribuída a ${task.assignee?.name || 'ninguém'}`,
          type: 'DEADLINE_APPROACHING',
          taskId: task.id,
          projectId: task.projectId,
        })
      }
    }

    if (notifications.length > 0) {
      await createMultipleNotifications(notifications)
    }
  } catch (error) {
    console.error('Erro ao enviar notificações de prazo:', error)
  }
}

function getStatusLabel(status: string): string {
  const labels: { [key: string]: string } = {
    TODO: 'A Fazer',
    IN_PROGRESS: 'Em Andamento',
    IN_REVIEW: 'Em Teste',
    COMPLETED: 'Concluído',
  }
  return labels[status] || status
}

function getSprintStatusLabel(status: string): string {
  const labels: { [key: string]: string } = {
    PLANNING: 'Planejamento',
    ACTIVE: 'Ativa',
    COMPLETED: 'Concluída',
    CANCELLED: 'Cancelada',
  }
  return labels[status] || status
}
