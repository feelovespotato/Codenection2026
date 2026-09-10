import test from 'node:test'
import assert from 'node:assert/strict'
import { createAI, parseAIJson } from '../src/ai.js'
import { boundaryDraft, enhanceProposals } from '../src/ai-features.js'
import { normalizeEvent, recovery, timetable } from '../src/engine.js'

const keys = { GROQ_API_KEY: 'test-groq-key', OPENROUTER_API_KEY: 'test-router-key', GEMINI_API_KEY: 'test-gemini-key' }
const request = { system: 'Return JSON', prompt: 'Hello', validate: text => parseAIJson(text).text }
const completion = text => Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ text }) } }] })
const gemini = text => Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ text }) }] } }] })

test('missing keys and disabled AI make no network calls; public status contains no secrets', async () => {
  const fetchImpl = () => { throw new Error('must not call') }
  assert.equal((await createAI({ env: {}, fetchImpl }).generate(request)).reason, 'not_configured')
  const disabled = createAI({ env: { ...keys, AI_ENABLED: 'false' }, fetchImpl })
  assert.equal((await disabled.generate(request)).reason, 'not_configured')
  assert.doesNotMatch(JSON.stringify(disabled.status()), /test-groq-key|test-router-key|test-gemini-key/)
})

test('tries Groq, OpenRouter and Gemini in order with provider-specific authentication', async () => {
  const calls = []
  const ai = createAI({ env: keys, fetchImpl: async (url, options) => {
    calls.push({ url, options })
    if (calls.length === 1) return new Response('secret provider error', { status: 401 })
    if (calls.length === 2) return new Response('', { status: 503 })
    return gemini('working')
  } })
  const result = await ai.generate(request)
  assert.equal(result.provider, 'Google Gemini')
  assert.equal(result.value, 'working')
  assert.match(calls[0].url, /api.groq.com/)
  assert.match(calls[1].url, /openrouter.ai/)
  assert.match(calls[2].url, /generativelanguage.googleapis.com/)
  assert.equal(calls[0].options.headers.Authorization, 'Bearer test-groq-key')
  assert.equal(calls[2].options.headers['x-goog-api-key'], 'test-gemini-key')
  assert.equal(new URL(calls[2].url).search, '')
  assert.equal(JSON.parse(calls[1].options.body).model, 'openrouter/free')
  assert.doesNotMatch(JSON.stringify(ai.status()), /secret provider error|test-groq-key/)
})

test('honors rate-limit cooldown then retries the primary provider after recovery', async () => {
  let clock = 1000000
  let primaryCalls = 0
  const ai = createAI({ env: keys, now: () => clock, fetchImpl: async url => {
    if (url.includes('groq.com')) { primaryCalls++; return primaryCalls === 1 ? new Response('', { status: 429, headers: { 'Retry-After': '120' } }) : completion('primary recovered') }
    return completion('backup')
  } })
  assert.equal((await ai.generate(request)).provider, 'OpenRouter')
  clock += 60001
  assert.equal((await ai.generate(request)).provider, 'OpenRouter')
  assert.equal(primaryCalls, 1)
  clock += 60000
  assert.equal((await ai.generate(request)).provider, 'Groq')
  assert.equal(ai.status().providers[0].state, 'ready')
})

test('timeout, invalid JSON and empty output all fail over without leaking errors', async () => {
  for (const first of [() => new Promise(() => {}), () => new Response('invalid json'), () => completion('')]) {
    const calls = []
    const ai = createAI({ env: { ...keys, AI_TIMEOUT_MS: '100' }, fetchImpl: async (url, options) => {
      calls.push(options.signal)
      return url.includes('groq.com') ? first() : completion('backup')
    } })
    const result = await ai.generate({ ...request, validate: text => parseAIJson(text).text || null })
    assert.equal(result.value, 'backup')
    assert.equal(result.provider, 'OpenRouter')
    assert.equal(calls[0].aborted, true)
  }
})

test('all-provider outage returns local fallback; moderation refusal does not try another provider', async () => {
  const ai = createAI({ env: keys, fetchImpl: async () => { throw new Error('sensitive error details') } })
  assert.deepEqual(await ai.generate(request), { value: null, method: 'local', provider: null, reason: 'unavailable' })
  let calls = 0
  const blocked = createAI({ env: keys, fetchImpl: async () => { calls++; return Response.json({ choices: [{ finish_reason: 'content_filter' }] }) } })
  assert.equal((await blocked.generate(request)).reason, 'blocked')
  assert.equal(calls, 1)
})

