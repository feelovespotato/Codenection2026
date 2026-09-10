export function localDate(value, zone) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value))
}
export function displayTime(value, zone) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}
export function displaySlot(slot, zone) {
  const format = new Intl.DateTimeFormat('en-GB', { timeZone: zone, month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  return `${format.format(new Date(slot.start))} → ${format.format(new Date(slot.end))}`
}
