import PixelIcon from '../components/PixelIcon.jsx'
import { useState, useRef, useEffect } from 'react'
import { useMoodify } from '../services/moodify-context.js'
import BackendStatus from '../components/BackendStatus.jsx'

const CHECKIN_OPTIONS = [
  { score: 1, emoji: '😌', label: 'Very Low', desc: 'Feeling calm, clear-headed, and well-rested.' },
  { score: 2, emoji: '🙂', label: 'Low', desc: 'Workload is comfortable and completely manageable.' },
  { score: 3, emoji: '😐', label: 'Moderate', desc: 'Noticeable pressure, but holding things together.' },
  { score: 4, emoji: '😣', label: 'High', desc: 'Strained, feeling rushed or anxious about deadlines.' },
  { score: 5, emoji: '😫', label: 'Overloaded', desc: 'Exhausted or overwhelmed. Immediate recharge needed.' },
]

const QUIZ_QUESTIONS = [
  {
    q: 'How often do you feel overwhelmed by your responsibilities?',
    options: ['Rarely', 'Sometimes', 'Frequently', 'Always'],
    scores: [1, 2, 3, 4],
  },
  {
    q: 'Do you have trouble sleeping due to racing thoughts?',
    options: ['Never', 'Sometimes', 'Often', 'Every night'],
    scores: [1, 2, 3, 4],
  },
  {
    q: 'How often do you feel anxious or worried?',
    options: ['Seldom', 'Occasionally', 'Often', 'Constantly'],
    scores: [1, 2, 3, 4],
  },
  {
    q: 'Do you experience physical symptoms like headaches or tension when stressed?',
    options: ['Rarely', 'Sometimes', 'Frequently', 'Always'],
    scores: [1, 2, 3, 4],
  },
  {
    q: "How often do you feel like you can't handle everything on your plate?",
    options: ['Never', 'Sometimes', 'Often', 'Always'],
    scores: [1, 2, 3, 4],
  },
  {
    q: 'Do you find it hard to relax even during your free time?',
    options: ['Rarely', 'Sometimes', 'Frequently', 'Always'],
    scores: [1, 2, 3, 4],
  },
  {
    q: 'Do you feel emotionally drained at the end of the day?',
    options: ['Rarely', 'Occasionally', 'Most days', 'Every day'],
    scores: [1, 2, 3, 4],
  },
  {
    q: 'How often do you feel irritable or short-tempered?',
    options: ['Almost never', 'Sometimes', 'Frequently', 'Very often'],
    scores: [1, 2, 3, 4],
  },
  {
    q: 'Do you feel a lack of motivation or mental energy?',
    options: ['Rarely', 'Sometimes', 'Often', 'Constantly'],
    scores: [1, 2, 3, 4],
  },
  {
    q: 'How often do you procrastinate tasks due to feeling overwhelmed?',
    options: ['Rarely', 'Sometimes', 'Often', 'Always'],
    scores: [1, 2, 3, 4],
  },
]

