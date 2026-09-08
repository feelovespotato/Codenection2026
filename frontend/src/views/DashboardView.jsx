import { useState, useMemo } from 'react'
import { StorageService } from '../services/storage.js'

export default function DashboardView({ onOpenCalendar, onOpenBreathing }) {
  const [capacityData, setCapacityData] = useState(() => StorageService.calculateCapacity())
  const [isShedding, setIsShedding] = useState(false)
  const [shedApplied, setShedApplied] = useState(false)
  const [recoveryAdded, setRecoveryAdded] = useState(false)

  const {
    capacityScore,
    loadPercent,
    stressPercent,
    latestStress,
    cognitiveHours,
    socialHours,
    rechargeHours,
    eventsCount,
  } = capacityData

  // Status level styling
  const statusInfo = useMemo(() => {
    if (capacityScore >= 85) {
      return {
        label: '⚠️ High Load Detected',
        sub: 'Approaching overload. Rebalancing recommended.',
        color: 'text-rose-700 bg-rose-50 border-rose-200',
        barColor: 'bg-rose-500',
      }
    }
    if (capacityScore >= 65) {
      return {
        label: '🟡 Elevated Workload',
        sub: 'Significant commitments today. Plan recovery pauses.',
        color: 'text-amber-700 bg-amber-50 border-amber-200',
        barColor: 'bg-amber-500',
      }
    }
    return {
      label: '🟢 Balanced & Sustainable',
      sub: 'Your current capacity is healthy and manageable.',
      color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      barColor: 'bg-emerald-500',
    }
  }, [capacityScore])

  // Category percentages
  const totalCategoryHours = Math.max(1, cognitiveHours + socialHours + rechargeHours)
  const cogPct = Math.round((cognitiveHours / totalCategoryHours) * 100)
  const socPct = Math.round((socialHours / totalCategoryHours) * 100)
  const recPct = Math.round((rechargeHours / totalCategoryHours) * 100)

  // Load Shedder Handler
  const handleSimulateLoadShed = () => {
    setIsShedding(true)
    setTimeout(() => {
      // Move a flexible task to tomorrow
      const today = new Date().toISOString().split('T')[0]
      const events = StorageService.getCalendarEvents()
      const flexibleToday = events.find((e) => e.date === today && e.isFlexible)
      
      if (flexibleToday) {
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        flexibleToday.date = tomorrow.toISOString().split('T')[0]
        StorageService.saveCalendarEvent(flexibleToday)
      }

      setCapacityData(StorageService.calculateCapacity())
      setIsShedding(false)
      setShedApplied(true)
    }, 600)
  }

  // Insert recovery into calendar
  const handleInsertRecovery = () => {
    const today = new Date().toISOString().split('T')[0]
    const recoveryEvent = {
      title: '🌿 Mindful Recharge Break',
      date: today,
      startTime: '17:30',
      endTime: '18:15',
      category: 'recharge',
      isFlexible: false,
    }
    StorageService.saveCalendarEvent(recoveryEvent)
    setCapacityData(StorageService.calculateCapacity())
    setRecoveryAdded(true)
    setTimeout(() => setRecoveryAdded(false), 3000)
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
      {/* Left Column: Capacity Gauge & Breakdown */}
      <div className="space-y-6 lg:col-span-6">
        {/* Main Capacity Gauge Card */}
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
              Personal Capacity Index
            </span>
            <span className={`rounded-full border px-3 py-1 text-xs font-bold ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
          </div>

          {/* Big Number & Progress Bar */}
          <div className="mt-6 flex items-baseline gap-2">
            <span className="text-5xl font-black tracking-tight text-stone-800">{capacityScore}%</span>
            <span className="text-xs font-semibold text-stone-400">of daily capacity utilized</span>
          </div>

          <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-stone-100">
            <div
              className={`h-full transition-all duration-700 ${statusInfo.barColor}`}
              style={{ width: `${capacityScore}%` }}
            />
          </div>

          <p className="mt-3 text-xs text-stone-500 leading-relaxed">{statusInfo.sub}</p>

          {/* Objective vs Subjective Dual Signal */}
          <div className="mt-6 grid grid-cols-2 gap-3 border-t border-stone-100 pt-4 text-xs">
            <div className="rounded-xl bg-stone-50 p-3">
              <div className="flex items-center justify-between text-stone-500 mb-1">
                <span>Objective Workload</span>
                <span className="font-bold text-stone-800">{loadPercent}%</span>
              </div>
              <p className="text-[11px] text-stone-400">
                Calculated from {eventsCount} calendar tasks
              </p>
            </div>
            <div className="rounded-xl bg-stone-50 p-3">
              <div className="flex items-center justify-between text-stone-500 mb-1">
                <span>Subjective Stress</span>
                <span className="font-bold text-stone-800">{latestStress} / 5 ({stressPercent}%)</span>
              </div>
              <p className="text-[11px] text-stone-400">
                Latest ground-truth check-in signal
              </p>
            </div>
          </div>
        </div>

        {/* Per-Category Load Breakdown */}
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-stone-600">
            Load Distribution By Category
          </h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs font-bold text-stone-700 mb-1">
                <span>🧠 Cognitive ({cognitiveHours}h)</span>
                <span>{cogPct}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-stone-100 overflow-hidden">
                <div className="h-full bg-indigo-500" style={{ width: `${cogPct}%` }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold text-stone-700 mb-1">
                <span>👥 Social ({socialHours}h)</span>
                <span>{socPct}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-stone-100 overflow-hidden">
                <div className="h-full bg-amber-500" style={{ width: `${socPct}%` }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold text-stone-700 mb-1">
                <span>🌿 Recharge ({rechargeHours}h)</span>
                <span>{recPct}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-stone-100 overflow-hidden">
                <div className="h-full bg-emerald-500" style={{ width: `${recPct}%` }} />
              </div>
            </div>
          </div>

          <div className="flex justify-between pt-2 text-[11px] text-stone-400">
            <span>🔥 4-Day Recovery Streak Active</span>
            <button
              type="button"
              onClick={onOpenCalendar}
              className="text-amber-700 hover:underline font-semibold"
            >
              Open Full Calendar →
            </button>
          </div>
        </div>
      </div>

      {/* Right Column: AI Load Shedder & Recovery Scheduler */}
      <div className="space-y-6 lg:col-span-6">
        {/* Load Shedder Card */}
        <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50/60 to-orange-50/40 p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-xl">🧹</span>
            <div>
              <h3 className="text-sm font-bold text-amber-950">AI Load Shedder</h3>
              <p className="text-[11px] text-amber-800/80">
                Identifies low-consequence flexible tasks to reduce immediate pressure.
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-amber-200/80 bg-white/80 p-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-stone-800">Suggested Action:</span>
              <span className="text-[11px] font-bold text-emerald-700">▼ ~14% capacity reduction</span>
            </div>
            <p className="mt-1 text-xs text-stone-600">
              Move flexible study/errand blocks from <strong>Today</strong> to <strong>Tomorrow</strong>.
            </p>

            <button
              type="button"
              disabled={isShedding || shedApplied}
              onClick={handleSimulateLoadShed}
              className="mt-3 w-full rounded-xl bg-amber-600 py-2 text-xs font-bold text-white shadow transition hover:bg-amber-700 disabled:opacity-50"
            >
              {isShedding ? 'Rebalancing Schedule...' : shedApplied ? '✓ Schedule Rebalanced!' : 'Apply Load Shedding'}
            </button>
          </div>
        </div>

        {/* AI Recovery Scheduler Card */}
        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/60 to-teal-50/40 p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-xl">🌿</span>
            <div>
              <h3 className="text-sm font-bold text-emerald-950">AI Recovery Recommendation</h3>
              <p className="text-[11px] text-emerald-800/80">
                Restores capacity before mental fatigue accumulates.
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-emerald-200/80 bg-white/80 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-800">🚶 20-Minute Nature Walk & Breathing</span>
                <span className="text-[11px] text-emerald-700 font-semibold">+15% Recovery</span>
              </div>
              <p className="mt-1 text-xs text-stone-500">
                Recommended between 17:30 – 18:15 after your afternoon cognitive block.
              </p>

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={handleInsertRecovery}
                  disabled={recoveryAdded}
                  className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
                >
                  {recoveryAdded ? '✓ Added to Calendar!' : '+ Insert into Calendar'}
                </button>
                <button
                  type="button"
                  onClick={onOpenBreathing}
                  className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-50"
                >
                  Start Breathing Now 🫁
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
