'use client'

import type { TrackReferenceOrPlaceholder } from '@livekit/components-core'
import { isEqualTrackRef, isTrackReference, isWeb, log } from '@livekit/components-core'
import { RoomEvent, Track } from 'livekit-client'
import * as React from 'react'
import {
  CarouselLayout,
  ConnectionStateToast,
  FocusLayout,
  FocusLayoutContainer,
  GridLayout,
  LayoutContextProvider,
  ParticipantTile,
  useCreateLayoutContext,
  usePinnedTracks,
  useTracks,
} from '@livekit/components-react'
import { LinkCallControlBar } from './LinkCallControlBar'

/** VideoConference LiveKit — PT via CSS + controles sem chat interno. */
export function LinkVideoConference(props: React.HTMLAttributes<HTMLDivElement>) {
  const lastAutoFocusedScreenShareTrack = React.useRef<TrackReferenceOrPlaceholder | null>(null)

  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { updateOnlyOn: [RoomEvent.ActiveSpeakersChanged], onlySubscribed: false }
  )

  const layoutContext = useCreateLayoutContext()

  const screenShareTracks = tracks
    .filter(isTrackReference)
    .filter((track) => track.publication.source === Track.Source.ScreenShare)

  const focusTrack = usePinnedTracks(layoutContext)?.[0]
  const carouselTracks = tracks.filter((track) => !isEqualTrackRef(track, focusTrack))

  const isScreenShareFocused =
    Boolean(focusTrack) &&
    isTrackReference(focusTrack!) &&
    focusTrack!.publication.source === Track.Source.ScreenShare

  React.useEffect(() => {
    const activeScreenShare = screenShareTracks.find((track) => track.publication.isSubscribed)

    if (activeScreenShare) {
      if (
        lastAutoFocusedScreenShareTrack.current?.publication?.trackSid !==
        activeScreenShare.publication.trackSid
      ) {
        layoutContext.pin.dispatch?.({ msg: 'set_pin', trackReference: activeScreenShare })
        lastAutoFocusedScreenShareTrack.current = activeScreenShare
      }
    } else if (lastAutoFocusedScreenShareTrack.current) {
      layoutContext.pin.dispatch?.({ msg: 'clear_pin' })
      lastAutoFocusedScreenShareTrack.current = null
    }

    if (focusTrack && !isTrackReference(focusTrack)) {
      const updatedFocusTrack = tracks.find(
        (tr) =>
          tr.participant.identity === focusTrack.participant.identity &&
          tr.source === focusTrack.source
      )
      if (updatedFocusTrack !== focusTrack && isTrackReference(updatedFocusTrack)) {
        layoutContext.pin.dispatch?.({ msg: 'set_pin', trackReference: updatedFocusTrack })
      }
    }
  }, [
    screenShareTracks
      .map((ref) => `${ref.publication.trackSid}_${ref.publication.isSubscribed}`)
      .join(),
    focusTrack?.publication?.trackSid,
    tracks,
    layoutContext.pin,
  ])

  return (
    <div
      className={`lk-video-conference${isScreenShareFocused ? ' link-call-room__video--screenshare' : ''}`}
      {...props}
    >
      {isWeb() ? (
        <LayoutContextProvider value={layoutContext}>
          <div className="lk-video-conference-inner">
            {!focusTrack ? (
              <div className="lk-grid-layout-wrapper">
                <GridLayout tracks={tracks}>
                  <ParticipantTile />
                </GridLayout>
              </div>
            ) : (
              <div className="lk-focus-layout-wrapper">
                <FocusLayoutContainer>
                  <CarouselLayout tracks={carouselTracks}>
                    <ParticipantTile />
                  </CarouselLayout>
                  {focusTrack ? <FocusLayout trackRef={focusTrack} /> : null}
                </FocusLayoutContainer>
              </div>
            )}
            <LinkCallControlBar />
          </div>
        </LayoutContextProvider>
      ) : null}
      <ConnectionStateToast />
    </div>
  )
}
