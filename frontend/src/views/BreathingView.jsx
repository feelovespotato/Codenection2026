import { useState, useEffect, useRef } from 'react'
import { api } from '../services/api.js'
import { useMoodify } from '../services/moodify-context.js'

const TECHNIQUES = [
  {
    id: 'balance',
    name: 'Balance',
    description: 'Stabilizes heart rate & restores equilibrium',
    pattern: [
      { name: 'Inhale', duration: 4 },
      { name: 'Hold', duration: 7 },
      { name: 'Exhale', duration: 4 },
    ],
    color: 'from-amber-400 to-orange-400',
  },
  {
    id: 'relax',
    name: 'Relax (4-7-8)',
    description: 'Natural tranquilizer for the nervous system',
    pattern: [
      { name: 'Inhale', duration: 4 },
      { name: 'Hold', duration: 7 },
      { name: 'Exhale', duration: 8 },
    ],
    color: 'from-sky-400 to-indigo-400',
  },
  {
    id: 'calm',
    name: 'Calm (5-5)',
    description: 'Coherent breathing for instant centering',
    pattern: [
      { name: 'Inhale', duration: 5 },
      { name: 'Exhale', duration: 5 },
    ],
    color: 'from-emerald-400 to-teal-400',
  },
  {
    id: 'release',
    name: 'Release (4-2-8)',
    description: 'Long exhalation to discharge tension & anxiety',
    pattern: [
      { name: 'Inhale', duration: 4 },
      { name: 'Hold', duration: 2 },
      { name: 'Exhale', duration: 8 },
    ],
    color: 'from-purple-400 to-pink-400',
  },
]

