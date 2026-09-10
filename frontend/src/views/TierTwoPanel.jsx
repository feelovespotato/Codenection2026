import { useState } from 'react'
import { useMoodify } from '../services/moodify-context.js'
import { api } from '../services/api.js'
import { displaySlot } from '../services/dates.js'
import { createSnapshotFile, downloadSnapshot } from '../services/snapshot.js'

const button = 'rounded-xl bg-amber-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-800 disabled:opacity-50'
const secondary = 'rounded-xl border border-stone-300 px-4 py-2.5 text-sm font-semibold text-stone-800 disabled:opacity-50'
const field = 'mt-1 block w-full rounded-lg border border-stone-300 bg-white p-2 text-sm text-stone-800'
const card = 'min-w-0 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm'

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
  return <section className={card}>
    <h3 className="font-bold text-stone-900">Boundary Guard</h3>
    <p className="mt-2 text-sm text-stone-600">Find the words to decline or defer. Edit your draft before using it.</p>
    <form onSubmit={generate} className="mt-4 space-y-3">
      <label className="block text-sm">Commitment<select className={field} value={eventId} onChange={e => setEventId(e.target.value)}><option value="">Write a commitment</option>{data.events.filter(e => Date.parse(e.end) > Date.parse(data.serverTime)).map(e => <option key={e.id} value={e.id}>{e.title}</option>)}</select></label>
      {!eventId && <label className="block text-sm">What are you responding to?<input className={field} value={commitment} onChange={e => setCommitment(e.target.value)} maxLength={250} required placeholder="e.g. Saturday’s club meeting" /></label>}
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">Response<select className={field} value={intent} onChange={e => setIntent(e.target.value)}><option value="decline">Decline</option><option value="defer">Defer</option></select></label>
        <label className="block text-sm">Tone<select className={field} value={tone} onChange={e => setTone(e.target.value)}><option value="warm">Warm</option><option value="direct">Direct</option></select></label>
      </div>
      {intent === 'defer' && <label className="block text-sm">Alternative time (optional)<input className={field} value={alternative} onChange={e => setAlternative(e.target.value)} maxLength={120} placeholder="e.g. next Tuesday afternoon" /></label>}
      <button className={button} disabled={pending}>{pending ? 'Preparing…' : 'Create draft'}</button>
    </form>
    {draft && <div className="mt-4"><label className="block text-sm">Your editable draft<textarea className={field} rows={6} value={draft} onChange={e => setDraft(e.target.value)} /></label><button type="button" className={`${secondary} mt-3`} disabled={!draft.trim()} onClick={copy}>Copy draft</button></div>}
    {generation && <p role="status" className="mt-3 text-xs text-stone-600">{generation.method === 'ai' ? `AI draft · ${generation.provider}` : generation.fallbackReason === 'not_configured' ? 'Local template · AI is not configured or enabled.' : 'Local template · AI could not complete this request.'}</p>}
    <p className="mt-3 text-xs text-stone-600">When AI is enabled, your chosen commitment and draft go to the configured providers in fallback order. Nothing is sent to the person you are replying to.</p>
    {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
    {notice && <p role="status" className="mt-3 text-sm text-emerald-800">{notice}</p>}
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
  return <section className={card}>
    <h3 className="font-bold text-stone-900">Task Batching</h3>
    <p className="mt-2 text-sm text-stone-600">Group small, flexible errands into one continuous block.</p>
    <label className="mt-4 block text-sm">Batch day<input type="date" className={field} min={data.date} value={date} onChange={e => setDate(e.target.value)} /></label>
    <button type="button" className={`${button} mt-3`} disabled={busy || pending || !date} onClick={suggest}>{pending ? 'Finding a block…' : 'Suggest a batch'}</button>
    <p className="mt-3 text-xs text-stone-600">Uses flexible local, .ics and Google errands up to 45 minutes each. Google batches require individual approval and calendar write access. Review travel time and opening hours.</p>
    {stale && <p role="status" className="mt-3 text-sm text-amber-800">Your schedule or selected day changed. Generate a fresh batch.</p>}
    {!stale && result?.message && <p role="status" className="mt-3 text-sm text-stone-700">{result.message}</p>}
    {!stale && result?.proposals.map(proposal => <div key={proposal.id} className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <h4 className="font-bold">{proposal.title} · {proposal.durationMinutes} min</h4>
      <p className="mt-2 text-sm">{displaySlot(proposal.after, data.zone)}</p>
      <ul className="mt-3 space-y-3 text-sm">{proposal.moves.map(move => <li key={move.eventId}><strong className="break-words">{move.title}</strong><p>Before: {displaySlot(move.before, data.zone)}</p><p>After: {displaySlot(move.after, data.zone)}</p>{proposal.individualApproval && <button type="button" className={`${button} mt-2`} disabled={busy || pending || move.applied} onClick={() => approve(proposal.id, move.eventId)}>{move.applied ? 'Move saved' : 'Approve this move'}</button>}</li>)}</ul>
      {!proposal.individualApproval && <button type="button" className={`${button} mt-4`} disabled={busy || pending} onClick={() => approve(proposal.id)}>Approve these {proposal.moves.length} moves</button>}
    </div>)}
    {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
    {notice && <p role="status" className="mt-3 text-sm text-emerald-800">{notice}</p>}
  </section>
}

function SnapshotShare() {
  const { data } = useMoodify()
  const [pending, setPending] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  async function exportCard(share) {
    setPending(true); setError(''); setNotice('')
    try {
      const file = await createSnapshotFile(data)
      if (share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'My Moodify capacity' })
        setNotice('Share dialog completed.')
      } else {
        downloadSnapshot(file)
        setNotice(share ? 'File sharing is unavailable here. Your PNG card was downloaded instead.' : 'PNG card downloaded.')
      }
    } catch (failure) { if (failure.name !== 'AbortError') setError('Could not create or share the card. Try downloading it again.') }
    finally { setPending(false) }
  }
  return <section className={card}>
    <h3 className="font-bold text-stone-900">Load Snapshot Share</h3>
    <div className="mt-4 border-2 border-amber-800 bg-amber-50 p-5 text-center text-stone-900">
      <p className="text-sm font-bold">MY MOODIFY</p><p className="mt-2 text-4xl font-black">{data.capacity.capacityScore}%</p><p className="text-sm">Daily capacity used</p><p className="mt-2 text-xs">{data.date} · {data.zone}</p>
    </div>
    <p className="mt-3 text-xs text-stone-600">The card includes only capacity, date and time zone. Event titles, diary entries and your check-in are left out.</p>
    <div className="mt-4 flex flex-wrap gap-3"><button type="button" className={button} disabled={pending} onClick={() => exportCard(false)}>Download PNG</button><button type="button" className={secondary} disabled={pending} onClick={() => exportCard(true)}>Share card</button></div>
    {notice && <p role="status" className="mt-3 text-sm text-emerald-800">{notice}</p>}
    {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
  </section>
}

