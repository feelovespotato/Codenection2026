import { useEffect, useRef, useState } from 'react'
import { readCompanionState, updateCompanionState } from '../services/companion-state.js'
import './Companioncharacter.css'

const FALLBACK = {
  music: { activeTrackId: 'rain', isPlaying: false, volume: 0.7 },
  focus: { isRunning: false, remainingSeconds: 25 * 60 },
}

function formatTime(seconds) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export default function Companioncharacter() {
  const [controlsOpen, setControlsOpen] = useState(false)
  const [state, setState] = useState(FALLBACK)
  const startPoint = useRef(null)
  const moved = useRef(false)

  useEffect(() => {
    let alive = true
    const sync = async () => {
      try {
        const next = await readCompanionState()
        if (alive) setState(next)
      } catch { /* The companion can open while the local API is still starting. */ }
    }
    sync()
    const interval = window.setInterval(sync, 1000)
    return () => { alive = false; window.clearInterval(interval) }
  }, [])

  useEffect(() => {
    window.companionDesktop?.setControlsOpen(controlsOpen)
  }, [controlsOpen])

  const patch = async (update) => {
    try { setState(await updateCompanionState(update)) } catch { /* Keep the last known controls until the API is available. */ }
  }

  const startDrag = (event) => {
    if (event.button !== 0) return
    startPoint.current = { x: event.screenX, y: event.screenY }
    moved.current = false
    window.companionDesktop?.startDrag({ x: event.screenX, y: event.screenY })
  }
  const moveDrag = (event) => {
    if (!startPoint.current) return
    if (Math.abs(event.screenX - startPoint.current.x) + Math.abs(event.screenY - startPoint.current.y) > 4) moved.current = true
    window.companionDesktop?.moveDrag({ x: event.screenX, y: event.screenY })
  }
  const endDrag = () => {
    if (!startPoint.current) return
    window.companionDesktop?.endDrag()
    startPoint.current = null
    if (!moved.current) setControlsOpen(open => !open)
  }

  const music = state.music || FALLBACK.music
  const focus = state.focus || FALLBACK.focus
  return (
    <main
      className={`companion-character ${controlsOpen ? 'companion-character--open' : ''}`}
      onPointerEnter={() => window.companionDesktop?.setInteractive(true)}
      onPointerLeave={() => window.companionDesktop?.setInteractive(false)}
    >
      <button
        className="companion-character__pet"
        type="button"
        aria-label={controlsOpen ? 'Hide companion controls' : 'Show companion controls'}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <span className="companion-character__sprite" />
      </button>

      {controlsOpen && (
        <section className="companion-character__card" aria-label="Moodify companion controls">
          <div className="companion-character__row">
            <span className="companion-character__label">{music.isPlaying ? 'Now playing' : 'Music paused'}</span>
            <button type="button" onClick={() => patch({ music: { isPlaying: !music.isPlaying } })}>
              {music.isPlaying ? '❚❚' : '▶'}
            </button>
          </div>
          <p className="companion-character__track">{music.activeTrackId.replaceAll('_', ' ')}</p>
          <label className="companion-character__volume">
            <span>Volume</span>
            <input type="range" min="0" max="1" step="0.05" value={music.volume} onChange={(event) => patch({ music: { volume: Number(event.target.value) } })} />
          </label>
          <div className="companion-character__row companion-character__timer">
            <span>Focus {formatTime(focus.remainingSeconds)}</span>
            <button type="button" onClick={() => patch({ focus: { action: focus.isRunning ? 'pause' : 'start' } })}>
              {focus.isRunning ? '❚❚' : '▶'}
            </button>
          </div>
          <button className="companion-character__break" type="button" onClick={() => patch({ focus: { action: 'start', durationSeconds: 5 * 60 } })}>Take a 5 min break</button>
          <button className="companion-character__close" type="button" onClick={() => setControlsOpen(false)}>Hide controls</button>
        </section>
      )}
    </main>
  )
}
