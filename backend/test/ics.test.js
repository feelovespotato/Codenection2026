import test from 'node:test'
import assert from 'node:assert/strict'
import { parseCalendar, exportCalendar } from '../src/ics.js'
const now = Date.parse('2026-09-10T00:00:00Z'), zone = 'Asia/Kuala_Lumpur'
const calendar = body => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${body}\r\nEND:VCALENDAR\r\n`
const item = body => `BEGIN:VEVENT\r\nUID:class-1\r\nSUMMARY:Algorithm lecture\r\n${body}\r\nEND:VEVENT`

test('floating times use the user zone; reimport IDs are stable', async () => {
  const text = calendar(item('DTSTART:20260910T090000\r\nDTEND:20260910T100000'))
  const first = await parseCalendar(text, zone, 'classes.ics', now)
  const second = await parseCalendar(text, zone, 'classes.ics', now)
  assert.equal(first.events[0].start, '2026-09-10T01:00:00.000Z')
  assert.deepEqual(first.events, second.events)
})
test('expands recurrence while excluding cancelled instances', async () => {
  const text = calendar(item('DTSTART;TZID=Asia/Kuala_Lumpur:20260910T090000\r\nDTEND;TZID=Asia/Kuala_Lumpur:20260910T100000\r\nRRULE:FREQ=DAILY;COUNT=3\r\nEXDATE;TZID=Asia/Kuala_Lumpur:20260911T090000'))
  const result = await parseCalendar(text, zone, 'classes.ics', now)
  assert.equal(result.events.length, 2)
  assert.equal(result.events[1].start, '2026-09-12T01:00:00.000Z')
})
test('all-day events keep their local dates and exclusive end', async () => {
  const text = calendar(item('DTSTART;VALUE=DATE:20260910\r\nDTEND;VALUE=DATE:20260912'))
  const [event] = (await parseCalendar(text, zone, 'days.ics', now)).events
  assert.equal(event.allDay, true)
  assert.equal(event.start, '2026-09-09T16:00:00.000Z')
  assert.equal(event.end, '2026-09-11T16:00:00.000Z')
})
test('export escapes and folds text without breaking Unicode; round-trips', async () => {
  const [event] = (await parseCalendar(calendar(item('DTSTART:20260910T090000Z\r\nDTEND:20260910T100000Z')), zone, 'test', now)).events
  event.title = 'Study, notes; ' + '🌿'.repeat(30)
  const exported = exportCalendar([event], zone)
  assert.ok(exported.split('\r\n').every(line => Buffer.byteLength(line) <= 75))
  assert.equal((await parseCalendar(exported, zone, 'roundtrip', now)).events[0].title, event.title)
})
test('rejects malformed files and excessive recurrence frequency', async () => {
  await assert.rejects(parseCalendar('not a calendar', zone, 'test', now), /valid .ics/)
  await assert.rejects(parseCalendar(calendar(item('DTSTART:20260910T090000Z\r\nDTEND:20260910T100000Z\r\nRRULE:FREQ=SECONDLY')), zone, 'test', now), /more often/)
})
