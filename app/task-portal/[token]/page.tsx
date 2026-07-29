'use client'

import { use, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TaskChecklist } from '@/components/collaborator/TaskChecklist'
import { Bot, CheckSquare, Copy, ExternalLink, Loader2 } from 'lucide-react'
import { toast } from 'react-hot-toast'

type PortalPayload = {
  task: {
    id: string
    title: string
    description?: string | null
    status: string
    priority: string
    project: { id: string; name: string }
    assignee?: { name: string } | null
  }
  checklist: {
    progress: { total: number; done: number; percent: number }
  }
  links: {
    view: string
    api: string
    agentMarkdown: string
    checklist: string
  }
  comments: Array<{ id: string; content: string; author?: { name: string } | null }>
}

const statusLabel: Record<string, string> = {
  TODO: 'A fazer',
  IN_PROGRESS: 'Em progresso',
  IN_REVIEW: 'Em revisão',
  COMPLETED: 'Concluída',
}

export default function TaskPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [data, setData] = useState<PortalPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        const res = await fetch(`/api/task-portal/${token}`)
        if (!res.ok) {
          throw new Error('Link inválido ou desativado')
        }
        const json = await res.json()
        if (!cancelled) setData(json)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erro ao carregar')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [token])

  const copy = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text)
    toast.success(`${label} copiado`)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Link indisponível</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground">
            {error || 'Esta task não está compartilhada ou o link expirou.'}
          </CardContent>
        </Card>
      </div>
    )
  }

  const { task, checklist, links, comments } = data

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{task.project.name}</Badge>
            <Badge>{statusLabel[task.status] || task.status}</Badge>
            <Badge variant="secondary">
              Checklist {checklist.progress.done}/{checklist.progress.total}
            </Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{task.title}</h1>
          {task.assignee?.name && (
            <p className="text-sm text-muted-foreground">Responsável: {task.assignee.name}</p>
          )}
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Bot className="h-4 w-4" />
              Links para agentes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" className="gap-2" onClick={() => copy(links.agentMarkdown, 'API markdown')}>
                <Copy className="h-4 w-4" />
                Copiar API markdown
              </Button>
              <Button type="button" size="sm" variant="outline" className="gap-2" onClick={() => copy(links.api, 'API JSON')}>
                <Copy className="h-4 w-4" />
                Copiar API JSON
              </Button>
              <Button type="button" size="sm" variant="outline" className="gap-2" asChild>
                <a href={links.agentMarkdown} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Abrir markdown
                </a>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Agentes podem buscar o passo a passo em markdown ou JSON e marcar itens do checklist via PATCH na API.
            </p>
          </CardContent>
        </Card>

        {task.description?.trim() && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Descrição</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                {task.description}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckSquare className="h-4 w-4" />
              Checklist
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TaskChecklist taskId={task.id} shareToken={token} readOnly={false} variant="minimal" />
          </CardContent>
        </Card>

        {comments.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Comentários</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {comments.map((comment) => (
                <div key={comment.id} className="rounded-lg border p-3 bg-background">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    {comment.author?.name || 'Sistema'}
                  </p>
                  <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                    {comment.content}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