export default function BreathingView() {
  const [selectedTechnique, setSelectedTechnique] = useState(TECHNIQUES[0].id)
  const [isActive, setIsActive] = useState(false)
  const [phaseIndex, setPhaseIndex] = useState(0)
  const [phaseSecondsLeft, setPhaseSecondsLeft] = useState(TECHNIQUES[0].pattern[0].duration)
  const [completedCycles, setCompletedCycles] = useState(0)
  const [soundEnabled, setSoundEnabled] = useState(false)

  const { refresh } = useMoodify()
  const [session, setSession] = useState(null)
  const [seconds, setSeconds] = useState(0)
  const [pending, setPending] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const saving = useRef(false)
  const audioRef = useRef(null)

  async function startSession() {
    setPending(true); setError(''); setNotice('')
    try {
      const result = await api('/recovery-sessions', { method: 'POST', body: { technique: selectedTechnique } })
      setSession(result.session); setSeconds(0); setCompletedCycles(0); setPhaseIndex(0)
      setPhaseSecondsLeft(activeTech.pattern[0].duration); setIsActive(true)
    } catch (failure) { setError(failure.message) }
    finally { setPending(false) }
  }
  function stopSession() { setIsActive(false); setSession(null); setSeconds(0); setNotice('Session stopped. No completion recorded.') }
  async function completeSession() {
    if (saving.current || !session) return
    saving.current = true; setPending(true); setIsActive(false); setError('')
    try {
      await api(`/recovery-sessions/${session.id}/complete`, { method: 'POST', body: {} })
      setSession(null); setNotice('One-minute session completed and saved. Your recovery streak is updated.')
      await refresh()
    } catch (failure) { setError(failure.message) }
    finally { saving.current = false; setPending(false) }
  }


  const activeTech = TECHNIQUES.find((t) => t.id === selectedTechnique) || TECHNIQUES[0]
  const currentPhase = activeTech.pattern[phaseIndex]

  // Switch technique
  const handleSelectTechnique = (techId) => {
    const tech = TECHNIQUES.find((t) => t.id === techId) || TECHNIQUES[0]
    stopSession()
    setSelectedTechnique(techId)
    setIsActive(false)
    setPhaseIndex(0)
    setPhaseSecondsLeft(tech.pattern[0].duration)
  }

  // Count active ticks only; stopping or leaving never submits a completion.
  useEffect(() => {
    if (!isActive) return
    const interval = setInterval(() => {
      setSeconds(value => value + 1)
      if (phaseSecondsLeft > 1) setPhaseSecondsLeft(phaseSecondsLeft - 1)
      else {
        const next = (phaseIndex + 1) % activeTech.pattern.length
        setPhaseIndex(next); setPhaseSecondsLeft(activeTech.pattern[next].duration)
        if (next === 0) setCompletedCycles(value => value + 1)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [isActive, phaseSecondsLeft, phaseIndex, activeTech])

  useEffect(() => {
    if (!isActive || seconds < 60) return
    const timer = setTimeout(() => completeSession(), 0)
    return () => clearTimeout(timer)
    // Completion is guarded by the session and an in-flight ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds, isActive])

  // Ambient sound handling
  useEffect(() => {
    if (soundEnabled && isActive) {
      if (!audioRef.current) {
        audioRef.current = new Audio('/audio/breathing.mp3')
        audioRef.current.loop = true
      }
      audioRef.current.play().catch(() => {})
    } else {
      audioRef.current?.pause()
    }
    return () => {
      audioRef.current?.pause()
    }
  }, [soundEnabled, isActive])

  // Dynamic circle scale based on breathing phase
  const getCircleScale = () => {
    if (!isActive) return 'scale-100'
    if (currentPhase.name === 'Inhale') return 'scale-125 duration-[4000ms]'
    if (currentPhase.name === 'Hold') return 'scale-125 duration-[1000ms]'
    if (currentPhase.name === 'Exhale') return 'scale-90 duration-[6000ms]'
    return 'scale-100'
  }

  return (
    <div className="flex flex-col items-center space-y-6 text-center">
      {/* Technique Selector */}
      <div className="flex flex-wrap justify-center gap-2">
        {TECHNIQUES.map((tech) => {
          const isSelected = tech.id === selectedTechnique
          return (
            <button
              key={tech.id}
              aria-pressed={isSelected}
              type="button"
              disabled={pending || Boolean(session && seconds >= 60)}
              onClick={() => handleSelectTechnique(tech.id)}
              className={`rounded-xl border px-4 py-2 text-xs font-bold transition active:scale-95 ${
                isSelected
                  ? 'border-amber-500 bg-amber-500 text-white shadow'
                  : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
              }`}
            >
              {tech.name}
            </button>
          )
        })}
      </div>

      <p className="max-w-md text-xs text-stone-500">{activeTech.description}</p>

      {/* Visual Breathing Ring */}
      <div className="relative flex h-64 w-64 items-center justify-center">
        {/* Outer ambient glow */}
        <div
          className={`absolute inset-0 rounded-full bg-gradient-to-tr ${activeTech.color} opacity-20 blur-2xl transition-all duration-1000 ${
            isActive ? 'scale-110' : 'scale-90'
          }`}
        />

        {/* Breathing Circle */}
        <div
          className={`relative flex h-48 w-48 flex-col items-center justify-center rounded-full border-4 border-white/60 bg-gradient-to-br ${
            activeTech.color
          } text-white shadow-2xl transition-transform ease-in-out ${getCircleScale()}`}
        >
          <span className="text-sm font-black uppercase tracking-widest text-white/90">
            {isActive ? currentPhase.name : 'Ready'}
          </span>
          <span className="text-4xl font-black">{isActive ? phaseSecondsLeft : 'Breathe'}</span>
          <span className="mt-1 text-[11px] font-medium text-white/80">
            {isActive ? `Cycle #${completedCycles + 1}` : 'Tap Start'}
          </span>
        </div>
      </div>

      {/* Step Dots indicator */}
      <div className="flex items-center gap-2">
        {activeTech.pattern.map((step, idx) => {
          const isCurrent = idx === phaseIndex && isActive
          return (
            <div
              key={step.name + idx}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition ${
                isCurrent ? 'bg-amber-100 text-amber-900 shadow-sm' : 'bg-stone-100 text-stone-400'
              }`}
            >
              <span>{step.name}</span>
              <span>({step.duration}s)</span>
            </div>
          )
        })}
      </div>

      <p role="status" className="text-sm">{Math.min(seconds, 60)} / 60 seconds · Finish the session to count toward your streak.</p>
      {notice && <p role="status" className="text-sm text-emerald-800">{notice}</p>}
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      {/* Control Buttons */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={isActive ? stopSession : session && seconds >= 60 ? completeSession : startSession}
          className={`flex items-center gap-2 rounded-2xl px-8 py-3 text-sm font-bold text-white shadow-lg transition active:scale-95 ${
            isActive
              ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
              : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
          }`}
        >
          <span>{pending ? 'Saving…' : isActive ? 'Stop session' : session && seconds >= 60 ? 'Retry saving completion' : 'Start 1-minute session'}</span>
        </button>

        <button
          type="button"
          disabled={pending || Boolean(session && seconds >= 60)}
          onClick={() => {
            stopSession()
            setPhaseIndex(0)
            setPhaseSecondsLeft(activeTech.pattern[0].duration)
            setCompletedCycles(0)
          }}
          className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-xs font-bold text-stone-600 shadow-sm hover:bg-stone-50"
        >
          Reset
        </button>

        <button
          type="button"
          onClick={() => setSoundEnabled(!soundEnabled)}
          className={`rounded-2xl border px-4 py-3 text-xs font-bold transition ${
            soundEnabled
              ? 'border-amber-300 bg-amber-100 text-amber-900'
              : 'border-stone-200 bg-white text-stone-500 hover:bg-stone-50'
          }`}
          title="Toggle ambient breathing sound"
        >
          {soundEnabled ? '🔊 Sound On' : '🔇 Muted'}
        </button>
      </div>
    </div>
  )
}
