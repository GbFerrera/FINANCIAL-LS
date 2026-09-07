'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Video, Phone, Users, DoorOpen, Sparkles, Radio, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import '@/components/call/link-call.css'
import { cn } from '@/lib/utils'

type ActiveRoom = {
  id: string
  title: string | null
  type: string
  startedAt: string
  createdBy: { id: string; name: string; avatar?: string | null }
}

function goToCall(path: string) {
  if (typeof window !== 'undefined') {
    window.location.assign(path)
  }
}

type CallHubPanelProps = {
  embedded?: boolean
}

export function CallHubPanel({ embedded = false }: CallHubPanelProps) {
  const [title, setTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const [joiningSalinha, setJoiningSalinha] = useState(false)
  const [salinhaError, setSalinhaError] = useState<string | null>(null)
  const [rooms, setRooms] = useState<ActiveRoom[]>([])
  const [livekitConfigured, setLivekitConfigured] = useState<boolean | null>(null)

  const loadRooms = () => {
    fetch('/api/calls')
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          console.error('calls list:', data.error)
          return
        }
        setRooms(data.rooms ?? [])
        setLivekitConfigured(Boolean(data.livekitConfigured))
      })
      .catch((err) => console.error('calls list fetch:', err))
  }

  useEffect(() => {
    loadRooms()
    const interval = setInterval(loadRooms, 30_000)
    return () => clearInterval(interval)
  }, [])

  const createAndJoin = async (opts: { title: string; type: 'audio' | 'video' }) => {
    const res = await fetch('/api/calls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(opts),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error ?? 'Erro ao criar call')
      return null
    }
    return data.joinPath as string
  }

  const startCall = async (type: 'audio' | 'video') => {
    setCreating(true)
    try {
      const path = await createAndJoin({
        title: title.trim() || (type === 'audio' ? 'Chamada de voz' : 'Reunião Link Call'),
        type,
      })
      if (path) goToCall(path)
    } catch {
      toast.error('Erro de rede')
    } finally {
      setCreating(false)
    }
  }

  const enterSalinha = async () => {
    if (joiningSalinha) return
    setJoiningSalinha(true)
    setSalinhaError(null)
    try {
      const res = await fetch('/api/calls/salinha', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        const msg = data.error ?? 'Erro ao entrar na salinha'
        setSalinhaError(msg)
        toast.error(msg)
        return
      }
      if (data.joinPath) {
        goToCall(data.joinPath)
        return
      }
      setSalinhaError('Resposta inválida do servidor')
    } catch {
      const msg = 'Erro de rede ao entrar na salinha'
      setSalinhaError(msg)
      toast.error(msg)
    } finally {
      setJoiningSalinha(false)
    }
  }

  const salinhaActive = rooms.some((r) => r.title === 'Salinha Link System')

  return (
    <div
      className={cn(
        'h-full overflow-y-auto',
        embedded ? 'p-5 md:p-6' : 'mx-auto max-w-4xl space-y-8 py-6'
      )}
    >
      <div className={cn('space-y-6', embedded ? 'mx-auto max-w-3xl' : 'space-y-8')}>
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-600 dark:text-violet-300">
            <Sparkles className="h-3.5 w-3.5" />
            Salas de voz e vídeo
          </div>
          <h2 className="text-xl font-semibold text-foreground">Link Call</h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Entre na salinha da equipe, crie uma sala ou participe de uma reunião em andamento.
          </p>
        </div>

        {livekitConfigured === false ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
            LiveKit não detectado. Rode <code className="text-xs">npm run call:up</code> e reinicie o{' '}
            <code className="text-xs">npm run dev</code>.
          </div>
        ) : livekitConfigured ? (
          <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
            <Radio className="h-4 w-4" />
            LiveKit pronto — vídeo e tela disponíveis
          </div>
        ) : null}

        <div className="link-call-hub-card relative overflow-hidden rounded-2xl p-6">
          <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-violet-500/20 blur-3xl" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/20">
                  <DoorOpen className="h-6 w-6 text-violet-400" />
                </div>
                {salinhaActive ? (
                  <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                    <span className="link-call-live-dot h-2 w-2 rounded-full bg-emerald-400" />
                    Alguém na sala
                  </span>
                ) : null}
              </div>
              <h3 className="text-lg font-semibold text-white">Salinha Link System</h3>
              <p className="mt-1 max-w-md text-sm text-white/55">
                Sala permanente da equipe — câmera, tela e chat integrados.
              </p>
              {salinhaError ? <p className="mt-2 text-sm text-red-400">{salinhaError}</p> : null}
            </div>
            <Button
              size="lg"
              disabled={joiningSalinha}
              onClick={enterSalinha}
              className="shrink-0 bg-violet-600 hover:bg-violet-500"
            >
              {joiningSalinha ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Entrando…
                </>
              ) : (
                <>
                  <Video className="mr-2 h-5 w-5" />
                  Entrar na salinha
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Nova sala
          </h3>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título da sala (opcional)"
          />
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => startCall('video')} disabled={creating}>
              <Video className="mr-2 h-4 w-4" />
              Reunião com vídeo
            </Button>
            <Button variant="outline" onClick={() => startCall('audio')} disabled={creating}>
              <Phone className="mr-2 h-4 w-4" />
              Só áudio
            </Button>
          </div>
        </div>

        {rooms.length > 0 ? (
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Users className="h-4 w-4" />
              Salas ativas agora
            </h3>
            <ul className="space-y-2">
              {rooms.map((room) => (
                <li
                  key={room.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{room.title ?? 'Call'}</p>
                    <p className="text-xs text-muted-foreground">
                      por {room.createdBy.name} · {room.type === 'audio' ? 'áudio' : 'vídeo'}
                    </p>
                  </div>
                  <Button size="sm" onClick={() => goToCall(`/team/call/${room.id}`)}>
                    Entrar
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  )
}
