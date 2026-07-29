'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Bot, Copy, Link2, Loader2, Power, PowerOff } from 'lucide-react'
import { toast } from 'react-hot-toast'

interface TaskSharePanelProps {
  taskId: string
}

export function TaskSharePanel({ taskId }: TaskSharePanelProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [shareEnabled, setShareEnabled] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [agentApiUrl, setAgentApiUrl] = useState<string | null>(null)

  const load = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/tasks/${taskId}/share`)
      if (!res.ok) throw new Error('Erro ao carregar link')
      const data = await res.json()
      setShareEnabled(Boolean(data.shareEnabled))
      setShareUrl(data.shareUrl || null)
      setAgentApiUrl(data.agentApiUrl || null)
    } catch {
      toast.error('Não foi possível carregar o link da task')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [taskId])

  const copy = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value)
    toast.success(`${label} copiado`)
  }

  const toggleShare = async (enable: boolean) => {
    try {
      setSaving(true)
      const res = await fetch(`/api/tasks/${taskId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: enable ? 'enable' : 'disable' }),
      })
      if (!res.ok) throw new Error('Erro ao atualizar link')
      const data = await res.json()
      setShareEnabled(Boolean(data.shareEnabled))
      setShareUrl(data.shareUrl || null)
      setAgentApiUrl(data.agentApiUrl || null)
      toast.success(enable ? 'Link de compartilhamento ativado' : 'Link desativado')
    } catch {
      toast.error('Erro ao atualizar compartilhamento')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="pl-8 flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando link da task...
      </div>
    )
  }

  return (
    <div className="pl-8 pt-2 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Link2 className="w-4 h-4 text-muted-foreground" />
          Link para agentes
          {shareEnabled ? (
            <Badge className="bg-green-600 hover:bg-green-600">Ativo</Badge>
          ) : (
            <Badge variant="secondary">Inativo</Badge>
          )}
        </div>
        <div className="flex gap-2">
          {shareEnabled ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={saving}
              onClick={() => toggleShare(false)}
              className="gap-2"
            >
              <PowerOff className="h-4 w-4" />
              Desativar
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              disabled={saving}
              onClick={() => toggleShare(true)}
              className="gap-2"
            >
              <Power className="h-4 w-4" />
              Gerar link
            </Button>
          )}
        </div>
      </div>

      {shareEnabled && shareUrl && (
        <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Visualização humana</label>
            <div className="flex gap-2">
              <Input readOnly value={shareUrl} className="text-xs bg-background" />
              <Button type="button" size="sm" variant="outline" onClick={() => copy(shareUrl, 'Link da task')}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {agentApiUrl && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Bot className="h-3.5 w-3.5" />
                API markdown para agentes (passo a passo)
              </label>
              <div className="flex gap-2">
                <Input readOnly value={agentApiUrl} className="text-xs bg-background font-mono" />
                <Button type="button" size="sm" variant="outline" onClick={() => copy(agentApiUrl, 'API markdown')}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Cole o link markdown em outro agente (Cursor, etc.) para ele ler checklist, comentários e marcar etapas concluídas.
          </p>
        </div>
      )}
    </div>
  )
}
