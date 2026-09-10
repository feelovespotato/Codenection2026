import PixelIcon from '../components/PixelIcon.jsx'
import { TRACKS } from '../services/sound-player.js'

export default function SoundView({ player }) {
  const { activeTrackId, isPlaying, isStarting, volume, timerMinutes, timeLeft, error, selectTrack, togglePlay, setVolume, handleSelectTimer } = player
  const activeTrack = TRACKS.find(track => track.id === activeTrackId) || TRACKS[0]

  return (
    <div className="space-y-6">
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      {/* Player Header */}
      <div className="flex flex-col items-center justify-center rounded-2xl border border-stone-200 bg-gradient-to-br from-amber-50 to-orange-50/50 p-6 shadow-sm text-center">
        <span className="text-5xl"><PixelIcon symbol={activeTrack.emoji} /></span>
        <h3 className="mt-3 text-lg font-bold text-stone-800">{activeTrack.name}</h3>
        <p className="text-xs text-stone-500">Keeps playing in your room. Default music resumes when playback stops or the timer ends.</p>

        {/* Play/Pause Button */}
        <div className="mt-5 flex items-center gap-4">
          <button
            type="button"
            onClick={togglePlay}
            aria-label={isPlaying || isStarting ? "Pause soundscape" : "Play soundscape"}
            className={`flex h-14 w-14 items-center justify-center rounded-full text-xl text-white shadow-xl transition active:scale-95 ${
              isPlaying ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/30' : 'bg-stone-800 hover:bg-stone-900 shadow-stone-800/30'
            }`}
          >
            {isStarting ? '…' : isPlaying ? '⏸' : '▶'}
          </button>
        </div>

        {/* Volume Bar */}
        <div className="mt-5 flex w-full max-w-xs items-center gap-3">
          <span className="text-xs text-stone-500"><PixelIcon symbol="🔈" /></span>
          <input
            type="range"
            aria-label="Soundscape volume"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-stone-300 accent-amber-600"
          />
          <span className="text-xs text-stone-500"><PixelIcon symbol="🔊" /></span>
        </div>

        {/* Sleep Timer */}
        <div className="mt-5 flex items-center gap-2">
          <span className="text-xs text-stone-500 font-semibold">Sleep Timer:</span>
          {[15, 30, 60].map((mins) => (
            <button
              key={mins}
              type="button"
              onClick={() => handleSelectTimer(mins)}
              aria-pressed={timerMinutes === mins}
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
                aria-pressed={isSelected}
                type="button"
                onClick={() => selectTrack(track)}
                className={`flex items-center gap-3 rounded-xl border p-3 text-left transition active:scale-95 ${
                  isSelected
                    ? 'border-amber-500 bg-amber-50 shadow-sm'
                    : 'border-stone-200 bg-white hover:border-amber-200 hover:bg-stone-50'
                }`}
              >
                <span className="text-2xl"><PixelIcon symbol={track.emoji} /></span>
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
