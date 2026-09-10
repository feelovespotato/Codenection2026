import { useState } from 'react'
import { useMoodify } from '../services/moodify-context.js'
import { displaySlot, localDate } from '../services/dates.js'
import BackendStatus from '../components/BackendStatus.jsx'

const inputClass = 'mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 focus:border-amber-600 focus:outline-amber-600'
const buttonClass = 'rounded-xl bg-amber-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-800 disabled:opacity-50'
const secondaryClass = 'rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-50'
const categoryClass = { cognitive: 'bg-indigo-100 text-indigo-900', social: 'bg-amber-100 text-amber-900', recharge: 'bg-emerald-100 text-emerald-900' }

function EventForm({ date, zone, event, onDone }) {
  const { busy, run } = useMoodify()
  const [error, setError] = useState('')
  const toLocal = value => {
    const parts = new Intl.DateTimeFormat('sv-SE', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value))
    return parts.replace(' ', 'T')
  }
  const remote = event?.source === 'google'
  async function save(e) {
    e.preventDefault(); setError('')
    const fields = Object.fromEntries(new FormData(e.currentTarget))
    const body = { ...fields, isFlexible: fields.isFlexible === 'on' }
    try { await run(event ? `/events/${event.id}` : '/events', body, event ? 'PATCH' : 'POST'); onDone() }
    catch (failure) { setError(failure.message) }
  }
  return <form onSubmit={save} className="space-y-4 rounded-2xl border border-amber-300 bg-amber-50/50 p-5 text-sm text-stone-800">
    <h3 className="font-bold">{event ? 'Edit event' : 'Add a commitment'}</h3>
    {remote && <p className="text-xs">Edit classification and flexibility here. Time changes use the dashboard’s per-task approval; edit other details in Google Calendar.</p>}
    <label className="block font-semibold">Title<input name="title" required maxLength={250} defaultValue={event?.title || ''} readOnly={remote} className={inputClass} placeholder="e.g. Algorithm lecture or grocery run" /></label>
    {!remote && <div className="grid gap-3 sm:grid-cols-2">
      <label className="font-semibold">Start<input name="start" type="datetime-local" required defaultValue={event ? toLocal(event.start) : `${date}T09:00`} className={inputClass} /></label>
      <label className="font-semibold">End<input name="end" type="datetime-local" required defaultValue={event ? toLocal(event.end) : `${date}T10:00`} className={inputClass} /></label>
    </div>}
    <p className="text-xs text-stone-600">Times use {zone}. Choose the next date for an overnight event.</p>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="font-semibold">Category<select name="category" defaultValue={event?.category || 'auto'} className={inputClass}><option value="auto">Auto classify from title</option><option value="cognitive">Cognitive</option><option value="social">Social</option><option value="recharge">Recharge</option></select></label>
      <label className="font-semibold">Consequence if deferred<select name="consequence" defaultValue={event?.consequence || 'medium'} className={inputClass}><option value="low">Low — safe to defer</option><option value="medium">Medium — review before moving</option><option value="high">High — keep in place</option></select></label>
    </div>
    <label className="block font-semibold">Must finish by (optional)<input type="datetime-local" name="deadline" defaultValue={event?.deadline ? toLocal(event.deadline) : ''} className={inputClass} /></label>
    <label className="flex items-center gap-2"><input name="isFlexible" type="checkbox" defaultChecked={event?.isFlexible || false} disabled={event?.hasAttendees} />Flexible task — allow rescheduling suggestions</label>
    {event?.hasAttendees && <p className="text-xs">Events with other attendees stay fixed.</p>}
    {error && <p role="alert" className="text-rose-700">{error}</p>}
    <div className="flex gap-2"><button className={buttonClass} disabled={busy}>{busy ? 'Saving…' : 'Save event'}</button><button type="button" className={secondaryClass} onClick={onDone}>Cancel</button></div>
  </form>
}

