'use client'

import { useState } from 'react'
import { Video } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { isValidGuestName, normalizeGuestName, storeGuestName } from '@/lib/call/guest'

type CallGuestJoinProps = {
  roomTitle: string
  onJoin: (guestName: string) => void
}

export function CallGuestJoin({ roomTitle, onJoin }: CallGuestJoinProps) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const guestName = normalizeGuestName(name)
    if (!isValidGuestName(guestName)) {
      setError('Informe seu nome (mínimo 2 caracteres).')
      return
    }
    storeGuestName(guestName)
    onJoin(guestName)
  }

  return (
    <div className="flex h-full min-h-0 items-center justify-center bg-background p-4 sm:p-6">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
        <div className="mb-4 flex items-center gap-2 text-primary">
          <Video className="h-5 w-5" />
          <span className="text-sm font-medium">Convite para reunião</span>
        </div>
        <h1 className="text-lg font-semibold text-foreground">{roomTitle}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Você foi convidado para participar desta call. Informe seu nome para entrar — não é
          necessário ter conta no sistema.
        </p>

        <form className="mt-6 space-y-4" onSubmit={submit}>
          <div>
            <label htmlFor="guest-name" className="mb-1.5 block text-sm font-medium text-foreground">
              Seu nome
            </label>
            <input
              id="guest-name"
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setError(null)
              }}
              placeholder="Como você quer aparecer na call"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none ring-primary focus:ring-2"
            />
            {error ? <p className="mt-1.5 text-xs text-destructive">{error}</p> : null}
          </div>
          <Button type="submit" className="w-full">
            Entrar na reunião
          </Button>
        </form>
      </div>
    </div>
  )
}
