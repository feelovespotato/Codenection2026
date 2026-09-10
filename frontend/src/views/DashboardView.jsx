import { useState } from 'react'
import { useMoodify } from '../services/moodify-context.js'
import { api } from '../services/api.js'
import { displaySlot } from '../services/dates.js'
import BackendStatus from '../components/BackendStatus.jsx'

const button = 'rounded-xl bg-amber-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-800 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600'
const labels = { cognitive: 'Cognitive', social: 'Social', recharge: 'Recharge' }
const colors = { cognitive: 'bg-indigo-500', social: 'bg-amber-500', recharge: 'bg-emerald-500' }

function SuggestionCard({ kind, title, description }) {
  const { data, busy, run } = useMoodify()
  const [result, setResult] = useState(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [writeToGoogle, setWriteToGoogle] = useState(false)
  const stale = result && result.revision !== data.revision
  async function suggest() {
    setPending(true); setError(''); setNotice('')
    try {
      const response = await api('/proposals', { method: 'POST', body: { kind, date: data.date } })
      setResult({ ...response, revision: data.revision })
    } catch (failure) { setError(failure.message) }
    finally { setPending(false) }
  }
  async function approve(proposal) {
    setError(''); setNotice('')
    try {
      await run(`/proposals/${proposal.id}/apply`, { approved: true, writeToGoogle })
      setResult(null)
      setNotice(kind === 'recovery' ? 'Recovery scheduled. It will count automatically when the block ends (inferred from your calendar).' : 'Task moved. Capacity has been recalculated. Generate fresh suggestions for any further moves.')
    } catch (failure) { setError(failure.message) }
  }
  return <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
    <h3 className="font-bold text-stone-900">{title}</h3>
    <p className="mt-1 text-sm leading-relaxed text-stone-600">{description}</p>
    <button type="button" className={`${button} mt-4`} disabled={pending || busy} onClick={suggest}>{pending ? 'Finding safe options…' : 'Generate suggestion'}</button>
    {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
    {notice && <p role="status" className="mt-3 text-sm text-emerald-800">{notice}</p>}
    {result?.message && <p role="status" className="mt-3 text-sm text-stone-600">{result.message}</p>}
    {stale && <p role="status" className="mt-3 text-sm text-amber-800">Your data changed. Generate a fresh suggestion before approving.</p>}
    {!stale && result?.proposals.map(proposal => {
      const event = data.events.find(e => e.id === proposal.eventId)
      const needsWrite = event?.source === 'google' && !data.google.canWrite
      return <div key={proposal.id} className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-sm text-stone-800">
        <h4 className="font-bold">{proposal.title}</h4>
        <dl className="mt-3 space-y-2">
          {proposal.before && <div><dt className="text-xs font-semibold uppercase text-stone-500">Before</dt><dd>{displaySlot(proposal.before, data.zone)}</dd></div>}
          <div><dt className="text-xs font-semibold uppercase text-stone-500">{proposal.before ? 'After' : 'Available time'}</dt><dd>{displaySlot(proposal.after, data.zone)}</dd></div>
        </dl>
        {proposal.before && <p className="mt-3 font-semibold">Today: {proposal.beforeCapacity}% → {proposal.afterCapacity}% <span className="text-emerald-800">({proposal.beforeCapacity - proposal.afterCapacity} percentage points lower)</span></p>}
        {proposal.targetAfter && <p className="mt-1 text-xs">Destination day load: {proposal.targetBefore.totalLoadHours} → {proposal.targetAfter.totalLoadHours} weighted hours.</p>}
        <p className="mt-2 text-xs leading-relaxed text-stone-600">{proposal.reason}</p>
        {kind === 'recovery' && data.google.canWrite && <label className="mt-3 flex items-center gap-2"><input type="checkbox" checked={writeToGoogle} onChange={e => setWriteToGoogle(e.target.checked)} />Also insert into Google Calendar</label>}
        {needsWrite && <p className="mt-2 text-amber-800">Open Calendar and enable Google write access first.</p>}
        <button type="button" className={`${button} mt-3`} disabled={busy || needsWrite} onClick={() => approve(proposal)}>{busy ? 'Applying…' : kind === 'recovery' ? `Insert into ${writeToGoogle ? 'Google Calendar' : 'Moodify calendar'}` : `Approve this move${event?.source === 'google' ? ' in Google' : ''}`}</button>
      </div>
    })}
  </section>
}

export default function DashboardView({ onOpenCalendar, onOpenBreathing }) {
  const { data } = useMoodify()
  const metrics = data?.capacity
  const loadScale = metrics ? Math.max(0, ...metrics.breakdown.map(item => Math.abs(item.weightedLoad))) : 0
  return <div className="space-y-5">
    <BackendStatus />
    {metrics && <>
      <p className="text-xs text-stone-500">Today · {data.date} · {data.zone}</p>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-5">
          <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-wide text-stone-600">Daily capacity used</h3>
            <p className="mt-4 text-5xl font-black text-stone-900">{metrics.capacityScore}%</p>
            <p className="mt-2 text-sm font-semibold text-stone-700">{metrics.capacityScore >= 85 ? 'High load — consider rebalancing' : metrics.capacityScore >= 65 ? 'Elevated workload — make room for rest' : 'Manageable capacity'}</p>
            <div role="meter" aria-label="Daily capacity used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={metrics.capacityScore} className="mt-4 h-3 overflow-hidden rounded-full bg-stone-100"><div className={`h-full ${metrics.capacityScore >= 85 ? 'bg-rose-500' : metrics.capacityScore >= 65 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${metrics.capacityScore}%` }} /></div>
            <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-indigo-50 p-3 text-indigo-950"><p className="font-bold">Objective load</p><p>{metrics.totalLoadHours} weighted hours</p><p className="text-xs">{metrics.loadPercent}% of an 8-hour reference</p></div>
              <div className="rounded-xl bg-amber-50 p-3 text-amber-950"><p className="font-bold">Today’s check-in</p><p>{metrics.latestStress === null ? 'No check-in yet' : `${metrics.latestStress} / 5 stress`}</p><p className="text-xs">{metrics.latestStress === null ? 'Capacity uses load only.' : '45% load + 55% stress signal'}</p></div>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-stone-500">Load = cognitive hours × 1.3 + social hours × 1 − recharge hours × 0.5, with a minimum of zero. All-day events block scheduling but do not imply 24 hours of work.</p>
          </section>
          <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <h3 className="font-bold text-stone-900">Load by category</h3>
            <p className="mt-2 text-sm text-stone-600">Weighted hours show each category’s contribution. Recharge reduces load.</p>
            {metrics.breakdown.map(item => <div key={item.category} className="mt-4 text-sm text-stone-700">
              <div className="flex flex-wrap justify-between gap-2"><span>{labels[item.category]} · {item.hours} hrs</span><span className="font-semibold">{item.weightedLoad > 0 ? '+' : ''}{item.weightedLoad} weighted hrs</span></div>
              <div aria-hidden="true" className="mt-2 grid grid-cols-2 gap-px bg-stone-300">
                <div className="flex h-2 justify-end bg-stone-100"><div className={colors[item.category]} style={{ width: `${loadScale && item.weightedLoad < 0 ? Math.abs(item.weightedLoad) / loadScale * 100 : 0}%` }} /></div>
                <div className="h-2 bg-stone-100"><div className={`h-full ${colors[item.category]}`} style={{ width: `${loadScale && item.weightedLoad > 0 ? item.weightedLoad / loadScale * 100 : 0}%` }} /></div>
              </div>
            </div>)}
            <div className="mt-2 flex justify-between text-xs text-stone-600"><span>Reduces load ←</span><span>→ Adds load</span></div>
            <p className="mt-4 font-bold text-stone-800">Net load: {metrics.totalLoadHours} weighted hrs</p>
            <p className="mt-1 text-xs text-stone-600">Category contributions are rounded. Net load has a minimum of zero.</p>
            <p aria-live="polite" className="mt-5 border-t border-stone-100 pt-4 text-sm font-bold text-stone-800">{metrics.recoveryStreak.currentStreak}-day recovery streak · {metrics.recoveryStreak.hasRecoveredToday ? 'Recovery counted today' : 'No recovery block ended today'}</p>
            <p className="mt-2 text-xs leading-relaxed text-stone-600">Timed recovery blocks count automatically when they end. Completion is inferred from your calendar, not verified activity. All-day events do not count.</p>
            <div className="mt-4 flex flex-wrap gap-3"><button type="button" onClick={onOpenCalendar} className={button}>Open calendar</button><button type="button" onClick={onOpenBreathing} className="rounded-xl border border-emerald-300 px-4 py-2.5 text-sm font-bold text-emerald-900">Start breathing</button></div>
          </section>
        </div>
        <div className="space-y-5">
          <SuggestionCard kind="shed" title="Load Shedder" description="Find one low-consequence flexible task that can move to a lighter day within the next three days." />
          <SuggestionCard kind="recovery" title="Recovery Scheduler" description="Find a free slot and a recovery activity matched to today’s stress and scheduled load." />
          <SuggestionCard kind="timetable" title="Timetable Suggester" description="Review flexible-task alternatives individually. Approve one move, then refresh the remaining suggestions." />
          <p className="text-xs text-stone-500">Suggestions use explainable scheduling rules. Calendar gaps are an inactivity proxy; actual physical inactivity is not measured.</p>
        </div>
      </div>
    </>}
  </div>
}
