export const TRACKS = [
  { id: 'rain', name: 'Gentle Rain', file: '/audio/rain.mp3', emoji: '🌧️' },
  { id: 'forest', name: 'Peaceful Forest', file: '/audio/forest.mp3', emoji: '🌲' },
  { id: 'calm_piano', name: 'Calm Piano', file: '/audio/calm_piano.mp3', emoji: '🎹' },
  { id: 'bird', name: 'Morning Birds', file: '/audio/bird.mp3', emoji: '🐦' },
  { id: 'ocean', name: 'Ocean Waves', file: '/audio/ocean.mp3', emoji: '🌊' },
  { id: 'waterfall', name: 'Cascade Waterfall', file: '/audio/waterfall.mp3', emoji: '💧' },
  { id: 'keyboard', name: 'Study Typing', file: '/audio/keyboard.mp3', emoji: '💻' },
  { id: 'lofi_music', name: 'Lo-Fi Chill', file: '/audio/lofi_music.wav', emoji: '🎧' },
]

// Owned by App, so closing a modal never disposes playback or its sleep timer.
export class SoundPlayer {
  constructor(settings, dependencies = {}) {
    this.settings = settings
    this.createAudio = dependencies.createAudio || (file => new Audio(file))
    this.now = dependencies.now || (() => Date.now())
    this.repeat = dependencies.repeat || ((callback, ms) => setInterval(callback, ms))
    this.cancel = dependencies.cancel || (id => clearInterval(id))
    this.state = { activeTrackId: 'rain', isPlaying: false, isStarting: false, volume: 0.7, timerMinutes: null, timeLeft: null, error: '' }
    this.listeners = new Set()
    this.generation = 0
    this.alive = false
    this.isApplyingCompanionState = false
  }
  getSnapshot = () => this.state
  subscribe = listener => { this.listeners.add(listener); return () => this.listeners.delete(listener) }
  update(values) { this.state = { ...this.state, ...values }; for (const listener of this.listeners) listener() }
  async applyCompanionState(next) {
    const track = TRACKS.find(item => item.id === next.activeTrackId) || TRACKS[0]
    const shouldPlay = next.isPlaying === true
    const trackChanged = this.state.activeTrackId !== track.id
    this.isApplyingCompanionState = true
    try {
      if (trackChanged) {
        this.stopAmbient()
        if (this.audio) { this.audio.onerror = null; this.audio.pause(); this.audio.src = '' }
        this.audio = this.createAudio(track.file)
        this.audio.loop = true
        this.audio.volume = next.volume
      }
      if (this.audio) this.audio.volume = next.volume
      if (shouldPlay && this.audio) {
        try { await this.audio.play(); this.update({ activeTrackId: track.id, isPlaying: true, isStarting: false, volume: next.volume, error: '' }) }
        catch { this.update({ activeTrackId: track.id, isPlaying: false, isStarting: false, volume: next.volume }) }
      } else {
        this.audio?.pause()
        this.update({ activeTrackId: track.id, isPlaying: false, isStarting: false, volume: next.volume })
        this.syncBackground()
      }
    } finally {
      this.isApplyingCompanionState = false
    }
  }
  mount() {
    this.alive = true
    this.background = this.createAudio('/audio/calm_piano.mp3')
    this.background.loop = true
    this.background.preload = 'auto'
    this.syncBackground()
  }
  setSettings(settings) { this.settings = settings; this.syncBackground() }
  syncBackground = () => {
    const audio = this.background
    if (!this.alive || !audio) return
    audio.volume = this.settings.musicVolume
    const allowed = this.settings.musicEnabled && !this.state.isPlaying && !this.state.isStarting
    audio.muted = !allowed
    if (!allowed) { audio.pause(); return }
    if (!audio.paused) return
    audio.play().then(() => {
      if (!this.alive || !this.settings.musicEnabled || this.state.isPlaying || this.state.isStarting) audio.pause()
    }).catch(() => {}) // Browser autoplay restrictions are retried on a user gesture.
  }
  selectTrack = track => {
    this.stopAmbient()
    this.update({ activeTrackId: track.id })
    this.audio = this.createAudio(track.file)
    this.audio.loop = true
    this.audio.volume = this.state.volume
    const audio = this.audio
    audio.onerror = () => {
      if (this.audio === audio && this.alive) this.failPlayback()
    }
    this.play()
  }
  play() {
    const audio = this.audio
    const generation = ++this.generation
    this.update({ isStarting: true, isPlaying: false, error: '' })
    this.syncBackground() // Silence room music before requesting ambient playback.
    audio.play().then(() => {
      if (!this.alive || generation !== this.generation) return
      this.update({ isStarting: false, isPlaying: true })
    }).catch(() => {
      if (this.alive && generation === this.generation) this.failPlayback()
    })
  }
  failPlayback() {
    this.stopAmbient()
    this.update({ isStarting: false, isPlaying: false, error: 'This sound could not play. Choose another sound or try again.' })
    this.syncBackground()
  }
  stopAmbient() {
    this.generation++
    if (this.audio) { this.audio.onerror = null; this.audio.pause(); this.audio.src = ''; this.audio = null }
  }
  togglePlay = () => {
    if (this.state.isPlaying || this.state.isStarting) {
      this.generation++
      this.audio?.pause()
      this.update({ isStarting: false, isPlaying: false })
      this.syncBackground()
    } else if (this.audio) this.play()
    else this.selectTrack(TRACKS.find(track => track.id === this.state.activeTrackId))
  }
  setVolume = volume => {
    const value = Math.min(1, Math.max(0, volume))
    if (this.audio) this.audio.volume = value
    this.update({ volume: value })
  }
  selectTimer = minutes => {
    if (this.interval) this.cancel(this.interval)
    this.interval = null
    if (minutes === this.state.timerMinutes) {
      this.deadline = null
      this.update({ timerMinutes: null, timeLeft: null })
      return
    }
    this.deadline = this.now() + minutes * 60000
    this.update({ timerMinutes: minutes, timeLeft: minutes * 60 })
    this.interval = this.repeat(this.tick, 1000)
  }
  tick = () => {
    if (!this.deadline) return
    const remaining = Math.max(0, Math.ceil((this.deadline - this.now()) / 1000))
    if (remaining > 0) { this.update({ timeLeft: remaining }); return }
    this.cancel(this.interval); this.interval = null; this.deadline = null
    this.generation++
    this.audio?.pause()
    this.update({ isPlaying: false, isStarting: false, timerMinutes: null, timeLeft: null })
    this.syncBackground()
  }
  onInteraction = () => { this.tick(); this.syncBackground() }
  destroy() {
    this.alive = false
    this.stopAmbient()
    if (this.interval) this.cancel(this.interval)
    this.interval = null; this.deadline = null
    if (this.background) { this.background.pause(); this.background.src = ''; this.background = null }
  }
}
