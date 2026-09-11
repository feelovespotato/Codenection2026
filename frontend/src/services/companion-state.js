const headers = { 'Content-Type': 'application/json', 'X-Moodify-Client': 'web' }

export async function readCompanionState() {
  const response = await fetch('/api/companion-state')
  if (!response.ok) throw new Error('Could not read companion state.')
  return response.json()
}

export async function updateCompanionState(update) {
  const response = await fetch('/api/companion-state', { method: 'PATCH', headers, body: JSON.stringify(update) })
  if (!response.ok) throw new Error('Could not update companion state.')
  return response.json()
}
