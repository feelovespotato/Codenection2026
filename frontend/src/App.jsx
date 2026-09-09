import { useCallback, useEffect, useRef, useState } from 'react'
import MainGamePage from './mainpage/MainGamePage.jsx'
import Modal from './components/Modal.jsx'
import DiaryView from './views/DiaryView.jsx'
import MoodTrackerView from './views/MoodTrackerView.jsx'
import CalendarView from './views/CalendarView.jsx'
import BreathingView from './views/BreathingView.jsx'
import StressQuizView from './views/StressQuizView.jsx'
import DashboardView from './views/DashboardView.jsx'
import SoundView from './views/SoundView.jsx'
import InstructionsView from './views/InstructionsView.jsx'
import { StorageService } from './services/storage.js'
import RoomMap from './social/RoomMap.jsx'
import SocialRoom from './social/SocialRoom.jsx'

export default function App() {
  const [activeModal, setActiveModal] = useState(null)
  const [activeScene, setActiveScene] = useState('main')
  const [capacity, setCapacity] = useState(() => StorageService.calculateCapacity())
  const [musicSettings, setMusicSettings] = useState(() => StorageService.getSettings())
  const backgroundMusicRef = useRef(null)
  const initialMusicSettingsRef = useRef(musicSettings)
  const musicEnabledRef = useRef(musicSettings.musicEnabled)

  useEffect(() => {
    const initialSettings = initialMusicSettingsRef.current
    const audio = new Audio('/audio/calm_piano.mp3')
    audio.loop = true
    audio.preload = 'auto'
    audio.volume = initialSettings.musicVolume
    audio.muted = !initialSettings.musicEnabled
    backgroundMusicRef.current = audio

    const beginAfterInteraction = () => {
      audio.play().then(() => {
        if (!musicEnabledRef.current) audio.pause()
        window.removeEventListener('pointerdown', beginAfterInteraction)
        window.removeEventListener('keydown', beginAfterInteraction)
      }).catch(() => {})
    }

    if (initialSettings.musicEnabled) audio.play().catch(() => {})
    window.addEventListener('pointerdown', beginAfterInteraction)
    window.addEventListener('keydown', beginAfterInteraction)

    return () => {
      window.removeEventListener('pointerdown', beginAfterInteraction)
      window.removeEventListener('keydown', beginAfterInteraction)
      audio.pause()
      audio.src = ''
      backgroundMusicRef.current = null
    }
  }, [])

  useEffect(() => {
    musicEnabledRef.current = musicSettings.musicEnabled
    StorageService.saveSettings(musicSettings)
    const audio = backgroundMusicRef.current
    if (!audio) return
    audio.volume = musicSettings.musicVolume
    audio.muted = !musicSettings.musicEnabled
    if (musicSettings.musicEnabled) audio.play().catch(() => {})
    else audio.pause()
  }, [musicSettings])

  const setMusicVolume = useCallback((volume) => {
    setMusicSettings((current) => ({ ...current, musicVolume: Math.min(1, Math.max(0, volume)) }))
  }, [])

  const setMusicEnabled = useCallback((enabled) => {
    setMusicSettings((current) => ({ ...current, musicEnabled: enabled }))
  }, [])

  const refreshCapacity = useCallback(() => {
    setCapacity(StorageService.calculateCapacity())
  }, [])

  const closeModal = useCallback(() => {
    setActiveModal(null)
    refreshCapacity()
  }, [refreshCapacity])

  // Handle room item clicks
  const handleActivity = useCallback((iconId) => {
    if (iconId === 'phone') {
      setActiveScene('map')
      return
    }
    const map = {
      diary: 'diary',
      mood: 'mood',
      calendar: 'calendar',
      hourglass: 'breathing',
      graph: 'dashboard',
      instructions: 'instructions',
    }
    if (map[iconId]) {
      setActiveModal(map[iconId])
    }
  }, [])

  const handleFeature = useCallback((feature) => {
    if (feature === 'radio' || feature === 'radio-play') {
      setActiveModal('sound')
    }
  }, [])

  // Color helper for capacity pill
  const getCapacityBadge = () => {
    const score = capacity.capacityScore
    if (score >= 85) return 'bg-rose-500/90 text-white border-rose-400'
    if (score >= 65) return 'bg-amber-500/90 text-white border-amber-400'
    return 'bg-emerald-500/90 text-white border-emerald-400'
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#0d0b12] text-[#fff8ef]" data-scene={activeScene}>
      {/* Floating Top Wellness Navigation Bar */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-40 flex items-center justify-between p-3 sm:px-6">
        {/* Brand & Room Title */}
        <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-white/15 bg-black/50 px-4 py-2 backdrop-blur-md shadow-lg">
          <span className="text-xl">🌿</span>
          <div className="hidden sm:block">
            <h1 className="text-xs font-black uppercase tracking-wider text-amber-100">Moodify</h1>
            <p className="text-[10px] text-stone-400">Mindful Capacity & Recovery</p>
          </div>
        </div>

        {/* Quick Hub Buttons */}
        <nav
          aria-label="Moodify Quick Hub"
          className="pointer-events-auto flex items-center gap-1.5 rounded-2xl border border-white/15 bg-black/55 p-1.5 backdrop-blur-md shadow-xl overflow-x-auto max-w-[70vw] sm:max-w-none"
        >
          <button
            type="button"
            onClick={() => setActiveModal('diary')}
            className="flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-semibold text-stone-200 transition hover:bg-white/15 hover:text-white"
            title="Diary"
          >
            <span>📖</span>
            <span className="hidden md:inline">Diary</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveModal('mood')}
            className="flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-semibold text-stone-200 transition hover:bg-white/15 hover:text-white"
            title="Mood Tracker"
          >
            <span>😄</span>
            <span className="hidden md:inline">Mood</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveModal('calendar')}
            className="flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-semibold text-stone-200 transition hover:bg-white/15 hover:text-white"
            title="Calendar"
          >
            <span>📅</span>
            <span className="hidden md:inline">Calendar</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveModal('breathing')}
            className="flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-semibold text-stone-200 transition hover:bg-white/15 hover:text-white"
            title="Breathing"
          >
            <span>⏳</span>
            <span className="hidden md:inline">Breathe</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveModal('stress')}
            className="flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-semibold text-stone-200 transition hover:bg-white/15 hover:text-white"
            title="Stress Check-In"
          >
            <span>📱</span>
            <span className="hidden md:inline">Check-In</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveModal('sound')}
            className="flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-semibold text-stone-200 transition hover:bg-white/15 hover:text-white"
            title="Ambient Audio"
          >
            <span>📻</span>
            <span className="hidden md:inline">Sound</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveModal('instructions')}
            className="flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-semibold text-stone-200 transition hover:bg-white/15 hover:text-white"
            title="Guide"
          >
            <span>❓</span>
            <span className="hidden md:inline">Guide</span>
          </button>
        </nav>

        {/* Capacity Indicator Pill */}
        <button
          type="button"
          onClick={() => setActiveModal('dashboard')}
          className={`pointer-events-auto flex items-center gap-2 rounded-2xl border px-3.5 py-1.5 text-xs font-black shadow-lg backdrop-blur-md transition hover:scale-105 active:scale-95 ${getCapacityBadge()}`}
          title="Click to view Capacity Gauge & Load Shedder"
        >
          <span>Capacity:</span>
          <span>{capacity.capacityScore}%</span>
        </button>
      </header>

      {/* Main PixiJS Game Room */}
      {activeScene === 'main' && (
        <MainGamePage
          onActivity={handleActivity}
          onFeature={handleFeature}
          onHotspot={(spotId) => console.log('Hotspot tapped:', spotId)}
          musicEnabled={musicSettings.musicEnabled}
          musicVolume={musicSettings.musicVolume}
          onMusicEnabledChange={setMusicEnabled}
          onMusicVolumeChange={setMusicVolume}
        />
      )}

      {activeScene === 'map' && (
        <RoomMap
          onBack={() => setActiveScene('main')}
          onEnterRoom={() => setActiveScene('social')}
        />
      )}

      {activeScene === 'social' && (
        <SocialRoom onBackToMap={() => setActiveScene('map')} />
      )}

      {/* Wellness Modals */}
      {activeModal === 'diary' && (
        <Modal
          title="Reflections & Diary"
          subtitle="Express your day with prompts, live sentiment analysis & word tracking"
          icon="📖"
          onClose={closeModal}
          maxWidth="max-w-5xl"
        >
          <DiaryView />
        </Modal>
      )}

      {activeModal === 'mood' && (
        <Modal
          title="Daily Mood Tracker"
          subtitle="Record emotional state, intensity, contributing factors & mindful quotes"
          icon="😄"
          onClose={closeModal}
          maxWidth="max-w-4xl"
        >
          <MoodTrackerView />
        </Modal>
      )}

      {activeModal === 'calendar' && (
        <Modal
          title="Schedule & Workload Calendar"
          subtitle="Categorize Cognitive, Social & Recharge hours with automatic load calculation"
          icon="📅"
          onClose={closeModal}
          maxWidth="max-w-5xl"
        >
          <CalendarView />
        </Modal>
      )}

      {activeModal === 'breathing' && (
        <Modal
          title="Guided Breathing Pacer"
          subtitle="Harmonize heart rate, soothe anxious thoughts & restore balance"
          icon="⏳"
          onClose={closeModal}
          maxWidth="max-w-xl"
        >
          <BreathingView />
        </Modal>
      )}

      {activeModal === 'stress' && (
        <Modal
          title="Stress Signal & Assessment"
          subtitle="Ground-truth 1–5 daily check-in or comprehensive 10-question chat survey"
          icon="📱"
          onClose={closeModal}
          maxWidth="max-w-2xl"
        >
          <StressQuizView onCheckInComplete={refreshCapacity} />
        </Modal>
      )}

      {activeModal === 'dashboard' && (
        <Modal
          title="Capacity Dashboard & Rebalancer"
          subtitle="Combines objective schedule data with subjective stress to prevent burnout"
          icon="📊"
          onClose={closeModal}
          maxWidth="max-w-5xl"
        >
          <DashboardView
            onOpenCalendar={() => setActiveModal('calendar')}
            onOpenBreathing={() => setActiveModal('breathing')}
          />
        </Modal>
      )}

      {activeModal === 'sound' && (
        <Modal
          title="Ambient Soundscapes"
          subtitle="Gentle rain, forest birds, ocean waves, piano & lo-fi audio"
          icon="📻"
          onClose={closeModal}
          maxWidth="max-w-2xl"
        >
          <SoundView />
        </Modal>
      )}

      {activeModal === 'instructions' && (
        <Modal
          title="How Moodify Works"
          subtitle="Explore your room, understand capacity, and discover balance"
          icon="❓"
          onClose={closeModal}
          maxWidth="max-w-3xl"
        >
          <InstructionsView />
        </Modal>
      )}
    </div>
  )
}
