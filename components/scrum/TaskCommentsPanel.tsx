'use client'

import { useCallback, useEffect, useState } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { MessageSquare, Loader2 } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { cn } from '@/lib/utils'
import { useTaskCommentsRealtime } from '@/hooks/useTaskCommentsRealtime'
import type { TaskCommentSocketEvent } from '@/lib/task-comments-socket'

import { LoadingAnimation, LoadingInline, LoadingScreen } from '@/components/ui/loading-animation'
export type TaskComment = {
  id: string
  content: string
  createdAt: string
  author?: {
    id: string
    name: string
    avatar?: string | null
  } | null
}

function formatActivityDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function TaskCommentsPanel({
  taskId,
  variant = 'default',
}: {
  taskId: string
  variant?: 'default' | 'plane'
}) {
  const [comments, setComments] = useState<TaskComment[]>([])
  const [loading, setLoading] = useState(true)
  const [newComment, setNewComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments`)
      if (!res.ok) throw new Error('Falha ao carregar comentários')
      const data = await res.json()
      setComments(data)
    } catch {
      toast.error('Não foi possível carregar os comentários')
    } finally {
      setLoading(false)
    }
  }, [taskId])

  useEffect(() => {
    setLoading(true)
    fetchComments()
  }, [fetchComments])

  const handleRealtimeEvent = useCallback((event: TaskCommentSocketEvent) => {
    if (event.action === 'created' && event.comment) {
      setComments((prev) => {
        if (prev.some((c) => c.id === event.comment!.id)) return prev
        return [event.comment!, ...prev]
      })
      return
    }

    if (event.action === 'deleted' && event.commentId) {
      setComments((prev) => prev.filter((c) => c.id !== event.commentId))
    }
  }, [])

  useTaskCommentsRealtime(taskId, handleRealtimeEvent)

  const handleSubmit = async () => {
    const content = newComment.trim()
    if (!content) return

    setSubmitting(true)
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      if (!res.ok) throw new Error('Falha ao comentar')
      const created = (await res.json()) as TaskComment
      setComments((prev) => [created, ...prev])
      setNewComment('')
    } catch {
      toast.error('Erro ao enviar comentário')
    } finally {
      setSubmitting(false)
    }
  }

  const isPlane = variant === 'plane'

  return (
    <div className={cn('flex flex-col', isPlane ? 'min-h-[320px]' : 'h-full min-h-0 bg-muted/15')}>
      <div className={cn(
        'flex shrink-0 items-center justify-between',
        isPlane ? 'mb-3' : 'border-b px-4 py-3'
      )}>
        <h3 className={cn('font-semibold', isPlane ? 'text-sm text-foreground' : 'flex items-center gap-2 text-sm')}>
          {!isPlane && <MessageSquare className="h-4 w-4" />}
          Atividade
        </h3>
      </div>

      <div className={cn('space-y-2', isPlane ? 'mb-4' : 'shrink-0 border-b p-4')}>
        <Textarea
          placeholder="Adicionar comentário"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          className={cn(
            'resize-none bg-background text-sm',
            isPlane ? 'min-h-[88px] rounded-lg border-border/80' : 'min-h-[72px]'
          )}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              handleSubmit()
            }
          }}
        />
        {newComment.trim() && (
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <>
                  <LoadingInline size="md" className="mr-1" />
                  Salvando...
                </>
              ) : (
                'Comentar'
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setNewComment('')}
              disabled={submitting}
            >
              Cancelar
            </Button>
          </div>
        )}
      </div>

      <div className={cn('space-y-4', isPlane ? '' : 'min-h-0 flex-1 overflow-y-auto p-4')}>
        {loading ? (
          <div className="flex justify-center py-8 text-muted-foreground text-sm">
            <LoadingInline size="md" />
          </div>
        ) : comments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhum comentário ainda. Registre atualizações, dúvidas ou decisões aqui.
          </p>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="flex gap-3">
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarImage src={comment.author?.avatar ?? undefined} />
                <AvatarFallback className="bg-primary/10 text-[10px]">
                  {comment.author?.name?.charAt(0).toUpperCase() ?? '?'}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="rounded-lg border border-border/80 bg-background px-3 py-2.5">
                  <div className="mb-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="text-sm font-medium">
                      {comment.author?.name ?? 'Usuário'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      comentou · {formatActivityDate(comment.createdAt)}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm text-foreground">
                    {comment.content}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
