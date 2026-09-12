import PixelIcon from '../components/PixelIcon.jsx'
import { useState, useMemo } from 'react'
import { StorageService } from '../services/storage.js'

const WRITING_PROMPTS = [
  'What is one small thing that made you smile today?',
  'What is taking up the most mental space right now, and can you let part of it go?',
  'Write about a peaceful moment you experienced recently.',
  'If your mind were a room right now, how does it look?',
  'What are three things your body or mind needs today to feel restored?',
  'Who is someone that made your life easier or happier this week?',
  'Describe a victory, no matter how small, from your day.',
  'What boundary can you set today to protect your energy?',
]

const EMOTION_PATTERNS = {
  happy: {
    words: ['happy', 'glad', 'joy', 'excited', 'great', 'fun', 'love', 'blessed', 'proud', 'wonderful', 'awesome', 'smiling', 'grateful'],
    emoji: '😊',
    label: 'Joyful',
    color: 'bg-amber-100 text-amber-800 border-amber-300',
  },
  stressed: {
    words: ['stress', 'stressed', 'anxious', 'overwhelmed', 'deadline', 'panic', 'exam', 'pressure', 'busy', 'rushing', 'too much'],
    emoji: '😰',
    label: 'Stressed',
    color: 'bg-rose-100 text-rose-800 border-rose-300',
  },
  sad: {
    words: ['sad', 'tired', 'exhausted', 'lonely', 'cry', 'down', 'hurt', 'miss', 'heavy', 'drained'],
    emoji: '😔',
    label: 'Low Energy / Down',
    color: 'bg-sky-100 text-sky-800 border-sky-300',
  },
  angry: {
    words: ['angry', 'mad', 'frustrated', 'annoyed', 'irritated', 'upset', 'hate', 'furious'],
    emoji: '😤',
    label: 'Frustrated',
    color: 'bg-orange-100 text-orange-800 border-orange-300',
  },
  calm: {
    words: ['calm', 'relaxed', 'peace', 'chill', 'quiet', 'rest', 'comfortable', 'gentle', 'content', 'mindful', 'breathe'],
    emoji: '🌿',
    label: 'Peaceful / Calm',
    color: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  },
}

function detectEmotion(text) {
  if (!text.trim()) return { emoji: '📝', label: 'Reflective', color: 'bg-stone-100 text-stone-700 border-stone-200' }
  const lower = text.toLowerCase()
  for (const val of Object.values(EMOTION_PATTERNS)) {
    if (val.words.some((w) => lower.includes(w))) {
      return val
    }
  }
  return { emoji: '💭', label: 'Thoughtful', color: 'bg-stone-100 text-stone-700 border-stone-200' }
}

