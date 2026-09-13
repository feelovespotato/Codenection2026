import { useEffect, useState, useSyncExternalStore } from 'react'
import { SoundPlayer } from './sound-player.js'
import { readCompanionState, updateCompanionState } from './companion-state.js'

export function useSoundPlayer(settings) {
  const [player] = useState(() => new SoundPlayer(settings))
  const state = useSyncExternalStore(player.subscribe, player.getSnapshot)
  useEffect(() => {
    player.mount()
    window.addEventListener('pointerdown', player.onInteraction)
    window.addEventListener('keydown', player.onInteraction)
    window.addEventListener('focus', player.onInteraction)
    document.addEventListener('visibilitychange', player.onInteraction)
    return () => {
      window.removeEventListener('pointerdown', player.onInteraction)
      window.removeEventListener('keydown', player.onInteraction)
      window.removeEventListener('focus', player.onInteraction)
      document.removeEventListener('visibilitychange', player.onInteraction)
      player.destroy()
    }
  }, [player])
  useEffect(() => { player.setSettings(settings) }, [player, settings])
  useEffect(() => {
    let alive = true
    let publishing = false
    let lastLocalUpdate = 0
    const publish = async () => {
      if (!alive || player.isApplyingCompanionState || publishing) return
      publishing = true
      lastLocalUpdate = Date.now()
      const { activeTrackId, isPlaying, isStarting, volume } = player.getSnapshot()
      try { await updateCompanionState({ music: { activeTrackId, isPlaying: isPlaying || isStarting, volume } }) } catch { /* The normal player still works if the local API is offline. */ }
      finally { publishing = false }
    }
    const sync = async () => {
      try {
        const fetchStart = Date.now()
        const shared = await readCompanionState()
        if (!alive || player.isApplyingCompanionState) return
        if (lastLocalUpdate > fetchStart - 2000) return
        const current = player.getSnapshot()
        const effectivelyPlaying = current.isPlaying || current.isStarting
        const music = shared.music
        if (music && (music.activeTrackId !== current.activeTrackId || music.isPlaying !== effectivelyPlaying || music.volume !== current.volume)) await player.applyCompanionState(music)
      } catch { /* Retry on the next polling interval. */ }
    }
    const unsubscribe = player.subscribe(publish)
    sync()
    const interval = window.setInterval(sync, 1000)
    return () => { alive = false; unsubscribe(); window.clearInterval(interval) }
  }, [player])
  return { ...state, selectTrack: player.selectTrack, togglePlay: player.togglePlay, setVolume: player.setVolume, handleSelectTimer: player.selectTimer }
}
