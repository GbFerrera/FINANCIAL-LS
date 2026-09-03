import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { emitTaskCommentEvent } from '@/lib/task-comments-socket-server'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; commentId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } })
    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const comment = await prisma.comment.findFirst({
      where: { id: params.commentId, taskId: params.id },
    })

    if (!comment) {
      return NextResponse.json({ error: 'Comentário não encontrado' }, { status: 404 })
    }

    await prisma.comment.delete({ where: { id: params.commentId } })

    emitTaskCommentEvent({
      action: 'deleted',
      taskId: params.id,
      commentId: params.commentId,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Erro ao excluir comentário:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
