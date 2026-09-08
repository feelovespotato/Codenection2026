import { useState, useRef, useEffect } from 'react'

const TRACKS = [
  { id: 'rain', name: 'Gentle Rain', file: '/audio/rain.mp3', emoji: '🌧️' },
  { id: 'forest', name: 'Peaceful Forest', file: '/audio/forest.mp3', emoji: '🌲' },
  { id: 'calm_piano', name: 'Calm Piano', file: '/audio/calm_piano.mp3', emoji: '🎹' },
  { id: 'bird', name: 'Morning Birds', file: '/audio/bird.mp3', emoji: '🐦' },
  { id: 'ocean', name: 'Ocean Waves', file: '/audio/ocean.mp3', emoji: '🌊' },
  { id: 'waterfall', name: 'Cascade Waterfall', file: '/audio/waterfall.mp3', emoji: '💧' },
  { id: 'keyboard', name: 'Study Typing', file: '/audio/keyboard.mp3', emoji: '💻' },
  { id: 'lofi_music', name: 'Lo-Fi Chill', file: '/audio/lofi_music.wav', emoji: '🎧' },
]

export default function SoundView() {
  const [activeTrackId, setActiveTrackId] = useState(TRACKS[0].id)
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(0.7)
  const [timerMinutes, setTimerMinutes] = useState(null)
  const [timeLeft, setTimeLeft] = useState(null)

  const audioRef = useRef(null)

  const activeTrack = TRACKS.find((t) => t.id === activeTrackId) || TRACKS[0]

  const getAudio = () => {
    if (!audioRef.current) {
      const audio = new Audio(activeTrack.file)
      audio.loop = true
      audio.volume = volume
      audioRef.current = audio
    }
    return audioRef.current
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  // Volume change
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume
    }
  }, [volume])

  const selectTrack = (track) => {
    setActiveTrackId(track.id)
    const audio = getAudio()
    audio.src = track.file
    audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
  }

  // Play / pause toggle
  const togglePlay = () => {
    const audio = getAudio()
    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
    } else {
      audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
    }
  }

  const handleSelectTimer = (mins) => {
    if (timerMinutes === mins) {
      setTimerMinutes(null)
      setTimeLeft(null)
    } else {
      setTimerMinutes(mins)
      setTimeLeft(mins * 60)
    }
  }

  // Sleep Timer countdown
  useEffect(() => {
    if (!timerMinutes) return

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (!prev || prev <= 1) {
          audioRef.current?.pause()
          setIsPlaying(false)
          setTimerMinutes(null)
          return null
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [timerMinutes])

  return (
    <div className="space-y-6">
      {/* Player Header */}
      <div className="flex flex-col items-center justify-center rounded-2xl border border-stone-200 bg-gradient-to-br from-amber-50 to-orange-50/50 p-6 shadow-sm text-center">
        <span className="text-5xl">{activeTrack.emoji}</span>
        <h3 className="mt-3 text-lg font-bold text-stone-800">{activeTrack.name}</h3>
        <p className="text-xs text-stone-500">Soothing soundscape for focus, reflection, and recovery</p>

        {/* Play/Pause Button */}
        <div className="mt-5 flex items-center gap-4">
          <button
            type="button"
            onClick={togglePlay}
            className={`flex h-14 w-14 items-center justify-center rounded-full text-xl text-white shadow-xl transition active:scale-95 ${
              isPlaying ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/30' : 'bg-stone-800 hover:bg-stone-900 shadow-stone-800/30'
            }`}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>
        </div>

        {/* Volume Bar */}
        <div className="mt-5 flex w-full max-w-xs items-center gap-3">
          <span className="text-xs text-stone-500">🔈</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-stone-300 accent-amber-600"
          />
          <span className="text-xs text-stone-500">🔊</span>
        </div>

        {/* Sleep Timer */}
        <div className="mt-5 flex items-center gap-2">
          <span className="text-xs text-stone-500 font-semibold">Sleep Timer:</span>
          {[15, 30, 60].map((mins) => (
            <button
              key={mins}
              type="button"
              onClick={() => handleSelectTimer(mins)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                timerMinutes === mins ? 'bg-amber-600 text-white' : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-100'
              }`}
            >
              {mins}m
            </button>
          ))}
          {timeLeft && (
            <span className="text-xs font-bold text-amber-700 ml-2">
              ⏱ {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
            </span>
          )}
        </div>
      </div>

      {/* Track Selection Grid */}
      <div>
        <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-stone-600">
          Available Soundscapes
        </h4>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {TRACKS.map((track) => {
            const isSelected = track.id === activeTrackId
            return (
              <button
                key={track.id}
                type="button"
                onClick={() => selectTrack(track)}
                className={`flex items-center gap-3 rounded-xl border p-3 text-left transition active:scale-95 ${
                  isSelected
                    ? 'border-amber-500 bg-amber-50 shadow-sm'
                    : 'border-stone-200 bg-white hover:border-amber-200 hover:bg-stone-50'
                }`}
              >
                <span className="text-2xl">{track.emoji}</span>
                <div>
                  <p className="text-xs font-bold text-stone-800">{track.name}</p>
                  <p className="text-[10px] text-stone-400">
                    {isSelected && isPlaying ? 'Playing now 🎵' : 'Tap to play'}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
