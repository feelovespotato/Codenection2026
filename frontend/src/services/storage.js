// Unified local persistence service for Moodify Wellness Suite

const KEYS = {
  DIARY: 'moodify_diary_entries',
  MOOD: 'moodify_mood_logs',
  CALENDAR: 'moodify_calendar_events',
  STRESS: 'moodify_stress_records',
  RECOVERY: 'moodify_recovery_logs',
  SETTINGS: 'moodify_settings',
}

// Sample default events so the user immediately sees meaningful calendar & load data
const DEFAULT_CALENDAR_EVENTS = [
  {
    id: 'evt-1',
    title: 'CS310 Algorithm Lecture',
    date: new Date().toISOString().split('T')[0],
    startTime: '09:00',
    endTime: '11:00',
    category: 'cognitive',
    isFlexible: false,
    weight: 3,
  },
  {
    id: 'evt-2',
    title: 'Study Group Project',
    date: new Date().toISOString().split('T')[0],
    startTime: '13:00',
    endTime: '15:00',
    category: 'cognitive',
    isFlexible: true,
    weight: 2,
  },
  {
    id: 'evt-3',
    title: 'Club Committee Catchup',
    date: new Date().toISOString().split('T')[0],
    startTime: '16:00',
    endTime: '17:30',
    category: 'social',
    isFlexible: true,
    weight: 1.5,
  },
  {
    id: 'evt-4',
    title: 'Evening Walk & Meditation',
    date: new Date().toISOString().split('T')[0],
    startTime: '19:00',
    endTime: '19:45',
    category: 'recharge',
    isFlexible: true,
    weight: 0.5,
  },
]

const DEFAULT_DIARY_ENTRIES = [
  {
    id: 'diary-1',
    title: 'A gentle start to the week',
    content: 'Had a long study session today, feeling a bit overwhelmed by upcoming deadlines, but taking a deep breath and walking my dog in the room helped ground me.',
    date: new Date(Date.now() - 86400000).toISOString(),
    emotion: 'calm',
    weather: 'Sunny, 28°C',
    wordCount: 33,
  },
]

const DEFAULT_MOOD_LOGS = [
  {
    id: 'mood-1',
    date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
    mood: 'Relaxed',
    rating: 7,
    tags: ['Study', 'Room'],
    note: 'Listened to the rain while working.',
  },
  {
    id: 'mood-2',
    date: new Date().toISOString().split('T')[0],
    mood: 'Happy',
    rating: 8,
    tags: ['Break', 'Friends'],
    note: 'Felt renewed after breathing exercise.',
  },
]

const DEFAULT_SETTINGS = {
  musicEnabled: true,
  musicVolume: 0.2,
}

