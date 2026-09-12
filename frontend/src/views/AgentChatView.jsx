import { useEffect, useRef, useState } from 'react'
import PixelIcon from '../components/PixelIcon.jsx'
import { sendAgentMessage } from '../services/agent.js'
import { api } from '../services/api.js'
import { StorageService } from '../services/storage.js'
import { useMoodify } from '../services/moodify-context.js'

const SpeechRecognitionApi = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null

const timeLabel = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

export default function AgentChatView() {
  const { data, run } = useMoodify()
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: "Hi, I'm here with you. Type or tap the mic and tell me what's going on — your workload, how you're feeling, anything. I will help you handle it.",
      time: timeLabel(),
    },
  ])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [listening, setListening] = useState(false)
  const [voiceError, setVoiceError] = useState('')

  const [planningState, setPlanningState] = useState({ active: false })

  const recognitionRef = useRef(null)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const messagesRef = useRef(messages)
  const planningStateRef = useRef(planningState)

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    planningStateRef.current = planningState
  }, [planningState])

  useEffect(() => {
    return () => {
      const history = messagesRef.current
      const finalPlanningState = planningStateRef.current

      // If the conversation was entirely in PLANNING_MODE, skip saving to diary
      if (finalPlanningState.sourceConversationType === 'PLANNING_MODE') return

      if (history.length > 2) {
        // Filter out calendar-management messages from the diary
        // In a real app we might ask the AI to filter, but here we just pass the history
        // to /conclusion and let the AI do its summary. We should pass the fact that it's a mixed conversation if needed.
        api('/agent-chat/conclusion', {
          method: 'POST',
          body: { history: history.map(m => ({ role: m.role, content: m.text })) },
        })
          .then((data) => {
            const now = new Date()
            StorageService.saveDiaryEntry({
              title: 'Chat Reflection',
              content: data.conclusion,
              emotion: data.emotion || 'thoughtful',
              date: now.toISOString(),
            })
            if (data.mood) {
              StorageService.saveMoodLog({
                mood: data.mood,
                rating: data.intensity || 5,
                tags: data.tags || [],
                note: data.note || 'Generated from chat session.',
                date: now.toISOString().split('T')[0],
                timestamp: now.toISOString(),
              })
            }
          })
          .catch((err) => console.error('Failed to save chat conclusion:', err))
      }
    }
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  // Set up the browser's speech-to-text engine once. Recognized speech is
  // written into the same text field the user can type in, so both input
  // paths share one send flow.
  useEffect(() => {
    if (!SpeechRecognitionApi) return undefined
    const recognition = new SpeechRecognitionApi()
    recognition.lang = 'en-US'
    recognition.interimResults = false
    recognition.continuous = false

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript || '')
        .join(' ')
        .trim()
      if (transcript) {
        setInput((prev) => (prev.trim() ? `${prev.trim()} ${transcript}` : transcript))
      }
    }
    recognition.onerror = (event) => {
      setListening(false)
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setVoiceError('Microphone access was blocked. Allow it in your browser settings to speak your message.')
      } else if (event.error !== 'aborted' && event.error !== 'no-speech') {
        setVoiceError('Voice input had trouble hearing you. Please try again or type instead.')
      }
    }
    recognition.onend = () => setListening(false)

    recognitionRef.current = recognition
    return () => {
      recognition.onresult = null
      recognition.onerror = null
      recognition.onend = null
      recognition.abort()
    }
  }, [])

  const toggleListening = () => {
    const recognition = recognitionRef.current
    if (!recognition) return
    setVoiceError('')
    if (listening) {
      recognition.stop()
      setListening(false)
      return
    }
    try {
      recognition.start()
      setListening(true)
    } catch {
      setVoiceError('Could not start the microphone. Please check your browser permissions.')
    }
  }

  const executeAction = async (syncToGoogle, actionToRun = pendingAction) => {
    if (!actionToRun) return
    setPendingAction(null)
    setSending(true)
    setSendError('')
    try {
      const { type, event: actionEvent, eventId } = actionToRun
      const id = actionEvent?.id || eventId
      
      if (type === 'CREATE_EVENT' || type === 'UPDATE_EVENT') {
         const body = {
           title: actionEvent.title,
           start: `${actionEvent.date}T${actionEvent.startTime || '00:00'}:00`,
           end: `${actionEvent.date}T${actionEvent.endTime || '00:00'}:00`,
           category: actionEvent.category || 'auto',
           isFlexible: actionEvent.isFlexible ?? true
         }
         let res;
         if (type === 'CREATE_EVENT') res = await run('/events', body, 'POST')
         else res = await run(`/events/${id}`, body, 'PATCH')
         
         if (syncToGoogle && res?.event?.id && data?.google?.canWrite) {
             await run(`/events/${res.event.id}/upload-google`, { approved: true }, 'POST')
         }
      }
      else if (type === 'DELETE_EVENT') {
         await run(`/events/${id}`, null, 'DELETE')
      }
    } catch (failure) {
      setSendError(failure.message)
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  const handleDeleteChoice = async (choice, id) => {
    setPendingDelete(null)
    setSending(true)
    setSendError('')
    try {
      if (choice === 'moodify' || choice === 'both') {
        await run(`/events/${id}`, null, 'DELETE')
      }
      // Note: 'Google only' would require an API endpoint we don't currently expose
    } catch (failure) {
      setSendError(failure.message)
    } finally {
      setSending(false)
    }
  }
  
  const [pendingAction, setPendingAction] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)

  const handleSend = async (event) => {
    event.preventDefault()
    const text = input.trim()
    if (!text || sending) return
    if (listening) toggleListening()

    const history = messages.map((message) => ({ role: message.role, content: message.text }))
    setMessages((prev) => [...prev, { role: 'user', text, time: timeLabel() }])
    setInput('')
    setSendError('')
    setSending(true)
    try {
      const response = await sendAgentMessage(text, history, planningState, data?.events || [])
      setMessages((prev) => [...prev, { role: 'assistant', text: response.reply, time: timeLabel() }])
      
      if (response.planningState) setPlanningState(response.planningState)
      if (response.calendarAction) {
        const { type, event: actionEvent, eventId } = response.calendarAction
        const id = actionEvent?.id || eventId
        
        if (type === 'DELETE_EVENT') {
           const existing = data?.events?.find(e => e.id === id)
           if (existing && existing.syncToGoogle) {
             setPendingDelete(existing)
           } else {
             await executeAction(false, response.calendarAction)
           }
        } else {
           setPendingAction(response.calendarAction)
        }
      }
    } catch (failure) {
      setSendError(failure.message)
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Side column: the companion, drawn as though she's sitting and listening */}
      <div className="order-2 lg:order-1 lg:col-span-4">
        <div className="flex flex-col items-center rounded-2xl border border-stone-200 bg-white p-6 text-center shadow-sm lg:sticky lg:top-0">
          <img
            src="/companion/girl-sitting.png"
            alt="Your Moodify companion, sitting cross-legged and listening"
            className="w-40 select-none sm:w-48 lg:w-full lg:max-w-[220px]"
            draggable="false"
          />
          <p className="mt-4 text-base sm:text-lg font-bold text-stone-800">Moodify is listening</p>
          <p className="mt-1.5 text-sm leading-relaxed text-stone-500">
            Talk it through out loud or by typing.
          </p>
        </div>
      </div>

      {/* Main column: the conversation */}
      <div className="order-1 flex flex-col lg:order-2 lg:col-span-8">
        <div className="flex h-[600px] flex-col rounded-2xl border border-stone-200 bg-stone-50/50 shadow-inner overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
            {messages.map((message, index) => {
              const isUser = message.role === 'user'
              return (
                <div key={index} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} animate-in fade-in duration-200`}>
                  <div
                    className={`max-w-[85%] rounded-2xl p-4 sm:p-5 text-base leading-relaxed shadow-sm ${
                      isUser
                        ? 'bg-amber-500 text-white rounded-br-xs'
                        : 'bg-white border border-stone-200 text-stone-800 rounded-bl-xs'
                    }`}
                  >
                    <p className="whitespace-pre-line font-medium">{message.text}</p>
                  </div>
                  <span className="mt-1 px-2 text-xs text-stone-400">{message.time}</span>
                </div>
              )
            })}

            {sending && (
              <div className="flex flex-col items-start">
                <div className="max-w-[85%] flex items-center gap-2 rounded-2xl border border-stone-200 bg-white px-5 py-5 shadow-sm rounded-bl-xs">
                  <span className="h-2 w-2 rounded-full bg-stone-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="h-2 w-2 rounded-full bg-stone-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="h-2 w-2 rounded-full bg-stone-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            
            {pendingAction && (
              <div className="flex flex-col items-start animate-in fade-in duration-200">
                <div className="max-w-[85%] rounded-2xl p-5 text-base shadow-sm bg-white border border-stone-200 text-stone-800 rounded-bl-xs">
                  <p className="font-medium mb-3">Where should I save it?</p>
                  <div className="flex flex-col gap-2">
                    <button onClick={() => executeAction(false)} className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50">Moodify only</button>
                    {data?.google?.connected ? (
                      <button onClick={() => executeAction(true)} className="rounded-xl bg-amber-700 px-4 py-2 text-sm font-bold text-white hover:bg-amber-800">Moodify + Google</button>
                    ) : (
                      <button onClick={() => {
                        api('/google/connect', { method: 'POST', body: { write: true } })
                          .then(res => { if (res.url) window.location.assign(res.url) })
                      }} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">Connect Google</button>
                    )}
                    <button onClick={() => setPendingAction(null)} className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50">Cancel</button>
                  </div>
                </div>
              </div>
            )}

            {pendingDelete && (
              <div className="flex flex-col items-start animate-in fade-in duration-200">
                <div className="max-w-[85%] rounded-2xl p-5 text-base shadow-sm bg-white border border-stone-200 text-stone-800 rounded-bl-xs">
                  <p className="font-medium mb-3">delete from where?</p>
                  <div className="flex flex-col gap-2">
                    <button onClick={() => handleDeleteChoice('moodify', pendingDelete.id)} className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50">Moodify only</button>
                    <button onClick={() => handleDeleteChoice('both', pendingDelete.id)} className="rounded-xl bg-rose-700 px-4 py-2 text-sm font-bold text-white hover:bg-rose-800">Both</button>
                    <button onClick={() => setPendingDelete(null)} className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50">Cancel</button>
                  </div>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {(sendError || voiceError) && (
            <div role="alert" className="border-t border-rose-200 bg-rose-50 px-5 py-3 text-sm text-rose-900">
              {sendError || voiceError}
            </div>
          )}

          <form onSubmit={handleSend} className="flex items-center gap-3 border-t border-stone-200 bg-white p-4">
            {SpeechRecognitionApi && (
              <button
                type="button"
                onClick={toggleListening}
                aria-pressed={listening}
                aria-label={listening ? 'Stop voice input' : 'Speak your message'}
                title={listening ? 'Stop voice input' : 'Speak your message'}
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border text-xl ${
                  listening ? 'border-rose-400 bg-rose-100 text-rose-700 animate-pulse' : 'border-stone-200 bg-stone-50 text-stone-600'
                }`}
              >
                <PixelIcon symbol={listening ? '⏹️' : '🎤'} />
              </button>
            )}
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={listening ? 'Listening…' : 'Type how you feel, or ask for help…'}
              aria-label="Message to your Moodify companion"
              className="flex-1 rounded-lg border border-stone-200 bg-stone-50/50 px-4 py-3 text-lg text-stone-800 placeholder-stone-400 focus:border-amber-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-200/50"
            />
            <button
              type="submit"
              disabled={!input.trim() || sending}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 px-5 py-3 text-base sm:text-lg font-semibold text-white shadow-md transition disabled:opacity-50 active:scale-95"
            >
              Send
            </button>
          </form>
        </div>

        {!SpeechRecognitionApi && (
          <p className="mt-2 text-xs text-stone-400">Voice input isn't supported in this browser — typing still works.</p>
        )}
      </div>
    </div>
  )
}