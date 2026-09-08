import { useState, useMemo } from 'react'
import { StorageService } from '../services/storage.js'

const CATEGORIES = {
  cognitive: { label: 'Cognitive', emoji: '🧠', color: 'bg-indigo-100 text-indigo-900 border-indigo-300', dot: 'bg-indigo-500' },
  social: { label: 'Social', emoji: '👥', color: 'bg-amber-100 text-amber-900 border-amber-300', dot: 'bg-amber-500' },
  recharge: { label: 'Recharge', emoji: '🌿', color: 'bg-emerald-100 text-emerald-900 border-emerald-300', dot: 'bg-emerald-500' },
}

export default function CalendarView() {
  const [events, setEvents] = useState(() => StorageService.getCalendarEvents())
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0])
  
  // New Event Form State
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('cognitive')
  const [startTime, setStartTime] = useState('10:00')
  const [endTime, setEndTime] = useState('11:30')
  const [isFlexible, setIsFlexible] = useState(false)
  const [isAdding, setIsAdding] = useState(false)

  // Events on currently selected day
  const dailyEvents = useMemo(() => {
    return events
      .filter((e) => e.date === selectedDate)
      .sort((a, b) => (a.startTime || '00:00').localeCompare(b.startTime || '00:00'))
  }, [events, selectedDate])

  // Daily hours calculation
  const stats = useMemo(() => {
    let cogHours = 0
    let socHours = 0
    let recHours = 0

    dailyEvents.forEach((evt) => {
      const [sh, sm] = (evt.startTime || '00:00').split(':').map(Number)
      const [eh, em] = (evt.endTime || '01:00').split(':').map(Number)
      const duration = Math.max(0.25, (eh * 60 + em - (sh * 60 + sm)) / 60)

      if (evt.category === 'cognitive') cogHours += duration
      else if (evt.category === 'social') socHours += duration
      else if (evt.category === 'recharge') recHours += duration
    })

    const totalHours = cogHours + socHours + recHours
    return {
      totalHours: totalHours.toFixed(1),
      cogHours: cogHours.toFixed(1),
      socHours: socHours.toFixed(1),
      recHours: recHours.toFixed(1),
    }
  }, [dailyEvents])

  const handleAddEvent = (e) => {
    e.preventDefault()
    if (!title.trim()) return

    const newEvt = {
      title: title.trim(),
      date: selectedDate,
      startTime,
      endTime,
      category,
      isFlexible,
    }

    const updated = StorageService.saveCalendarEvent(newEvt)
    setEvents(updated)
    setTitle('')
    setIsAdding(false)
  }

  const handleDeleteEvent = (id) => {
    const updated = StorageService.deleteCalendarEvent(id)
    setEvents(updated)
  }

  const handleExportICS = () => {
    let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Moodify//Wellness Calendar//EN\n"
    events.forEach((evt) => {
      const dt = evt.date.replace(/-/g, '')
      const st = (evt.startTime || '09:00').replace(':', '') + '00'
      const et = (evt.endTime || '10:00').replace(':', '') + '00'
      icsContent += `BEGIN:VEVENT\nSUMMARY:${evt.title}\nDTSTART:${dt}T${st}\nDTEND:${dt}T${et}\nDESCRIPTION:Category: ${evt.category} | Flexible: ${evt.isFlexible ? 'Yes' : 'No'}\nEND:VEVENT\n`
    })
    icsContent += "END:VCALENDAR"

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `moodify-schedule-${selectedDate}.ics`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
      {/* Left Column: Date Picker & Daily Load Breakdown */}
      <div className="space-y-6 lg:col-span-5">
        {/* Date Selector */}
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-stone-500">
            Selected Day
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full rounded-xl border border-stone-200 bg-stone-50 p-3 text-base font-semibold text-stone-800 focus:border-amber-400 focus:bg-white focus:outline-none"
          />

          {/* Quick Date Shortcuts */}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
              className="rounded-lg bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-600 hover:bg-amber-100 hover:text-amber-900"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => {
                const tmrw = new Date()
                tmrw.setDate(tmrw.getDate() + 1)
                setSelectedDate(tmrw.toISOString().split('T')[0])
              }}
              className="rounded-lg bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-600 hover:bg-amber-100 hover:text-amber-900"
            >
              Tomorrow
            </button>
          </div>
        </div>

        {/* Workload Summary Card */}
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-stone-600">
            Daily Workload Metrics
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-stone-50 p-3">
              <span className="text-[11px] font-medium text-stone-400">Total Scheduled</span>
              <p className="text-xl font-black text-stone-800">{stats.totalHours} hrs</p>
            </div>
            <div className="rounded-xl bg-indigo-50/70 p-3">
              <span className="text-[11px] font-medium text-indigo-500">🧠 Cognitive Load</span>
              <p className="text-xl font-black text-indigo-900">{stats.cogHours} hrs</p>
            </div>
            <div className="rounded-xl bg-amber-50/70 p-3">
              <span className="text-[11px] font-medium text-amber-600">👥 Social Load</span>
              <p className="text-xl font-black text-amber-900">{stats.socHours} hrs</p>
            </div>
            <div className="rounded-xl bg-emerald-50/70 p-3">
              <span className="text-[11px] font-medium text-emerald-600">🌿 Recharge Time</span>
              <p className="text-xl font-black text-emerald-900">{stats.recHours} hrs</p>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-stone-100 flex items-center justify-between">
            <button
              type="button"
              onClick={handleExportICS}
              className="text-xs font-semibold text-stone-600 hover:text-amber-800 flex items-center gap-1.5"
            >
              <span>📅 Export .ics Calendar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Right Column: Events List & Quick Add */}
      <div className="space-y-4 lg:col-span-7">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-stone-700">
              Schedule for {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </h3>
            <span className="text-xs text-stone-400">{dailyEvents.length} scheduled commitments</span>
          </div>

          <button
            type="button"
            onClick={() => setIsAdding(!isAdding)}
            className="flex items-center gap-1 rounded-xl bg-amber-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-amber-700 active:scale-95"
          >
            <span>{isAdding ? '✕ Cancel' : '+ Add Event'}</span>
          </button>
        </div>

        {/* Add Event Form */}
        {isAdding && (
          <form onSubmit={handleAddEvent} className="rounded-2xl border-2 border-amber-300 bg-amber-50/40 p-4 space-y-3 animate-in fade-in duration-150">
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Event title (e.g. Math Revision, Grocery Run, Club Call)..."
              className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 placeholder-stone-400 focus:border-amber-500 focus:outline-none"
            />

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase text-stone-500 mb-1">Start Time</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full rounded-lg border border-stone-200 bg-white p-1.5 text-xs font-semibold"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-stone-500 mb-1">End Time</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full rounded-lg border border-stone-200 bg-white p-1.5 text-xs font-semibold"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold uppercase text-stone-500 mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-lg border border-stone-200 bg-white p-1.5 text-xs font-semibold text-stone-700"
                >
                  <option value="cognitive">🧠 Cognitive (High Focus)</option>
                  <option value="social">👥 Social (Meetings/Hangouts)</option>
                  <option value="recharge">🌿 Recharge (Recovery/Breaks)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 text-xs text-stone-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isFlexible}
                  onChange={(e) => setIsFlexible(e.target.checked)}
                  className="rounded border-stone-300 text-amber-600 focus:ring-amber-500"
                />
                <span>Flexible / Low Consequence (Eligible for Load Shedding)</span>
              </label>

              <button
                type="submit"
                className="rounded-lg bg-amber-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-700"
              >
                Save to Schedule
              </button>
            </div>
          </form>
        )}

        {/* Events Timeline */}
        <div className="max-h-[480px] space-y-2.5 overflow-y-auto pr-1">
          {dailyEvents.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-300 p-8 text-center text-xs text-stone-400">
              No events scheduled for this day. Free time is recovery time!
            </div>
          ) : (
            dailyEvents.map((evt) => {
              const cat = CATEGORIES[evt.category] || CATEGORIES.cognitive
              return (
                <div
                  key={evt.id}
                  className="flex items-center justify-between rounded-xl border border-stone-200 bg-white p-3.5 shadow-sm transition hover:border-amber-200 hover:shadow"
                >
                  <div className="flex items-center gap-3">
                    <span className={`h-3 w-3 rounded-full ${cat.dot} shrink-0`} />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-stone-800">{evt.title}</span>
                        {evt.isFlexible && (
                          <span className="rounded bg-stone-100 px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider text-amber-800">
                            Flexible
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-stone-400">
                        <span>🕒 {evt.startTime} – {evt.endTime}</span>
                        <span>•</span>
                        <span className="font-medium text-stone-500">{cat.emoji} {cat.label}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteEvent(evt.id)}
                    className="rounded-lg p-1.5 text-xs text-stone-400 hover:bg-rose-50 hover:text-rose-600"
                    title="Remove event"
                  >
                    🗑️
                  </button>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
