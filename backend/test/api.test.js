import test from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { mkdtempSync, rmSync, rmdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp } from '../src/app.js'
import { createStore } from '../src/store.js'
import { AppError } from '../src/engine.js'

const current = Date.parse('2026-09-10T00:00:00Z')
async function fixture(t, googleOverrides = {}) {
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
  const server = createApp({ store, google, now: () => clock }).listen(0, '127.0.0.1')
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
  const user = () => store.db.prepare('SELECT id FROM users LIMIT 1').get().id
  return { request, client, store, writes, user, advance(ms) { clock += ms } }
}
const event = (title, start, end, extra = {}) => ({ title, start: `2026-09-10T${start}:00+08:00`, end: `2026-09-10T${end}:00+08:00`, ...extra })

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
  Object.assign(data.events.find(e => e.id === created.id), { source: 'google', googleId: 'one', etag: 'old' })
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
  assert.equal((await request(`/events/${block.id}/complete`, {})).status, 200)
  assert.equal((await request('/state')).data.capacity.recoveryStreak.currentStreak, 1)
})
test('SQLite state and sessions survive reopening the database', () => {
  const directory = mkdtempSync(join(tmpdir(), 'moodify-store-'))
  const file = join(directory, 'test.sqlite')
  let store = createStore(file)
  store.createSession('session', 'user')
  const data = store.get('user'); data.checkins.push({ date: '2026-09-10', score: 4 }); store.save('user', data)
  store.db.close()
  store = createStore(file)
  assert.equal(store.session('session'), 'user')
  assert.equal(store.get('user').checkins[0].score, 4)
  store.db.close()
  for (const suffix of ['', '-wal', '-shm']) rmSync(file + suffix, { force: true })
  rmdirSync(directory)
})
