import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeEvent, capacity, overlaps } from '../src/engine.js'
import { sleepProxy, deadlineDensity, boundaryTemplate, taskBatch } from '../src/tier2.js'

const zone = 'Asia/Kuala_Lumpur'
const date = '2026-09-10'
const now = Date.parse('2026-09-10T08:00:00+08:00')
const event = (title, start, end, extra = {}) => normalizeEvent({ title, start, end, ...extra }, zone)
const today = (title, start, end, extra = {}) => event(title, `${date}T${start}:00+08:00`, `${date}T${end}:00+08:00`, extra)
const errand = (title, start, end, extra = {}) => today(title, start, end, { isFlexible: true, consequence: 'low', ...extra })

test('sleep proxy merges overlapping commitments and never counts future time', () => {
  const items = [
    event('Study', '2026-09-09T21:00:00+08:00', '2026-09-09T23:00:00+08:00'),
    event('Call', '2026-09-09T22:00:00+08:00', '2026-09-10T00:00:00+08:00'),
    today('Lecture', '07:00', '08:00'),
  ]
  const result = sleepProxy(items, date, zone, now)
  assert.equal(result.hours, 7)
  assert.equal(result.start, '2026-09-09T16:00:00.000Z')
  assert.equal(result.end, '2026-09-09T23:00:00.000Z')
  const untilNow = sleepProxy([items[0]], date, zone, now)
  assert.equal(Date.parse(untilNow.end), now)
  assert.equal(untilNow.hours, 9)
})

test('sleep proxy handles absent coverage, fully occupied windows and DST', () => {
  assert.equal(sleepProxy([], date, zone, now), null)
  assert.equal(sleepProxy([today('Study', '08:00', '09:00')], '2026-09-12', zone, now), null)
  const occupied = event('Trip', '2026-09-09', '2026-09-11', { allDay: true })
  assert.deepEqual(sleepProxy([occupied], date, zone, now), { available: false, hours: 0 })
  const dstEvent = event('Study', '2026-03-07T18:00:00-05:00', '2026-03-07T19:00:00-05:00')
  assert.equal(sleepProxy([dstEvent], '2026-03-08', 'America/New_York', Date.parse('2026-03-08T10:00:00-04:00')).hours, 11)
})

test('deadline density picks one heavy day in the next three local days', () => {
  const items = [1, 2, 3].map(i => event(`Assignment ${i}`, '2026-09-10T10:00:00+08:00', '2026-09-10T10:15:00+08:00', { deadline: '2026-09-11T00:30:00+08:00' }))
  items.push(event('Lecture', '2026-09-12T09:00:00+08:00', '2026-09-12T15:00:00+08:00'))
  items.push(event('Exam', '2026-09-14T09:00:00+08:00', '2026-09-14T20:00:00+08:00'))
  const result = deadlineDensity(items, date, zone)
  assert.equal(result.days[0].deadlines, 3)
  assert.equal(result.heavyDay.date, '2026-09-12')
  assert.equal(result.days.length, 3)
  assert.equal(deadlineDensity([], date, zone).hasEvents, false)
})

test('deadline signals do not double-count explicit dates and ignore completed work', () => {
  const item = event('Exam due', '2026-09-11', '2026-09-12', { allDay: true, deadline: '2026-09-12T09:00:00+08:00' })
  const result = deadlineDensity([item], date, zone)
  assert.equal(result.days[0].deadlines, 0)
  assert.equal(result.days[1].deadlines, 1)
  assert.equal(result.heavyDay, null)
  assert.equal(deadlineDensity([{ ...item, completedAt: new Date(now).toISOString() }], date, zone).days[1].deadlines, 0)
})

test('boundary drafts use the selected commitment without disclosing stress or load', () => {
  const input = { intent: 'defer', tone: 'warm', eventId: 'chosen', alternative: 'next Tuesday' }
  const draft = boundaryTemplate(input, { events: [{ id: 'chosen', title: 'Club meeting' }], checkins: [{ score: 5 }] })
  assert.match(draft.text, /Club meeting/)
  assert.match(draft.text, /next Tuesday/)
  assert.doesNotMatch(draft.text, /stress|capacity|5/)
  assert.equal(draft.method, 'template')
  assert.throws(() => boundaryTemplate({ ...input, eventId: 'someone-else' }, { events: [] }), /not found/)
  assert.throws(() => boundaryTemplate({ intent: 'bad', tone: 'warm', commitment: 'x' }, { events: [] }), /decline or defer/)
  assert.throws(() => boundaryTemplate({ intent: 'decline', tone: 'warm', commitment: '' }, { events: [] }), /commitment/)
})

test('batch suggests a contiguous block preserving IDs, duration and load without mutation', () => {
  const items = [errand('Grocery shopping', '14:00', '14:30'), errand('Collect package', '16:00', '16:15'), today('Lecture', '08:00', '10:00')]
  const data = { events: items, zone }
  const original = structuredClone(data)
  const [proposal] = taskBatch(data, date, now)
  assert.equal(proposal.moves.length, 2)
  assert.equal(proposal.durationMinutes, 45)
  assert.equal(proposal.moves[0].after.end, proposal.moves[1].after.start)
  const after = items.map(e => ({ ...e, ...proposal.moves.find(m => m.eventId === e.id)?.after }))
  for (const e of after) assert.equal(overlaps(e, after, e.id), false)
  assert.equal(capacity(after, [], date, zone).totalLoadHours, capacity(items, [], date, zone).totalLoadHours)
  assert.deepEqual(data, original)
})

test('batch excludes fixed/high-consequence/long/started tasks and respects deadlines', () => {
  const a = errand('Grocery shopping', '14:00', '14:30')
  const b = errand('Laundry pickup', '16:00', '16:15')
  for (const overrides of [{ isFlexible: false }, { consequence: 'high' }, { hasAttendees: true }, { completedAt: new Date(now).toISOString() }, { allDay: true }]) {
    assert.equal(taskBatch({ events: [a, { ...b, ...overrides }], zone }, date, now).length, 0)
  }
  assert.equal(taskBatch({ events: [a, errand('Laundry', '16:00', '17:00')], zone }, date, now).length, 0)
  assert.equal(taskBatch({ events: [a, b], zone }, date, Date.parse(a.start)).length, 0)
  const blocker = today('Lecture', '08:00', '17:00')
  const deadlineA = { ...a, deadline: '2026-09-10T17:15:00+08:00' }
  assert.equal(taskBatch({ events: [deadlineA, b, blocker], zone }, date, now).length, 0)
})

test('Google batch destinations are free even before other errands move', () => {
  const items = [errand('Laundry', '08:30', '09:00'), { ...errand('Groceries', '16:00', '16:30'), source: 'google' }]
  const [proposal] = taskBatch({ events: items, zone }, date, now)
  assert.equal(proposal.individualApproval, true)
  for (const move of proposal.moves) assert.equal(overlaps(move.after, items), false)
})