export default function CalendarView() {
  const { data, busy, run } = useMoodify()
  const [selectedDate, setSelectedDate] = useState('')
  const [editing, setEditing] = useState(null)
  const [adding, setAdding] = useState(false)
  const [message, setMessage] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    const status = params.get('calendar')
    const reasons = {
      invalid_client: 'Google rejected the app credentials. The developer must check that the backend Client ID and Client Secret belong to the same Web application client, then restart the backend.',
      invalid_grant: 'Google could not accept this sign-in code. Close old sign-in tabs and start Connect Google again from this page. Do not refresh or reuse the callback page.',
      redirect_uri_mismatch: 'The callback address does not match Google Cloud. The developer must register the exact backend GOOGLE_REDIRECT_URI on the same OAuth client.',
      access_denied: 'Google access was denied. Start Connect Google again and approve the requested calendar access.',
      unauthorized_client: 'Google has not authorized this OAuth client for this sign-in flow. The developer must check its Web application client configuration.',
      provider_unavailable: 'Google returned a server error while completing sign-in. Wait briefly, then start Connect Google again.',
      network_error: 'The backend could not reach Google to finish sign-in. Check the server internet connection and retry Connect Google.',
      token_storage_failed: 'Google approved the connection, but Moodify could not store its credentials. The developer must check the backend token-encryption configuration.',
      exchange_failed: 'Google returned to Moodify, but the backend could not finish authorization. Retry Connect Google; if it repeats, contact the developer.',
    }
    if (status === 'failed') return reasons[params.get('reason')] || reasons.exchange_failed
    return status === 'connected' ? 'Google connected. Select Sync now to import your events.' : status === 'denied' || status === 'failed' ? 'Google connection was not completed. You can retry or import an .ics file.' : ''
  })
  const [error, setError] = useState('')
  const [pendingDelete, setPendingDelete] = useState(null)
  const date = selectedDate || data?.date || ''
  const zone = data?.zone || 'Asia/Kuala_Lumpur'
  const events = (data?.events || []).filter(event => localDate(event.start, zone) <= date && localDate(Date.parse(event.end) - 1, zone) >= date).sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
  async function action(path, body, notice, method) {
    setMessage(''); setError('')
    try { const result = await run(path, body, method); setMessage(typeof notice === 'function' ? notice(result) : notice); return result }
    catch (failure) { setError(failure.message); return null }
  }
  async function importFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > 800000) { setError('Choose an .ics file smaller than 800 KB.'); return }
    try { await action('/calendar/import', { name: file.name, text: await file.text() }, result => `Imported ${result.count} events. Window: past 30 days through the next 90 days. Reimporting the same filename updates that calendar.`) }
    catch { setError('Could not read this file. Please choose it again.') }
  }
  async function connect(write) {
    const result = await action('/google/connect', { write }, '')
    if (result) window.location.assign(result.url)
  }
  return <div className="space-y-5">
    <BackendStatus />
    {data && <>
      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <h3 className="font-bold text-stone-900">Bring your calendar into Moodify</h3>
        <p className="mt-1 text-sm text-stone-600">Events are classified automatically. Imported commitments stay fixed until you mark them flexible.</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {!data.google.connected ? <button className={buttonClass} disabled={busy || !data.google.configured} onClick={() => connect(false)}>Connect Google (read only)</button> : <>
            <button className={buttonClass} disabled={busy} onClick={() => action('/google/sync', {}, result => `Synced ${result.count} events from your primary Google calendar.`)}>Sync now</button>
            {!data.google.canWrite && <button className={secondaryClass} disabled={busy} onClick={() => connect(true)}>Enable Google write access</button>}
            <button className={secondaryClass} disabled={busy} onClick={() => action('/google/disconnect', {}, 'Disconnected. Google events were removed from Moodify; your Google calendar was not changed.')}>Disconnect</button>
          </>}
          <label className={`${secondaryClass} cursor-pointer`}>Import .ics<input type="file" accept=".ics,text/calendar" aria-label="Import .ics calendar file" onChange={importFile} disabled={busy} className="mt-2 block max-w-full text-xs" /></label>
          <a href="/api/calendar/export" className={secondaryClass}>Export .ics</a>
        </div>
        {!data.google.configured && <p className="mt-3 text-xs text-stone-600">Google connection needs OAuth setup. You can use .ics import and all local scheduling features now.</p>}
        {data.google.connected && <p className="mt-3 text-xs text-emerald-800">Connected · {data.google.canWrite ? 'Writes enabled; each move still requires approval' : 'Read-only access'} · {data.google.lastSync ? `Last sync: ${new Date(data.google.lastSync).toLocaleString()}` : 'Not synced yet'}</p>}
        <form className="mt-4 flex flex-wrap items-end gap-2" onSubmit={e => { e.preventDefault(); action('/preferences', { zone: new FormData(e.currentTarget).get('zone') }, 'Time zone updated.', 'PUT') }}>
          <label className="text-xs font-semibold text-stone-600">Calendar time zone<input key={zone} name="zone" defaultValue={zone} required aria-label="Calendar time zone" className={inputClass} /></label>
          <button className={secondaryClass} disabled={busy}>Set time zone</button>
        </form>
      </section>
      {busy && <p role="status" className="text-sm text-stone-600">Saving or syncing your calendar…</p>}
      {message && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{message}</p>}
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="text-sm font-bold text-stone-800">Selected day<input type="date" value={date} onChange={e => setSelectedDate(e.target.value)} className={inputClass} /></label>
        <div className="flex gap-2"><button className={secondaryClass} onClick={() => setSelectedDate(data.date)}>Today</button><button className={buttonClass} onClick={() => { setAdding(true); setEditing(null) }}>Add event</button></div>
      </div>
      {(adding || editing) && <EventForm key={editing?.id || `new-${date}`} date={date} zone={zone} event={editing} onDone={() => { setAdding(false); setEditing(null) }} />}
      <p className="text-xs text-stone-500">{events.length} commitments · {zone} · Changes are saved to the backend for this browser session.</p>
      <div className="space-y-3">
        {events.length === 0 && <p className="rounded-2xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500">No commitments on this day. Import your calendar or add an event to calculate your load.</p>}
        {events.map(event => <article key={event.id} className="rounded-2xl border border-stone-200 bg-white p-4 text-sm text-stone-800 shadow-sm">
          <div className="flex flex-wrap justify-between gap-3">
            <div className="min-w-0"><h3 className="break-words font-bold">{event.title}</h3><p className="mt-1 text-xs text-stone-600">{event.allDay ? 'All-day · ' : ''}{displaySlot(event, zone)}</p></div>
            <span className={`h-fit rounded-full px-3 py-1 text-xs font-semibold ${categoryClass[event.category]}`}>{event.category}</span>
          </div>
          <p className="mt-2 text-xs text-stone-500">{event.source} · {event.isFlexible ? `Flexible · ${event.consequence} consequence` : 'Fixed'} · {event.classificationReason}</p>
          {event.deadline && <p className="mt-1 text-xs text-stone-600">Deadline: {displaySlot({ start: event.deadline, end: event.deadline }, zone).split(' → ')[0]}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <button className={secondaryClass} disabled={busy} onClick={() => { setEditing(event); setAdding(false) }}>Edit</button>
            {event.source !== 'google' && <button className={secondaryClass} disabled={busy} onClick={() => setPendingDelete(event.id)}>Delete</button>}
            {event.category === 'recharge' && <button className={secondaryClass} disabled={busy || !!event.completedAt || Date.parse(event.end) > Date.parse(data.serverTime)} onClick={() => action(`/events/${event.id}/complete`, {}, 'Recovery completed. Your streak has been updated.')}>{event.completedAt ? 'Completed' : 'Mark recovery completed'}</button>}
          </div>
          {pendingDelete === event.id && <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-rose-50 p-3"><span>Delete this commitment from Moodify?</span><button className="rounded-lg bg-rose-700 px-3 py-2 font-semibold text-white" disabled={busy} onClick={async () => { const result = await action(`/events/${event.id}`, {}, 'Event deleted.', 'DELETE'); if (result) setPendingDelete(null) }}>Delete event</button><button className={secondaryClass} onClick={() => setPendingDelete(null)}>Keep event</button></div>}
        </article>)}
      </div>
    </>}
  </div>
}
