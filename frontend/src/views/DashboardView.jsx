import { useState } from 'react'
import { useMoodify } from '../services/moodify-context.js'
import BackendStatus from '../components/BackendStatus.jsx'
import PixelIcon from '../components/PixelIcon.jsx'
import TierTwoPanel from './TierTwoPanel.jsx'

const button = 'rounded-xl bg-amber-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-800 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600'
const labels = { cognitive: 'Cognitive', social: 'Social', recharge: 'Recharge' }
const colors = { cognitive: 'bg-indigo-500', social: 'bg-amber-500', recharge: 'bg-emerald-500' }
const chipIcon = { cognitive: '🧠', social: '👥', recharge: '🌿' }

// Same 1–5 wording used on the Stress Quiz, so the number means the same thing everywhere.
const STRESS_SCALE = {
  1: { emoji: '😌', label: 'Very Low' },
  2: { emoji: '🙂', label: 'Low' },
  3: { emoji: '😐', label: 'Moderate' },
  4: { emoji: '😣', label: 'High' },
  5: { emoji: '😫', label: 'Overloaded' },
}

// Same 65/85 thresholds as the HUD badge in App.jsx, phrased as an RPG status effect.
function statusFor(score) {
  if (score >= 85) return { tag: '⚠️ Overloaded', tone: 'rose', message: 'Your day is packed. Shedding a task or booking a recharge would help.' }
  if (score >= 65) return { tag: '🟡 Stretched', tone: 'amber', message: "Getting full. A short recharge block would keep today manageable." }
  return { tag: '🟢 Steady', tone: 'emerald', message: "You've got room today — nice and manageable." }
}
const tone = {
  rose: { bar: 'bg-rose-500', chip: 'border-rose-300 bg-rose-100 text-rose-900' },
  amber: { bar: 'bg-amber-500', chip: 'border-amber-300 bg-amber-100 text-amber-900' },
  emerald: { bar: 'bg-emerald-500', chip: 'border-emerald-300 bg-emerald-100 text-emerald-900' },
}

export default function DashboardView({ onOpenCalendar, onOpenBreathing }) {
  const { data } = useMoodify()
  const metrics = data?.capacity
  const status = metrics ? statusFor(metrics.capacityScore) : null
  const t = status ? tone[status.tone] : null
  const stress = metrics?.latestStress ? STRESS_SCALE[metrics.latestStress] : null
  const streakDays = metrics ? Math.max(metrics.recoveryStreak.currentStreak, metrics.calendarRecoveryStreak?.currentStreak || 0) : 0
  const totalHours = metrics ? metrics.breakdown.reduce((sum, item) => sum + item.hours, 0) : 0

  return <div className="space-y-5">
    <BackendStatus />
    {metrics && <>
      <p className="text-xs text-stone-500">Today · {data.date} · {data.zone}</p>

      {/* Headline: one number, one status, one plain-language sentence. Everything else is opt-in. */}
      <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-stone-600"><PixelIcon symbol="⏳" /> Today's capacity</h3>
          <span className={`rounded-full border px-3 py-1 text-xs font-black ${t.chip}`}>{status.tag}</span>
        </div>
        <p className="mt-4 text-5xl font-black text-stone-900">{metrics.capacityScore}%</p>
        <div role="meter" aria-label="Daily capacity used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={metrics.capacityScore} className="mt-4 h-4 overflow-hidden rounded-full border border-stone-200 bg-stone-100"><div className={`h-full ${t.bar}`} style={{ width: `${metrics.capacityScore}%` }} /></div>
        <p className="mt-3 text-sm font-semibold text-stone-700">{status.message}</p>

        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-indigo-50 p-3 text-indigo-950">
            <p className="flex items-center gap-1.5 font-bold"><PixelIcon symbol="🧠" /> Workload</p>
            <p className="mt-1">{metrics.totalLoadHours} hrs of demanding time</p>
          </div>
          <div className="rounded-xl bg-amber-50 p-3 text-amber-950">
            <p className="flex items-center gap-1.5 font-bold"><PixelIcon symbol="😊" /> How you feel</p>
            <p className="mt-1">{stress ? `${stress.emoji} ${stress.label}` : 'No check-in yet'}</p>
          </div>
        </div>

        <details className="mt-4">
          <summary className="cursor-pointer text-xs font-bold text-stone-500">How is this calculated?</summary>
          <p className="mt-2 text-xs leading-relaxed text-stone-500">Workload = cognitive hours × 1.3 + social hours × 1 − recharge hours × 0.5, never below zero — about {metrics.loadPercent}% of an 8-hour reference day. Once you check in, capacity blends that workload (45%) with how you say you feel (55%). All-day events block scheduling but don't imply 24 hours of work.</p>
        </details>
      </section>

      {/* One glance at where the time is going, as a single stacked bar instead of a diverging chart. */}
      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <h3 className="flex items-center gap-2 font-bold text-stone-900"><PixelIcon symbol="📊" /> Where your time is going</h3>
        {totalHours > 0 ? <>
          <div aria-hidden="true" className="mt-4 flex h-4 w-full overflow-hidden rounded-full border border-stone-200">
            {metrics.breakdown.filter(item => item.hours > 0).map(item => <div key={item.category} className={colors[item.category]} style={{ width: `${item.hours / totalHours * 100}%` }} />)}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-stone-700">
            {metrics.breakdown.map(item => <li key={item.category} className="flex items-center gap-1.5"><span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${colors[item.category]}`} />{chipIcon[item.category]} {labels[item.category]} · {item.hours} hrs</li>)}
          </ul>
        </> : <p className="mt-3 text-sm text-stone-600">No timed events found for today yet.</p>}
        <p className="mt-3 text-xs text-stone-500">🌿 Recharge time lowers your workload rather than adding to it.</p>
      </section>

      {/* Streak + quick actions, merged into one badge-style row. Rebalancing suggestions now
          live on the Calendar page (Open calendar), since they mutate calendar events directly. */}
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <div>
          <p className="text-sm font-black text-stone-900">{streakDays > 0 ? `🔥 ${streakDays}-day recovery streak` : '🔥 No streak yet'}</p>
          <details className="mt-1"><summary className="cursor-pointer text-xs text-stone-500">{metrics.recoveryStreak.hasRecoveredToday ? 'Session completed today' : 'No session completed today'} · what counts?</summary><p className="mt-1 max-w-sm text-xs leading-relaxed text-stone-500">In-app streak counts completed one-minute breathing sessions. Calendar-based streak (inferred from ended blocks): {metrics.calendarRecoveryStreak?.currentStreak || 0} days. Neither measures physical recovery.</p></details>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={onOpenCalendar} className={button}>Open calendar</button>
          <button type="button" onClick={onOpenBreathing} className="rounded-xl border border-emerald-300 px-4 py-2.5 text-sm font-bold text-emerald-900">Start breathing</button>
        </div>
      </section>


      <TierTwoPanel />
    </>}
  </div>
}