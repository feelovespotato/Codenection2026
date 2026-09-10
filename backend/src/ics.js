import { createHash } from 'node:crypto'
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads'
import ical from 'node-ical'
import { DateTime } from 'luxon'
import { AppError, requireValue, normalizeEvent } from './engine.js'

export async function parseCalendar(text, zone, sourceName, now = Date.now()) {
  requireValue(typeof text === 'string' && text.includes('BEGIN:VCALENDAR') && text.includes('END:VCALENDAR'), 'Choose a valid .ics calendar file.')
  // RFC floating times belong to the user's selected zone, not the server's OS zone.
  const zoned = text.replace(/\r?\n[ \t]/g, '').replace(/^(DTSTART|DTEND|RECURRENCE-ID|EXDATE|RDATE):(\d{8}T\d{6}(?:,\d{8}T\d{6})*)\r?$/gm, `$1;TZID=${zone}:$2`)
  const parsed = await ical.async.parseICS(zoned)
  const from = DateTime.fromMillis(now, { zone }).startOf('day').minus({ days: 30 }).toJSDate()
  const to = DateTime.fromMillis(now, { zone }).startOf('day').plus({ days: 91 }).toJSDate()
  const events = []
  for (const event of Object.values(parsed)) {
    if (event.type !== 'VEVENT' || event.status === 'CANCELLED' || event.transparency === 'TRANSPARENT') continue
    requireValue(event.start instanceof Date && !Number.isNaN(+event.start), 'A calendar event has an invalid start date.')
    if (event.rrule) requireValue(['YEARLY', 'MONTHLY', 'WEEKLY', 'DAILY'].includes(event.rrule.options.freq), 'Calendar repeats more often than daily are not supported. Export a calendar with daily or slower repeats.')
    const instances = ical.expandRecurringEvent(event, { from, to, expandOngoing: true })
    for (const instance of instances) {
      if (instance.event?.status === 'CANCELLED') continue
      const allDay = instance.isFullDay || event.datetype === 'date'
      let start = instance.start, end = instance.end
      if (allDay) {
        const originZone = event.start.tz || Intl.DateTimeFormat().resolvedOptions().timeZone
        start = DateTime.fromJSDate(start, { zone: originZone }).toISODate()
        end = end ? DateTime.fromJSDate(end, { zone: originZone }).toISODate() : DateTime.fromISO(start).plus({ days: 1 }).toISODate()
        start = DateTime.fromISO(start, { zone }).toISO()
        end = DateTime.fromISO(end, { zone }).toISO()
      } else {
        requireValue(end instanceof Date && end > start, 'A timed event is missing a valid end time.')
        start = start.toISOString(); end = end.toISOString()
      }
      const uid = event.uid || `${event.summary}:${start}`
      const id = `ics-${createHash('sha256').update(`${sourceName}:${uid}:${instance.recurrenceId || instance.start.toISOString()}`).digest('hex').slice(0, 32)}`
      events.push(normalizeEvent({ title: instance.summary || event.summary || 'Untitled event', description: instance.description || event.description, start, end, allDay, category: 'auto', consequence: 'high' }, zone, { id, source: 'ics', sourceName }))
      requireValue(events.length <= 2000, 'Calendar contains over 2,000 events in the import window.', 413)
    }
  }
  return { events, from: from.toISOString(), to: to.toISOString() }
}
export function importCalendar(text, zone, sourceName, now) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./ics.js', import.meta.url), { workerData: { text, zone, sourceName, now }, resourceLimits: { maxOldGenerationSizeMb: 128 } })
    const timer = setTimeout(() => { worker.terminate(); reject(new AppError('Calendar is too complex to import. Try a smaller export.', 400)) }, 8000)
    worker.once('message', message => { clearTimeout(timer); worker.terminate(); message.error ? reject(new AppError(message.error)) : resolve(message.result) })
    worker.once('error', () => { clearTimeout(timer); reject(new AppError('Could not parse the calendar. Check the .ics file.')) })
    worker.once('exit', code => { clearTimeout(timer); if (code !== 0) reject(new AppError('Calendar import stopped before completion.')) })
  })
}
if (!isMainThread) {
  try { parentPort.postMessage({ result: await parseCalendar(workerData.text, workerData.zone, workerData.sourceName, workerData.now) }) }
  catch (error) { parentPort.postMessage({ error: error.message }) }
}
export function exportCalendar(events, zone) {
  const escape = value => String(value).replaceAll('\\', '\\\\').replaceAll('\r', '').replaceAll('\n', '\\n').replaceAll(',', '\\,').replaceAll(';', '\\;')
  const stamp = value => DateTime.fromISO(value).toUTC().toFormat("yyyyMMdd'T'HHmmss'Z'")
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Moodify//Calendar//EN', 'CALSCALE:GREGORIAN']
  for (const event of events) {
    lines.push('BEGIN:VEVENT', `UID:${event.id}@moodify`, `DTSTAMP:${stamp(new Date().toISOString())}`, `SUMMARY:${escape(event.title)}`,
      event.allDay ? `DTSTART;VALUE=DATE:${DateTime.fromISO(event.start).setZone(zone).toFormat('yyyyMMdd')}` : `DTSTART:${stamp(event.start)}`,
      event.allDay ? `DTEND;VALUE=DATE:${DateTime.fromISO(event.end).setZone(zone).toFormat('yyyyMMdd')}` : `DTEND:${stamp(event.end)}`,
      `DESCRIPTION:${escape(event.description || event.category)}`, 'END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  // Fold by UTF-8 octets without splitting a Unicode code point.
  return lines.map(line => {
    let result = '', length = 0
    for (const char of line) {
      const bytes = Buffer.byteLength(char)
      if (length + bytes > 75) { result += '\r\n '; length = 1 }
      result += char; length += bytes
    }
    return result
  }).join('\r\n') + '\r\n'
}
