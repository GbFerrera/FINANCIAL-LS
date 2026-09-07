'use client'

import { supportsScreenSharing } from '@livekit/components-core'
import {
  DisconnectButton,
  MediaDeviceMenu,
  StartMediaButton,
  TrackToggle,
  useLocalParticipant,
  useLocalParticipantPermissions,
  usePersistentUserChoices,
} from '@livekit/components-react'
import { Track } from 'livekit-client'
import { ChevronDown, MonitorUp } from 'lucide-react'
import * as React from 'react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

function useCompactCallControls() {
  const [compact, setCompact] = React.useState(false)

  React.useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const update = () => setCompact(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  return compact
}

const trackSourceToProtocol = (source: Track.Source) => {
  switch (source) {
    case Track.Source.Camera:
      return 1
    case Track.Source.Microphone:
      return 2
    case Track.Source.ScreenShare:
      return 3
    default:
      return 0
  }
}

/** Barra de controles em português (microfone, câmera, tela, sair). */
export function LinkCallControlBar(props: React.HTMLAttributes<HTMLDivElement>) {
  const compact = useCompactCallControls()
  const localPermissions = useLocalParticipantPermissions()
  const { localParticipant } = useLocalParticipant()
  const [screenSharing, setScreenSharing] = React.useState(false)
  const [switchingScreen, setSwitchingScreen] = React.useState(false)

  const screenCaptureOptions = React.useMemo(
    () => ({ audio: true, selfBrowserSurface: 'include' as const }),
    []
  )

  const {
    saveAudioInputEnabled,
    saveVideoInputEnabled,
    saveAudioInputDeviceId,
    saveVideoInputDeviceId,
  } = usePersistentUserChoices({ preventSave: false })

  const onDeviceError = React.useCallback((source: Track.Source, error: Error) => {
    const label =
      source === Track.Source.ScreenShare
        ? 'compartilhamento de tela'
        : source === Track.Source.Camera
          ? 'câmera'
          : 'microfone'
    toast.error(`Não foi possível acessar ${label}: ${error.message}`)
  }, [])

  const canPublishSource = React.useCallback(
    (source: Track.Source) => {
      if (!localPermissions?.canPublish) return false
      if (!localPermissions.canPublishSources?.length) return true
      return localPermissions.canPublishSources.includes(trackSourceToProtocol(source))
    },
    [localPermissions]
  )

  const showMic = canPublishSource(Track.Source.Microphone)
  const showCam = canPublishSource(Track.Source.Camera)
  const showScreen =
    canPublishSource(Track.Source.ScreenShare) && supportsScreenSharing()

  const switchScreenShare = React.useCallback(async () => {
    if (!localParticipant || switchingScreen) return
    setSwitchingScreen(true)
    try {
      await localParticipant.setScreenShareEnabled(false)
      await localParticipant.setScreenShareEnabled(true, screenCaptureOptions)
      setScreenSharing(true)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido'
      toast.error(`Não foi possível trocar a tela: ${message}`)
    } finally {
      setSwitchingScreen(false)
    }
  }, [localParticipant, screenCaptureOptions, switchingScreen])

  return (
    <div {...props} className={`lk-control-bar ${props.className ?? ''}`}>
      {showMic ? (
        <div className="lk-button-group">
          <TrackToggle
            source={Track.Source.Microphone}
            showIcon
            aria-label="Microfone"
            onChange={(enabled, isUserInitiated) =>
              isUserInitiated ? saveAudioInputEnabled(enabled) : null
            }
            onDeviceError={(error) => onDeviceError(Track.Source.Microphone, error)}
          >
            {compact ? <span className="lk-button-label">Microfone</span> : 'Microfone'}
          </TrackToggle>
          <div className="lk-button-group-menu">
            <MediaDeviceMenu
              kind="audioinput"
              onActiveDeviceChange={(_kind, deviceId) =>
                saveAudioInputDeviceId(deviceId ?? 'default')
              }
            />
          </div>
        </div>
      ) : null}

      {showCam ? (
        <div className="lk-button-group">
          <TrackToggle
            source={Track.Source.Camera}
            showIcon
            aria-label="Câmera"
            onChange={(enabled, isUserInitiated) =>
              isUserInitiated ? saveVideoInputEnabled(enabled) : null
            }
            onDeviceError={(error) => onDeviceError(Track.Source.Camera, error)}
          >
            {compact ? <span className="lk-button-label">Câmera</span> : 'Câmera'}
          </TrackToggle>
          <div className="lk-button-group-menu">
            <MediaDeviceMenu
              kind="videoinput"
              onActiveDeviceChange={(_kind, deviceId) =>
                saveVideoInputDeviceId(deviceId ?? 'default')
              }
            />
          </div>
        </div>
      ) : null}

      {showScreen ? (
        <div className="lk-button-group">
          <TrackToggle
            source={Track.Source.ScreenShare}
            captureOptions={screenCaptureOptions}
            showIcon
            aria-label={screenSharing ? 'Parar compartilhamento de tela' : 'Apresentar tela'}
            onChange={setScreenSharing}
            onDeviceError={(error) => onDeviceError(Track.Source.ScreenShare, error)}
          >
            {compact ? (
              <span className="lk-button-label">{screenSharing ? 'Parar tela' : 'Apresentar tela'}</span>
            ) : screenSharing ? (
              'Parar tela'
            ) : (
              'Apresentar tela'
            )}
          </TrackToggle>
          {screenSharing ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={switchingScreen}
                  className="lk-button h-10 w-9 shrink-0 rounded-l-none border-l-0 md:h-10"
                  aria-label="Opções de compartilhamento de tela"
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center">
                <DropdownMenuItem disabled={switchingScreen} onClick={switchScreenShare}>
                  <MonitorUp className="mr-2 h-4 w-4" />
                  Trocar tela compartilhada
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      ) : null}

      <DisconnectButton>Sair</DisconnectButton>
      <StartMediaButton />
    </div>
  )
}