export default function TierTwoPanel() {
  const { data } = useMoodify()
  const sleep = data.insights?.sleep
  const deadlines = data.insights?.deadlines
  const heavy = deadlines?.heavyDay
  return <div className="grid gap-6 lg:grid-cols-2">
    <section className={card}>
      <h3 className="font-bold text-stone-900">Sleep Proxy Estimator</h3>
      <p className="mt-2 text-sm text-stone-600">Longest calendar gap in last night’s 21:00–09:00 window.</p>
      {sleep?.available ? <><p className="mt-4 text-2xl font-bold text-stone-900">{sleep.hours} hours available</p><p className="mt-2 text-sm">{displaySlot(sleep, data.zone)}</p></> : <p className="mt-4 text-sm">{sleep ? 'No free overnight window found.' : 'Not enough nearby calendar data to estimate a window.'}</p>}
      <p className="mt-3 text-xs text-stone-600">Low-confidence calendar estimate. Free time is not measured sleep; unscheduled activities may fill this gap.</p>
    </section>
    <section className={card}>
      <h3 className="font-bold text-stone-900">Upcoming Deadline Density</h3>
      {heavy ? <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4"><p className="font-bold">Heavy day ahead · {heavy.date}</p><p className="mt-2 text-sm">{heavy.deadlines} deadline signals · {heavy.weightedHours} weighted hours</p></div> : <p className="mt-4 text-sm">{deadlines?.hasEvents ? 'No heavy day flagged in the next three days.' : 'No commitments or deadline signals found in the next three days.'}</p>}
      <p className="mt-3 text-xs text-stone-600">Flags the heaviest qualifying day: at least 3 deadline signals or 6.4 weighted hours. Signals use saved deadlines and titles/descriptions mentioning exams, submissions, deadlines or “due”.</p>
    </section>
    <BoundaryGuard />
    <TaskBatching />
    <SnapshotShare />
  </div>
}
