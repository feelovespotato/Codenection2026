import test from 'node:test'
import assert from 'node:assert/strict'
import { OAuth2Client } from 'google-auth-library'
import { createGoogle } from '../src/google.js'
const cipher = { encrypt: value => JSON.stringify(value), decrypt: value => JSON.parse(value) }
const google = createGoogle({ clientId: 'test-client', clientSecret: 'test-secret', redirectUri: 'http://localhost:5173/api/google/callback' }, cipher)
const profile = () => ({ zone: 'Asia/Kuala_Lumpur', events: [], checkins: [], google: { tokens: cipher.encrypt({ access_token: 'test-only' }), canWrite: true } })
const remote = (id, extra = {}) => ({ id, summary: 'Study', start: { dateTime: '2026-09-10T09:00:00+08:00' }, end: { dateTime: '2026-09-10T10:00:00+08:00' }, etag: 'v1', ...extra })

test('OAuth exchange exposes only safe failure categories without provider secrets', async t => {
  for (const [response, expected] of [
    [{ status: 401, data: { error: 'invalid_client' } }, 'invalid_client'],
    [{ status: 400, data: { error: 'invalid_grant' } }, 'invalid_grant'],
    [{ status: 503, data: {} }, 'provider_unavailable'],
    [undefined, 'network_error'],
    [{ status: 400, data: { error: 'private-token-in-error' } }, 'exchange_failed'],
  ]) {
    const mock = t.mock.method(OAuth2Client.prototype, 'getToken', async () => {
      throw Object.assign(new Error('sensitive-provider-message'), { response })
    })
    await assert.rejects(google.exchange('private-code', false), error => {
      assert.equal(error.oauthReason, expected)
      assert.equal(error.message, 'Google authorization failed. Please reconnect.')
      assert.ok(!JSON.stringify(error).includes('private-'))
      return true
    })
    mock.mock.restore()
  }
})

test('OAuth exchange encrypts tokens and reports the granted write scope', async t => {
  const tokens = { access_token: 'test-token', scope: 'https://www.googleapis.com/auth/calendar.events' }
  t.mock.method(OAuth2Client.prototype, 'getToken', async () => ({ tokens }))
  const connection = await google.exchange('test-code', true)
  assert.equal(connection.canWrite, true)
  assert.deepEqual(cipher.decrypt(connection.tokens), tokens)
})

test('token storage failures are not reported as network failures', async t => {
  t.mock.method(OAuth2Client.prototype, 'getToken', async () => ({ tokens: { access_token: 'test-token' } }))
  const brokenStorage = createGoogle({ clientId: 'test', clientSecret: 'test', redirectUri: 'http://localhost/callback' }, {
    encrypt() { throw new Error('private-storage-details') },
  })
  await assert.rejects(brokenStorage.exchange('test-code', false), error => {
    assert.equal(error.oauthReason, 'token_storage_failed')
    assert.ok(!error.message.includes('private-storage-details'))
    return true
  })
})

test('Google sync reads every page, classifies, removes missing events and hides credentials', async t => {
  const calls = []
  t.mock.method(OAuth2Client.prototype, 'request', async options => {
    calls.push(options)
    return options.params.pageToken ? { data: { items: [remote('second', { summary: 'Club meeting' })] } } : { data: {
      nextPageToken: 'page2', items: [remote('first'), remote('cancelled', { status: 'cancelled' }), remote('free', { transparency: 'transparent' }), remote('declined', { attendees: [{ self: true, responseStatus: 'declined' }] })],
    } }
  })
  const data = profile(); data.events = [{ id: 'deleted', source: 'google' }, { id: 'local', source: 'local' }]
  assert.equal(await google.sync(data, Date.parse('2026-09-10')), 2)
  assert.equal(calls.length, 2); assert.equal(calls[0].params.singleEvents, true)
  assert.equal(data.events.length, 3)
  assert.equal(data.events.find(e => e.googleId === 'second').category, 'social')
  assert.equal(data.events.some(e => e.id === 'deleted'), false)
  assert.equal(data.events.find(e => e.googleId === 'first').isFlexible, false)
})
test('sync leaves existing events intact when a later page fails', async t => {
  t.mock.method(OAuth2Client.prototype, 'request', async options => {
    if (options.params.pageToken) throw new Error('offline')
    return { data: { items: [remote('new')], nextPageToken: 'page2' } }
  })
  const data = profile(); data.events = [{ id: 'existing', source: 'local' }]
  await assert.rejects(google.sync(data, Date.parse('2026-09-10')), /could not complete/)
  assert.deepEqual(data.events, [{ id: 'existing', source: 'local' }])
})
test('Google all-day imports use the user time zone and preserve exclusive end', async t => {
  t.mock.method(OAuth2Client.prototype, 'request', async () => ({ data: { items: [remote('all-day', { start: { date: '2026-09-10' }, end: { date: '2026-09-11' } })] } }))
  const data = profile(); await google.sync(data)
  assert.equal(data.events[0].start, '2026-09-09T16:00:00.000Z')
  assert.equal(data.events[0].end, '2026-09-10T16:00:00.000Z')
  assert.equal(data.events[0].allDay, true)
})
test('Google move rechecks availability, sends only time changes and uses If-Match', async t => {
  const calls = []
  t.mock.method(OAuth2Client.prototype, 'request', async options => {
    calls.push(options)
    return { data: options.method === 'PATCH' ? { etag: 'v2' } : { items: [] } }
  })
  const after = { start: '2026-09-11T00:00:00.000Z', end: '2026-09-11T01:00:00.000Z' }
  await google.move(profile(), { googleId: 'original', etag: 'v1' }, after)
  assert.equal(calls.length, 2)
  assert.equal(calls[1].headers['If-Match'], 'v1')
  assert.deepEqual(Object.keys(calls[1].data), ['start', 'end'])
  assert.equal(calls[1].params.sendUpdates, 'none')
})
test('new provider conflicts prevent any Google write', async t => {
  const calls = []
  t.mock.method(OAuth2Client.prototype, 'request', async options => { calls.push(options); return { data: { items: [remote('conflict')] } } })
  await assert.rejects(google.move(profile(), { googleId: 'original', etag: 'v1' }, { start: '2026-09-11T00:00:00Z', end: '2026-09-11T01:00:00Z' }), /commitment in that slot/)
  assert.equal(calls.length, 1)
})
test('OAuth read-only mode requests the narrow scope and write mode is explicit', () => {
  const read = new URL(google.authUrl('state-value', false))
  assert.equal(read.searchParams.get('state'), 'state-value')
  assert.equal(read.searchParams.get('scope'), 'https://www.googleapis.com/auth/calendar.events.readonly')
  assert.equal(new URL(google.authUrl('state-value', true)).searchParams.get('scope'), 'https://www.googleapis.com/auth/calendar.events')
})
