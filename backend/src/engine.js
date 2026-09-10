import { DateTime } from 'luxon'
import { randomUUID } from 'node:crypto'

export class AppError extends Error {
  constructor(message, status = 400) { super(message); this.status = status }
}
export function requireValue(condition, message, status = 400) {
  if (!condition) throw new AppError(message, status)
}
export const WEIGHTS = { cognitive: 1.3, social: 1, recharge: -0.5 }
export function validZone(zone) { return typeof zone === 'string' && DateTime.now().setZone(zone).isValid }
export function dayStart(date, zone) {
  const value = DateTime.fromISO(date, { zone }).startOf('day')
  requireValue(/^\d{4}-\d{2}-\d{2}$/.test(date) && value.isValid, 'Use a valid date (YYYY-MM-DD).')
  return value
}
export function classify(title, description = '') {
  const text = `${title} ${description}`.toLowerCase()
  const rules = [
    ['cognitive', /\b(exam|lecture|assignment|study|revision|coding|project|class|lab|research|deadline|tutorial)\b/],
    ['recharge', /\b(break|walk|meditat\w*|breath\w*|nap|rest|yoga|relax\w*|recharge|hobby|gaming|lunch|dinner)\b/],
    ['social', /\b(meet\w*|call|club|party|friend\w*|social|catchup|catch-up|family|grocery|groceries|errand\w*|shopping)\b/],
  ]
  const match = rules.find(([, pattern]) => pattern.test(text))
  return { category: match?.[0] || 'cognitive', classificationReason: match ? `Keyword match: ${text.match(match[1])[0]}` : 'Default focus category; you can correct this.' }
}
export function normalizeEvent(input, zone, previous = {}) {
  requireValue(typeof input.title === 'string' && input.title.trim().length > 0 && input.title.length <= 250, 'Enter an event title (up to 250 characters).')
  const start = DateTime.fromISO(input.start || '', { zone, setZone: true })
  const end = DateTime.fromISO(input.end || '', { zone, setZone: true })
  requireValue(start.isValid && end.isValid && end > start, 'End must be after start. Include the end date for overnight events.')
  requireValue(end.diff(start, 'days').days <= 366, 'Events cannot span more than one year.')
  const classified = classify(input.title, input.description)
  const category = input.category === 'auto' || !input.category ? classified.category : input.category
  requireValue(Object.hasOwn(WEIGHTS, category), 'Unknown category.')
  const consequence = input.consequence || 'medium'
  requireValue(['low', 'medium', 'high'].includes(consequence), 'Unknown consequence level.')
  const deadline = input.deadline ? DateTime.fromISO(input.deadline, { zone, setZone: true }) : null
  requireValue(!deadline || (deadline.isValid && end <= deadline), 'Deadline must be at or after the event end.')
  return {
    ...previous, id: previous.id || randomUUID(), title: input.title.trim(),
    description: String(input.description || '').slice(0, 2000), start: start.toUTC().toISO(), end: end.toUTC().toISO(),
    category, weight: WEIGHTS[category], classificationReason: input.category && input.category !== 'auto' ? 'Category selected by you.' : classified.classificationReason,
    isFlexible: input.isFlexible === true && !previous.hasAttendees, consequence,
    deadline: deadline?.toUTC().toISO() || null, allDay: input.allDay === true,
    source: previous.source || 'local', completedAt: previous.completedAt || null,
  }
}
export function hoursOnDay(event, date, zone) {
  if (event.allDay) return 0 // Calendar occupancy is not a reliable duration for an all-day deadline.
  const start = dayStart(date, zone).toMillis(), end = dayStart(date, zone).plus({ days: 1 }).toMillis()
  return Math.max(0, Math.min(Date.parse(event.end), end) - Math.max(Date.parse(event.start), start)) / 3600000
}
export function capacity(events, checkins, date, zone) {
  dayStart(date, zone)
  const hours = { cognitive: 0, social: 0, recharge: 0 }
  for (const event of events) hours[event.category] += hoursOnDay(event, date, zone)
  const totalLoadHours = Math.max(0, Object.entries(hours).reduce((sum, [category, value]) => sum + value * WEIGHTS[category], 0))
  const checkin = checkins.find(item => item.date === date)
  const loadPercent = Math.min(100, totalLoadHours / 8 * 100)
  const stressPercent = checkin ? (checkin.score - 1) / 4 * 100 : null
  return {
    date, totalLoadHours: +totalLoadHours.toFixed(2), loadPercent: Math.round(loadPercent),
    latestStress: checkin?.score ?? null, stressPercent,
    capacityScore: Math.round(stressPercent === null ? loadPercent : loadPercent * 0.45 + stressPercent * 0.55),
    cognitiveHours: +hours.cognitive.toFixed(2), socialHours: +hours.social.toFixed(2), rechargeHours: +hours.recharge.toFixed(2),
    breakdown: Object.entries(hours).map(([category, value]) => ({ category, hours: +value.toFixed(2), weightedLoad: +(value * WEIGHTS[category]).toFixed(2) })),
    eventsCount: events.filter(event => Date.parse(event.start) < dayStart(date, zone).plus({ days: 1 }).toMillis() && Date.parse(event.end) > dayStart(date, zone).toMillis()).length,
  }
}
export function overlaps(event, events, excludeId) {
  return events.some(other => other.id !== excludeId && Date.parse(event.start) < Date.parse(other.end) && Date.parse(event.end) > Date.parse(other.start))
}
export function freeSlots(events, date, zone, now, durationMinutes = 20) {
  const day = dayStart(date, zone)
  const finish = day.set({ hour: 21 })
  let cursor = Math.max(day.set({ hour: 8 }).toMillis(), now + 5 * 60000)
  cursor = Math.ceil(cursor / 900000) * 900000
  const slots = []
  for (; cursor + durationMinutes * 60000 <= finish.toMillis(); cursor += 900000) {
    const slot = { start: new Date(cursor).toISOString(), end: new Date(cursor + durationMinutes * 60000).toISOString() }
    if (!overlaps(slot, events)) slots.push(slot)
  }
  return slots
}
export function timetable(data, date, now = Date.now(), kind = 'timetable') {
  const { events, checkins, zone } = data
  const baseline = capacity(events, checkins, date, zone)
  const candidates = events.filter(event => event.isFlexible && !event.allDay && !event.completedAt && !event.hasAttendees && event.consequence !== 'high' && event.category !== 'recharge' && Date.parse(event.start) > now && hoursOnDay(event, date, zone) > 0)
    .sort((a, b) => (a.consequence === 'low' ? 0 : 1) - (b.consequence === 'low' ? 0 : 1) || hoursOnDay(b, date, zone) - hoursOnDay(a, date, zone))
    .slice(0, 20)
  const proposals = []
  for (const event of candidates) {
    const duration = (Date.parse(event.end) - Date.parse(event.start)) / 60000
    let best = null
    for (let offset = 1; offset <= 3; offset++) {
      const targetDate = dayStart(date, zone).plus({ days: offset }).toISODate()
      const targetBefore = capacity(events, checkins, targetDate, zone)
      const slot = freeSlots(events, targetDate, zone, now, duration).find(item => !event.deadline || Date.parse(item.end) <= Date.parse(event.deadline))
      if (slot) {
        const moved = { ...event, ...slot }
        const nextEvents = events.map(item => item.id === event.id ? moved : item)
        const targetAfter = capacity(nextEvents, checkins, targetDate, zone)
        if (targetAfter.totalLoadHours >= baseline.totalLoadHours || targetAfter.totalLoadHours > 8) continue
        if (!best || targetAfter.totalLoadHours < best.targetAfter.totalLoadHours) best = {
          kind, eventId: event.id, title: event.title, before: { start: event.start, end: event.end }, after: slot,
          beforeCapacity: baseline.capacityScore, afterCapacity: capacity(nextEvents, checkins, date, zone).capacityScore,
          targetBefore, targetAfter, reason: `${event.consequence === 'low' ? 'Low' : 'Medium'} consequence, flexible task; a conflict-free slot on a lighter day before its deadline.`,
        }
      }
    }
    if (best) proposals.push(best)
    if (proposals.length >= (kind === 'shed' ? 1 : 5)) break
  }
  return proposals
}
export function recovery(data, date, now = Date.now()) {
  const { events, checkins, zone } = data
  const metrics = capacity(events, checkins, date, zone)
  const highStress = metrics.latestStress >= 4
  const longBlock = events.filter(event => hoursOnDay(event, date, zone) >= 1.5 && event.category !== 'recharge')
    .sort((a, b) => Date.parse(b.end) - Date.parse(a.end))[0]
  const minutes = highStress ? 15 : 20
  const slots = freeSlots(events, date, zone, now, minutes)
  const slot = slots.find(item => longBlock && Date.parse(item.start) >= Date.parse(longBlock.end)) || slots[0]
  if (!slot) return []
  const title = highStress ? 'Quiet breathing & grounding break' : metrics.cognitiveHours >= metrics.socialHours ? 'Screen-free walk & stretch' : 'Quiet solo recharge'
  return [{ kind: 'recovery', title, after: slot, reason: highStress ? 'Matched to your high stress check-in; a short quiet break in available time.' : longBlock ? 'A movement/rest opportunity after a long scheduled block (calendar-based inactivity proxy).' : 'A preventive recovery break matched to your available time and load mix.' }]
}
export function streak(events, zone, now = Date.now()) {
  const dates = new Set(events.filter(e => e.category === 'recharge' && e.completedAt).map(e => DateTime.fromISO(e.completedAt).setZone(zone).toISODate()))
  let day = DateTime.fromMillis(now, { zone }).startOf('day')
  const hasRecoveredToday = dates.has(day.toISODate())
  if (!hasRecoveredToday) day = day.minus({ days: 1 })
  let currentStreak = 0
  while (dates.has(day.toISODate())) { currentStreak++; day = day.minus({ days: 1 }) }
  return { currentStreak, hasRecoveredToday }
}