export const StorageService = {
  // --- APP SETTINGS ---
  getSettings() {
    try {
      const stored = JSON.parse(localStorage.getItem(KEYS.SETTINGS) || '{}')
      return {
        ...DEFAULT_SETTINGS,
        ...stored,
        musicEnabled: stored.musicEnabled ?? DEFAULT_SETTINGS.musicEnabled,
        musicVolume: Math.min(1, Math.max(0, Number(stored.musicVolume ?? DEFAULT_SETTINGS.musicVolume))),
      }
    } catch {
      return DEFAULT_SETTINGS
    }
  },
  saveSettings(settings) {
    const next = { ...this.getSettings(), ...settings }
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify(next))
    return next
  },

  // --- DIARY ---
  getDiaryEntries() {
    try {
      const data = localStorage.getItem(KEYS.DIARY)
      return data ? JSON.parse(data) : DEFAULT_DIARY_ENTRIES
    } catch {
      return DEFAULT_DIARY_ENTRIES
    }
  },
  saveDiaryEntry(entry) {
    const entries = this.getDiaryEntries()
    const index = entries.findIndex((e) => e.id === entry.id)
    if (index >= 0) {
      entries[index] = entry
    } else {
      entries.unshift({ ...entry, id: `diary-${Date.now()}` })
    }
    localStorage.setItem(KEYS.DIARY, JSON.stringify(entries))
    return entries
  },
  deleteDiaryEntry(id) {
    const entries = this.getDiaryEntries().filter((e) => e.id !== id)
    localStorage.setItem(KEYS.DIARY, JSON.stringify(entries))
    return entries
  },

  // --- MOOD ---
  getMoodLogs() {
    try {
      const data = localStorage.getItem(KEYS.MOOD)
      return data ? JSON.parse(data) : DEFAULT_MOOD_LOGS
    } catch {
      return DEFAULT_MOOD_LOGS
    }
  },
  saveMoodLog(log) {
    const logs = this.getMoodLogs()
    logs.unshift({ ...log, id: `mood-${Date.now()}` })
    localStorage.setItem(KEYS.MOOD, JSON.stringify(logs))
    return logs
  },

  // --- CALENDAR ---
  getCalendarEvents() {
    try {
      const data = localStorage.getItem(KEYS.CALENDAR)
      return data ? JSON.parse(data) : DEFAULT_CALENDAR_EVENTS
    } catch {
      return DEFAULT_CALENDAR_EVENTS
    }
  },
  saveCalendarEvent(event) {
    const events = this.getCalendarEvents()
    const index = events.findIndex((e) => e.id === event.id)
    if (index >= 0) {
      events[index] = event
    } else {
      events.push({ ...event, id: `evt-${Date.now()}` })
    }
    localStorage.setItem(KEYS.CALENDAR, JSON.stringify(events))
    return events
  },
  deleteCalendarEvent(id) {
    const events = this.getCalendarEvents().filter((e) => e.id !== id)
    localStorage.setItem(KEYS.CALENDAR, JSON.stringify(events))
    return events
  },

  // --- STRESS CHECK-IN ---
  getStressRecords() {
    try {
      const data = localStorage.getItem(KEYS.STRESS)
      return data ? JSON.parse(data) : [{ score: 3, level: 'Moderate', date: new Date().toISOString() }]
    } catch {
      return [{ score: 3, level: 'Moderate', date: new Date().toISOString() }]
    }
  },
  saveStressCheckIn(score, level, answers = null) {
    const records = this.getStressRecords()
    records.unshift({
      score,
      level,
      answers,
      date: new Date().toISOString(),
    })
    localStorage.setItem(KEYS.STRESS, JSON.stringify(records))
    return records
  },

  // --- CAPACITY CALCULATION ---
  calculateCapacity() {
    const today = new Date().toISOString().split('T')[0]
    const events = this.getCalendarEvents().filter((e) => e.date === today)
    
    // Total objective load: hours * weight
    let totalLoadHours = 0
    let cognitiveHours = 0
    let socialHours = 0
    let rechargeHours = 0

    events.forEach((evt) => {
      const [sh, sm] = (evt.startTime || '09:00').split(':').map(Number)
      const [eh, em] = (evt.endTime || '10:00').split(':').map(Number)
      const durationHours = Math.max(0.5, (eh * 60 + em - (sh * 60 + sm)) / 60)
      
      if (evt.category === 'cognitive') {
        cognitiveHours += durationHours
        totalLoadHours += durationHours * 1.3
      } else if (evt.category === 'social') {
        socialHours += durationHours
        totalLoadHours += durationHours * 1.0
      } else if (evt.category === 'recharge') {
        rechargeHours += durationHours
        totalLoadHours = Math.max(0, totalLoadHours - durationHours * 0.5)
      }
    })

    // Subjective Stress (1 to 5 scale, default 3)
    const records = this.getStressRecords()
    const latestStress = records.length > 0 ? records[0].score : 3

    // Capacity percentage: 40% objective workload + 60% subjective stress
    // Max reference load = 8 hours
    const loadPercent = Math.min(100, Math.round((totalLoadHours / 8) * 100))
    const stressPercent = Math.round((latestStress / 5) * 100)
    const capacityScore = Math.min(100, Math.max(10, Math.round(loadPercent * 0.45 + stressPercent * 0.55)))

    return {
      capacityScore,
      loadPercent,
      stressPercent,
      latestStress,
      totalLoadHours: Number(totalLoadHours.toFixed(1)),
      cognitiveHours: Number(cognitiveHours.toFixed(1)),
      socialHours: Number(socialHours.toFixed(1)),
      rechargeHours: Number(rechargeHours.toFixed(1)),
      eventsCount: events.length,
      recoveryStreak: this.calculateRecoveryStreak(),
    }
  },

  // --- RECOVERY LOGS & STREAK TRACKER ---
  getRecoveryLogs() {
    try {
      const data = localStorage.getItem(KEYS.RECOVERY)
      if (data) return JSON.parse(data)
      // Provide default sample streak of past 3 days so user sees an active streak right away
      const now = Date.now()
      const d1 = new Date(now - 86400000).toISOString().split('T')[0]
      const d2 = new Date(now - 86400000 * 2).toISOString().split('T')[0]
      const d3 = new Date(now - 86400000 * 3).toISOString().split('T')[0]
      const defaults = [
        { date: d1, type: 'recharge', title: 'Evening Walk & Meditation' },
        { date: d2, type: 'breathing', title: '4-7-8 Breathing Session' },
        { date: d3, type: 'recharge', title: 'Power Nap & Rest' },
      ]
      localStorage.setItem(KEYS.RECOVERY, JSON.stringify(defaults))
      return defaults
    } catch {
      return []
    }
  },

  recordRecovery(type = 'activity', title = 'Recharge Activity') {
    const today = new Date().toISOString().split('T')[0]
    const logs = this.getRecoveryLogs()
    const exists = logs.some((l) => l.date === today && l.title === title)
    if (!exists) {
      logs.unshift({ date: today, type, title, timestamp: new Date().toISOString() })
      localStorage.setItem(KEYS.RECOVERY, JSON.stringify(logs))
    }
    return this.calculateRecoveryStreak()
  },

  calculateRecoveryStreak() {
    const today = new Date().toISOString().split('T')[0]
    const logs = this.getRecoveryLogs()

    // Also include any calendar recharge events as recovery days
    const events = this.getCalendarEvents()
    const rechargeEventDates = new Set(
      events.filter((e) => e.category === 'recharge').map((e) => e.date),
    )

    // Set of all unique dates where user completed a recovery action
    const recoveryDates = new Set([
      ...logs.map((l) => l.date),
      ...rechargeEventDates,
    ])

    const hasRecoveredToday = recoveryDates.has(today)

    // Calculate streak counting backwards
    let streak = 0
    const checkDate = new Date()

    if (!hasRecoveredToday) {
      checkDate.setDate(checkDate.getDate() - 1)
    }

    while (true) {
      const dateStr = checkDate.toISOString().split('T')[0]
      if (recoveryDates.has(dateStr)) {
        streak++
        checkDate.setDate(checkDate.getDate() - 1)
      } else {
        break
      }
    }

    return {
      currentStreak: streak,
      hasRecoveredToday,
      totalRecoverySessions: recoveryDates.size,
      recentDates: Array.from(recoveryDates).sort().reverse().slice(0, 7),
    }
  },
}
