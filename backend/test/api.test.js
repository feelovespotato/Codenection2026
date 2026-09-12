import test from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { mkdtempSync, rmSync, rmdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp } from '../src/app.js'
import { createStore } from '../src/store.js'
import { AppError } from '../src/engine.js'
import { createAI } from '../src/ai.js'

const current = Date.parse('2026-09-10T00:00:00Z')
async function fixture(t, googleOverrides = {}, ai) {
  const store = createStore(':memory:')
  let clock = current
  const writes = []
  const google = {
    configured: false,
    authUrl() { throw new AppError('Google OAuth is not configured.', 503) },
    async move(data, event, after) { if (!data.google?.canWrite) throw new AppError('Write access required.', 409); writes.push({ event, after }); return { etag: 'updated' } },
    async insert(data, event) { if (!data.google?.canWrite) throw new AppError('Write access required.', 409); writes.push({ event }); return { id: 'remote-new', etag: 'new' } },
    ...googleOverrides,
  }
  const server = createApp({ store, google, ai, now: () => clock }).listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => { server.closeAllConnections(); server.close(); store.db.close() })
  const base = `http://127.0.0.1:${server.address().port}`
  function client() {
    let cookie = ''
    return async (path, body, method = body === undefined ? 'GET' : 'POST', extra = {}) => {
      const response = await fetch(base + '/api' + path, { method, headers: { Cookie: cookie, 'Content-Type': 'application/json', 'X-Moodify-Client': 'web', ...extra }, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' })
      cookie = response.headers.get('set-cookie')?.split(';')[0] || cookie
      const text = await response.text()
      let data
      try { data = JSON.parse(text) } catch { data = text }
      return { status: response.status, data, headers: response.headers }
    }
  }
  const request = client()
  let ownerId
  const user = () => ownerId ||= store.db.prepare('SELECT id FROM users ORDER BY rowid LIMIT 1').get().id
  return { request, client, store, writes, user, advance(ms) { clock += ms } }
}
const event = (title, start, end, extra = {}) => ({ title, start: `2026-09-10T${start}:00+08:00`, end: `2026-09-10T${end}:00+08:00`, ...extra })

test('AI boundary endpoint fails over and returns safe provider metadata', async t => {
  const ai = createAI({ env: { GROQ_API_KEY: 'secret-groq', OPENROUTER_API_KEY: 'secret-router' }, fetchImpl: async url => url.includes('groq.com')
    ? new Response('', { status: 429 })
    : Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"text":"Thanks for asking, but I cannot attend the club meeting."}' } }] }) })
  const { request } = await fixture(t, {}, ai)
  const result = await request('/boundary-template', { intent: 'decline', tone: 'warm', commitment: 'Club meeting' })
  assert.equal(result.status, 200)
  assert.equal(result.data.provider, 'OpenRouter')
  assert.equal(result.data.method, 'ai')
  const status = await request('/ai/status')
  assert.equal(status.data.providers[0].state, 'cooldown')
  assert.doesNotMatch(JSON.stringify(status.data), /secret-groq|secret-router/)
  assert.equal((await request('/state')).data.events.length, 0)
})

test('Tier 2 insights and boundary drafts are session-isolated', async t => {
  const { request, client } = await fixture(t)
  const created = (await request('/events', event('Grocery shopping', '14:00', '14:30'))).data.event
  const state = (await request('/state')).data
  assert.equal(state.insights.deadlines.days.length, 3)
  assert.ok(state.insights.sleep)
  const body = { intent: 'decline', tone: 'direct', eventId: created.id }
  assert.match((await request('/boundary-template', body)).data.text, /Grocery shopping/)
  assert.equal((await client()('/boundary-template', body)).status, 404)
})

test('batch approvals persist all moves atomically and reject stale/replayed proposals', async t => {
  const { request, writes } = await fixture(t)
  await request('/events', event('Grocery shopping', '14:00', '14:30', { isFlexible: true, consequence: 'low' }))
  await request('/events', event('Laundry pickup', '16:00', '16:15', { isFlexible: true, consequence: 'low' }))
  const baseline = (await request('/state')).data
  const [stale] = (await request('/proposals', { kind: 'batch' })).data.proposals
  await request('/checkins', { score: 2 })
  assert.equal((await request(`/proposals/${stale.id}/apply`, { approved: true })).status, 409)
  const [proposal] = (await request('/proposals', { kind: 'batch' })).data.proposals
  assert.equal((await request(`/proposals/${proposal.id}/apply`, { approved: false })).status, 400)
  assert.equal((await request(`/proposals/${proposal.id}/apply`, { approved: true })).status, 200)
  const after = (await request('/state')).data
  assert.equal(after.events.length, baseline.events.length)
  assert.equal(after.capacity.totalLoadHours, baseline.capacity.totalLoadHours)
  for (const move of proposal.moves) assert.equal(after.events.find(e => e.id === move.eventId).start, move.after.start)
  assert.equal(writes.length, 0)
  assert.equal((await request(`/proposals/${proposal.id}/apply`, { approved: true })).status, 409)
  assert.equal((await request('/proposals', { kind: 'batch' })).data.proposals.length, 0)
})

test('calendar/check-in flow persists and returns consistent capacity without sample data', async t => {
  const { request } = await fixture(t)
  const empty = (await request('/state')).data
  assert.equal(empty.events.length, 0); assert.equal(empty.capacity.capacityScore, 0)
  assert.equal((await request('/events', event('Study', '09:00', '11:00'))).status, 201)
  const checkin = await request('/checkins', { score: 5 })
  assert.equal(checkin.status, 200)
  assert.equal(checkin.data.capacity.totalLoadHours, 2.6)
  assert.equal(checkin.data.capacity.latestStress, 5)
  const reload = (await request('/state')).data
  assert.deepEqual(reload.capacity, checkin.data.capacity)
  await request('/checkins', { score: 2 })
  assert.equal((await request('/state')).data.checkin.score, 2)
  assert.equal((await request('/checkins', { score: 6 })).status, 400)
})
test('data is isolated between browser sessions and cross-origin mutations are rejected', async t => {
  const { request, client } = await fixture(t)
  await request('/events', event('Study', '09:00', '11:00'))
  assert.equal((await client()('/state')).data.events.length, 0)
  assert.equal((await request('/events', event('Study', '11:00', '12:00'), 'POST', { Origin: 'https://other.example' })).status, 403)
})
test('suggestions are read-only, apply one task, and cannot be replayed', async t => {
  const { request } = await fixture(t)
  await request('/events', event('Lecture', '09:00', '12:00'))
  const created = (await request('/events', event('Study', '13:00', '15:00', { isFlexible: true, consequence: 'low' }))).data.event
  const proposal = (await request('/proposals', { kind: 'shed' })).data.proposals[0]
  assert.ok(proposal)
  assert.equal((await request('/state')).data.events.find(e => e.id === created.id).start, created.start)
  assert.equal((await request(`/proposals/${proposal.id}/apply`, { approved: false })).status, 400)
  assert.equal((await request(`/proposals/${proposal.id}/apply`, { approved: true })).status, 200)
  assert.equal((await request('/state')).data.events.find(e => e.id === created.id).start, proposal.after.start)
  assert.equal((await request(`/proposals/${proposal.id}/apply`, { approved: true })).status, 409)
})
test('stale, expired and conflicting proposals cannot be applied', async t => {
  const { request, advance } = await fixture(t)
  const first = (await request('/proposals', { kind: 'recovery' })).data.proposals[0]
  // The earliest slot begins now, so use an occupied morning to get a future slot.
  await request('/events', event('Lecture', '08:00', '10:00'))
  assert.equal((await request(`/proposals/${first.id}/apply`, { approved: true })).status, 409)
  const next = (await request('/proposals', { kind: 'recovery' })).data.proposals[0]
  advance(16 * 60000)
  assert.equal((await request(`/proposals/${next.id}/apply`, { approved: true })).status, 409)
})
test('Google write requires permission and an individual approved proposal', async t => {
  const { request, store, writes, user } = await fixture(t)
  await request('/events', event('Lecture', '09:00', '12:00'))
  const created = (await request('/events', event('Study', '13:00', '15:00', { isFlexible: true, consequence: 'low' }))).data.event
  const data = store.get(user())
  Object.assign(data.events.find(e => e.id === created.id), { source: 'google', googleEventId: 'one', etag: 'old' })
  data.google = { canWrite: false }; store.save(user(), data)
  const proposal = (await request('/proposals', { kind: 'timetable' })).data.proposals[0]
  assert.equal(writes.length, 0)
  assert.equal((await request(`/proposals/${proposal.id}/apply`, { approved: true })).status, 409)
  const writable = store.get(user()); writable.google.canWrite = true; store.save(user(), writable)
  assert.equal((await request(`/proposals/${proposal.id}/apply`, { approved: true })).status, 200)
  assert.equal(writes.length, 1)
})
test('failed remote write leaves the local schedule unchanged', async t => {
  const { request, store, user } = await fixture(t, { async move() { throw new AppError('Provider unavailable.', 502) } })
  await request('/events', event('Lecture', '09:00', '12:00'))
  const created = (await request('/events', event('Study', '13:00', '15:00', { isFlexible: true }))).data.event
  const data = store.get(user()); data.events[1].source = 'google'; data.google = { canWrite: true }; store.save(user(), data)
  const proposal = (await request('/proposals', { kind: 'shed' })).data.proposals[0]
  assert.equal((await request(`/proposals/${proposal.id}/apply`, { approved: true })).status, 502)
  assert.equal((await request('/state')).data.events.find(e => e.id === created.id).start, created.start)
})
test('import is idempotent; worker parses calendar and export is downloadable', async t => {
  const { request } = await fixture(t)
  const text = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:abc\r\nSUMMARY:Study\r\nDTSTART:20260910T090000\r\nDTEND:20260910T100000\r\nEND:VEVENT\r\nEND:VCALENDAR'
  const first = await request('/calendar/import', { name: 'test.ics', text })
  assert.equal(first.status, 200, JSON.stringify(first.data)); assert.equal(first.data.count, 1)
  assert.equal((await request('/calendar/import', { name: 'test.ics', text })).status, 200)
  assert.equal((await request('/state')).data.events.length, 1)
  const output = await request('/calendar/export')
  assert.match(output.headers.get('content-type'), /text\/calendar/)
  assert.match(output.data, /BEGIN:VEVENT/)
})
test('recovery insertion is not completion and cannot overlap the current schedule', async t => {
  const { request, advance } = await fixture(t)
  await request('/events', event('Lecture', '08:00', '10:00'))
  const proposal = (await request('/proposals', { kind: 'recovery' })).data.proposals[0]
  assert.equal((await request(`/proposals/${proposal.id}/apply`, { approved: true })).status, 200)
  const state = (await request('/state')).data
  assert.equal(state.capacity.recoveryStreak.currentStreak, 0)
  const block = state.events.find(e => e.category === 'recharge')
  assert.equal((await request(`/events/${block.id}/complete`, {})).status, 400)
  advance(4 * 3600000)
  const automatic = (await request('/state')).data
  assert.equal(automatic.capacity.calendarRecoveryStreak.currentStreak, 1)
  assert.equal(automatic.events.find(e => e.id === block.id).recoveryStatus, 'inferred')
  assert.equal(automatic.events.find(e => e.id === block.id).completedAt, null)
  assert.equal((await request(`/events/${block.id}/complete`, {})).status, 200)
  assert.equal((await request('/state')).data.capacity.calendarRecoveryStreak.currentStreak, 1)
})
test('SQLite state and sessions survive reopening the database', () => {
  const directory = mkdtempSync(join(tmpdir(), 'moodify-store-'))
  const file = join(directory, 'test.sqlite')
  let store = createStore(file)
  store.createSession('session', 'user')
  const data = store.get('user'); data.checkins.push({ date: '2026-09-10', score: 4 }); data.recoverySessions = [{ id: 'saved-session', startedAt: '2026-09-10T00:00:00Z', completedAt: '2026-09-10T00:01:00Z', durationSeconds: 60 }]; store.save('user', data)
  store.db.close()
  store = createStore(file)
  assert.equal(store.session('session'), 'user')
  assert.equal(store.get('user').checkins[0].score, 4)
  assert.equal(store.get('user').recoverySessions[0].id, 'saved-session')
  store.db.close()
  for (const suffix of ['', '-wal', '-shm']) rmSync(file + suffix, { force: true })
  rmdirSync(directory)
})

test('Google batch applies one approved move, preserves partial success and retries failure', async t => {
  let fail = false
  const { request, store, user, client, writes } = await fixture(t, {
    async move(data, item, after) {
      if (!data.google?.canWrite) throw new AppError('Write access required.', 409)
      if (fail) throw new AppError('Remote event changed. Sync Google.', 409)
      writes.push({ id: item.id, after }); return { etag: 'new-etag' }
    },
  })
  await request('/events', event('Laundry', '14:00', '14:30', { isFlexible: true, consequence: 'low' }))
  await request('/events', event('Grocery', '16:00', '16:30', { isFlexible: true, consequence: 'low' }))
  const data = store.get(user())
  data.events.forEach((e, i) => Object.assign(e, { source: 'google', googleEventId: `remote-${i}`, etag: 'old-etag' }))
  store.save(user(), data)
  const [proposal] = (await request('/proposals', { kind: 'batch' })).data.proposals
  assert.equal(proposal.individualApproval, true)
  const path = `/proposals/${proposal.id}/apply`
  const approve = index => ({ approved: true, eventId: proposal.moves[index].eventId })
  assert.equal(writes.length, 0)
  assert.equal((await client()(path, approve(0))).status, 409)
  assert.equal((await request(path, { approved: true })).status, 409)
  assert.equal((await request(path, approve(0))).status, 409)
  const writable = store.get(user()); writable.google = { canWrite: true }; store.save(user(), writable)
  assert.equal((await request(path, approve(0))).status, 200)
  assert.equal(writes.length, 1)
  assert.equal((await request(path, approve(0))).status, 409)
  fail = true
  assert.equal((await request(path, approve(1))).status, 409)
  const partial = (await request('/state')).data
  assert.equal(partial.events.find(e => e.id === proposal.moves[0].eventId).start, proposal.moves[0].after.start)
  assert.equal(partial.events.find(e => e.id === proposal.moves[1].eventId).start, proposal.moves[1].before.start)
  fail = false
  assert.equal((await request(path, approve(1))).status, 200)
  assert.equal(writes.length, 2)
  assert.equal((await request(path, approve(1))).status, 409)
})

test('recovery sessions require elapsed time, isolate users, save once and exclude abandoned sessions', async t => {
  const { request, client, advance, store, user } = await fixture(t)
  assert.equal((await request('/recovery-sessions', { technique: 'fake' })).status, 400)
  const start = async () => (await request('/recovery-sessions', { technique: 'calm' })).data.session
  const abandoned = await start()
  const owner = user()
  advance(60000)
  assert.equal((await request('/state')).data.capacity.recoveryStreak.currentStreak, 0)
  const session = await start()
  const path = `/recovery-sessions/${session.id}/complete`
  assert.equal((await request(`/recovery-sessions/${abandoned.id}/complete`, {})).status, 404)
  assert.equal((await client()(path, {})).status, 404)
  assert.equal((await request(path, {})).status, 409)
  advance(60000)
  const completed = await request(path, {})
  assert.equal(completed.status, 200)
  advance(1000)
  assert.equal((await request(path, {})).data.session.completedAt, completed.data.session.completedAt)
  assert.equal(store.get(owner).recoverySessions.filter(s => s.completedAt).length, 1)
  const state = (await request('/state')).data
  assert.equal(state.capacity.recoveryStreak.currentStreak, 1)
  assert.equal(state.capacity.calendarRecoveryStreak.currentStreak, 0)
  const expired = await start(); advance(31 * 60000)
  assert.equal((await request(`/recovery-sessions/${expired.id}/complete`, {})).status, 409)
  advance(2 * 86400000)
  assert.equal((await request('/state')).data.capacity.recoveryStreak.currentStreak, 0)
})

test('local upload requires approval/write access and links one event without duplicates', async t => {
  let calls = 0
  let fail = true
  const { request, client, store, user } = await fixture(t, {
    async upload(data, item) {
      calls++
      assert.match(item.googleUploadId, /^[a-f0-9]{32}$/)
      if (fail) throw new AppError('Network failure', 502)
      return { id: item.googleUploadId, etag: 'uploaded' }
    },
  })
  const item = (await request('/events', event('Gathering', '17:00', '17:30'))).data.event
  const path = `/events/${item.id}/upload-google`
  assert.equal((await request(path, {})).status, 400)
  assert.equal((await request(path, { approved: true })).status, 409)
  assert.equal((await client()(path, { approved: true })).status, 404)
  assert.equal(calls, 0)
  const data = store.get(user()); data.google = { canWrite: true }; store.save(user(), data)
  assert.equal((await request(path, { approved: true })).status, 502)
  const pending = store.get(user()).events[0]
  assert.equal(pending.source, 'moodify')
  fail = false
  const uploaded = (await request(path, { approved: true })).data.event
  assert.equal(uploaded.id, item.id)
  assert.equal(uploaded.source, 'google')
  assert.equal(uploaded.googleEventId, pending.googleUploadId)
  assert.equal((await request(path, { approved: true })).status, 200)
  assert.equal(calls, 2)
  assert.equal((await request('/state')).data.events.length, 1)
})

test('Google time edits require approval and preserve local state on remote failure', async t => {
  let rejected = false
  const { request, store, user, writes } = await fixture(t, {
    async move(data, item, after) {
      if (!data.google?.canWrite || rejected) throw new AppError('Write denied or event changed', 409)
      writes.push(after); return { etag: 'edited' }
    },
  })
  const item = (await request('/events', event('Laundry', '14:00', '14:30'))).data.event
  const data = store.get(user()); Object.assign(data.events[0], { source: 'google', googleEventId: 'remote', etag: 'old' }); store.save(user(), data)
  const path = `/events/${item.id}`
  const change = { start: '2026-09-10T16:00', end: '2026-09-10T16:45', approved: true }
  assert.equal((await request(path, { ...change, approved: false }, 'PATCH')).status, 400)
  assert.equal((await request(path, change, 'PATCH')).status, 409)
  assert.equal((await request('/state')).data.events[0].start, item.start)
  data.google = { canWrite: true }; store.save(user(), data)
  const response = await request(path, change, 'PATCH')
  assert.equal(response.status, 200)
  assert.equal(response.data.event.start, '2026-09-10T08:00:00.000Z')
  assert.equal(response.data.event.end, '2026-09-10T08:45:00.000Z')
  assert.equal(response.data.event.etag, 'edited')
  assert.equal(writes.length, 1)
  rejected = true
  assert.equal((await request(path, { ...change, end: '2026-09-10T17:00' }, 'PATCH')).status, 409)
  assert.equal((await request('/state')).data.events[0].end, response.data.event.end)
  assert.equal((await request(path, { category: 'social' }, 'PATCH')).status, 200)
  assert.equal(writes.length, 1)
})
