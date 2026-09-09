import { useEffect, useRef, useState } from 'react'
import { createSocialRoomGame } from './SocialRoomGame.js'

const ROOM_CHANNEL = 'moodify-quiet-lounge'

export default function SocialRoom({ onBackToMap }) {
  const gameHostRef = useRef(null)
  const gameRef = useRef(null)
  const channelRef = useRef(null)
  const knownVisitorsRef = useRef(new Map())
  const visitorIdRef = useRef(null)
  const messagesRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [occupants, setOccupants] = useState(1)
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState([])

  useEffect(() => {
    let cancelled = false
    let game
    const visitorId = crypto.randomUUID()
    visitorIdRef.current = visitorId
    const knownVisitors = knownVisitorsRef.current
    const channel = 'BroadcastChannel' in window ? new BroadcastChannel(ROOM_CHANNEL) : null
    channelRef.current = channel

    const addVisitor = (id, style = 1, position) => {
      if (!id || id === visitorId) return
      const isKnown = knownVisitors.has(id)
      if (!isKnown && knownVisitors.size >= 3) return
      knownVisitors.set(id, Date.now())
      if (isKnown) return
      gameRef.current?.addRemotePlayer(id, style, position)
      setOccupants(1 + knownVisitors.size)
    }

    if (channel) {
      channel.onmessage = (event) => {
        const data = event.data
        if (!data || data.sender === visitorId) return

        if (data.type === 'join') {
          addVisitor(data.sender, data.style, data.position)
          channel.postMessage({ type: 'presence', sender: visitorId, style: 0, position: gameRef.current?.getLocalPosition() })
        }
        if (data.type === 'count-request') {
          channel.postMessage({ type: 'presence', sender: visitorId, style: 0, position: gameRef.current?.getLocalPosition() })
        }
        if (data.type === 'presence') addVisitor(data.sender, data.style, data.position)
        if (data.type === 'move') {
          addVisitor(data.sender, data.style, data.position)
          gameRef.current?.moveRemotePlayer(data.sender, data.position)
        }
        if (data.type === 'leave') {
          knownVisitors.delete(data.sender)
          gameRef.current?.removeRemotePlayer(data.sender)
          setOccupants(1 + knownVisitors.size)
        }
        if (data.type === 'chat' && typeof data.text === 'string') {
          addVisitor(data.sender, data.style)
          gameRef.current?.showChatBubble(data.sender, data.text)
          setMessages((current) => [
            ...current,
            { id: `${data.sender}-${Date.now()}`, author: 'Someone nearby', text: data.text.slice(0, 120) },
          ].slice(-50))
        }
      }
    }

    createSocialRoomGame(gameHostRef.current, {
      onMove: (position) => channel?.postMessage({ type: 'move', sender: visitorId, style: 0, position }),
    }).then((created) => {
      if (cancelled) {
        created.destroy()
        return
      }
      game = created
      gameRef.current = created
      setLoading(false)
      channel?.postMessage({ type: 'join', sender: visitorId, style: 0, position: created.getLocalPosition() })
    })

    const heartbeat = window.setInterval(() => {
      channel?.postMessage({ type: 'presence', sender: visitorId, style: 0, position: gameRef.current?.getLocalPosition() })
      const staleBefore = Date.now() - 5500
      knownVisitors.forEach((lastSeen, id) => {
        if (lastSeen >= staleBefore) return
        knownVisitors.delete(id)
        gameRef.current?.removeRemotePlayer(id)
      })
      setOccupants(1 + knownVisitors.size)
    }, 2000)

    return () => {
      cancelled = true
      channel?.postMessage({ type: 'leave', sender: visitorId })
      window.clearInterval(heartbeat)
      channel?.close()
      channelRef.current = null
      game?.destroy()
      gameRef.current = null
      knownVisitors.clear()
      visitorIdRef.current = null
    }
  }, [])

  useEffect(() => {
    const messageList = messagesRef.current
    if (messageList) messageList.scrollTop = messageList.scrollHeight
  }, [messages])

  const sendMessage = (event) => {
    event.preventDefault()
    const text = message.trim()
    if (!text) return
    setMessages((current) => [...current, { id: `me-${Date.now()}`, author: 'You', text }].slice(-50))
    gameRef.current?.showLocalChatBubble(text)
    channelRef.current?.postMessage({ type: 'chat', sender: visitorIdRef.current, style: 0, text })
    setMessage('')
  }

  return (
    <main className="social-room-game" aria-label="The Quiet Lounge multiplayer room">
      <div className="social-room-game__frame">
        <div ref={gameHostRef} className="social-game-canvas" />

        {loading && <div className="social-room-game__loading">Opening the lounge…</div>}

        <div className="social-room-game__status" aria-label="Room capacity">
          <span className="social-room-game__online-dot" />
          Quiet Lounge · {occupants} / 4
        </div>

        <button type="button" className="social-room-game__back" onClick={onBackToMap}>
          <span aria-hidden="true">←</span> Room map
        </button>

        <section className="room-chat" aria-label="Room chat">
          <div ref={messagesRef} className="room-chat__messages" aria-live="polite" tabIndex="0">
            {messages.length === 0 && (
              <p className="room-chat__empty">The room is quiet. Say hello when someone joins.</p>
            )}
            {messages.map((item) => (
              <p className={item.author === 'You' ? 'is-mine' : ''} key={item.id}>
                <span>{item.author}</span>
                {item.text}
              </p>
            ))}
          </div>
          <form className="room-chat__form" onSubmit={sendMessage}>
            <input
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={120}
              placeholder="Say something kind…"
              aria-label="Chat message"
            />
            <button type="submit" aria-label="Send message">Send</button>
          </form>
        </section>

        <p className="social-room-game__hint">Move with WASD or arrow keys</p>

        <div className="room-dpad" aria-label="Movement controls">
          {[
            ['up', '↑'],
            ['left', '←'],
            ['down', '↓'],
            ['right', '→'],
          ].map(([direction, symbol]) => (
            <button
              type="button"
              key={direction}
              aria-label={`Move ${direction}`}
              onPointerDown={() => gameRef.current?.setDirection(direction, true)}
              onPointerUp={() => gameRef.current?.setDirection(direction, false)}
              onPointerLeave={() => gameRef.current?.setDirection(direction, false)}
              onPointerCancel={() => gameRef.current?.setDirection(direction, false)}
            >{symbol}</button>
          ))}
        </div>
      </div>
    </main>
  )
}
