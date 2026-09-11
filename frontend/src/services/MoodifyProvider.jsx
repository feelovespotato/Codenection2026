import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api.js'
import { MoodifyContext } from './moodify-context.js'

export default function MoodifyProvider({ children }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  // Suggestion cache, keyed by kind ('shed' | 'recovery' | 'timetable'). Lives here (not inside
  // DashboardView) so a fetch triggered from CalendarView on page-open is visible to Dashboard,
  // and switching Dashboard tabs no longer needs to re-fetch.
  const [suggestions, setSuggestions] = useState({})
  const [suggestionsLoading, setSuggestionsLoading] = useState({})
  const serial = useRef(0)
  const mutation = useRef(false)
  const refresh = useCallback(async () => {
    const requestId = ++serial.current
    try {
      const result = await api('/state')
      if (requestId === serial.current) { setData(result); setError('') }
      return result
    } catch (failure) {
      if (requestId === serial.current) setError(failure.message)
      throw failure
    } finally { if (requestId === serial.current) setLoading(false) }
  }, [])
  useEffect(() => {
    refresh().catch(() => {})
    const reload = () => { if (!mutation.current) refresh().catch(() => {}) }
    window.addEventListener('focus', reload)
    const timer = setInterval(reload, 60000)
    return () => { window.removeEventListener('focus', reload); clearInterval(timer) }
  }, [refresh])
  const run = useCallback(async (path, body = {}, method = 'POST') => {
    if (mutation.current) throw new Error('Please wait for the current change to finish.')
    mutation.current = true; setBusy(true); setError('')
    try {
      const result = await api(path, { method, body })
      await refresh()
      return result
    } catch (failure) { setError(failure.message); throw failure }
    finally { mutation.current = false; setBusy(false) }
  }, [refresh])
  // On-demand suggestion fetch. Callers: CalendarView (once, when that page opens) and
  // DashboardView's "Refresh suggestion" button (manual). Tags the cached result with the
  // data.revision at fetch time, so consumers can detect staleness (e.g. after an approve()
  // elsewhere bumps the revision via refresh()) without this needing to auto-refetch itself.
  const fetchSuggestion = useCallback(async (kind) => {
    if (!data) return null
    setSuggestionsLoading(current => ({ ...current, [kind]: true }))
    try {
      const response = await api('/proposals', { method: 'POST', body: { kind, date: data.date } })
      setSuggestions(current => ({ ...current, [kind]: { ...response, revision: data.revision } }))
      return response
    } catch (failure) {
      setSuggestions(current => ({ ...current, [kind]: { ...(current[kind] || {}), error: failure.message } }))
      throw failure
    } finally {
      setSuggestionsLoading(current => ({ ...current, [kind]: false }))
    }
  }, [data])
  return <MoodifyContext.Provider value={{ data, error, loading, busy, refresh, run, suggestions, suggestionsLoading, fetchSuggestion }}>{children}</MoodifyContext.Provider>
}