export default function DiaryView() {
  const [entries, setEntries] = useState(() => StorageService.getDiaryEntries())
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [promptIndex, setPromptIndex] = useState(0)
  const [saveToast, setSaveToast] = useState(false)
  const [weather] = useState('Sunny, 29°C')

  const wordCount = useMemo(() => {
    return content.trim() ? content.trim().split(/\s+/).length : 0
  }, [content])

  const detectedEmotion = useMemo(() => detectEmotion(content), [content])

  const handleNextPrompt = () => {
    setPromptIndex((prev) => (prev + 1) % WRITING_PROMPTS.length)
  }

  const handleUsePrompt = () => {
    setContent((prev) => (prev ? `${prev}\n\n${WRITING_PROMPTS[promptIndex]}: ` : `${WRITING_PROMPTS[promptIndex]}: `))
  }

  const handleSave = (e) => {
    e.preventDefault()
    if (!content.trim()) return

    const newEntry = {
      id: editingId || `diary-${Date.now()}`,
      title: title.trim() || `Reflection on ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
      content,
      date: new Date().toISOString(),
      emotion: detectedEmotion.label,
      weather,
      wordCount,
    }

    const updated = StorageService.saveDiaryEntry(newEntry)
    setEntries(updated)
    setTitle('')
    setContent('')
    setEditingId(null)
    setSaveToast(true)
    setTimeout(() => setSaveToast(false), 2500)
  }

  const handleEdit = (entry) => {
    setEditingId(entry.id)
    setTitle(entry.title)
    setContent(entry.content)
  }

  const handleDelete = (id) => {
    const updated = StorageService.deleteDiaryEntry(id)
    setEntries(updated)
    if (editingId === id) {
      setEditingId(null)
      setTitle('')
      setContent('')
    }
  }

  const filteredEntries = entries.filter(
    (entry) =>
      entry.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.content.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
      {/* Left Column: Diary Editor */}
      <div className="space-y-6 lg:col-span-7">
        {/* Prompt Card */}
        <div className="pixel-inspiration flex items-start justify-between gap-4 rounded-xl border border-amber-200/80 bg-gradient-to-r from-amber-50 to-orange-50/60 p-4 sm:p-5 shadow-sm">
          <div className="space-y-1.5">
            <span className="text-sm font-bold uppercase tracking-wider text-amber-800/80"><PixelIcon symbol="✨" /> Daily Inspiration Prompt</span>
            <p className="text-base sm:text-lg font-medium text-stone-800">"{WRITING_PROMPTS[promptIndex]}"</p>
          </div>
          <div className="flex shrink-0 gap-2 pt-1">
            <button
              type="button"
              onClick={handleUsePrompt}
              className="rounded-lg bg-amber-200/70 px-4 py-2 text-sm font-semibold text-amber-900 transition hover:bg-amber-300"
            >
              Insert
            </button>
            <button
              type="button"
              onClick={handleNextPrompt}
              className="rounded-lg border border-amber-300/80 bg-white px-3 py-2 text-sm text-amber-900 transition hover:bg-amber-100"
              title="Shuffle prompt"
            >
              <PixelIcon symbol="🔄" />
            </button>
          </div>
        </div>

        {/* Editor Form */}
        <form onSubmit={handleSave} className="space-y-4 rounded-2xl border border-stone-200 bg-white p-6 sm:p-8 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-4">
            <div className="flex items-center gap-3">
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold ${detectedEmotion.color}`}>
                <span><PixelIcon symbol={detectedEmotion.emoji} /></span>
                <span>{detectedEmotion.label}</span>
              </span>
              <span className="text-sm text-stone-500"><PixelIcon symbol="⛅" /> {weather}</span>
            </div>
            <div className="text-sm font-medium text-stone-400">
              <span>{wordCount} words</span>
            </div>
          </div>

          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Give this entry a title..."
            className="w-full rounded-lg border border-stone-200 bg-stone-50/50 px-4 py-3 text-lg font-semibold text-stone-800 placeholder-stone-400 focus:border-amber-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-200/50"
          />

          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={8}
            placeholder="How are you feeling today? Write your thoughts freely..."
            className="w-full resize-none rounded-lg border border-stone-200 bg-stone-50/50 p-4 text-base sm:text-lg leading-relaxed text-stone-800 placeholder-stone-400 focus:border-amber-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-200/50"
          />

          <div className="flex items-center justify-between pt-2">
            {editingId ? (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null)
                  setTitle('')
                  setContent('')
                }}
                className="text-sm font-medium text-stone-500 underline hover:text-stone-800"
              >
                Cancel Edit
              </button>
            ) : <div />}

            <div className="flex items-center gap-4">
              {saveToast && <span className="text-sm font-semibold text-emerald-600 animate-pulse">✓ Entry Saved!</span>}
              <button
                type="submit"
                disabled={!content.trim()}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 px-6 py-3 text-base font-semibold text-white shadow-md transition hover:from-amber-700 hover:to-orange-700 disabled:opacity-50 active:scale-95"
              >
                <span>{editingId ? 'Update Reflection' : 'Save Reflection'}</span>
                <span><PixelIcon symbol="💾" /></span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Right Column: History & Past Entries */}
      <div className="space-y-4 lg:col-span-5">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold uppercase tracking-wider text-stone-600">Past Reflections ({entries.length})</h3>
          <input
            type="text"
            placeholder="Search entries..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm text-stone-700 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
          />
        </div>

        <div className="max-h-[600px] space-y-4 overflow-y-auto pr-2">
          {filteredEntries.length === 0 ? (
            <div className="rounded-xl border border-dashed border-stone-300 p-10 text-center text-sm text-stone-400">
              No diary reflections found. Write your first thought on the left!
            </div>
          ) : (
            filteredEntries.map((entry) => (
              <div
                key={entry.id}
                className="group relative rounded-xl border border-stone-200 bg-white p-5 shadow-sm transition hover:border-amber-300 hover:shadow"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-base font-bold text-stone-800">{entry.title}</span>
                  <span className="text-xs text-stone-400">
                    {new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="line-clamp-3 text-sm leading-relaxed text-stone-600">{entry.content}</p>
                <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-3 text-xs text-stone-400">
                  <span className="rounded bg-stone-100 px-2 py-1 text-stone-600">{entry.emotion || 'Reflective'}</span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleEdit(entry)}
                      className="text-amber-700 text-sm hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(entry.id)}
                      className="text-rose-600 text-sm hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
