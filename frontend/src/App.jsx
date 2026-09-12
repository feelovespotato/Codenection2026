import PixelIcon from './components/PixelIcon.jsx'
import { useCallback, useEffect, useState } from 'react'
import MainGamePage from './mainpage/MainGamePage.jsx'
import Modal from './components/Modal.jsx'
import DiaryView from './views/DiaryView.jsx'
import MoodTrackerView from './views/MoodTrackerView.jsx'
import CalendarView from './views/CalendarView.jsx'
import BreathingView from './views/BreathingView.jsx'
import StressQuizView from './views/StressQuizView.jsx'
import DashboardView from './views/DashboardView.jsx'
import SoundView from './views/SoundView.jsx'
import { useSoundPlayer } from './services/useSoundPlayer.js'
import InstructionsView from './views/InstructionsView.jsx'
import AgentChatView from './views/AgentChatView.jsx'
import { StorageService } from './services/storage.js'
import RoomMap from './social/RoomMap.jsx'
import SocialRoom from './social/SocialRoom.jsx'
import { useMoodify } from './services/moodify-context.js'

export default function App() {
  const [activeModal, setActiveModal] = useState(() => new URLSearchParams(window.location.search).has('calendar') ? 'calendar' : null)
  const [activeScene, setActiveScene] = useState('main')
  const { data, refresh } = useMoodify()
  const capacity = data?.capacity
  const [musicSettings, setMusicSettings] = useState(() => StorageService.getSettings())
  const soundPlayer = useSoundPlayer(musicSettings)
  const handleHotspot = useCallback((spotId) => console.log('Hotspot tapped:', spotId), [])

  useEffect(() => {
    StorageService.saveSettings(musicSettings)
  }, [musicSettings])

  const setMusicVolume = useCallback((volume) => {
    setMusicSettings((current) => ({ ...current, musicVolume: Math.min(1, Math.max(0, volume)) }))
  }, [])

  const setMusicEnabled = useCallback((enabled) => {
    setMusicSettings((current) => ({ ...current, musicEnabled: enabled }))
  }, [])

  const refreshCapacity = useCallback(() => {
    refresh().catch(() => {})
  }, [refresh])

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

  const handleCompanion = useCallback(() => {
    setActiveModal('agent-chat')
  }, [])

  useEffect(() => {
    const viewport = window.visualViewport
    const update = () => {
      document.documentElement.style.setProperty('--visible-height', `${viewport?.height || window.innerHeight}px`)
      document.documentElement.style.setProperty('--visible-top', `${viewport?.offsetTop || 0}px`)
    }
    update()
    viewport?.addEventListener('resize', update)
    viewport?.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    return () => {
      viewport?.removeEventListener('resize', update)
      viewport?.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  // Color helper for capacity pill
  const getCapacityBadge = () => {
    const score = capacity?.capacityScore ?? 0
    if (score >= 85) return 'bg-rose-500/90 text-white border-rose-400'
    if (score >= 65) return 'bg-amber-500/90 text-white border-amber-400'
    return 'bg-emerald-500/90 text-white border-emerald-400'
  }

  const [showDownloadBanner, setShowDownloadBanner] = useState(() => !navigator.userAgent.includes('Electron') && !sessionStorage.getItem('dismissedDownload'))
  const [isNavHidden, setIsNavHidden] = useState(false)

  return (
    <div className="pixel-ui relative h-screen w-screen overflow-hidden bg-[#0d0b12] text-[#fff8ef]" data-scene={activeScene}>

      {/* Desktop Companion Download Banner */}
      {showDownloadBanner && (
        <div className="pointer-events-auto absolute inset-x-0 top-0 z-50 flex items-center justify-between gap-3 bg-gradient-to-r from-amber-800/95 to-orange-700/95 px-4 py-2 text-sm text-white shadow-lg backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <span className="text-lg">🐱</span>
            <span className="font-semibold">Get the Desktop Companion — your pixel girl lives on your screen!</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href="https://github.com/feelovespotato/Codenection2026/releases/latest/download/Moodify.Companion.Setup.1.0.0.exe"
              download
              className="rounded-lg bg-white px-3 py-1 text-sm font-bold text-amber-800 hover:bg-amber-50 transition"
            >
              ⬇ Download for Windows
            </a>
            <button
              type="button"
              onClick={() => { sessionStorage.setItem('dismissedDownload', '1'); setShowDownloadBanner(false) }}
              className="rounded px-2 py-1 text-white/70 hover:text-white transition"
              aria-label="Dismiss"
            >✕</button>
          </div>
        </div>
      )}

      {/* Floating Top Wellness Navigation Bar — single-line strip pinned to the very top */}
      {activeScene === 'main' && (
        <>
          <header className={`pixel-hud pointer-events-none absolute inset-x-0 z-40 flex items-center gap-2 p-2 sm:gap-3 sm:p-3 sm:px-6 ${showDownloadBanner ? 'top-10' : 'top-0'}`}>
            {/* Brand & Room Title */}
            <div className="pixel-brand pointer-events-auto flex shrink-0 items-center gap-2 rounded-2xl border border-white/15 bg-black/50 px-4 py-2 backdrop-blur-md shadow-lg">
              <span className="text-xl"><PixelIcon symbol="🌿" /></span>
              <div className="hidden sm:block">
                <h1 className="text-xs font-black uppercase tracking-wider text-amber-100">Moodify</h1>
                <p className="text-[10px] text-stone-400">Mindful Capacity & Recovery</p>
              </div>
            </div>

            {/* Hide/show toggle for the Quick Hub row */}
            <button
              type="button"
              onClick={() => setIsNavHidden((hidden) => !hidden)}
              className="pixel-nav-toggle pointer-events-auto flex shrink-0 items-center justify-center"
              title={isNavHidden ? 'Show navigation' : 'Hide navigation'}
              aria-expanded={!isNavHidden}
              aria-label={isNavHidden ? 'Show navigation' : 'Hide navigation'}
            >
              <span>{isNavHidden ? '☰' : '✕'}</span>
            </button>

            {/* Quick Hub Buttons — one horizontal row, centered, scrolls sideways instead of wrapping */}
            {!isNavHidden && (
            <nav
              aria-label="Moodify Quick Hub"
              className="pixel-nav pointer-events-auto flex min-w-0 flex-1 items-center justify-center gap-1.5 overflow-x-auto"
            >
              <button
                type="button"
                onClick={() => setActiveModal('diary')}
                aria-current={activeModal === 'diary' ? 'page' : undefined}
                className="flex shrink-0 items-center justify-center gap-2"
                title="Diary"
              >
                <span><PixelIcon symbol="📖" /></span>
                <span className="hidden md:inline">Diary</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveModal('mood')}
                aria-current={activeModal === 'mood' ? 'page' : undefined}
                className="flex shrink-0 items-center justify-center gap-2"
                title="Mood Tracker"
              >
                <span><PixelIcon symbol="😄" /></span>
                <span className="hidden md:inline">Mood</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveModal('calendar')}
                aria-current={activeModal === 'calendar' ? 'page' : undefined}
                className="flex shrink-0 items-center justify-center gap-2"
                title="Calendar"
              >
                <span><PixelIcon symbol="📅" /></span>
                <span className="hidden md:inline">Calendar</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveModal('breathing')}
                aria-current={activeModal === 'breathing' ? 'page' : undefined}
                className="flex shrink-0 items-center justify-center gap-2"
                title="Breathing"
              >
                <span><PixelIcon symbol="⏳" /></span>
                <span className="hidden md:inline">Breathe</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveModal('stress')}
                aria-current={activeModal === 'stress' ? 'page' : undefined}
                className="flex shrink-0 items-center justify-center gap-2"
                title="Stress Check-In"
              >
                <span><PixelIcon symbol="📱" /></span>
                <span className="hidden md:inline">Check-In</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveModal('sound')}
                aria-current={activeModal === 'sound' ? 'page' : undefined}
                className="flex shrink-0 items-center justify-center gap-2"
                title="Ambient Audio"
              >
                <span><PixelIcon symbol="📻" /></span>
                <span className="hidden md:inline">Sound</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveModal('instructions')}
                aria-current={activeModal === 'instructions' ? 'page' : undefined}
                className="flex shrink-0 items-center justify-center gap-2"
                title="Guide"
              >
                <span><PixelIcon symbol="❓" /></span>
                <span className="hidden md:inline">Guide</span>
              </button>
            </nav>
            )}
            {isNavHidden && <div className="flex-1" />}

            {/* Capacity Indicator Pill */}
            <button
              type="button"
              onClick={() => setActiveModal('dashboard')}
              className={`pixel-capacity pointer-events-auto flex shrink-0 items-center gap-2 rounded-2xl border px-3.5 py-1.5 text-xs font-black shadow-lg backdrop-blur-md transition hover:scale-105 active:scale-95 ${getCapacityBadge()}`}
              title="Click to view Capacity Gauge & Load Shedder"
            >
              <span>Capacity:</span>
              <span>{capacity ? `${capacity.capacityScore}%` : '—'}</span>
            </button>
          </header>
        </>
      )}

      {/* Main PixiJS Game Room */}
      {activeScene === 'main' && (
        <MainGamePage
          onActivity={handleActivity}
          onFeature={handleFeature}
          onHotspot={handleHotspot}
          onCompanion={handleCompanion}
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
          maxWidth="max-w-6xl"
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
          maxWidth="max-w-5xl"
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
          maxWidth="max-w-3xl"
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
          <SoundView player={soundPlayer} />
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

      {activeModal === 'agent-chat' && (
        <Modal
          title="Moodify Assistant"
          subtitle="Type or speak to your AI assistant — a space to think out loud"
          icon="💬"
          onClose={closeModal}
          maxWidth="max-w-5xl"
        >
          <AgentChatView />
        </Modal>
      )}
    </div>
  )
}