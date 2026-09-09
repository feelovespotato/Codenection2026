import { useEffect, useRef, useState } from 'react'

const rooms = [
  {
    id: 'social',
    name: 'The Quiet Lounge',
    description: 'A warm little room for up to four people.',
  },
]

export default function RoomMap({ onBack, onEnterRoom }) {
  const [occupied, setOccupied] = useState(0)
  const visitorsRef = useRef(new Map())

  useEffect(() => {
    if (!('BroadcastChannel' in window)) return undefined
    const visitors = visitorsRef.current
    const channel = new BroadcastChannel('moodify-quiet-lounge')
    channel.onmessage = (event) => {
      const data = event.data
      if (!data?.sender) return
      if (['join', 'presence', 'move', 'chat'].includes(data.type)) visitors.set(data.sender, Date.now())
      if (data.type === 'leave') visitors.delete(data.sender)
      setOccupied(Math.min(4, visitors.size))
    }
    channel.postMessage({ type: 'count-request' })
    const cleanup = window.setInterval(() => {
      const staleBefore = Date.now() - 5500
      visitors.forEach((lastSeen, id) => {
        if (lastSeen < staleBefore) visitors.delete(id)
      })
      setOccupied(Math.min(4, visitors.size))
    }, 2000)
    return () => {
      window.clearInterval(cleanup)
      channel.close()
      visitors.clear()
    }
  }, [])

  return (
    <main className="room-map" aria-labelledby="room-map-title">
      <div className="room-map__mist room-map__mist--one" />
      <div className="room-map__mist room-map__mist--two" />

      <section className="room-phone" aria-label="Moodify room browser">
        <div className="room-phone__hardware" aria-hidden="true">
          <span className="room-phone__camera" />
          <span className="room-phone__speaker" />
        </div>

        <div className="room-phone__screen">
          <nav className="room-phone__nav" aria-label="Room browser navigation">
            <button type="button" className="room-phone__back" onClick={onBack} aria-label="Back to my room">
              <span aria-hidden="true">←</span>
            </button>
            <div>
              <span className="room-phone__brand">Moodify</span>
              <strong>Cozy rooms</strong>
            </div>
            <span className="room-phone__signal" aria-hidden="true">●</span>
          </nav>

          <div className="room-phone__scroll">
            <header className="room-map__heading">
              <p className="room-map__eyebrow">Room finder</p>
              <h1 id="room-map-title">Find a quiet place</h1>
              <p>Scroll, choose a room, and join whenever you feel ready.</p>
            </header>

            <div className="room-map__grid">
              {rooms.map((room) => (
                <article className="room-card" key={room.id}>
                  <div className="room-card__preview">
                    <img
                      src="/moodify/social-backgrounds/large-cozy-room.png"
                      alt="Warm isometric pixel-art preview of the Quiet Lounge"
                    />
                    <span className="room-card__capacity" aria-label={`${occupied} / 4 places occupied`}>
                      <span className="room-card__dot" /> {occupied} / 4
                    </span>
                  </div>
                  <div className="room-card__body">
                    <div>
                      <p className="room-card__tag">Open now · anonymous</p>
                      <h2>{room.name}</h2>
                      <p>{room.description}</p>
                    </div>
                    <button type="button" className="pixel-button" onClick={() => onEnterRoom(room.id)}>
                      Enter room <span aria-hidden="true">→</span>
                    </button>
                  </div>
                </article>
              ))}
            </div>

            <p className="room-map__note">
              Rooms hold four anonymous visitors. When someone leaves, their place quietly opens for the next person.
            </p>
            <div className="room-phone__scroll-cue" aria-hidden="true">⌄</div>
          </div>
        </div>

        <div className="room-phone__home" aria-hidden="true" />
      </section>
    </main>
  )
}
