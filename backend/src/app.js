import express from 'express'
import { randomBytes, randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import { capacity, dayStart, normalizeEvent, overlaps, recovery, recoveryStatus, requireValue, streak, timetable, validZone } from './engine.js'
import { exportCalendar, importCalendar } from './ics.js'

export function createApp({ store, google, origin = 'http://localhost:5173', now = () => Date.now(), staticDirectory }) {
  const app = express()
  app.disable('x-powered-by')
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store')
    res.set('X-Content-Type-Options', 'nosniff')
    if (req.headers.origin && req.headers.origin !== origin) return res.status(403).json({ error: 'Request origin is not allowed.' })
    if (!['GET', 'HEAD'].includes(req.method) && (req.headers['x-moodify-client'] !== 'web' || !req.is('application/json'))) return res.status(403).json({ error: 'Use the Moodify application to make changes.' })
    next()
  })
  app.use(express.json({ limit: '1mb' }))
  app.get('/api/health', (_req, res) => res.json({ ok: true }))
  app.use('/api', (req, res, next) => {
    const sessionId = /(?:^|; )moodify_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1]
    let userId = sessionId && store.session(sessionId)
    if (!userId) {
      userId = randomUUID()
      const session = randomBytes(32).toString('hex')
      store.createSession(session, userId)
      res.cookie('moodify_session', session, { httpOnly: true, sameSite: 'lax', secure: origin.startsWith('https:'), maxAge: 30 * 86400000, path: '/' })
    }
    req.userId = userId
    next()
  })
  // Serialize mutations per user across async Google/import operations to prevent lost updates.
  const locks = new Map()
  function mutate(handler) {
    return async (req, res, next) => {
      const prior = locks.get(req.userId) || Promise.resolve()
      let release
      const current = new Promise(resolve => { release = resolve })
      locks.set(req.userId, current)
      await prior
      try { await handler(req, res, store.get(req.userId)) } catch (error) { next(error) }
      finally { release(); if (locks.get(req.userId) === current) locks.delete(req.userId) }
    }
  }
  function persist(req, data) { data.revision++; data.proposals = []; store.save(req.userId, data) }
  function snapshot(data, date) {
    date ||= DateTime.fromMillis(now(), { zone: data.zone }).toISODate()
    return { zone: data.zone, date, serverTime: new Date(now()).toISOString(), events: data.events.map(event => ({ ...event, recoveryStatus: recoveryStatus(event, now()) })), checkin: data.checkins.find(c => c.date === date) || null,
      capacity: { ...capacity(data.events, data.checkins, date, data.zone), recoveryStreak: streak(data.events, data.zone, now()) },
      revision: data.revision, google: { configured: google.configured, connected: Boolean(data.google), canWrite: Boolean(data.google?.canWrite), lastSync: data.google?.lastSync || null },
    }
  }
  app.get('/api/state', (req, res) => res.json(snapshot(store.get(req.userId), req.query.date)))
  app.put('/api/preferences', mutate((req, res, data) => {
    requireValue(validZone(req.body.zone), 'Choose a valid IANA time zone.')
    if (data.zone !== req.body.zone) { data.zone = req.body.zone; persist(req, data) }
    res.json(snapshot(data))
  }))
  app.post('/api/events', mutate((req, res, data) => {
    const event = normalizeEvent(req.body, data.zone)
    requireValue(data.events.length < 12000, 'Calendar is full.', 413)
    data.events.push(event); persist(req, data); res.status(201).json({ event })
  }))
  app.patch('/api/events/:id', mutate((req, res, data) => {
    const event = data.events.find(e => e.id === req.params.id)
    requireValue(event, 'Event not found.', 404)
    // Google time/title edits must go through approved proposals; local metadata is safe to change here.
    const input = event.source === 'google' ? { ...event, category: req.body.category ?? event.category, isFlexible: req.body.isFlexible ?? event.isFlexible, consequence: req.body.consequence ?? event.consequence, deadline: req.body.deadline ?? event.deadline } : { ...event, ...req.body }
    const updated = normalizeEvent(input, data.zone, event)
    data.events = data.events.map(e => e.id === event.id ? updated : e)
    persist(req, data); res.json({ event: updated })
  }))
  app.delete('/api/events/:id', mutate((req, res, data) => {
    const event = data.events.find(e => e.id === req.params.id)
    requireValue(event, 'Event not found.', 404)
    requireValue(event.source !== 'google', 'Delete this event in Google Calendar, then sync again.')
    data.events = data.events.filter(e => e.id !== event.id); persist(req, data); res.json({ ok: true })
  }))
  app.post('/api/events/:id/complete', mutate((req, res, data) => {
    const event = data.events.find(e => e.id === req.params.id)
    requireValue(event?.category === 'recharge', 'Recovery event not found.', 404)
    requireValue(Date.parse(event.end) <= now(), 'This recovery block has not finished yet.')
    event.completedAt ||= new Date(now()).toISOString(); persist(req, data); res.json({ ok: true })
  }))
  app.post('/api/checkins', mutate((req, res, data) => {
    requireValue(Number.isInteger(req.body.score) && req.body.score >= 1 && req.body.score <= 5, 'Stress score must be an integer from 1 to 5.')
    const date = DateTime.fromMillis(now(), { zone: data.zone }).toISODate()
    data.checkins = [{ date, score: req.body.score, recordedAt: new Date(now()).toISOString() }, ...data.checkins.filter(c => c.date !== date)].slice(0, 366)
    persist(req, data); res.json(snapshot(data))
  }))
  app.post('/api/calendar/import', mutate(async (req, res, data) => {
    const sourceName = String(req.body.name || 'calendar.ics').slice(0, 200)
    const result = await importCalendar(req.body.text, data.zone, sourceName, now())
    const old = new Map(data.events.map(e => [e.id, e]))
    const incoming = result.events.map(event => old.has(event.id) ? { ...event, category: old.get(event.id).category, weight: old.get(event.id).weight, isFlexible: old.get(event.id).isFlexible, consequence: old.get(event.id).consequence, deadline: old.get(event.id).deadline, completedAt: old.get(event.id).completedAt } : event)
    data.events = [...data.events.filter(e => !(e.source === 'ics' && e.sourceName === sourceName && Date.parse(e.start) < Date.parse(result.to) && Date.parse(e.end) > Date.parse(result.from))), ...incoming]
    requireValue(data.events.length <= 12000, 'Import would exceed the calendar size limit.', 413)
    persist(req, data); res.json({ count: incoming.length, from: result.from, to: result.to })
  }))
  app.get('/api/calendar/export', (req, res) => {
    const data = store.get(req.userId)
    res.set('Content-Disposition', 'attachment; filename="moodify-calendar.ics"').type('text/calendar').send(exportCalendar(data.events, data.zone))
  })
  app.post('/api/proposals', mutate((req, res, data) => {
    const kind = req.body.kind
    requireValue(['shed', 'timetable', 'recovery'].includes(kind), 'Unknown suggestion type.')
    const date = req.body.date || DateTime.fromMillis(now(), { zone: data.zone }).toISODate()
    dayStart(date, data.zone)
    const suggestions = kind === 'recovery' ? recovery(data, date, now()) : timetable(data, date, now(), kind)
    const proposals = suggestions.map(item => ({ ...item, id: randomUUID(), revision: data.revision, expires: now() + 15 * 60000 }))
    data.proposals = [...data.proposals.filter(p => p.expires > now() && p.kind !== kind), ...proposals].slice(-20)
    store.save(req.userId, data)
    res.json({ proposals, message: proposals.length ? null : kind === 'recovery' ? 'No suitable free time remains between 08:00 and 21:00 on this day.' : 'No safe move found. Mark an upcoming task flexible with low/medium consequence, or keep this schedule.' })
  }))
  app.post('/api/proposals/:id/apply', mutate(async (req, res, data) => {
    requireValue(req.body.approved === true, 'Approve this individual change first.')
    const proposal = data.proposals.find(p => p.id === req.params.id)
    requireValue(proposal && proposal.revision === data.revision && proposal.expires > now(), 'This suggestion expired or the schedule changed. Generate fresh suggestions.', 409)
    requireValue(Date.parse(proposal.after.start) > now(), 'This suggested time has passed. Generate a new suggestion.', 409)
    requireValue(!overlaps(proposal.after, data.events, proposal.eventId), 'That slot is no longer free. Generate new suggestions.', 409)
    if (proposal.kind === 'recovery') {
      const event = normalizeEvent({ title: proposal.title, ...proposal.after, category: 'recharge', consequence: 'low' }, data.zone)
      if (req.body.writeToGoogle === true) {
        const remote = await google.insert(data, event, proposal.id)
        Object.assign(event, { source: 'google', googleId: remote.id, etag: remote.etag })
      }
      data.events.push(event)
    } else {
      const event = data.events.find(e => e.id === proposal.eventId)
      requireValue(event?.isFlexible && !event.hasAttendees && event.consequence !== 'high', 'This event is no longer eligible to move.', 409)
      requireValue(!event.deadline || Date.parse(proposal.after.end) <= Date.parse(event.deadline), 'Move would cross the deadline.', 409)
      if (event.source === 'google') {
        const remote = await google.move(data, event, proposal.after)
        event.etag = remote.etag
      }
      Object.assign(event, proposal.after)
    }
    persist(req, data); res.json({ ok: true })
  }))
  app.post('/api/google/connect', mutate((req, res, data) => {
    const state = randomBytes(32).toString('hex'), write = req.body.write === true
    const url = google.authUrl(state, write)
    data.oauth = { state, write, expires: now() + 10 * 60000 }; store.save(req.userId, data)
    res.json({ url })
  }))
  app.get('/api/google/callback', mutate(async (req, res, data) => {
    const oauth = data.oauth
    delete data.oauth; store.save(req.userId, data)
    if (!oauth || oauth.state !== req.query.state || oauth.expires < now() || req.query.error || typeof req.query.code !== 'string') return res.redirect(`${origin}/?calendar=denied`)
    try {
      data.google = await google.exchange(req.query.code, oauth.write)
      persist(req, data)
      res.redirect(`${origin}/?calendar=connected`)
    } catch (error) {
      const allowed = ['invalid_client', 'invalid_grant', 'redirect_uri_mismatch', 'access_denied', 'unauthorized_client', 'provider_unavailable', 'network_error', 'exchange_failed', 'token_storage_failed']
      const reason = allowed.includes(error.oauthReason) ? error.oauthReason : 'exchange_failed'
      res.redirect(`${origin}/?calendar=failed&reason=${reason}`)
    }
  }))
  app.post('/api/google/sync', mutate(async (req, res, data) => { const count = await google.sync(data, now()); persist(req, data); res.json({ count }) }))
  app.post('/api/google/disconnect', mutate((req, res, data) => {
    data.google = null; delete data.oauth
    data.events = data.events.filter(e => e.source !== 'google')
    persist(req, data); res.json({ ok: true })
  }))
  app.use('/api', (_req, res) => res.status(404).json({ error: 'API endpoint not found.' }))
  if (staticDirectory) app.use(express.static(staticDirectory))
  app.use((error, _req, res, _next) => {
    const status = error.status || 500
    if (status === 500) console.error('API failure:', error.message)
    res.status(status).json({ error: status === 500 ? 'The server could not complete this request.' : error.message })
  })
  return app
}
