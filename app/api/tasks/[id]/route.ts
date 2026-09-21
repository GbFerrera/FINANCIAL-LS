import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { notifyTaskStatusChange, notifyTaskAssignment } from '@/lib/notifications';
import { broadcastTaskEvent, resolveTaskUpdateAction, serializeTaskForSocket, shouldBroadcastTaskPatch } from '@/lib/task-socket-server';
import { syncTaskLinkedProjects } from '@/lib/task-projects';
import { extractTaskLabels, syncTaskLabels, taskLabelsInclude } from '@/lib/task-labels';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const taskId = params.id;
    const updates = await request.json();

    // Verificar se a tarefa existe e se o usuário tem permissão
    const existingTask = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: {
          include: {
            team: true
          }
        }
      }
    });

    if (!existingTask) {
      return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 });
    }

    // Verificar permissões (admin, owner do projeto, ou membro do projeto)
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    });

    const isAdmin = user?.role === 'ADMIN';
    const isProjectMember = existingTask.project.team.some(
      (member: any) => member.userId === session.user.id
    );

    if (!isAdmin && !isProjectMember) {
      return NextResponse.json({ error: 'Sem permissão para editar esta tarefa' }, { status: 403 });
    }

    // Guardar valores antigos para notificações
    const oldStatus = existingTask.status
    const oldAssigneeId = existingTask.assigneeId
    const oldTitle = existingTask.title
    const oldPriority = existingTask.priority

    const taskUpdateInclude = {
      assignee: {
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true
        }
      },
      project: {
        select: {
          id: true,
          name: true
        }
      },
      sprint: {
        select: {
          id: true,
          name: true,
          status: true
        }
      },
      milestone: {
        select: {
          id: true,
          name: true,
          status: true
        }
      }
    } as const

    // Regras de completedAt conforme mudança de status
    const statusUpdate = updates.status as string | undefined
    const setCompletedAt =
      statusUpdate === 'COMPLETED' && !existingTask.completedAt
        ? new Date()
        : statusUpdate && statusUpdate !== 'COMPLETED'
          ? null
          : undefined

    if (!isAdmin && statusUpdate === 'COMPLETED' && existingTask.status !== 'COMPLETED') {
      return NextResponse.json(
        { error: 'Apenas administradores podem marcar tarefas como concluídas' },
        { status: 403 }
      );
    }

    if (updates.isArchived === true && existingTask.status !== 'COMPLETED') {
      return NextResponse.json({ error: 'Apenas tarefas concluídas podem ser arquivadas' }, { status: 400 });
    }

    const setArchivedAt =
      updates.isArchived === true
        ? new Date()
        : updates.isArchived === false
          ? null
          : undefined

    const linkedProjectIds = Array.isArray(updates.linkedProjectIds)
      ? (updates.linkedProjectIds as string[]).filter(Boolean)
      : undefined

    const labelIds = Array.isArray(updates.labelIds)
      ? (updates.labelIds as string[]).filter(Boolean)
      : undefined

    const nextProjectId =
      typeof updates.projectId === 'string' && updates.projectId.trim()
        ? updates.projectId.trim()
        : undefined

    if (nextProjectId && nextProjectId !== existingTask.projectId) {
      const targetProject = await prisma.project.findUnique({
        where: { id: nextProjectId },
        select: { id: true },
      })
      if (!targetProject) {
        return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 })
      }
    }

    const projectChanged =
      !!nextProjectId && nextProjectId !== existingTask.projectId
    const primaryProjectId = nextProjectId || existingTask.projectId

    const taskUpdateData = {
      ...(updates.title !== undefined && { title: updates.title }),
      ...(updates.description !== undefined && { description: updates.description }),
      ...(updates.status && { status: updates.status }),
      ...(updates.priority !== undefined && { priority: updates.priority }),
      ...(updates.isArchived !== undefined && { isArchived: !!updates.isArchived }),
      ...(updates.assigneeId !== undefined && { assigneeId: updates.assigneeId }),
      ...(updates.dueDate !== undefined && {
        dueDate: updates.dueDate ? new Date(updates.dueDate) : null,
      }),
      ...(updates.startDate !== undefined && {
        startDate: updates.startDate ? new Date(updates.startDate) : null,
      }),
      ...(updates.startTime !== undefined && { startTime: updates.startTime }),
      ...(updates.estimatedMinutes !== undefined && { estimatedMinutes: updates.estimatedMinutes }),
      ...(updates.storyPoints !== undefined && { storyPoints: updates.storyPoints }),
      ...(updates.hasBonus !== undefined ? ({ hasBonus: !!updates.hasBonus } as any) : {}),
      ...(setCompletedAt !== undefined ? { completedAt: setCompletedAt as Date | null } : {}),
      ...(setArchivedAt !== undefined ? { archivedAt: setArchivedAt as Date | null } : {}),
      ...(updates.sprintId !== undefined && updates.sprintId !== null ? { sprintId: updates.sprintId } : {}),
      ...(projectChanged ? { sprintId: null, kanbanColumnId: null } : {}),
      ...(nextProjectId ? { projectId: nextProjectId } : {}),
      ...(updates.order !== undefined && { order: updates.order }),
      updatedAt: new Date(),
    }

    const extendedInclude = {
      ...taskUpdateInclude,
      linkedProjects: {
        include: {
          project: { select: { id: true, name: true } },
        },
      },
      ...taskLabelsInclude,
    } as const

    let updatedTask
    try {
      updatedTask = await prisma.$transaction(async (tx) => {
        const task = await tx.task.update({
          where: { id: taskId },
          data: taskUpdateData,
          include: extendedInclude,
        })

        if (linkedProjectIds !== undefined || projectChanged) {
          try {
            let links = linkedProjectIds
            if (links === undefined && projectChanged) {
              const existingLinks = await tx.taskProject.findMany({
                where: { taskId },
                select: { projectId: true },
              })
              links = existingLinks
                .map((row) => row.projectId)
                .filter(
                  (id) => id !== existingTask.projectId && id !== primaryProjectId
                )
            }
            await syncTaskLinkedProjects(tx, taskId, primaryProjectId, links)
          } catch (e) {
            if (e instanceof Error && e.message === 'INVALID_PROJECTS') {
              throw new Error('INVALID_PROJECTS')
            }
            throw e
          }
        }

        if (labelIds !== undefined) {
          try {
            await syncTaskLabels(tx, taskId, labelIds, session.user.id)
          } catch (e) {
            if (e instanceof Error && e.message === 'INVALID_LABELS') {
              throw new Error('INVALID_LABELS')
            }
            throw e
          }
        }

        if (updates.status && updates.status !== oldStatus) {
          await tx.taskStatusHistory.create({
            data: {
              taskId,
              fromStatus: oldStatus,
              toStatus: updates.status,
              changedById: session.user.id,
            },
          })
        }

        if (linkedProjectIds !== undefined || labelIds !== undefined || projectChanged) {
          return tx.task.findUnique({
            where: { id: taskId },
            include: extendedInclude,
          })
        }

        return task
      })
    } catch (e) {
      if (e instanceof Error && e.message === 'INVALID_PROJECTS') {
        return NextResponse.json({ error: 'Projetos vinculados inválidos' }, { status: 400 })
      }
      if (e instanceof Error && e.message === 'INVALID_LABELS') {
        return NextResponse.json({ error: 'Etiquetas inválidas' }, { status: 400 })
      }

      updatedTask = await prisma.task.update({
        where: { id: taskId },
        data: taskUpdateData,
        include: taskUpdateInclude,
      })

      if (updates.status && updates.status !== oldStatus) {
        await prisma.taskStatusHistory.create({
          data: {
            taskId,
            fromStatus: oldStatus,
            toStatus: updates.status,
            changedById: session.user.id,
          },
        }).catch(console.error)
      }
    }

    if (!updatedTask) {
      return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 })
    }

    // Enviar notificações assíncronas
    if (updates.status && updates.status !== oldStatus) {
      notifyTaskStatusChange(taskId, oldStatus, updates.status, session.user.id).catch(console.error)
    }

    if (updates.assigneeId !== undefined && updates.assigneeId !== oldAssigneeId) {
      if (updates.assigneeId) {
        notifyTaskAssignment(taskId, updates.assigneeId, session.user.id).catch(console.error)
      }
    }

    if (shouldBroadcastTaskPatch(updates, existingTask)) {
      const { action: resolvedAction, changes } = resolveTaskUpdateAction(updates, {
        title: oldTitle,
        priority: oldPriority,
        status: oldStatus,
        isArchived: existingTask.isArchived,
      })

      broadcastTaskEvent({
        action: resolvedAction,
        taskId,
        projectId: updatedTask.project.id,
        userId: session.user.id,
        userName: session.user.name || undefined,
        task: serializeTaskForSocket(updatedTask as Record<string, unknown>, session.user.id),
        changes: Object.keys(changes).length > 0 ? changes : undefined,
      }).catch(console.error)
    }

    const labels = extractTaskLabels(updatedTask.labelAssignments, session.user.id)

    return NextResponse.json({ ...updatedTask, labels });
  } catch (error) {
    console.error('Erro ao atualizar tarefa:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const taskId = params.id;

    // Verificar se a tarefa existe e se o usuário tem permissão
    const existingTask = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: {
          include: {
            team: true
          }
        }
      }
    });

    if (!existingTask) {
      return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 });
    }

    // Verificar permissões (admin, owner do projeto, ou membro do projeto)
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    });

    const isAdmin = user?.role === 'ADMIN';
    const isProjectMember = existingTask.project.team.some(
      (member: any) => member.userId === session.user.id
    );

    if (!isAdmin && !isProjectMember) {
      return NextResponse.json({ error: 'Sem permissão para deletar esta tarefa' }, { status: 403 });
    }

    // Deletar a tarefa
    await prisma.task.delete({
      where: { id: taskId }
    });

    broadcastTaskEvent({
      action: 'deleted',
      taskId,
      projectId: existingTask.projectId,
      userId: session.user.id,
      userName: session.user.name || undefined,
    }).catch(console.error)

    return NextResponse.json({ message: 'Tarefa deletada com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar tarefa:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const taskId = params.id;

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true
          }
        },
        project: {
          select: {
            id: true,
            name: true
          }
        },
        sprint: {
          select: {
            id: true,
            name: true,
            status: true
          }
        },
        linkedProjects: {
          include: {
            project: { select: { id: true, name: true } },
          },
        },
        statusHistory: {
          orderBy: { changedAt: 'asc' },
          include: {
            changedBy: { select: { id: true, name: true } },
          },
        },
        ...taskLabelsInclude,
      }
    });

    if (!task) {
      return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 });
    }

    const labels = extractTaskLabels(task.labelAssignments, session.user.id)

    return NextResponse.json({ ...task, labels });
  } catch (error) {
    console.error('Erro ao buscar tarefa:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
