import { useEffect, useRef, useState } from 'react'
import { createMoodifyGame } from './MoodifyGame.js'

export default function MainGamePage({
  onActivity,
  onHotspot,
  onFeature,
  onSettings,
  musicEnabled,
  musicVolume,
  onMusicEnabledChange,
  onMusicVolumeChange,
}) {
  const hostRef = useRef(null)
  const gameRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    let game
    createMoodifyGame(hostRef.current, {
      onActivity,
      onHotspot,
      onFeature,
      onSettings: () => {
        setSettingsOpen((open) => !open)
        onSettings?.()
      },
    }).then((created) => {
      if (cancelled) {
        created.destroy()
        return
      }
      game = created
      gameRef.current = created
      setLoading(false)
    }).catch((error) => {
      console.error('Moodify game failed to start', error)
      setLoadError('The room could not load. Please refresh the page.')
      setLoading(false)
    })
    return () => {
      cancelled = true
      game?.destroy()
      gameRef.current = null
    }
  }, [onActivity, onFeature, onHotspot, onSettings])

  return (
    <main className="main-room fixed inset-0 flex h-svh w-screen items-center justify-center overflow-hidden bg-[#0d0b12]">
      <section
        className="main-room__stage relative h-[min(100svh,56.25vw)] w-[min(100vw,177.7778svh)] overflow-hidden bg-[#0d0b12]"
        aria-label="Moodify main game"
      >
        <div ref={hostRef} className="game-canvas absolute inset-0" />

        {loading && (
          <div className="absolute inset-0 grid place-items-center bg-[#17131b] text-base font-semibold tracking-wide text-[#f5dfcb]">
            Opening your room…
          </div>
        )}

        {loadError && (
          <div role="alert" className="absolute inset-x-4 top-4 bg-red-950/95 px-4 py-3 text-center text-sm font-semibold text-white">
            {loadError}
          </div>
        )}

        {settingsOpen && (
          <aside className="pixel-settings absolute right-3 top-[13%] max-h-[80%] overflow-y-auto w-52 border-4 border-[#3b2930] bg-[#fff0dc] p-3 text-[#251a20] shadow-2xl sm:w-64">
            <div className="mb-2 flex items-center justify-between border-b-2 border-[#a87c66] pb-2">
              <h2 className="text-base font-black uppercase tracking-wider">Settings</h2>
              <button type="button" className="px-2 text-xl font-black" onClick={() => setSettingsOpen(false)} aria-label="Close settings">×</button>
            </div>
            <p className="text-sm leading-5">Use the left and right arrow keys on your keyboard to walk around your Moodify room.</p>

            <div className="mt-4 border-t-2 border-[#d7b49c] pt-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <label htmlFor="cozy-music-volume" className="text-xs font-black uppercase tracking-wider">
                  Cozy music
                </label>
                <button
                  type="button"
                  onClick={() => onMusicEnabledChange?.(!musicEnabled)}
                  className={`border-2 border-[#3b2930] px-2 py-1 text-xs font-black shadow-[2px_2px_0_#3b2930] ${
                    musicEnabled ? 'bg-[#b8d99b] text-[#263025]' : 'bg-[#dbc9bc] text-[#554741]'
                  }`}
                  aria-pressed={musicEnabled}
                >
                  {musicEnabled ? '🔊 On' : '🔇 Off'}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span aria-hidden="true" className="text-xs">♪</span>
                <input
                  id="cozy-music-volume"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={musicVolume}
                  onChange={(event) => onMusicVolumeChange?.(Number(event.target.value))}
                  className="h-2 min-w-0 flex-1 cursor-pointer accent-[#a75f48]"
                  aria-label="Cozy music volume"
                  disabled={!musicEnabled}
                />
                <output htmlFor="cozy-music-volume" className="w-9 text-right text-xs font-black">
                  {Math.round(musicVolume * 100)}%
                </output>
              </div>
              <p className="mt-2 text-[11px] leading-4 text-[#6f5b53]">Soft piano continues gently between rooms.</p>
            </div>
          </aside>
        )}
      </section>
      <div className="main-room__mobile-tools">
        <p>Swipe the room sideways to explore. Use the menu above to open your activities.</p>
        <div>
          <button type="button" onClick={() => onActivity?.('phone')}>Chat rooms</button>
          <button type="button" onClick={() => setSettingsOpen(open => !open)}>Settings</button>
        </div>
      </div>
    </main>
  )
}
