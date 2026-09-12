import express from 'express'
import { randomBytes, randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import { capacity, dayStart, normalizeEvent, overlaps, recovery, recoveryStatus, requireValue, streak, timetable, validZone } from './engine.js'
import { exportCalendar, importCalendar } from './ics.js'
import { sleepProxy, deadlineDensity, taskBatch, batchEligible } from './tier2.js'
import { createAI, parseAIJson } from './ai.js'
import { boundaryDraft, enhanceProposals } from './ai-features.js'

export function createApp({ store, google, ai = createAI({ env: {} }), origin = 'http://localhost:5173', now = () => Date.now(), staticDirectory }) {
  const app = express()

  // The Electron companion and the web app are separate renderers, so this
  // small local server state is their shared source of truth for music/timer UI.
  const companion = {
    music: { activeTrackId: 'rain', isPlaying: false, volume: 0.7 },
    focus: { isRunning: false, remainingSeconds: 25 * 60, endsAt: null },
  }

  const tracks = new Set([
    'rain',
    'forest',
    'calm_piano',
    'bird',
    'ocean',
    'waterfall',
    'keyboard',
    'lofi_music'
  ])

  function companionSnapshot() {
    if (companion.focus.isRunning && companion.focus.endsAt) {
      companion.focus.remainingSeconds = Math.max(
        0,
        Math.ceil((companion.focus.endsAt - now()) / 1000)
      )

      if (companion.focus.remainingSeconds === 0) {
        companion.focus.isRunning = false
        companion.focus.endsAt = null
      }
    }

    return {
      music: { ...companion.music },
      focus: {
        isRunning: companion.focus.isRunning,
        remainingSeconds: companion.focus.remainingSeconds
      }
    }
  }

  app.disable('x-powered-by')
  app.use(express.json())

  app.use('/api', async (req, res, next) => {
    try {
      const sessionId =
        /(?:^|; )moodify_session=([a-f0-9]{64})(?:;|$)/
          .exec(req.headers.cookie || '')?.[1]

      let userId = sessionId
        ? await store.session(sessionId)
        : null

      if (!userId) {
        userId = randomUUID()
        const session = randomBytes(32).toString('hex')

        await store.createSession(session, userId)

        res.cookie('moodify_session', session, {
          httpOnly: true,
          sameSite: 'lax',
          secure: origin.startsWith('https:'),
          maxAge: 30 * 86400000,
          path: '/',
        })
      }

      req.userId = userId
      next()
    } catch (error) {
      next(error)
    }
  })

  // Serialize mutations per user across async Google/import operations to prevent lost updates.
  const locks = new Map()

  function mutate(handler) {
    return async (req, res, next) => {
      const prior = locks.get(req.userId) || Promise.resolve()
      let release

      const current = new Promise(resolve => {
        release = resolve
      })

      locks.set(req.userId, current)
      await prior

      try {
        if (store.withUser) {
          let reply
          let status = 200

          const deferred = {
            status(code) {
              status = code
              return deferred
            },
            json(body) {
              reply = () => res.status(status).json(body)
            },
            redirect(url) {
              reply = () => res.redirect(url)
            }
          }

          await store.withUser(
            req.userId,
            async () => handler(req, deferred, await store.get(req.userId))
          )

          reply?.()
        } else {
          await handler(req, res, await store.get(req.userId))
        }
      } catch (error) {
        next(error)
      } finally {
        release()

        if (locks.get(req.userId) === current) {
          locks.delete(req.userId)
        }
      }
    }
  }

  async function persist(req, data) {
    data.revision++
    data.proposals = []
    await store.save(req.userId, data)
  }

  function snapshot(data, date) {
    date ||= DateTime
      .fromMillis(now(), { zone: data.zone })
      .toISODate()

    return {
      zone: data.zone,
      date,
      serverTime: new Date(now()).toISOString(),

      events: data.events.map(event => ({
        ...event,
        recoveryStatus: recoveryStatus(event, now())
      })),

      checkin:
        data.checkins.find(c => c.date === date) || null,

      capacity: {
        ...capacity(
          data.events,
          data.checkins,
          date,
          data.zone
        ),

        calendarRecoveryStreak: streak(
          data.events,
          data.zone,
          now()
        ),

        recoveryStreak: streak(
          (data.recoverySessions || [])
            .filter(s => s.completedAt)
            .map(s => ({
              category: 'recharge',
              start: s.startedAt,
              end: s.completedAt,
              completedAt: s.completedAt
            })),
          data.zone,
          now()
        )
      },

      insights: {
        sleep: sleepProxy(
          data.events,
          date,
          data.zone,
          now()
        ),

        deadlines: deadlineDensity(
          data.events,
          date,
          data.zone
        )
      },

      ai: ai.status(),
      revision: data.revision,

      google: {
        configured: google.configured,
        connected: Boolean(data.google),
        canWrite: Boolean(data.google?.canWrite),
        lastSync: data.google?.lastSync || null,
      },
    }
  }

  // ------------------------------------------------------------
  // Companion API
  // ------------------------------------------------------------

  app.get('/api/companion-state', (_req, res) => {
    res.json(companionSnapshot())
  })

  app.patch('/api/companion-state', (req, res) => {
    const music = req.body.music

    if (music) {
      if (
        music.activeTrackId !== undefined &&
        tracks.has(music.activeTrackId)
      ) {
        companion.music.activeTrackId = music.activeTrackId
      }

      if (
        music.isPlaying !== undefined &&
        typeof music.isPlaying === 'boolean'
      ) {
        companion.music.isPlaying = music.isPlaying
      }

      if (
        music.volume !== undefined &&
        Number.isFinite(music.volume)
      ) {
        companion.music.volume = Math.min(
          1,
          Math.max(0, music.volume)
        )
      }
    }

    const focus = req.body.focus

    if (focus) {
      if (
        Number.isInteger(focus.durationSeconds) &&
        focus.durationSeconds >= 60 &&
        focus.durationSeconds <= 4 * 3600
      ) {
        companion.focus.remainingSeconds =
          focus.durationSeconds

        companion.focus.endsAt = null
        companion.focus.isRunning = false
      }

      if (focus.action === 'start') {
        companion.focus.isRunning = true
        companion.focus.endsAt =
          now() + companion.focus.remainingSeconds * 1000
      } else if (focus.action === 'pause') {
        companionSnapshot()

        companion.focus.isRunning = false
        companion.focus.endsAt = null
      } else if (focus.action === 'reset') {
        companion.focus = {
          isRunning: false,
          remainingSeconds: 25 * 60,
          endsAt: null
        }
      }
    }

    res.json(companionSnapshot())
  })

  // Keep the original /api/state endpoint from main.
  // Important: store.get() is awaited.
  app.get('/api/state', async (req, res) =>
    res.json(
      snapshot(
        await store.get(req.userId),
        req.query.date
      )
    )
  )

  app.get('/api/ai/status', (_req, res) =>
    res.json(ai.status())
  )

  app.post('/api/recovery-sessions', mutate(async (req, res, data) => {
    requireValue(
      ['balance', 'relax', 'calm', 'release'].includes(req.body.technique),
      'Choose a breathing technique.'
    )

    const session = {
      id: randomUUID(),
      technique: req.body.technique,
      startedAt: new Date(now()).toISOString(),
      durationSeconds: 60
    }

    data.recoverySessions = [
      ...(data.recoverySessions || []).filter(s => s.completedAt),
      session
    ]

    await store.save(req.userId, data)

    res.status(201).json({ session })
  }))

  app.post('/api/recovery-sessions/:id/complete', mutate(async (req, res, data) => {
    const session = data.recoverySessions?.find(
      s => s.id === req.params.id
    )

    requireValue(
      session,
      'Session not found. Start a new breathing session.',
      404
    )

    if (!session.completedAt) {
      const elapsed =
        now() - Date.parse(session.startedAt)

      requireValue(
        elapsed >= session.durationSeconds * 1000,
        'Finish the full session before completing it.',
        409
      )

      requireValue(
        elapsed <= 30 * 60000,
        'Session expired. Start a new breathing session.',
        409
      )

      session.completedAt =
        new Date(now()).toISOString()

      await store.save(req.userId, data)
    }

    res.json({ session })
  }))

  app.post('/api/boundary-template', async (req, res) =>
    res.json(
      await boundaryDraft(
        ai,
        req.body,
        await store.get(req.userId),
        req.userId
      )
    )
  )

  app.post('/api/agent-chat', async (req, res) => {
    const { message, history, planningState, calendarEvents } = req.body
    
    const system = `You are Moodify Assistant, a highly empathetic and supportive AI companion.
You also have an AI-powered Calendar / Planner feature.

### Calendar / Planner Rules
You must distinguish between dedicated planning conversations and normal conversations where a plan is casually mentioned.

1. NEVER auto-add to the calendar without confirmation.
Flow: Detect plan -> Extract details -> Ask missing info -> Show short summary -> Ask for confirmation -> Create event.

2. Intent Detection
- If the user's main purpose is to create/schedule a plan, enter "PLANNING_MODE" (set \`sourceConversationType\` to "PLANNING_MODE").
- If the user is talking normally (feelings, life) and casually mentions a plan, the state is "NORMAL_CHAT". You can suggest adding it to the calendar.

3. Ask Only Necessary Questions
Only ask what is needed (What, When, How long/End time). Keep it short. e.g. "what time?", "how long?"

4. Confirmation Summary
Before creating, show a short summary. e.g. "Study tomorrow, 8-10pm. add it?" Set \`awaitingConfirmation\` to true.

5. Existing Plans
If the user modifies an active plan (e.g. "make it 9 instead"), update the temporary planningState.

6. Temporary Planning State
Maintain the planningState in your JSON output. If the user says "yes" to your confirmation summary, output a \`calendarAction\`.

### Response style
- Respond like a supportive friend texting.
- Keep replies very short — normally 1-2 sentences.
- Use simple language, texting-style punctuation.

### Context
Today's Date: ${new Date().toISOString().split('T')[0]}
Current Planning State: ${JSON.stringify(planningState || {})}
Existing Calendar Events: ${JSON.stringify(calendarEvents || [])}

### Output Format
You MUST reply using ONLY valid JSON. Do not include any conversational text outside of the JSON block. Do not use markdown.
Reply using strict JSON. Here is an example of the exact structure required:
{
  "reply": "Your conversational response",
  "planningState": {
    "active": true,
    "sourceConversationType": "NORMAL_CHAT",
    "title": "Gym",
    "date": "2026-09-13",
    "startTime": "19:00",
    "endTime": "20:00",
    "duration": "1 hour",
    "location": null,
    "notes": null,
    "awaitingConfirmation": false
  },
  "calendarAction": null
}
If you need to create an event (only after user says yes to confirmation), calendarAction should be an object:
"calendarAction": {
  "type": "CREATE_EVENT",
  "event": { "id": "temp-1", "title": "Gym", "date": "2026-09-13", "startTime": "19:00", "endTime": "20:00", "category": "recharge", "isFlexible": true }
}
Note: After issuing CREATE_EVENT, you should clear the planningState (active: false, but preserve sourceConversationType).`
    
    const formattedHistory = (history || []).map(h => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`).join('\n')
    const prompt = `Conversation history:\n${formattedHistory}\n\nUser: ${message}\nAssistant:`

    const result = await ai.generate({
      system,
      prompt,
      validate: (text) => {
        try {
          const parsed = parseAIJson(text)
          if (typeof parsed.reply === 'string' && parsed.reply.trim()) {
            return parsed
          }
          console.log('Validation failed. Parsed:', parsed)
          return null
        } catch (err) {
          console.error('Failed to parse JSON:', err.message, 'Raw text:', text)
          return null
        }
      },
      scope: 'agent-chat-' + req.userId
    })

    if (result.value) {
      res.json(result.value)
    } else {
      let msg = "I'm having a little trouble connecting right now, but I want you to know I'm still here for you. Take a deep breath, and let's try again in a moment."
      if (result.reason === 'rate_limited') {
        msg = "The AI rate limit has been reached! ⏳ Please wait a minute before trying again."
      } else if (result.reason === 'key_model_or_billing') {
        msg = "There seems to be an issue with your API key or billing."
      }
      res.json({ reply: msg })
    }
  })

  app.post('/api/agent-chat/conclusion', async (req, res) => {
    const { history } = req.body

    const system = `You are a helpful AI that summarizes a supportive conversation.
You need to generate two things based on the conversation:
1. A first-person diary reflection entry (using "I", "my") summarizing what the user discussed, how they felt, and any comforting takeaways.
   IMPORTANT: If the user discussed scheduling or managing their calendar, DO NOT include that in the diary reflection. Focus only on the emotional and meaningful parts of the conversation.
2. Data for a mood tracker log. 

For the mood tracker, strictly use these allowed values:
Allowed Moods: "Happy", "Excited", "Relaxed", "Sleepy", "Sad", "Angry"
Allowed Tags: "Studies 📚", "Work 💻", "Friends 👥", "Family 🏡", "Sleep 🌙", "Health 🌿", "Gaming 🎮", "Exercise 🏃"

Reply using a strict JSON format exactly like this:
{
  "conclusion": "Today I felt...",
  "emotion": "calm",
  "mood": "Relaxed",
  "intensity": 7,
  "tags": ["Work 💻", "Sleep 🌙"],
  "note": "Short note about the mood"
}`
    
    const formattedHistory = (history || []).map(h => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`).join('\n')
    const prompt = `Conversation history:\n${formattedHistory}\n\nGenerate the JSON output.`

    const result = await ai.generate({
      system,
      prompt,
      validate: (text) => {
        const parsed = parseAIJson(text)
        if (typeof parsed.conclusion === 'string' && parsed.conclusion.trim()) {
          return {
            conclusion: parsed.conclusion.trim(),
            emotion: parsed.emotion || 'thoughtful',
            mood: parsed.mood || 'Relaxed',
            intensity: typeof parsed.intensity === 'number' ? parsed.intensity : 5,
            tags: Array.isArray(parsed.tags) ? parsed.tags : [],
            note: parsed.note || ''
          }
        }
        return null
      },
      scope: 'agent-chat-conc-' + req.userId
    })

    if (result.value) {
      res.json(result.value)
    } else {
      res.json({ conclusion: "I spent some time reflecting on my feelings today.", emotion: "reflective", mood: "Relaxed", intensity: 5, tags: [], note: "" })
    }
  })

  app.put('/api/preferences', mutate(async (req, res, data) => {
    requireValue(
      validZone(req.body.zone),
      'Choose a valid IANA time zone.'
    )

    if (data.zone !== req.body.zone) {
      data.zone = req.body.zone
      await persist(req, data)
    }

    res.json(snapshot(data))
  }))

  app.post('/api/events', mutate(async (req, res, data) => {
    const event = normalizeEvent(
      req.body,
      data.zone
    )

    requireValue(
      data.events.length < 12000,
      'Calendar is full.',
      413
    )

    data.events.push(event)

    await persist(req, data)

    res.status(201).json({ event })
  }))

  app.patch('/api/events/:id', mutate(async (req, res, data) => {
    const event = data.events.find(
      e => e.id === req.params.id
    )

    requireValue(
      event,
      'Event not found.',
      404
    )

    const input =
      event.source === 'google'
        ? {
            ...event,
            start: req.body.start ?? event.start,
            end: req.body.end ?? event.end,
            category: req.body.category ?? event.category,
            isFlexible:
              req.body.isFlexible ?? event.isFlexible,
            consequence:
              req.body.consequence ?? event.consequence,
            deadline:
              req.body.deadline ?? event.deadline
          }
        : {
            ...event,
            ...req.body
          }

    const updated = normalizeEvent(
      input,
      data.zone,
      event
    )

    if (
      event.source === 'google' &&
      (
        updated.start !== event.start ||
        updated.end !== event.end
      )
    ) {
      requireValue(
        req.body.approved === true,
        'Approve saving the new times to Google Calendar.'
      )

      requireValue(
        event.googleEventId && event.etag,
        'Sync Google before editing this event.',
        409
      )

      const remote = await google.move(
        data,
        event,
        {
          start: updated.start,
          end: updated.end
        }
      )

      updated.etag = remote.etag
    }

    data.events = data.events.map(
      e => e.id === event.id ? updated : e
    )

    await persist(req, data)

    res.json({ event: updated })
  }))

  app.post('/api/events/:id/upload-google', mutate(async (req, res, data) => {
    requireValue(
      req.body.approved === true,
      'Approve uploading this event first.'
    )

    const event = data.events.find(
      e => e.id === req.params.id
    )

    requireValue(
      event,
      'Event not found.',
      404
    )

    if (event.source === 'google') {
      res.json({ event })
      return
    }

    requireValue(
      event.source === 'moodify',
      'Only local events can be uploaded directly.'
    )

    requireValue(
      data.google?.canWrite,
      'Enable Google write access before uploading.',
      409
    )

    // Save a stable identity before the network call so retries and sync can reconcile it.
    event.googleUploadId ||= event.id.replaceAll('-', '')

    await store.save(req.userId, data)

    const remote = await google.upload(data, event)

    Object.assign(event, {
      syncToGoogle: true,
      googleEventId: remote.id,
      etag: remote.etag
    })

    await persist(req, data)

    res.json({ event })
  }))

  app.delete('/api/events/:id', mutate(async (req, res, data) => {
    const event = data.events.find(
      e => e.id === req.params.id
    )

    requireValue(
      event,
      'Event not found.',
      404
    )

    requireValue(
      event.source !== 'google',
      'Delete this event in Google Calendar, then sync again.'
    )

    data.events = data.events.filter(
      e => e.id !== event.id
    )

    await persist(req, data)

    res.json({ ok: true })
  }))

  app.post('/api/events/:id/complete', mutate(async (req, res, data) => {
    const event = data.events.find(
      e => e.id === req.params.id
    )

    requireValue(
      event?.category === 'recharge',
      'Recovery event not found.',
      404
    )

    requireValue(
      Date.parse(event.end) <= now(),
      'This recovery block has not finished yet.'
    )

    event.completedAt ||= new Date(now()).toISOString()

    await persist(req, data)

    res.json({ ok: true })
  }))

  app.post('/api/checkins', mutate(async (req, res, data) => {
    requireValue(
      Number.isInteger(req.body.score) &&
      req.body.score >= 1 &&
      req.body.score <= 5,
      'Stress score must be an integer from 1 to 5.'
    )

    const date = DateTime
      .fromMillis(now(), { zone: data.zone })
      .toISODate()

    data.checkins = [
      {
        date,
        score: req.body.score,
        recordedAt: new Date(now()).toISOString()
      },
      ...data.checkins.filter(
        c => c.date !== date
      )
    ].slice(0, 366)

    await persist(req, data)

    res.json(snapshot(data))
  }))

  app.post('/api/calendar/import', mutate(async (req, res, data) => {
    const sourceName =
      String(req.body.name || 'calendar.ics').slice(0, 200)

    const result = await importCalendar(
      req.body.text,
      data.zone,
      sourceName,
      now()
    )

    const old = new Map(
      data.events.map(e => [e.id, e])
    )

    const incoming = result.events.map(event =>
      old.has(event.id)
        ? {
            ...event,
            category: old.get(event.id).category,
            weight: old.get(event.id).weight,
            isFlexible: old.get(event.id).isFlexible,
            consequence: old.get(event.id).consequence,
            deadline: old.get(event.id).deadline,
            completedAt: old.get(event.id).completedAt
          }
        : event
    )

    data.events = [
      ...data.events.filter(
        e =>
          !(
            e.source === 'ics' &&
            e.sourceName === sourceName &&
            Date.parse(e.start) < Date.parse(result.to) &&
            Date.parse(e.end) > Date.parse(result.from)
          )
      ),
      ...incoming
    ]

    requireValue(
      data.events.length <= 12000,
      'Import would exceed the calendar size limit.',
      413
    )

    await persist(req, data)

    res.json({
      count: incoming.length,
      from: result.from,
      to: result.to
    })
  }))

  app.get('/api/calendar/export', async (req, res) => {
    const data = await store.get(req.userId)

    res
      .set(
        'Content-Disposition',
        'attachment; filename="moodify-calendar.ics"'
      )
      .type('text/calendar')
      .send(
        exportCalendar(
          data.events,
          data.zone
        )
      )
  })

  app.post('/api/proposals', mutate(async (req, res, data) => {
    const kind = req.body.kind

    requireValue(
      ['shed', 'timetable', 'recovery', 'batch'].includes(kind),
      'Unknown suggestion type.'
    )

    const date =
      req.body.date ||
      DateTime
        .fromMillis(now(), { zone: data.zone })
        .toISODate()

    dayStart(date, data.zone)

    const candidates =
      kind === 'batch'
        ? taskBatch(data, date, now())
        : kind === 'recovery'
          ? recovery(data, date, now())
          : timetable(
              data,
              date,
              now(),
              'timetable'
            ).map(item => ({
              ...item,
              kind
            }))

    const ranked = await enhanceProposals(
      ai,
      candidates,
      data,
      date,
      req.userId
    )

    const suggestions =
      kind === 'shed'
        ? ranked.slice(0, 1)
        : ranked

    const proposals = suggestions.map(item => ({
      ...item,
      id: randomUUID(),
      revision: data.revision,
      expires: now() + 15 * 60000
    }))

    data.proposals = [
      ...data.proposals.filter(
        p => p.expires > now() && p.kind !== kind
      ),
      ...proposals
    ].slice(-20)

    await store.save(req.userId, data)

    res.json({
      proposals,
      message: proposals.length
        ? null
        : kind === 'batch'
          ? 'No batch available. Choose at least two upcoming flexible errands of 45 minutes or less, with low/medium consequence and a free combined block.'
          : kind === 'recovery'
            ? 'No suitable free time remains between 08:00 and 21:00 on this day.'
            : 'No safe move found. Mark an upcoming task flexible with low/medium consequence, or keep this schedule.'
    })
  }))

  app.post('/api/proposals/:id/apply', mutate(async (req, res, data) => {
    requireValue(
      req.body.approved === true,
      'Approve this individual change first.'
    )

    const proposal = data.proposals.find(
      p => p.id === req.params.id
    )

    requireValue(
      proposal &&
      proposal.revision === data.revision &&
      proposal.expires > now(),
      'This suggestion expired or the schedule changed. Generate fresh suggestions.',
      409
    )

    requireValue(
      Date.parse(proposal.after.start) > now(),
      'This suggested time has passed. Generate a new suggestion.',
      409
    )

    if (proposal.kind === 'batch') {
      if (proposal.individualApproval) {
        const move = proposal.moves.find(
          m => m.eventId === req.body.eventId
        )

        requireValue(
          move && !move.applied,
          'Choose an unapplied move to approve.',
          409
        )

        const event = data.events.find(
          e => e.id === move.eventId
        )

        requireValue(
          event &&
          batchEligible(event, now()) &&
          event.start === move.before.start &&
          event.end === move.before.end,
          'Errand changed. Generate a fresh batch.',
          409
        )

        requireValue(
          Date.parse(move.after.start) > now() &&
          (
            !event.deadline ||
            Date.parse(move.after.end) <= Date.parse(event.deadline)
          ),
          'Move has passed or crosses a deadline.',
          409
        )

        requireValue(
          !overlaps(
            move.after,
            data.events,
            event.id
          ),
          'The batch slot is no longer free.',
          409
        )

        if (event.source === 'google') {
          requireValue(
            event.googleEventId && event.etag,
            'Sync Google before moving this event.',
            409
          )

          const remote = await google.move(
            data,
            event,
            move.after
          )

          event.etag = remote.etag
        }

        Object.assign(event, move.after)

        move.applied = true
        data.revision++
        proposal.revision = data.revision

        data.proposals =
          proposal.moves.every(m => m.applied)
            ? []
            : [proposal]

        await store.save(req.userId, data)

        res.json({
          ok: true,
          proposal,
          revision: data.revision
        })

        return
      }

      const ids = new Set(
        proposal.moves.map(
          move => move.eventId
        )
      )

      const remaining = data.events.filter(
        event => !ids.has(event.id)
      )

      for (const move of proposal.moves) {
        const event = data.events.find(
          e => e.id === move.eventId
        )

        requireValue(
          event && batchEligible(event, now()),
          'An errand is no longer eligible. Generate a fresh batch.',
          409
        )

        requireValue(
          !event.deadline ||
          Date.parse(move.after.end) <=
            Date.parse(event.deadline),
          'Batch would cross a deadline.',
          409
        )

        requireValue(
          !overlaps(move.after, remaining),
          'The batch slot is no longer free.',
          409
        )

        remaining.push({
          ...event,
          ...move.after
        })
      }

      // Validate all moves before updating any event. No remote writes or deletions.
      for (const move of proposal.moves) {
        Object.assign(
          data.events.find(
            e => e.id === move.eventId
          ),
          move.after
        )
      }

      await persist(req, data)

      res.json({ ok: true })

      return
    }

    requireValue(
      !overlaps(
        proposal.after,
        data.events,
        proposal.eventId
      ),
      'That slot is no longer free. Generate new suggestions.',
      409
    )

    if (proposal.kind === 'recovery') {
      const event = normalizeEvent(
        {
          title: proposal.title,
          ...proposal.after,
          category: 'recharge',
          consequence: 'low'
        },
        data.zone
      )

      if (req.body.writeToGoogle === true) {
        const remote = await google.insert(
          data,
          event,
          proposal.id
        )

        Object.assign(event, {
          syncToGoogle: true,
          googleEventId: remote.id,
          etag: remote.etag
        })
      }

      data.events.push(event)
    } else {
      const event = data.events.find(
        e => e.id === proposal.eventId
      )

      requireValue(
        event?.isFlexible &&
        !event.hasAttendees &&
        event.consequence !== 'high',
        'This event is no longer eligible to move.',
        409
      )

      requireValue(
        !event.deadline ||
        Date.parse(proposal.after.end) <=
          Date.parse(event.deadline),
        'Move would cross the deadline.',
        409
      )

      if (event.source === 'google') {
        const remote = await google.move(
          data,
          event,
          proposal.after
        )

        event.etag = remote.etag
      }

      Object.assign(
        event,
        proposal.after
      )
    }

    await persist(req, data)

    res.json({ ok: true })
  }))

  app.post('/api/google/connect', mutate(async (req, res, data) => {
    const state = randomBytes(32).toString('hex')
    const write = req.body.write === true

    const url = google.authUrl(
      state,
      write
    )

    data.oauth = {
      state,
      write,
      expires: now() + 10 * 60000
    }

    await store.save(req.userId, data)

    res.json({ url })
  }))

  app.get('/api/google/callback', mutate(async (req, res, data) => {
    const oauth = data.oauth

    delete data.oauth

    await store.save(
      req.userId,
      data
    )

    if (
      !oauth ||
      oauth.state !== req.query.state ||
      oauth.expires < now() ||
      req.query.error ||
      typeof req.query.code !== 'string'
    ) {
      return res.redirect(
        `${origin}/?calendar=denied`
      )
    }

    try {
      data.google = await google.exchange(
        req.query.code,
        oauth.write
      )

      await persist(req, data)

      res.redirect(
        `${origin}/?calendar=connected`
      )
    } catch (error) {
      const allowed = [
        'invalid_client',
        'invalid_grant',
        'redirect_uri_mismatch',
        'access_denied',
        'unauthorized_client',
        'provider_unavailable',
        'network_error',
        'exchange_failed',
        'token_storage_failed'
      ]

      const reason =
        allowed.includes(error.oauthReason)
          ? error.oauthReason
          : 'exchange_failed'

      res.redirect(
        `${origin}/?calendar=failed&reason=${reason}`
      )
    }
  }))

  app.post('/api/google/sync', mutate(async (req, res, data) => {
    const count = await google.sync(
      data,
      now()
    )

    await persist(
      req,
      data
    )

    res.json({ count })
  }))

  app.post('/api/google/disconnect', mutate(async (req, res, data) => {
    data.google = null
    delete data.oauth

    data.events = data.events.filter(
      e => e.source !== 'google'
    )

    await persist(
      req,
      data
    )

    res.json({ ok: true })
  }))

  app.use('/api', (_req, res) =>
    res.status(404).json({
      error: 'API endpoint not found.'
    })
  )

  if (staticDirectory) {
    app.use(
      express.static(staticDirectory)
    )
  }

  app.use((error, _req, res, _next) => {
    const status = error.status || 500

    if (status === 500) {
      console.error(
        'API failure:',
        error.message
      )
    }

    res.status(status).json({
      error:
        status === 500
          ? 'The server could not complete this request.'
          : error.message
    })
  })

  return app
}