test('total deadline bounds a stalled chain and per-session limits preserve a local fallback', async () => {
  let calls = 0
  const ai = createAI({ env: { ...keys, AI_TIMEOUT_MS: '100', AI_TOTAL_TIMEOUT_MS: '100' }, fetchImpl: () => { calls++; return new Promise(() => {}) } })
  assert.equal((await ai.generate(request)).method, 'local')
  assert.equal(calls, 1)
  const limited = createAI({ env: { GROQ_API_KEY: 'test', AI_REQUESTS_PER_MINUTE: '1' }, fetchImpl: async () => completion('ok') })
  assert.equal((await limited.generate({ ...request, scope: 'a' })).method, 'ai')
  assert.equal((await limited.generate({ ...request, scope: 'a' })).reason, 'busy')
  assert.equal((await limited.generate({ ...request, scope: 'b' })).method, 'ai')
})

test('provider order deduplicates and paid OpenRouter models need explicit opt-in', async () => {
  const ai = createAI({ env: { ...keys, AI_PROVIDER_ORDER: 'openrouter,groq,groq,typo', OPENROUTER_MODEL: 'paid/model' }, fetchImpl: async () => completion('ok') })
  assert.equal((await ai.generate(request)).provider, 'Groq')
  assert.equal(ai.status().providers[0].state, 'paid_disabled')
  assert.deepEqual(ai.status().unknownProviders, ['typo'])
  assert.equal(ai.status().providers.length, 2)
})

const zone = 'Asia/Kuala_Lumpur'
const date = '2026-09-10'
const now = Date.parse('2026-09-10T08:00:00+08:00')
const state = () => ({ zone, checkins: [{ date, score: 4 }], events: [
  normalizeEvent({ title: 'Private lecture title', start: `${date}T09:00:00+08:00`, end: `${date}T12:00:00+08:00` }, zone),
  normalizeEvent({ title: 'Private study title', start: `${date}T13:00:00+08:00`, end: `${date}T15:00:00+08:00`, isFlexible: true, consequence: 'low' }, zone),
] })

test('boundary AI only receives the authorized draft; invalid event sends nothing', async () => {
  const data = state()
  let prompt
  const ai = createAI({ env: { GROQ_API_KEY: 'test' }, fetchImpl: async (_url, options) => { prompt = JSON.parse(options.body).messages[1].content; return completion('Thanks, but I cannot attend.') } })
  const input = { intent: 'decline', tone: 'warm', commitment: 'Club meeting' }
  const result = await boundaryDraft(ai, input, data, 'user')
  assert.equal(result.method, 'ai')
  assert.doesNotMatch(prompt, /Private lecture|Private study|checkins|stress/)
  prompt = null
  await assert.rejects(boundaryDraft(ai, { ...input, eventId: 'another-user' }, data, 'user'), /not found/)
  assert.equal(prompt, null)
  const fallback = await boundaryDraft(createAI({ env: {} }), input, data, 'user')
  assert.equal(fallback.method, 'template')
  assert.match(fallback.text, /Club meeting/)
})

test('recovery AI selects only allowed activities and cannot change validated times', async () => {
  const data = state()
  const original = recovery(data, date, now)
  let payload
  const ai = createAI({ env: { GROQ_API_KEY: 'test' }, fetchImpl: async (_url, options) => {
    payload = JSON.parse(options.body)
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ activityId: 'hobby', after: { start: 'malicious' } }) } }] })
  } })
  const enhanced = await enhanceProposals(ai, original, data, date, 'user')
  assert.equal(enhanced[0].title, 'Short creative hobby break')
  assert.deepEqual(enhanced[0].after, original[0].after)
  assert.equal(enhanced[0].generation, 'ai')
  assert.doesNotMatch(JSON.stringify(payload), /Private lecture|Private study/)
  const invalid = createAI({ env: { GROQ_API_KEY: 'test' }, fetchImpl: async () => completion('unrecognized') })
  const safe = await enhanceProposals(invalid, original, data, date, 'user')
  assert.equal(safe[0].title, original[0].title)
  assert.equal(safe[0].generation, 'local')
})

test('timetable AI cannot invent or duplicate moves, and valid ranking keeps proposal data', async () => {
  const data = state()
  const proposals = timetable(data, date, now)
  for (const order of [[999], [0, 0]]) {
    const ai = createAI({ env: { GROQ_API_KEY: 'test' }, fetchImpl: async () => Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ order }) } }] }) })
    const result = await enhanceProposals(ai, proposals, data, date, 'user')
    assert.equal(result[0].generation, 'local')
    assert.deepEqual(result[0].after, proposals[0].after)
  }
  const ai = createAI({ env: { GROQ_API_KEY: 'test' }, fetchImpl: async () => Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"order":[0]}' } }] }) })
  const result = await enhanceProposals(ai, proposals, data, date, 'user')
  assert.equal(result[0].generation, 'ai')
  assert.equal(result[0].eventId, proposals[0].eventId)
})
