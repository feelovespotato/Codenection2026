import { useState } from 'react'
import { useMoodify } from '../services/moodify-context.js'
import { api } from '../services/api.js'
import { displaySlot } from '../services/dates.js'

const button = 'rounded-xl bg-amber-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-800 disabled:opacity-50'
const secondary = 'rounded-xl border border-stone-300 px-4 py-2.5 text-sm font-semibold text-stone-800 disabled:opacity-50'
const field = 'mt-1 block w-full rounded-lg border border-stone-300 bg-white p-2 text-sm text-stone-800'
const card = 'min-w-0 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm'
const details = 'mt-4 rounded-lg bg-stone-50 p-3 text-xs leading-relaxed text-stone-600'

function BoundaryGuard() {
  const { data } = useMoodify()
  const [eventId, setEventId] = useState('')
  const [commitment, setCommitment] = useState('')
  const [intent, setIntent] = useState('decline')
  const [tone, setTone] = useState('warm')
  const [alternative, setAlternative] = useState('')
  const [draft, setDraft] = useState('')
  const [generation, setGeneration] = useState(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  async function generate(e) {
    e.preventDefault(); setPending(true); setError(''); setNotice('')
    try { const result = await api('/boundary-template', { method: 'POST', body: { eventId, commitment, intent, tone, alternative } }); setDraft(result.text); setGeneration(result) }
    catch (failure) { setError(failure.message) }
    finally { setPending(false) }
  }
  async function copy() {
    setNotice(''); setError('')
    try { await navigator.clipboard.writeText(draft); setNotice('Copied. Paste it into your conversation when ready.') }
    catch { setError('Clipboard unavailable. Select and copy the editable draft below.') }
  }
  return <section className={`${card} border-t-4 border-t-rose-300`}>
    <h3 className="flex items-center gap-2 font-bold text-stone-900"><span className="text-xl">🛡️</span> Boundary Guard</h3>
    <p className="mt-1.5 text-sm text-stone-600">Overcommitted and dreading the "no"? Pick the thing you need to back out of, and get a ready-to-send decline or reschedule message — edit it before you use it.</p>
    <p className="mt-2 inline-block rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-800">e.g. skip a club meeting, push back a catch-up you double-booked</p>
    <form onSubmit={generate} className="mt-4 space-y-3">
      <label className="block text-sm font-semibold text-stone-800">Which commitment is this about?
        <select className={`${field} font-normal`} value={eventId} onChange={e => setEventId(e.target.value)}><option value="">Choose from your calendar…</option>{data.events.filter(e => Date.parse(e.end) > Date.parse(data.serverTime)).map(e => <option key={e.id} value={e.id}>{e.title}</option>)}</select>
      </label>
      {!eventId && <label className="block text-sm font-semibold text-stone-800">…or just describe it
        <input className={`${field} font-normal`} value={commitment} onChange={e => setCommitment(e.target.value)} maxLength={250} required placeholder="e.g. Saturday’s club meeting" />
      </label>}
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-semibold text-stone-800">I want to<select className={`${field} font-normal`} value={intent} onChange={e => setIntent(e.target.value)}><option value="decline">Decline it</option><option value="defer">Push it back</option></select></label>
        <label className="block text-sm font-semibold text-stone-800">Tone<select className={`${field} font-normal`} value={tone} onChange={e => setTone(e.target.value)}><option value="warm">Warm</option><option value="direct">Direct</option></select></label>
      </div>
      {intent === 'defer' && <label className="block text-sm font-semibold text-stone-800">Suggest a new time? (optional)<input className={`${field} font-normal`} value={alternative} onChange={e => setAlternative(e.target.value)} maxLength={120} placeholder="e.g. next Tuesday afternoon" /></label>}
      <button className={button} disabled={pending}>{pending ? 'Writing your draft…' : 'Write my message'}</button>
    </form>
    {draft && <div className="mt-4"><label className="block text-sm font-semibold text-stone-800">Your editable draft<textarea className={`${field} font-normal`} rows={6} value={draft} onChange={e => setDraft(e.target.value)} /></label><button type="button" className={`${secondary} mt-3`} disabled={!draft.trim()} onClick={copy}>Copy draft</button></div>}
    {generation && <p role="status" className="mt-3 text-xs text-stone-600">{generation.method === 'ai' ? `AI draft · ${generation.provider}` : generation.fallbackReason === 'not_configured' ? 'Local template · AI is not configured or enabled.' : 'Local template · AI could not complete this request.'}</p>}
    {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
    {notice && <p role="status" className="mt-3 text-sm text-emerald-800">{notice}</p>}
    <details className={details}>
      <summary className="cursor-pointer font-semibold text-stone-700">Privacy & how this works</summary>
      <p className="mt-1.5">Nothing is sent to the person you're replying to — this only drafts text for you to copy. When AI is enabled, your chosen commitment and draft go to the configured providers in fallback order; otherwise a local template fills it in.</p>
    </details>
  </section>
}

function TaskBatching() {
  const { data, run, busy } = useMoodify()
  const [date, setDate] = useState(data.date)
  const [result, setResult] = useState(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const stale = result && (result.revision !== data.revision || result.date !== date)
  async function suggest() {
    setPending(true); setError(''); setNotice(''); setResult(null)
    try { const response = await api('/proposals', { method: 'POST', body: { kind: 'batch', date } }); setResult({ ...response, date, revision: data.revision }) }
    catch (failure) { setError(failure.message) }
    finally { setPending(false) }
  }
  async function approve(id, eventId) {
    setError(''); setNotice('')
    try {
      const response = await run(`/proposals/${id}/apply`, { approved: true, eventId })
      if (response.proposal) {
        setResult({ proposals: [response.proposal], date, revision: response.revision })
        setNotice('Move saved. Review and approve each remaining move separately.')
      } else { setResult(null); setNotice('Errands grouped. Your calendar has been updated.') }
    }
    catch (failure) { setError(failure.message) }
  }
  return <section className={`${card} border-t-4 border-t-amber-300`}>
    <h3 className="flex items-center gap-2 font-bold text-stone-900"><span className="text-xl">🧺</span> Task Batching</h3>
    <p className="mt-1.5 text-sm text-stone-600">Got a handful of quick, flexible errands scattered across the day? This finds one open block and groups them together, so you're not making five separate trips.</p>
    <p className="mt-2 inline-block rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">e.g. grocery run + dry cleaning + package drop-off, back to back</p>
    <label className="mt-4 block text-sm font-semibold text-stone-800">Which day?<input type="date" className={`${field} font-normal`} min={data.date} value={date} onChange={e => setDate(e.target.value)} /></label>
    <button type="button" className={`${button} mt-3`} disabled={busy || pending || !date} onClick={suggest}>{pending ? 'Finding a block…' : 'Find a batch for me'}</button>
    {stale && <p role="status" className="mt-3 text-sm text-amber-800">Your schedule or selected day changed. Generate a fresh batch.</p>}
    {!stale && result?.message && <p role="status" className="mt-3 text-sm text-stone-700">{result.message}</p>}
    {!stale && result?.proposals.map(proposal => <div key={proposal.id} className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <h4 className="font-bold">{proposal.title} · {proposal.durationMinutes} min</h4>
      <p className="mt-2 text-sm">{displaySlot(proposal.after, data.zone)}</p>
      <ul className="mt-3 space-y-3 text-sm">{proposal.moves.map(move => <li key={move.eventId}><strong className="break-words">{move.title}</strong><p>Before: {displaySlot(move.before, data.zone)}</p><p>After: {displaySlot(move.after, data.zone)}</p>{proposal.individualApproval && <button type="button" className={`${button} mt-2`} disabled={busy || pending || move.applied} onClick={() => approve(proposal.id, move.eventId)}>{move.applied ? 'Move saved' : 'Approve this move'}</button>}</li>)}</ul>
      {!proposal.individualApproval && <button type="button" className={`${button} mt-4`} disabled={busy || pending} onClick={() => approve(proposal.id)}>Approve these {proposal.moves.length} moves</button>}
    </div>)}
    {!result && !pending && !error && <p className="mt-4 text-sm text-stone-500">Nothing grouped yet — pick a day and hit the button above.</p>}
    {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
    {notice && <p role="status" className="mt-3 text-sm text-emerald-800">{notice}</p>}
    <details className={details}>
      <summary className="cursor-pointer font-semibold text-stone-700">What counts as an errand here?</summary>
      <p className="mt-1.5">Flexible local, .ics and Google errands up to 45 minutes each. Google batches need your individual approval and calendar write access. Double-check travel time and opening hours before you rely on it.</p>
    </details>
  </section>
}

export default function TierTwoPanel() {
  const { data } = useMoodify()
  const sleep = data.insights?.sleep
  const deadlines = data.insights?.deadlines
  const heavy = deadlines?.heavyDay
  return <div>
    <div className="mb-1">
      <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-stone-600"><span>🧰</span> Advanced tools</h3>
      <p className="mt-1 text-sm text-stone-500">Optional helpers for when a day needs a bit more than the basics above.</p>
    </div>
    <div className="mt-4 grid gap-6 lg:grid-cols-2">
      <section className={`${card} border-t-4 border-t-indigo-300`}>
        <h3 className="flex items-center gap-2 font-bold text-stone-900"><span className="text-xl">🌙</span> Sleep Proxy Estimator</h3>
        <p className="mt-1.5 text-sm text-stone-600">A rough guess at how much sleep you got, based on the longest free gap in last night's calendar.</p>
        {sleep?.available ? <><p className="mt-4 text-2xl font-bold text-stone-900">{sleep.hours} hours available</p><p className="mt-2 text-sm">{displaySlot(sleep, data.zone)}</p></> : <p className="mt-4 text-sm">{sleep ? 'No free overnight window found.' : 'Not enough nearby calendar data to estimate a window.'}</p>}
        <details className={details}>
          <summary className="cursor-pointer font-semibold text-stone-700">Why "proxy"?</summary>
          <p className="mt-1.5">This looks at the longest calendar gap between 21:00–09:00 — it's not measured sleep. Unscheduled activities may fill this gap without showing up here.</p>
        </details>
      </section>
      <section className={`${card} border-t-4 border-t-emerald-300`}>
        <h3 className="flex items-center gap-2 font-bold text-stone-900"><span className="text-xl">📈</span> Upcoming Deadline Density</h3>
        <p className="mt-1.5 text-sm text-stone-600">A heads-up if one of the next three days is stacked with deadlines, so it doesn't sneak up on you.</p>
        {heavy ? <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4"><p className="font-bold">Heavy day ahead · {heavy.date}</p><p className="mt-2 text-sm">{heavy.deadlines} deadline signals · {heavy.weightedHours} weighted hours</p></div> : <p className="mt-4 text-sm">{deadlines?.hasEvents ? 'No heavy day flagged in the next three days.' : 'No commitments or deadline signals found in the next three days.'}</p>}
        <details className={details}>
          <summary className="cursor-pointer font-semibold text-stone-700">How a day gets flagged</summary>
          <p className="mt-1.5">Flags the heaviest qualifying day: at least 3 deadline signals or 6.4 weighted hours. Signals use saved deadlines and titles/descriptions mentioning exams, submissions, deadlines or "due".</p>
        </details>
      </section>
      <BoundaryGuard />
      <TaskBatching />
    </div>
  </div>
}