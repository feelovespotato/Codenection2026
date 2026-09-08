export default function InstructionsView() {
  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Introduction Card */}
      <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50/50 p-5 shadow-sm text-center">
        <h3 className="text-base font-bold text-amber-950">Welcome to Moodify 🌿</h3>
        <p className="mt-1 text-xs leading-relaxed text-amber-800/90">
          Moodify is your workload and recovery assistant. It combines <strong>objective calendar commitments</strong> with <strong>subjective stress signals</strong> to protect your mental capacity before burnout happens.
        </p>
      </div>

      {/* Room Controls & Hotspots */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-stone-600">
          🎮 Room Navigation & Keyboard Controls
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 font-bold text-xs text-stone-800">
              <span className="rounded bg-stone-100 px-2 py-1">←</span>
              <span className="rounded bg-stone-100 px-2 py-1">→</span>
              <span>Arrow Keys</span>
            </div>
            <p className="mt-2 text-xs text-stone-500 leading-relaxed">
              Walk your character freely around the room. Your loyal puppy will happily follow or nap nearby!
            </p>
          </div>

          <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 font-bold text-xs text-stone-800">
              <span className="rounded bg-stone-100 px-2 py-1">Esc</span>
              <span>Escape Key / Click</span>
            </div>
            <p className="mt-2 text-xs text-stone-500 leading-relaxed">
              Close any open overlay or wellness window and immediately return to room walking mode.
            </p>
          </div>
        </div>
      </div>

      {/* Interactive Room Objects */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-stone-600">
          🛋️ Interactive Hotspots in Your Room
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="flex items-start gap-3 rounded-xl border border-stone-200 bg-white p-3.5 shadow-sm">
            <span className="text-2xl">⏳</span>
            <div>
              <p className="font-bold text-stone-800">Hourglass (Breathing Timer)</p>
              <p className="text-stone-500 mt-0.5">Guided 4-7-8, box breathing & coherent heart pacing.</p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-stone-200 bg-white p-3.5 shadow-sm">
            <span className="text-2xl">📖</span>
            <div>
              <p className="font-bold text-stone-800">Diary on Desk</p>
              <p className="text-stone-500 mt-0.5">Reflections with live sentiment analysis & prompts.</p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-stone-200 bg-white p-3.5 shadow-sm">
            <span className="text-2xl">😄</span>
            <div>
              <p className="font-bold text-stone-800">Mood Tracker (Wall)</p>
              <p className="text-stone-500 mt-0.5">Log daily feelings, tags, and inspirational quotes.</p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-stone-200 bg-white p-3.5 shadow-sm">
            <span className="text-2xl">📅</span>
            <div>
              <p className="font-bold text-stone-800">Calendar (Wall)</p>
              <p className="text-stone-500 mt-0.5">Categorized events: Cognitive, Social & Recharge hours.</p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-stone-200 bg-white p-3.5 shadow-sm">
            <span className="text-2xl">📱</span>
            <div>
              <p className="font-bold text-stone-800">Phone (Stress Check-In)</p>
              <p className="text-stone-500 mt-0.5">One-tap 1–5 check-in & 10-question chat quiz.</p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-stone-200 bg-white p-3.5 shadow-sm">
            <span className="text-2xl">📊</span>
            <div>
              <p className="font-bold text-stone-800">Bar Graph (Capacity Gauge)</p>
              <p className="text-stone-500 mt-0.5">View your Capacity Gauge, AI Load Shedder & recovery plans.</p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-stone-200 bg-white p-3.5 shadow-sm">
            <span className="text-2xl">📻</span>
            <div>
              <p className="font-bold text-stone-800">Radio on Shelf</p>
              <p className="text-stone-500 mt-0.5">Play ambient rain, forest, ocean, and calm lo-fi audio.</p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-stone-200 bg-white p-3.5 shadow-sm">
            <span className="text-2xl">🪴</span>
            <div>
              <p className="font-bold text-stone-800">Houseplants & TV</p>
              <p className="text-stone-500 mt-0.5">Water your plants or watch cozy pixel animations.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
