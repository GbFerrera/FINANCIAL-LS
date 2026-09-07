'use client'

import { useEffect, useState } from 'react'
import { Bell, Volume2 } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import {
  getTeamChatNotificationPrefs,
  setTeamChatNotificationPrefs,
  type TeamChatNotificationPrefs,
} from '@/lib/team-chat-notification-prefs'
import { unlockNotificationSound } from '@/lib/notification-sound'

type PrefRowProps = {
  id: string
  label: string
  description: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

function PrefRow({ id, label, description, checked, onCheckedChange }: PrefRowProps) {
  return (
    <label htmlFor={id} className="team-comms__notif-row">
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onCheckedChange(v === true)} />
      <span className="min-w-0 flex-1">
        <span className="team-comms__notif-row-label">{label}</span>
        <span className="team-comms__notif-row-desc">{description}</span>
      </span>
    </label>
  )
}

export function TeamChatNotificationSettings() {
  const [prefs, setPrefs] = useState<TeamChatNotificationPrefs>(() =>
    getTeamChatNotificationPrefs()
  )

  useEffect(() => {
    setPrefs(getTeamChatNotificationPrefs())
  }, [])

  const update = (patch: Partial<TeamChatNotificationPrefs>) => {
    const next = { ...prefs, ...patch }
    setPrefs(next)
    setTeamChatNotificationPrefs(next)
    if (patch.soundEnabled) unlockNotificationSound()
  }

  return (
    <div className="team-comms__notif-panel">
      <div className="team-comms__notif-panel-header">
        <Bell className="h-4 w-4 text-primary" />
        <div>
          <p className="team-comms__notif-panel-title">Alertas do chat</p>
          <p className="team-comms__notif-panel-subtitle">Configure como deseja ser avisado</p>
        </div>
      </div>

      <div className="team-comms__notif-options">
        <PrefRow
          id="team-chat-notif-toast"
          label="Aviso na tela"
          description="Mostra um toast quando chegar mensagem nova"
          checked={prefs.toastEnabled}
          onCheckedChange={(toastEnabled) => update({ toastEnabled })}
        />
        <PrefRow
          id="team-chat-notif-sound"
          label="Som de notificação"
          description="Toca um alerta sonoro (requer interação na página antes)"
          checked={prefs.soundEnabled}
          onCheckedChange={(soundEnabled) => update({ soundEnabled })}
        />
        <PrefRow
          id="team-chat-notif-away"
          label="Somente quando estou ausente"
          description="Não alerta no canal que você está vendo com a aba ativa"
          checked={prefs.onlyWhenAway}
          onCheckedChange={(onlyWhenAway) => update({ onlyWhenAway })}
        />
      </div>

      {prefs.soundEnabled ? (
        <p className="team-comms__notif-hint">
          <Volume2 className="inline h-3.5 w-3.5" /> Clique em qualquer lugar da página uma vez
          para liberar o som no navegador.
        </p>
      ) : null}
    </div>
  )
}
