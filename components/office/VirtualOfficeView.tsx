'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo } from 'react'
import { LoadingScreen } from '@/components/ui/loading-animation'
import { Button } from '@/components/ui/button'
import { ExternalLink, Map, Users, Video, DoorOpen } from 'lucide-react'
import Link from 'next/link'
import {
  WORKADVENTURE_PLAY_URL,
  buildWorkAdventureOfficeUrl,
} from '@/lib/workadventure'
import { useOfficeSession } from '@/contexts/OfficeSessionContext'

export function VirtualOfficeView() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { startSession, registerHost } = useOfficeSession()

  const configured = Boolean(WORKADVENTURE_PLAY_URL)

  const iframeSrc = useMemo(
    () =>
      configured
        ? buildWorkAdventureOfficeUrl({
            nickname: session?.user?.name ?? null,
          })
        : '',
    [configured, session?.user?.name]
  )

  const hostRef = useCallback(
    (node: HTMLDivElement | null) => {
      registerHost(node)
    },
    [registerHost]
  )

  useEffect(() => {
    if (status === 'loading') return
    if (!session) router.push('/auth/signin')
  }, [session, status, router])

  useEffect(() => {
    if (!configured || !iframeSrc) return
    startSession(iframeSrc)
  }, [configured, iframeSrc, startSession])

  if (status === 'loading') return <LoadingScreen />

  if (!configured) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Escritório 2D</h1>
          <p className="mt-2 text-muted-foreground">
            Mapa virtual estilo RPG com bonecos — baseado em{' '}
            <a
              href="https://github.com/workadventure/workadventure"
              className="text-primary underline-offset-2 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              WorkAdventure
            </a>
            . O PM embute o mundo 2D; vídeo e chat usam o que já existe na plataforma.
          </p>
        </div>

        <div className="rounded-xl border bg-card p-5 space-y-4 text-sm">
          <h2 className="font-semibold">Como funciona (visão geral)</h2>
          <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
            <li>
              <strong className="text-foreground">WorkAdventure</strong> roda em Docker separado (não dentro do
              Next.js) — frontend Phaser, backend próprio, mapas Tiled.
            </li>
            <li>
              O PM abre o escritório em <code className="text-xs">/team/office</code> via iframe apontando para sua
              instância.
            </li>
            <li>
              Cada membro aparece como <strong className="text-foreground">avatar 2D</strong>; ao se aproximar, abre
              vídeo (LiveKit — o mesmo da Link Call).
            </li>
            <li>
              Login único via <strong className="text-foreground">OIDC</strong> (nome/foto do usuário do PM).
            </li>
          </ol>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border p-4">
            <Map className="mb-2 h-5 w-5 text-violet-500" />
            <p className="font-medium text-sm">Mapa custom</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Salas, mesas e logo Link System no Tiled Map Editor
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <Users className="mb-2 h-5 w-5 text-violet-500" />
            <p className="font-medium text-sm">Bonecos</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Avatar Woka por pessoa; nome vem do login PM
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <Video className="mb-2 h-5 w-5 text-violet-500" />
            <p className="font-medium text-sm">Call integrada</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Proximidade → vídeo LiveKit (já configurado no PM)
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm space-y-2">
          <p className="font-medium text-amber-900 dark:text-amber-100">Setup local</p>
          <p className="text-muted-foreground">
            1. Rode <code className="text-xs">npm run office:up</code> no projects
            <br />
            2. Adicione ao <code className="text-xs">/etc/hosts</code> (ver{' '}
            <code className="text-xs">tmp/workadventure-setup.md</code>)
            <br />
            3. Aguarde <code className="text-xs">docker logs -f workadventure-play-1</code>{' '}
            terminar o npm install
            <br />
            4. Reinicie <code className="text-xs">npm run dev</code> após o .env
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link href="/team/call">
              <DoorOpen className="mr-2 h-4 w-4" />
              Link Call (sem mapa 2D)
            </Link>
          </Button>
          <Button asChild variant="ghost">
            <a
              href="https://docs.workadventu.re/map-building/"
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Docs — criar mapa
            </a>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={hostRef}
      className="h-full min-h-0 w-full flex-1 bg-black"
      aria-label="Escritório virtual Link System"
    />
  )
}
