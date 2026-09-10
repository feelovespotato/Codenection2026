import { OAuth2Client } from 'google-auth-library'
import { DateTime } from 'luxon'
import { AppError, requireValue, normalizeEvent } from './engine.js'

export function createGoogle(config, cipher) {
  const configured = Boolean(config.clientId && config.clientSecret)
  function client(tokens) {
    const auth = new OAuth2Client(config.clientId, config.clientSecret, config.redirectUri)
    if (tokens) auth.setCredentials(tokens)
    return auth
  }
  async function request(data, path, options = {}) {
    requireValue(data.google, 'Connect Google Calendar first.', 409)
    const tokens = cipher.decrypt(data.google.tokens)
    const auth = client(tokens)
    try {
      const result = await auth.request({ url: `https://www.googleapis.com/calendar/v3/calendars/primary${path}`, timeout: 15000, retry: false, ...options })
      data.google.tokens = cipher.encrypt({ ...tokens, ...auth.credentials })
      return result.data
    } catch (error) {
      const status = error.response?.status
      throw new AppError(status === 412 ? 'This Google event changed. Sync again before approving.' : status === 401 || status === 403 ? 'Google access expired or permission was denied. Reconnect with the required access.' : 'Google Calendar could not complete the request. Sync before retrying.', status === 412 ? 409 : 502)
    }
  }
  async function ensureFree(data, after, excludeGoogleId) {
    let pageToken
    do {
      const result = await request(data, '/events', { params: { singleEvents: true, timeMin: after.start, timeMax: after.end, maxResults: 2500, pageToken } })
      const conflict = (result.items || []).some(event => event.id !== excludeGoogleId && event.status !== 'cancelled' && event.transparency !== 'transparent' && !event.attendees?.some(a => a.self && a.responseStatus === 'declined'))
      requireValue(!conflict, 'Google Calendar has a commitment in that slot. Sync and generate fresh suggestions.', 409)
      pageToken = result.nextPageToken
    } while (pageToken)
  }
  return {
    configured,
    authUrl(state, write) {
      requireValue(configured, 'Google OAuth is not configured. Use .ics import or add the backend Google credentials.', 503)
      return client().generateAuthUrl({ access_type: 'offline', prompt: 'consent', state, scope: [write ? 'https://www.googleapis.com/auth/calendar.events' : 'https://www.googleapis.com/auth/calendar.events.readonly'] })
    },
    async exchange(code, write) {
      let tokens
      try {
        ;({ tokens } = await client().getToken(code))
      } catch (error) {
        if (error instanceof AppError) throw error
        // Never forward provider descriptions, request bodies or tokens to the UI/logs.
        const providerCode = error.response?.data?.error
        const allowed = ['invalid_client', 'invalid_grant', 'redirect_uri_mismatch', 'access_denied', 'unauthorized_client']
        const failure = new AppError('Google authorization failed. Please reconnect.', 400)
        failure.oauthReason = allowed.includes(providerCode) ? providerCode
          : error.response?.status >= 500 ? 'provider_unavailable'
          : !error.response ? 'network_error' : 'exchange_failed'
        const networkCodes = ['EACCES', 'EPERM', 'ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'CERT_HAS_EXPIRED', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'SELF_SIGNED_CERT_IN_CHAIN']
        const code = [error.code, error.cause?.code].find(value => networkCodes.includes(value))
        console.warn('Google token exchange failed:', failure.oauthReason, code || 'no-network-code')
        throw failure
      }
      try {
        const canWrite = (tokens.scope || '').split(' ').includes('https://www.googleapis.com/auth/calendar.events')
        requireValue(!write || canWrite, 'Calendar write permission was not granted.', 403)
        return { tokens: cipher.encrypt(tokens), canWrite, lastSync: null }
      } catch (error) {
        if (error instanceof AppError) throw error
        const failure = new AppError('Google connected, but its credentials could not be stored.', 500)
        failure.oauthReason = 'token_storage_failed'
        console.warn('Google token exchange failed:', failure.oauthReason)
        throw failure
      }
    },
    async sync(data, now = Date.now()) {
      const from = DateTime.fromMillis(now, { zone: data.zone }).startOf('day').minus({ days: 30 }).toUTC().toISO()
      const to = DateTime.fromMillis(now, { zone: data.zone }).startOf('day').plus({ days: 91 }).toUTC().toISO()
      const imported = []
      let pageToken
      do {
        const response = await request(data, '/events', { params: { timeMin: from, timeMax: to, singleEvents: true, showDeleted: false, maxResults: 2500, pageToken } })
        for (const event of response.items || []) {
          if (event.status === 'cancelled' || event.transparency === 'transparent' || event.attendees?.some(a => a.self && a.responseStatus === 'declined')) continue
          const previous = data.events.find(item => (item.source === 'google' && item.googleId === event.id) || (item.source === 'local' && item.googleUploadId === event.id && event.extendedProperties?.private?.moodifyLocalEvent === item.id))
          const allDay = Boolean(event.start.date)
          const start = allDay ? DateTime.fromISO(event.start.date, { zone: data.zone }).toISO() : event.start.dateTime
          const end = allDay ? DateTime.fromISO(event.end.date, { zone: data.zone }).toISO() : event.end.dateTime
          const hasAttendees = (event.attendees || []).some(a => !a.self)
          imported.push(normalizeEvent({ title: event.summary || 'Untitled event', description: event.description, start, end, allDay,
            category: previous?.category || 'auto', isFlexible: previous?.isFlexible || false, consequence: previous?.consequence || 'high',
            deadline: previous?.deadline && Date.parse(previous.deadline) >= Date.parse(end) ? previous.deadline : null,
          }, data.zone, { ...previous, source: 'google', googleId: event.id, etag: event.etag, hasAttendees }))
        }
        requireValue(imported.length <= 10000, 'Too many Google events in the sync window. Use a smaller calendar.', 413)
        pageToken = response.nextPageToken
      } while (pageToken)
      const importedIds = new Set(imported.map(e => e.id))
      data.events = [...data.events.filter(e => e.source !== 'google' && !importedIds.has(e.id)), ...imported]
      data.google.lastSync = new Date(now).toISOString()
      return imported.length
    },
    async upload(data, event) {
      requireValue(data.google?.canWrite, 'Enable Google write access before uploading.', 409)
      const id = event.googleUploadId
      requireValue(/^[a-f0-9]{32}$/.test(id || ''), 'Invalid upload identity.')
      const times = event.allDay ? {
        start: { date: DateTime.fromISO(event.start).setZone(data.zone).toISODate() },
        end: { date: DateTime.fromISO(event.end).setZone(data.zone).toISODate() },
      } : { start: { dateTime: event.start }, end: { dateTime: event.end } }
      try {
        return await request(data, '/events', { method: 'POST', params: { sendUpdates: 'none' }, data: {
          id, summary: event.title, description: event.description, ...times,
          extendedProperties: { private: { moodifyLocalEvent: event.id } },
        } })
      } catch (error) {
        const existing = await request(data, `/events/${id}`).catch(() => null)
        if (existing?.status !== 'cancelled' && existing?.extendedProperties?.private?.moodifyLocalEvent === event.id) return existing
        throw error
      }
    },
    async move(data, event, after) {
      requireValue(data.google?.canWrite, 'Reconnect Google with write access to approve this move.', 409)
      await ensureFree(data, after, event.googleId)
      return request(data, `/events/${encodeURIComponent(event.googleId)}`, {
        method: 'PATCH', headers: { 'If-Match': event.etag }, params: { sendUpdates: 'none' },
        data: event.allDay ? {
          start: { date: DateTime.fromISO(after.start).setZone(data.zone).toISODate() },
          end: { date: DateTime.fromISO(after.end).setZone(data.zone).toISODate() },
        } : { start: { dateTime: after.start }, end: { dateTime: after.end } },
      })
    },
    async insert(data, event, proposalId) {
      requireValue(data.google?.canWrite, 'Reconnect Google with write access to insert recovery.', 409)
      // Stable provider ID makes retries safe when a response is lost after Google accepted the write.
      const googleId = proposalId.replaceAll('-', '')
      await ensureFree(data, event, googleId)
      try {
        return await request(data, '/events', { method: 'POST', params: { sendUpdates: 'none' }, data: {
          id: googleId, summary: event.title, start: { dateTime: event.start }, end: { dateTime: event.end },
          extendedProperties: { private: { moodifyProposal: proposalId } },
        } })
      } catch (error) {
        const existing = await request(data, `/events/${googleId}`).catch(() => null)
        if (existing?.extendedProperties?.private?.moodifyProposal === proposalId) return existing
        throw error
      }
    },
  }
}
