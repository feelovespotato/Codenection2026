import { useMoodify } from '../services/moodify-context.js'
export default function BackendStatus() {
  const { error, loading, refresh } = useMoodify()
  if (loading) return <p role="status" className="rounded-xl bg-stone-100 p-4 text-sm text-stone-700">Loading your calendar and capacity…</p>
  if (!error) return null
  return <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
    <p>{error}</p>
    <button type="button" className="mt-2 font-bold underline" onClick={() => refresh().catch(() => {})}>Retry connection</button>
  </div>
}
