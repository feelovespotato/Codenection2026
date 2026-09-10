import test from 'node:test'
import assert from 'node:assert/strict'
import { capacity, classify, normalizeEvent, recovery, timetable, overlaps, streak } from '../src/engine.js'

const zone = 'Asia/Kuala_Lumpur'
const now = Date.parse('2026-09-10T00:00:00Z')
const event = (title, start, end, extra = {}) => normalizeEvent({ title, start: `2026-09-10T${start}:00+08:00`, end: `2026-09-10T${end}:00+08:00`, ...extra }, zone)

test('classifies synced titles and allows an explicit correction', () => {
  assert.equal(classify('Algorithm lecture').category, 'cognitive')
  assert.equal(classify('Club meeting').category, 'social')
  assert.equal(classify('Walk & breathing').category, 'recharge')
  assert.equal(event('Study', '09:00', '10:00', { category: 'social' }).category, 'social')
})
test('weighted formula uses actual short durations and is independent of event order', () => {
  const items = [event('Break', '08:00', '09:00'), event('Study', '09:00', '11:00'), event('Club', '11:00', '11:15')]
  const metrics = capacity(items, [], '2026-09-10', zone)
  assert.equal(metrics.totalLoadHours, 2.35)
  assert.equal(metrics.socialHours, 0.25)
  assert.deepEqual(metrics, capacity(items.toReversed(), [], '2026-09-10', zone))
  assert.equal(metrics.latestStress, null)
  assert.equal(metrics.capacityScore, metrics.loadPercent)
})
test('clips overnight load to each local day and respects DST boundaries', () => {
  const overnight = normalizeEvent({ title: 'Study', start: '2026-09-10T23:00:00+08:00', end: '2026-09-11T01:00:00+08:00' }, zone)
  assert.equal(capacity([overnight], [], '2026-09-10', zone).cognitiveHours, 1)
  assert.equal(capacity([overnight], [], '2026-09-11', zone).cognitiveHours, 1)
  const dst = normalizeEvent({ title: 'Study', start: '2026-03-08T01:00:00-05:00', end: '2026-03-08T04:00:00-04:00' }, 'America/New_York')
  assert.equal(capacity([dst], [], '2026-03-08', 'America/New_York').cognitiveHours, 2)
})
test('all-day events occupy time but do not create 24 hours of load', () => {
  const allDay = normalizeEvent({ title: 'Deadline', start: '2026-09-10', end: '2026-09-11', allDay: true }, zone)
  assert.equal(capacity([allDay], [], '2026-09-10', zone).totalLoadHours, 0)
  assert.deepEqual(recovery({ events: [allDay], checkins: [], zone }, '2026-09-10', now), [])
})
test('only the selected day check-in affects capacity; scores use the full scale', () => {
  const items = [event('Study', '09:00', '11:00')]
  assert.equal(capacity(items, [{ date: '2026-09-09', score: 5 }], '2026-09-10', zone).latestStress, null)
  assert.equal(capacity([], [{ date: '2026-09-10', score: 1 }], '2026-09-10', zone).capacityScore, 0)
  assert.equal(capacity([], [{ date: '2026-09-10', score: 5 }], '2026-09-10', zone).capacityScore, 55)
})
test('validates impossible ranges, categories and deadlines', () => {
  assert.throws(() => event('Study', '11:00', '10:00'), /End must/)
  assert.throws(() => event('Study', '09:00', '10:00', { category: 'bad' }), /category/)
  assert.throws(() => event('Study', '09:00', '10:00', { deadline: '2026-09-10T09:30:00+08:00' }), /Deadline/)
})
test('shedder proposes a lighter conflict-free day and leaves input untouched', () => {
  const items = [event('Lecture', '09:00', '12:00'), event('Study', '13:00', '15:00', { isFlexible: true, consequence: 'low' })]
  const original = structuredClone(items)
  const proposals = timetable({ events: items, checkins: [], zone }, '2026-09-10', now, 'shed')
  assert.equal(proposals.length, 1)
  assert.equal(proposals[0].eventId, items[1].id)
  assert.ok(proposals[0].afterCapacity < proposals[0].beforeCapacity)
  assert.equal(overlaps(proposals[0].after, items), false)
  assert.deepEqual(items, original)
})
test('keeps fixed, high-consequence, started, attendee and deadline-bound tasks in place', () => {
  const fixed = event('Lecture', '09:00', '12:00')
  const high = event('Study', '13:00', '14:00', { isFlexible: true, consequence: 'high' })
  const deadline = event('Study', '15:00', '16:00', { isFlexible: true, deadline: '2026-09-10T20:00:00+08:00' })
  const attendee = { ...event('Club', '16:00', '17:00', { isFlexible: true }), hasAttendees: true }
  assert.equal(timetable({ events: [fixed, high, deadline, attendee], checkins: [], zone }, '2026-09-10', now).length, 0)
  const passed = event('Study', '07:00', '09:00', { isFlexible: true })
  assert.equal(timetable({ events: [passed], checkins: [], zone }, '2026-09-10', now).length, 0)
})
test('recovery matches stress and does not overlap commitments or precede now', () => {
  const items = [event('Lecture', '09:00', '12:00'), event('Club', '13:00', '15:00')]
  const [proposal] = recovery({ events: items, checkins: [{ date: '2026-09-10', score: 5 }], zone }, '2026-09-10', now)
  assert.match(proposal.title, /breathing/)
  assert.equal(Date.parse(proposal.after.end) - Date.parse(proposal.after.start), 15 * 60000)
  assert.equal(overlaps(proposal.after, items), false)
  assert.ok(Date.parse(proposal.after.start) >= now)
})
test('streak counts recovery exactly at its end, without confirmation or double counting', () => {
  const item = event('Walk', '17:00', '17:30')
  assert.equal(streak([item], zone, now).currentStreak, 0)
  const end = Date.parse(item.end)
  assert.equal(streak([item], zone, end - 1).currentStreak, 0)
  assert.equal(streak([item, item], zone, end).currentStreak, 1)
  item.completedAt = new Date(end + 86400000).toISOString()
  assert.deepEqual(streak([item], zone, end + 86400000), { currentStreak: 1, hasRecoveredToday: false })
})
test('automatic streak respects local end dates, missed days and all-day exclusions', () => {
  const block = (start, end, extra = {}) => normalizeEvent({ title: 'Walk', start, end, ...extra }, zone)
  const items = [
    block('2026-09-08T23:50:00+08:00', '2026-09-09T00:10:00+08:00'),
    block('2026-09-10T07:00:00+08:00', '2026-09-10T07:30:00+08:00'),
    block('2026-09-10T00:00:00+08:00', '2026-09-11T00:00:00+08:00', { allDay: true }),
  ]
  assert.equal(streak(items, zone, now).currentStreak, 2)
  assert.equal(streak(items, zone, now + 86400000).currentStreak, 2)
  assert.equal(streak(items, zone, now + 2 * 86400000).currentStreak, 0)
  assert.equal(streak([], zone, now).currentStreak, 0)
  assert.equal(streak([event('Study', '06:00', '07:00')], zone, now).currentStreak, 0)
})
test('breakdown exposes signed category contributions including recharge-only days', () => {
  const metrics = capacity([event('Study', '09:00', '11:00'), event('Club', '12:00', '13:00'), event('Walk', '14:00', '15:00')], [], '2026-09-10', zone)
  assert.deepEqual(metrics.breakdown.map(item => item.weightedLoad), [2.6, 1, -0.5])
  assert.equal(metrics.totalLoadHours, 3.1)
  const recharge = capacity([event('Walk', '14:00', '15:00')], [], '2026-09-10', zone)
  assert.equal(recharge.totalLoadHours, 0)
  assert.equal(recharge.breakdown[2].weightedLoad, -0.5)
})
