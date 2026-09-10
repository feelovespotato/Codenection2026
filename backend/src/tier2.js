import { DateTime } from 'luxon'
import { capacity, dayStart, freeSlots, hoursOnDay, requireValue } from './engine.js'

export function sleepProxy(events, date, zone, now = Date.now()) {
  const morning = DateTime.fromMillis(Math.min(dayStart(date, zone).set({ hour: 9 }).toMillis(), now), { zone })
  const evening = dayStart(date, zone).minus({ days: 1 }).set({ hour: 21 })
  if (morning <= evening) return null
  // With no surrounding calendar coverage, an empty calendar is not evidence of sleep.
  const contextStart = evening.minus({ hours: 12 }).toMillis()
  const contextEnd = morning.plus({ hours: 12 }).toMillis()
  if (!events.some(e => Date.parse(e.end) > contextStart && Date.parse(e.start) < contextEnd)) return null
  const occupied = events.map(e => ({ start: Math.max(evening.toMillis(), Date.parse(e.start)), end: Math.min(morning.toMillis(), Date.parse(e.end)) }))
    .filter(e => e.end > e.start).sort((a, b) => a.start - b.start)
  let cursor = evening.toMillis()
  const gaps = []
  for (const interval of occupied) {
    if (interval.start > cursor) gaps.push({ start: cursor, end: interval.start })
    cursor = Math.max(cursor, interval.end)
  }
  if (cursor < morning.toMillis()) gaps.push({ start: cursor, end: morning.toMillis() })
  const best = gaps.sort((a, b) => (b.end - b.start) - (a.end - a.start))[0]
  if (!best) return { available: false, hours: 0 }
  return { available: true, start: new Date(best.start).toISOString(), end: new Date(best.end).toISOString(), hours: +((best.end - best.start) / 3600000).toFixed(2) }
}

export function deadlineDensity(events, date, zone) {
  const days = [1, 2, 3].map(offset => {
    const target = dayStart(date, zone).plus({ days: offset }).toISODate()
    const deadlines = events.filter(e => {
      if (e.category === 'recharge' || e.completedAt) return false
      const due = e.deadline || (/\b(exam|deadline|submission|due)\b/i.test(`${e.title} ${e.description || ''}`) ? e.start : null)
      return due && DateTime.fromISO(due).setZone(zone).toISODate() === target
    }).length
    const load = capacity(events, [], target, zone)
    return { date: target, deadlines, weightedHours: load.totalLoadHours, eventsCount: load.eventsCount, heavy: deadlines >= 3 || load.totalLoadHours >= 6.4 }
  })
  const heavyDay = days.filter(d => d.heavy).sort((a, b) => (b.deadlines + b.weightedHours) - (a.deadlines + a.weightedHours) || a.date.localeCompare(b.date))[0] || null
  return { heavyDay, days, hasEvents: days.some(d => d.eventsCount || d.deadlines) }
}

export function boundaryTemplate(input, data) {
  requireValue(['decline', 'defer'].includes(input.intent), 'Choose decline or defer.')
  requireValue(['warm', 'direct'].includes(input.tone), 'Choose a warm or direct tone.')
  let commitment = input.commitment
  if (input.eventId) {
    const event = data.events.find(e => e.id === input.eventId)
    requireValue(event, 'Commitment not found.', 404)
    commitment = event.title
  }
  requireValue(typeof commitment === 'string' && commitment.trim().length > 0 && commitment.length <= 250, 'Enter a commitment (up to 250 characters).')
  requireValue(input.alternative === undefined || (typeof input.alternative === 'string' && input.alternative.length <= 120), 'Keep the alternative time under 120 characters.')
  commitment = commitment.trim().replace(/\s+/g, ' ')
  const alternative = input.alternative?.trim().replace(/\s+/g, ' ')
  const intro = input.tone === 'warm' ? `Thanks for thinking of me for ${commitment}.` : `Regarding ${commitment}:`
  const decision = input.intent === 'decline' ? 'I won’t be able to take this on. I need to keep space for my existing commitments.'
    : `I can’t commit to the current timing. ${alternative ? `Could we arrange it for ${alternative} instead?` : 'Could we find a later time that works for both of us?'}`
  return { text: `${intro} ${decision}${input.tone === 'warm' ? ' Thank you for understanding.' : ''}`, method: 'template' }
}

const errand = /\b(grocery|groceries|shopping|errands?|laundry|parcel|package|post office|pharmacy|pick.?up|stationery)\b/i
export function batchEligible(event, now) {
  const minutes = (Date.parse(event.end) - Date.parse(event.start)) / 60000
  return event.isFlexible && !event.hasAttendees && !event.allDay && !event.completedAt && event.category !== 'recharge'
    && event.consequence !== 'high' && Date.parse(event.start) > now && minutes > 0 && minutes <= 45 && errand.test(event.title)
}
export function taskBatch(data, date, now) {
  const { events, zone } = data
  const candidates = events.filter(e => batchEligible(e, now) && hoursOnDay(e, date, zone) > 0)
    .sort((a, b) => Date.parse(a.deadline || a.start) - Date.parse(b.deadline || b.start))
  const tasks = []
  let duration = 0
  for (const event of candidates) {
    const minutes = (Date.parse(event.end) - Date.parse(event.start)) / 60000
    if (duration + minutes > 120 || tasks.length === 4) continue
    tasks.push(event); duration += minutes
  }
  if (tasks.length < 2) return []
  const chronological = [...tasks].sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
  if (chronological.slice(1).every((event, index) => Date.parse(event.start) === Date.parse(chronological[index].end))) return []
  const ids = new Set(tasks.map(e => e.id))
  const individualApproval = tasks.some(e => e.source === 'google')
  // Remote moves are independent: their destinations must be free before any move.
  const remaining = individualApproval ? events : events.filter(e => !ids.has(e.id))
  for (const slot of freeSlots(remaining, date, zone, now, duration)) {
    let cursor = Date.parse(slot.start)
    const moves = tasks.map(event => {
      const start = cursor
      cursor += Date.parse(event.end) - Date.parse(event.start)
      return { eventId: event.id, title: event.title, before: { start: event.start, end: event.end }, after: { start: new Date(start).toISOString(), end: new Date(cursor).toISOString() } }
    })
    if (moves.some(move => {
      const original = tasks.find(e => e.id === move.eventId)
      return original.deadline && Date.parse(move.after.end) > Date.parse(original.deadline)
    })) continue
    if (moves.every(move => Date.parse(move.before.start) === Date.parse(move.after.start))) continue
    return [{ kind: 'batch', individualApproval, title: `${tasks.length} errands in one block`, after: slot, moves, durationMinutes: duration,
      reason: 'Groups flexible errands back-to-back, preserving every task and its duration. Review travel time and opening hours before approving.' }]
  }
  return []
}
