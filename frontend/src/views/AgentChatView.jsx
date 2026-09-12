import { useEffect, useRef, useState } from 'react'
import PixelIcon from '../components/PixelIcon.jsx'
import { sendAgentMessage } from '../services/agent.js'

const SpeechRecognitionApi = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null

const timeLabel = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

export default function AgentChatView() {
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

  const recognitionRef = useRef(null)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

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

  const handleSend = async (event) => {
    event.preventDefault()
    const text = input.trim()
    if (!text || sending) return
    if (listening) toggleListening()

    // The AI agent lives on the backend; the frontend only forwards the
    // message plus prior turns as conversational context.
    const history = messages.map((message) => ({ role: message.role, content: message.text }))

    setMessages((prev) => [...prev, { role: 'user', text, time: timeLabel() }])
    setInput('')
    setSendError('')
    setSending(true)
    try {
      const reply = await sendAgentMessage(text, history)
      setMessages((prev) => [...prev, { role: 'assistant', text: reply, time: timeLabel() }])
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
        <div className="flex flex-col items-center rounded-2xl border border-stone-200 bg-white p-4 text-center shadow-sm lg:sticky lg:top-0">
          <img
            src="/companion/girl-sitting.png"
            alt="Your Moodify companion, sitting cross-legged and listening"
            className="w-40 select-none sm:w-48 lg:w-full lg:max-w-[220px]"
            draggable="false"
          />
          <p className="mt-3 text-sm font-bold text-stone-800">Moodify is listening</p>
          <p className="mt-1 text-xs leading-relaxed text-stone-500">
            Talk it through out loud or by typing.
          </p>
        </div>
      </div>

      {/* Main column: the conversation */}
      <div className="order-1 flex flex-col lg:order-2 lg:col-span-8">
        <div className="flex h-[460px] flex-col rounded-2xl border border-stone-200 bg-stone-50/50 shadow-inner overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((message, index) => {
              const isUser = message.role === 'user'
              return (
                <div key={index} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} animate-in fade-in duration-200`}>
                  <div
                    className={`max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed shadow-sm ${
                      isUser
                        ? 'bg-amber-500 text-white rounded-br-xs'
                        : 'bg-white border border-stone-200 text-stone-800 rounded-bl-xs'
                    }`}
                  >
                    <p className="whitespace-pre-line font-medium">{message.text}</p>
                  </div>
                  <span className="mt-1 px-1 text-[10px] text-stone-400">{message.time}</span>
                </div>
              )
            })}

            {sending && (
              <div className="flex flex-col items-start">
                <div className="max-w-[85%] rounded-2xl border border-stone-200 bg-white p-3.5 text-xs text-stone-500 shadow-sm rounded-bl-xs">
                  Moodify is thinking…
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {(sendError || voiceError) && (
            <div role="alert" className="border-t border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-900">
              {sendError || voiceError}
            </div>
          )}

          <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-stone-200 bg-white p-3">
            {SpeechRecognitionApi && (
              <button
                type="button"
                onClick={toggleListening}
                aria-pressed={listening}
                aria-label={listening ? 'Stop voice input' : 'Speak your message'}
                title={listening ? 'Stop voice input' : 'Speak your message'}
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-base ${
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
              className="flex-1 rounded-lg border border-stone-200 bg-stone-50/50 px-3.5 py-2 text-sm text-stone-800 placeholder-stone-400 focus:border-amber-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-200/50"
            />
            <button
              type="submit"
              disabled={!input.trim() || sending}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition disabled:opacity-50 active:scale-95"
            >
              Send
            </button>
          </form>
        </div>

        {!SpeechRecognitionApi && (
          <p className="mt-2 text-[11px] text-stone-400">Voice input isn't supported in this browser — typing still works.</p>
        )}
      </div>
    </div>
  )
}