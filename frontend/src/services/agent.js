import { api } from './api.js'

// Frontend contract for the backend AI agent (implemented separately).
// POST /api/agent-chat
//   body:     { message: string, history: Array<{ role: 'user' | 'assistant', content: string }> }
//   response: { reply: string }
// `history` is sent so the agent has conversational context; it excludes the
// in-flight `message`, which is passed separately.
export async function sendAgentMessage(message, history = [], planningState = {}, calendarEvents = []) {
  const data = await api('/agent-chat', {
    method: 'POST',
    body: { message, history, planningState, calendarEvents },
  })
  if (typeof data?.reply !== 'string' || !data.reply.trim()) {
    throw new Error('Moodify did not send back a reply. Please try again.')
  }
  return data
}