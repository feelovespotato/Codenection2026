import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api.js'
import { MoodifyContext } from './moodify-context.js'

export default function MoodifyProvider({ children }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
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
  return <MoodifyContext.Provider value={{ data, error, loading, busy, refresh, run }}>{children}</MoodifyContext.Provider>
}