export default function StressQuizView({ onCheckInComplete }) {
  const { data, busy, run } = useMoodify()
  const [saveError, setSaveError] = useState('')
  const [activeTab, setActiveTab] = useState('checkin') // 'checkin' | 'quiz'
  const selectedQuickScore = data?.checkin?.score ?? null
  const [quickSavedToast, setQuickSavedToast] = useState(false)

  // Chat Quiz State
  const [chatMessages, setChatMessages] = useState([
    {
      sender: 'bot',
      text: "Hello! Let's assess your current stress levels with 10 quick questions. Take your time and select what feels true for you.",
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
    {
      sender: 'bot',
      text: `Q1: ${QUIZ_QUESTIONS[0].q}`,
      options: QUIZ_QUESTIONS[0].options,
      questionIdx: 0,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ])
  const [quizScores, setQuizScores] = useState([])
  const [quizCompleted, setQuizCompleted] = useState(false)
  const [finalScoreSummary, setFinalScoreSummary] = useState(null)

  const chatBottomRef = useRef(null)

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  // Quick 1-5 Check-in Save
  const handleQuickCheckIn = async (score) => {
    setSaveError(''); setQuickSavedToast(false)
    try {
      await run('/checkins', { score })
      setQuickSavedToast(true)
      onCheckInComplete?.()
      setTimeout(() => setQuickSavedToast(false), 3000)
    } catch (failure) { setSaveError(failure.message) }
  }

  // Answer a question in the Quiz
  const handleAnswerQuestion = (optText, questionIdx) => {
    const question = QUIZ_QUESTIONS[questionIdx]
    const optIdx = question.options.indexOf(optText)
    const scoreVal = question.scores[optIdx]
    const updatedScores = [...quizScores, scoreVal]
    setQuizScores(updatedScores)

    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    // Add user reply message
    const nextQuestionIdx = questionIdx + 1
    const newMessages = [
      ...chatMessages.map((m) => ({ ...m, options: null })), // disable previous options
      { sender: 'user', text: optText, time: now },
    ]

    if (nextQuestionIdx < QUIZ_QUESTIONS.length) {
      newMessages.push({
        sender: 'bot',
        text: `Q${nextQuestionIdx + 1}: ${QUIZ_QUESTIONS[nextQuestionIdx].q}`,
        options: QUIZ_QUESTIONS[nextQuestionIdx].options,
        questionIdx: nextQuestionIdx,
        time: now,
      })
    } else {
      // Finished all 10 questions!
      const total = updatedScores.reduce((a, b) => a + b, 0)
      let ratingLevel = 'Mild'
      let mappedScore = 2
      let tip = 'You are managing your workload healthily. Maintain your recovery habits!'

      if (total >= 32) {
        ratingLevel = 'High / Critical'
        mappedScore = 5
        tip = 'Your stress response is significantly elevated. We strongly recommend shedding low-priority tasks and taking a 15-minute breathing session.'
      } else if (total >= 24) {
        ratingLevel = 'Elevated'
        mappedScore = 4
        tip = 'You are carrying substantial strain. Consider rescheduling flexible commitments for tomorrow.'
      } else if (total >= 17) {
        ratingLevel = 'Moderate'
        mappedScore = 3
        tip = 'Your stress is at a typical midpoint. Plan a quiet recharge activity after your main study blocks.'
      }

      // The optional survey is reflection only. Only the explicit daily 1–5 check-in updates capacity.

      setFinalScoreSummary({ total, ratingLevel, mappedScore, tip })
      setQuizCompleted(true)

      newMessages.push({
        sender: 'bot',
        text: `🎉 Survey complete! Your Total Score is ${total}/40 (${ratingLevel} Stress).\n\n💡 Recommendation: ${tip}`,
        time: now,
      })
    }

    setChatMessages(newMessages)
  }

  const handleRestartQuiz = () => {
    setQuizScores([])
    setQuizCompleted(false)
    setFinalScoreSummary(null)
    setChatMessages([
      {
        sender: 'bot',
        text: "Let's restart the assessment.",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
      {
        sender: 'bot',
        text: `Q1: ${QUIZ_QUESTIONS[0].q}`,
        options: QUIZ_QUESTIONS[0].options,
        questionIdx: 0,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ])
  }

  return (
    <div className="space-y-6">
      <BackendStatus />
      {saveError && <p role="alert" className="text-sm text-rose-700">{saveError}</p>}
      {busy && <p role="status" className="text-sm text-stone-600">Saving your check-in…</p>}
      {/* Tabs */}
      <div className="flex justify-center">
        <div className="inline-flex rounded-xl bg-stone-100 p-2">
          <button
            type="button"
            onClick={() => setActiveTab('checkin')}
            aria-pressed={activeTab === 'checkin'}
            className={`rounded-lg px-6 py-3 text-sm sm:text-base font-bold transition ${
              activeTab === 'checkin'
                ? 'bg-white text-stone-800 shadow-sm'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            ⚡ Quick 1–5 Check-In
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('quiz')}
            aria-pressed={activeTab === 'quiz'}
            className={`rounded-lg px-6 py-3 text-sm sm:text-base font-bold transition ${
              activeTab === 'quiz'
                ? 'bg-white text-stone-800 shadow-sm'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            📋 10-Question Chat Assessment
          </button>
        </div>
      </div>

      {/* Tab 1: One-Tap Daily Check-in */}
      {activeTab === 'checkin' && (
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="rounded-2xl border border-stone-200 bg-white p-8 sm:p-10 shadow-sm text-center">
            <h3 className="text-xl sm:text-2xl font-bold text-stone-800">How heavy does today feel?</h3>

            <div className="mt-8 grid grid-cols-5 gap-4">
              {CHECKIN_OPTIONS.map((opt) => {
                const isSelected = selectedQuickScore === opt.score
                return (
                  <button
                    key={opt.score}
                    type="button"
                    disabled={busy || !data}
                    aria-pressed={isSelected}
                    onClick={() => handleQuickCheckIn(opt.score)}
                    className={`flex flex-col items-center justify-center rounded-2xl border-2 p-4 sm:p-5 transition active:scale-95 ${
                      isSelected
                        ? 'border-amber-500 bg-amber-50 shadow-md scale-105'
                        : 'border-stone-200 bg-white hover:border-amber-200 hover:bg-stone-50'
                    }`}
                  >
                    <span className="text-4xl sm:text-5xl"><PixelIcon symbol={opt.emoji} /></span>
                    <span className="mt-2 text-sm sm:text-base font-black text-stone-800">{opt.score}</span>
                    <span className="text-xs sm:text-sm text-stone-500">{opt.label}</span>
                  </button>
                )
              })}
            </div>

            {/* Selected Option Explainer */}
            <div className="mt-8 rounded-xl bg-amber-50/60 border border-amber-200/60 p-4 sm:p-5">
              <span className="text-sm sm:text-base font-semibold text-amber-900">
                {CHECKIN_OPTIONS.find((o) => o.score === selectedQuickScore)?.desc || 'Optional: choose how you feel today. Without a check-in, capacity uses objective load only.'}
              </span>
            </div>

            {quickSavedToast && (
              <div className="mt-5 text-sm sm:text-base font-bold text-emerald-600 animate-bounce">
                ✓ Recorded! Capacity Gauge updated.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Interactive Chat Quiz */}
      {activeTab === 'quiz' && (
        <div className="mx-auto max-w-4xl">
          <p className="mb-4 text-sm sm:text-base text-stone-600">Reflection only. This survey does not replace your daily check-in or change capacity.</p>
          <div className="flex h-[600px] flex-col rounded-2xl border border-stone-200 bg-stone-50/50 shadow-inner overflow-hidden">
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
              {chatMessages.map((msg, i) => {
                const isUser = msg.sender === 'user'
                return (
                  <div
                    key={i}
                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} animate-in fade-in duration-200`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl p-4 sm:p-5 text-base leading-relaxed shadow-sm ${
                        isUser
                          ? 'bg-amber-500 text-white rounded-br-xs'
                          : 'bg-white border border-stone-200 text-stone-800 rounded-bl-xs'
                      }`}
                    >
                      <p className="whitespace-pre-line font-medium">{msg.text}</p>
                    </div>
                    <span className="mt-1 px-2 text-xs text-stone-400">{msg.time}</span>

                    {/* Interactive Options Buttons */}
                    {msg.options && (
                      <div className="mt-3 flex flex-wrap gap-3">
                        {msg.options.map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => handleAnswerQuestion(opt, msg.questionIdx)}
                            className="rounded-xl border border-amber-300 bg-amber-100/70 px-4 py-2 text-sm sm:text-base font-bold text-amber-900 shadow-sm transition hover:bg-amber-200 active:scale-95"
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
              <div ref={chatBottomRef} />
            </div>

            {/* Quiz Footer / Reset */}
            {quizCompleted && finalScoreSummary && (
              <div className="border-t border-stone-200 bg-white p-5 sm:p-6 space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-sm sm:text-base font-bold text-stone-800">
                      Score: {finalScoreSummary.total}/40 — {finalScoreSummary.ratingLevel}
                    </span>
                    <p className="text-xs sm:text-sm text-stone-500">{finalScoreSummary.tip}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRestartQuiz}
                    className="rounded-lg border border-stone-200 px-4 py-2 text-sm sm:text-base font-semibold text-stone-600 hover:bg-stone-50"
                  >
                    Retake
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
