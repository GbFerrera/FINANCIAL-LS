'use client'

import { useCallback, useEffect, useState } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { MessageSquare, Loader2 } from 'lucide-react'
import { toast } from 'react-hot-toast'

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

export function TaskCommentsPanel({ taskId }: { taskId: string }) {
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

  return (
    <div className="flex flex-col h-full min-h-0 bg-muted/15">
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          Comentários e atividade
        </h3>
      </div>

      <div className="p-4 border-b shrink-0 space-y-2">
        <Textarea
          placeholder="Escrever um comentário..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          className="min-h-[72px] resize-none bg-background text-sm"
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
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
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

      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {loading ? (
          <div className="flex justify-center py-8 text-muted-foreground text-sm">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : comments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhum comentário ainda. Registre atualizações, dúvidas ou decisões aqui.
          </p>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="flex gap-3">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarImage src={comment.author?.avatar ?? undefined} />
                <AvatarFallback className="text-xs bg-primary/10">
                  {comment.author?.name?.charAt(0).toUpperCase() ?? '?'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="rounded-md bg-background border px-3 py-2 shadow-sm">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mb-1">
                    <span className="text-sm font-semibold">
                      {comment.author?.name ?? 'Usuário'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatActivityDate(comment.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-wrap break-words">
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
