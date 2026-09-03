import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { emitTaskCommentEvent } from '@/lib/task-comments-socket-server';
import { notifyTaskComment } from '@/lib/notifications';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const task = await prisma.task.findUnique({
      where: { id: params.id },
      select: { id: true },
    });

    if (!task) {
      return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 });
    }

    const comments = await prisma.comment.findMany({
      where: { taskId: params.id },
      orderBy: { createdAt: 'desc' },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    });

    return NextResponse.json(comments);
  } catch (error) {
    console.error('Erro ao listar comentários:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { content } = await request.json();

    if (!content || content.trim().length === 0) {
      return NextResponse.json({ error: 'Conteúdo do comentário é obrigatório' }, { status: 400 });
    }

    // Verificar se a tarefa existe
    const task = await prisma.task.findUnique({
      where: { id: params.id }
    });

    if (!task) {
      return NextResponse.json({ error: 'Tarefa não encontrada' }, { status: 404 });
    }

    // Criar o comentário
    const comment = await prisma.comment.create({
      data: {
        content: content.trim(),
        authorId: session.user.id,
        projectId: task.projectId,
        taskId: task.id,
        type: 'INTERNAL'
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            avatar: true
          }
        }
      }
    });

    emitTaskCommentEvent({
      action: 'created',
      taskId: task.id,
      comment: {
        id: comment.id,
        content: comment.content,
        createdAt: comment.createdAt.toISOString(),
        author: comment.author,
      },
    });

    notifyTaskComment(
      task.id,
      session.user.id,
      comment.author?.name || session.user.name || 'Usuário',
      comment.content
    ).catch(console.error);

    return NextResponse.json(comment, { status: 201 });

  } catch (error) {
    console.error('Erro ao criar comentário:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}