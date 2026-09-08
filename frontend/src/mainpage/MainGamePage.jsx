import { useEffect, useRef, useState } from 'react'
import { createMoodifyGame } from './MoodifyGame.js'

export default function MainGamePage({ onActivity, onHotspot, onFeature, onSettings }) {
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
    <main className="fixed inset-0 flex h-svh w-screen items-center justify-center overflow-hidden bg-[#0d0b12]">
      <section
        className="relative h-[min(100svh,56.25vw)] w-[min(100vw,177.7778svh)] overflow-hidden bg-[#0d0b12]"
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
          <aside className="absolute right-3 top-[13%] w-52 border-4 border-[#3b2930] bg-[#fff0dc] p-3 text-[#251a20] shadow-2xl sm:w-64">
            <div className="mb-2 flex items-center justify-between border-b-2 border-[#a87c66] pb-2">
              <h2 className="text-base font-black uppercase tracking-wider">Settings</h2>
              <button type="button" className="px-2 text-xl font-black" onClick={() => setSettingsOpen(false)} aria-label="Close settings">×</button>
            </div>
            <p className="text-sm leading-5">Use the left and right arrow keys on your keyboard to walk around your Moodify room.</p>
          </aside>
        )}
      </section>
    </main>
  )
}
