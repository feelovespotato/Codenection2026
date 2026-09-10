import { useEffect, useState, useSyncExternalStore } from 'react'
import { SoundPlayer } from './sound-player.js'

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
  return { ...state, selectTrack: player.selectTrack, togglePlay: player.togglePlay, setVolume: player.setVolume, handleSelectTimer: player.selectTimer }
}
