import { useState, useMemo } from 'react'
import { StorageService } from '../services/storage.js'

const MOODS = [
  { id: 'Happy', emoji: '😄', label: 'Happy', color: 'bg-amber-100 border-amber-400 text-amber-900', img: '/wellness/happy.png', quote: 'Keep shining, the world needs your light!' },
  { id: 'Excited', emoji: '🤩', label: 'Excited', color: 'bg-orange-100 border-orange-400 text-orange-900', img: '/wellness/excited.png', quote: 'Your excitement is the spark for amazing things!' },
  { id: 'Relaxed', emoji: '😌', label: 'Relaxed', color: 'bg-emerald-100 border-emerald-400 text-emerald-900', img: '/wellness/relaxed.png', quote: 'Peace of mind is the best kind of success.' },
  { id: 'Sleepy', emoji: '🥱', label: 'Sleepy', color: 'bg-indigo-100 border-indigo-400 text-indigo-900', img: '/wellness/sleepy.png', quote: 'Rest well — even dreams need time to grow.' },
  { id: 'Sad', emoji: '😢', label: 'Sad', color: 'bg-sky-100 border-sky-400 text-sky-900', img: '/wellness/sad.png', quote: "It's okay to be not okay. Better days are coming." },
  { id: 'Angry', emoji: '😡', label: 'Angry', color: 'bg-rose-100 border-rose-400 text-rose-900', img: '/wellness/angry.png', quote: "Breathe deeply. Stay calm. You're in control." },
]

const CONTEXT_TAGS = ['Studies 📚', 'Work 💻', 'Friends 👥', 'Family 🏡', 'Sleep 🌙', 'Health 🌿', 'Gaming 🎮', 'Exercise 🏃']

export default function MoodTrackerView() {
  const [logs, setLogs] = useState(() => StorageService.getMoodLogs())
  const [selectedMood, setSelectedMood] = useState(MOODS[0].id)
  const [intensity, setIntensity] = useState(7)
  const [selectedTags, setSelectedTags] = useState(['Studies 📚'])
  const [note, setNote] = useState('')
  const [savedSuccess, setSavedSuccess] = useState(false)

  const activeMoodObj = useMemo(() => {
    return MOODS.find((m) => m.id === selectedMood) || MOODS[0]
  }, [selectedMood])

  const toggleTag = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    )
  }

  const handleSave = (e) => {
    e.preventDefault()
    const newLog = {
      mood: activeMoodObj.id,
      rating: intensity,
      tags: selectedTags,
      note: note.trim(),
      date: new Date().toISOString().split('T')[0],
      timestamp: new Date().toISOString(),
    }
    const updated = StorageService.saveMoodLog(newLog)
    setLogs(updated)
    setNote('')
    setSavedSuccess(true)
    setTimeout(() => setSavedSuccess(false), 2500)
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
      {/* Left Column: Log New Mood */}
      <div className="space-y-6 lg:col-span-7">
        {/* Mood Selection Carousel / Grid */}
        <div>
          <label className="mb-3 block text-xs font-bold uppercase tracking-wider text-stone-500">
            How are you feeling right now?
          </label>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {MOODS.map((m) => {
              const isSelected = m.id === selectedMood
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedMood(m.id)}
                  className={`flex flex-col items-center justify-center rounded-2xl border-2 p-3 transition active:scale-95 ${
                    isSelected
                      ? `${m.color} shadow-md scale-105 font-bold`
                      : 'border-stone-200 bg-white text-stone-600 hover:border-amber-200 hover:bg-stone-50'
                  }`}
                >
                  <span className="text-3xl">{m.emoji}</span>
                  <span className="mt-1 text-xs">{m.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Motivational Quote Card */}
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-center">
          <p className="text-sm font-semibold italic text-amber-900">"{activeMoodObj.quote}"</p>
        </div>

        {/* Intensity Slider */}
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-stone-600">
              Mood Intensity Level
            </label>
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-black text-amber-800">
              {intensity} / 10
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="10"
            value={intensity}
            onChange={(e) => setIntensity(Number(e.target.value))}
            className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-stone-200 accent-amber-600"
          />
          <div className="mt-1 flex justify-between text-[11px] text-stone-400">
            <span>Mild (1)</span>
            <span>Balanced (5)</span>
            <span>Intense (10)</span>
          </div>

          {/* Reason Tags */}
          <div className="mt-5 border-t border-stone-100 pt-4">
            <label className="mb-2.5 block text-xs font-bold uppercase tracking-wider text-stone-600">
              What contributed to this mood?
            </label>
            <div className="flex flex-wrap gap-2">
              {CONTEXT_TAGS.map((tag) => {
                const active = selectedTags.includes(tag)
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`rounded-xl border px-3 py-1 text-xs font-medium transition ${
                      active
                        ? 'border-amber-500 bg-amber-500 text-white shadow-sm'
                        : 'border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    {tag}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Notes */}
          <div className="mt-4">
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add any extra thoughts or context (optional)..."
              className="w-full rounded-xl border border-stone-200 bg-stone-50/60 p-3 text-xs text-stone-800 placeholder-stone-400 focus:border-amber-400 focus:bg-white focus:outline-none"
            />
          </div>

          {/* Save Button */}
          <div className="mt-4 flex items-center justify-between">
            {savedSuccess ? (
              <span className="text-xs font-bold text-emerald-600">✓ Mood Logged!</span>
            ) : <span />}
            <button
              type="button"
              onClick={handleSave}
              className="rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 px-6 py-2 text-sm font-semibold text-white shadow-md transition hover:from-amber-700 hover:to-orange-700 active:scale-95"
            >
              Save Mood Entry
            </button>
          </div>
        </div>
      </div>

      {/* Right Column: Mood History & Stats */}
      <div className="space-y-4 lg:col-span-5">
        <h3 className="text-sm font-bold uppercase tracking-wider text-stone-600">Recent Mood Log ({logs.length})</h3>
        <div className="max-h-[500px] space-y-3 overflow-y-auto pr-1">
          {logs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-xs text-stone-400">
              No mood logs yet. Choose your mood and save your first log!
            </div>
          ) : (
            logs.map((log) => {
              const moodItem = MOODS.find((m) => m.id === log.mood) || MOODS[0]
              return (
                <div
                  key={log.id || log.timestamp}
                  className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm transition hover:shadow"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{moodItem.emoji}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-stone-800">{log.mood}</span>
                          <span className="rounded-full bg-stone-100 px-2 py-0.2 text-[10px] font-bold text-stone-600">
                            Level {log.rating}/10
                          </span>
                        </div>
                        <span className="text-[10px] text-stone-400">{log.date}</span>
                      </div>
                    </div>
                  </div>

                  {log.note && <p className="mt-2 text-xs text-stone-600">{log.note}</p>}

                  {log.tags && log.tags.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-stone-100 pt-2">
                      {log.tags.map((tag) => (
                        <span key={tag} className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-600">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
