import test from 'node:test'
import assert from 'node:assert/strict'
import { SoundPlayer, TRACKS } from '../src/services/sound-player.js'

function fixture(enabled = true) {
  const sounds = [], intervals = new Map()
  let time = 1000, sequence = 0
  const player = new SoundPlayer({ musicEnabled: enabled, musicVolume: 0.2 }, {
    createAudio(src) {
      const audio = { src, paused: true, play() { this.paused = false; return Promise.resolve() }, pause() { this.paused = true } }
      sounds.push(audio); return audio
    },
    now: () => time,
    repeat: callback => { intervals.set(++sequence, callback); return sequence },
    cancel: id => intervals.delete(id),
  })
  player.mount()
  return { player, sounds, intervals, advance(ms) { time += ms; for (const callback of intervals.values()) callback() } }
}
const settle = async () => { await Promise.resolve(); await Promise.resolve() }

test('ambient selection silences default music immediately and remains active without view subscribers', async () => {
  const { player, sounds } = fixture()
  const unsubscribe = player.subscribe(() => {})
  player.selectTrack(TRACKS[0])
  assert.equal(sounds[0].paused, true)
  await settle()
  unsubscribe() // Modal closes; App still owns the player.
  assert.equal(player.state.isPlaying, true)
  assert.equal(sounds[1].paused, false)
  player.onInteraction()
  assert.equal(sounds[0].paused, true)
  player.destroy()
})
test('timer expires outside the modal, stops ambient, and resumes default music', async () => {
  const { player, sounds, advance, intervals } = fixture()
  player.selectTrack(TRACKS[0]); await settle()
  player.selectTimer(15)
  advance(5 * 60000)
  assert.equal(player.state.timeLeft, 600)
  // Simulates a throttled/hidden tab skipping directly past its deadline.
  advance(11 * 60000); await settle()
  assert.equal(sounds[1].paused, true)
  assert.equal(sounds[0].paused, false)
  assert.equal(player.state.isPlaying, false)
  assert.equal(player.state.timerMinutes, null)
  assert.equal(intervals.size, 0)
  player.destroy()
})
test('timer expiry respects disabled room music', async () => {
  const { player, sounds, advance } = fixture()
  player.selectTrack(TRACKS[0]); await settle()
  player.selectTimer(15)
  player.setSettings({ musicEnabled: false, musicVolume: 0.4 })
  advance(15 * 60000); await settle()
  assert.equal(sounds[0].paused, true)
  assert.equal(sounds[0].muted, true)
  player.destroy()
})
test('changing tracks preserves volume and timer; canceling timer does not stop sound', async () => {
  const { player, sounds, advance } = fixture()
  player.selectTrack(TRACKS[0]); await settle()
  player.setVolume(0.35); player.selectTimer(30); advance(10000)
  player.selectTrack(TRACKS[1]); await settle()
  assert.equal(sounds[1].paused, true)
  assert.equal(sounds[2].volume, 0.35)
  assert.equal(player.state.timeLeft, 1790)
  player.selectTimer(30)
  advance(31 * 60000)
  assert.equal(player.state.timerMinutes, null)
  assert.equal(sounds[2].paused, false)
  player.destroy()
})
test('manual pause restores default music; resume takes over again', async () => {
  const { player, sounds } = fixture()
  player.selectTrack(TRACKS[0]); await settle()
  player.togglePlay(); await settle()
  assert.equal(sounds[1].paused, true)
  assert.equal(sounds[0].paused, false)
  player.togglePlay(); await settle()
  assert.equal(sounds[1].paused, false)
  assert.equal(sounds[0].paused, true)
  player.destroy()
})
test('late failure from an old track cannot interrupt its replacement', async () => {
  const { player, sounds } = fixture()
  player.selectTrack(TRACKS[0]); await settle()
  let rejectOld
  sounds[1].play = () => new Promise((_resolve, reject) => { rejectOld = reject })
  player.togglePlay(); player.togglePlay()
  player.selectTrack(TRACKS[1]); await settle()
  rejectOld(new Error('old load aborted')); await settle()
  assert.equal(player.state.activeTrackId, 'forest')
  assert.equal(player.state.isPlaying, true)
  assert.equal(player.state.error, '')
  player.destroy()
})
test('audio errors restore default music and app disposal stops both tracks', async () => {
  const { player, sounds, intervals } = fixture()
  player.selectTrack(TRACKS[0]); await settle()
  sounds[1].onerror(); await settle()
  assert.equal(player.state.isPlaying, false)
  assert.match(player.state.error, /could not play/)
  assert.equal(sounds[0].paused, false)
  player.selectTrack(TRACKS[1]); player.selectTimer(15)
  player.destroy(); await settle()
  assert.ok(sounds.every(audio => audio.paused))
  assert.equal(intervals.size, 0)
})
