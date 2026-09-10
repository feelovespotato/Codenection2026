import { useState, useEffect, useRef } from 'react'
import { StorageService } from '../services/storage.js'

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

  const audioRef = useRef(null)

  const activeTech = TECHNIQUES.find((t) => t.id === selectedTechnique) || TECHNIQUES[0]
  const currentPhase = activeTech.pattern[phaseIndex]

  // Switch technique
  const handleSelectTechnique = (techId) => {
    const tech = TECHNIQUES.find((t) => t.id === techId) || TECHNIQUES[0]
    setSelectedTechnique(techId)
    setIsActive(false)
    setPhaseIndex(0)
    setPhaseSecondsLeft(tech.pattern[0].duration)
  }

  // Timer loop
  useEffect(() => {
    let interval = null
    if (isActive) {
      interval = setInterval(() => {
        setPhaseSecondsLeft((prev) => {
          if (prev <= 1) {
            // Next phase
            setPhaseIndex((currPhaseIdx) => {
              const nextIdx = (currPhaseIdx + 1) % activeTech.pattern.length
              if (nextIdx === 0) {
                setCompletedCycles((c) => c + 1)
                StorageService.recordRecovery('breathing', `${activeTech.name} Breathing Session`)
              }
              return nextIdx
            })
            return activeTech.pattern[(phaseIndex + 1) % activeTech.pattern.length].duration
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [isActive, phaseIndex, activeTech])

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

      {/* Control Buttons */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setIsActive(!isActive)}
          className={`flex items-center gap-2 rounded-2xl px-8 py-3 text-sm font-bold text-white shadow-lg transition active:scale-95 ${
            isActive
              ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
              : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
          }`}
        >
          <span>{isActive ? '⏸ Pause' : '▶ Start Breathing'}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setIsActive(false)
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
