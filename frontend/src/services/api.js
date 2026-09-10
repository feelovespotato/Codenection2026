export async function api(path, options = {}) {
  let response
  try {
    response = await fetch(`/api${path}`, {
      credentials: 'same-origin', ...options,
      headers: { 'Content-Type': 'application/json', 'X-Moodify-Client': 'web', ...options.headers },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
  } catch { throw new Error('Cannot reach the backend. Start the app with npm run dev, then retry.') }
  const data = await response.json().catch(() => null)
  if (!response.ok || !data) throw new Error(data?.error || 'The backend did not return a valid response. Please retry.')
  return data
}
