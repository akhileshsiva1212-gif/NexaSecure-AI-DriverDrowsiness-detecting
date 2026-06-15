// In-browser wake-up audio engine.
//
// The three presets are synthesized live with the Web Audio API — no asset files, works
// offline, no licensing concerns, and they genuinely play (not mock):
//   - default-alarm : a harsh rising/falling two-tone emergency siren
//   - music-1       : a bright ascending arpeggio loop
//   - music-2       : a calmer pentatonic loop
// "uploaded" plays a driver-provided MP3/WAV via an <audio> element.
//
// Autoplay policy: browsers block audio until a user gesture. Call unlock() from a click
// (selecting a sound, Test, etc.) so a later drowsiness alert can play without interaction.

import type { AudioOption } from '../../lib/types'

interface Note {
  freq: number // Hz; 0 = rest
  dur: number // seconds
}

// A four-note major arpeggio (C5–E5–G5–C6), bright and attention-getting.
const MUSIC_1: Note[] = [
  { freq: 523.25, dur: 0.22 },
  { freq: 659.25, dur: 0.22 },
  { freq: 783.99, dur: 0.22 },
  { freq: 1046.5, dur: 0.34 },
  { freq: 0, dur: 0.16 },
]

// A calmer minor-pentatonic phrase (A4–C5–D5–E5–G5), gentler wake-up.
const MUSIC_2: Note[] = [
  { freq: 440.0, dur: 0.28 },
  { freq: 523.25, dur: 0.28 },
  { freq: 587.33, dur: 0.28 },
  { freq: 659.25, dur: 0.28 },
  { freq: 783.99, dur: 0.4 },
  { freq: 0, dur: 0.2 },
]

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

export class WakeAudioEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private stopFns: Array<() => void> = []
  private audioEl: HTMLAudioElement | null = null
  private playing: AudioOption | null = null
  private volume = 0.9

  private ensureCtx(): AudioContext {
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.ctx = new Ctor()
      this.master = this.ctx.createGain()
      this.master.gain.value = this.volume
      this.master.connect(this.ctx.destination)
    }
    return this.ctx
  }

  /** Resume the AudioContext — call from a user gesture so alerts can play later. */
  async unlock(): Promise<void> {
    const ctx = this.ensureCtx()
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume()
      } catch {
        /* resume can reject without a gesture; a later gesture will succeed */
      }
    }
  }

  setVolume(v: number): void {
    this.volume = clamp01(v)
    if (this.master) this.master.gain.value = this.volume
    if (this.audioEl) this.audioEl.volume = this.volume
  }

  isPlaying(): boolean {
    return this.playing !== null
  }

  current(): AudioOption | null {
    return this.playing
  }

  /** Start playing the chosen sound on a loop until stop() is called. */
  async play(option: AudioOption, opts: { volume?: number; uploadedUrl?: string | null } = {}): Promise<void> {
    this.stop()
    if (opts.volume != null) this.setVolume(opts.volume)
    await this.unlock()
    this.playing = option
    if (option === 'uploaded') this.playUploaded(opts.uploadedUrl ?? null)
    else if (option === 'default-alarm') this.playSiren()
    else this.playMelody(option === 'music-1' ? MUSIC_1 : MUSIC_2)
  }

  stop(): void {
    for (const fn of this.stopFns) {
      try {
        fn()
      } catch {
        /* ignore teardown errors */
      }
    }
    this.stopFns = []
    if (this.audioEl) {
      this.audioEl.pause()
      this.audioEl.src = ''
      this.audioEl = null
    }
    this.playing = null
  }

  // --- preset synthesis ------------------------------------------------------------------

  private playSiren(): void {
    const ctx = this.ensureCtx()
    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.value = 800
    // An LFO wails the pitch between ~400–1200 Hz for the classic siren sweep.
    const lfo = ctx.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = 4
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 400
    lfo.connect(lfoGain)
    lfoGain.connect(osc.frequency)
    const g = ctx.createGain()
    g.gain.value = 0.55
    osc.connect(g)
    g.connect(this.master!)
    osc.start()
    lfo.start()
    this.stopFns.push(() => {
      osc.stop()
      lfo.stop()
      osc.disconnect()
      lfo.disconnect()
      lfoGain.disconnect()
      g.disconnect()
    })
  }

  private playMelody(melody: Note[]): void {
    const ctx = this.ensureCtx()
    let i = 0
    let nextTime = ctx.currentTime + 0.06
    const LOOKAHEAD = 0.3 // schedule notes this far ahead
    const tick = () => {
      while (nextTime < ctx.currentTime + LOOKAHEAD) {
        const note = melody[i % melody.length]
        this.scheduleNote(note.freq, nextTime, note.dur)
        nextTime += note.dur
        i++
      }
    }
    tick()
    const id = window.setInterval(tick, 100)
    this.stopFns.push(() => window.clearInterval(id))
  }

  private scheduleNote(freq: number, time: number, dur: number): void {
    if (freq <= 0) return // rest
    const ctx = this.ctx!
    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.value = freq
    const g = ctx.createGain()
    // Short attack + decay envelope so notes are distinct and clickless.
    g.gain.setValueAtTime(0.0001, time)
    g.gain.exponentialRampToValueAtTime(0.5, time + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur * 0.95)
    osc.connect(g)
    g.connect(this.master!)
    osc.start(time)
    osc.stop(time + dur)
    osc.onended = () => {
      osc.disconnect()
      g.disconnect()
    }
  }

  private playUploaded(url: string | null): void {
    if (!url) {
      // A wake-up alert must never fail silently — fall back to the siren.
      this.playSiren()
      this.playing = 'uploaded'
      return
    }
    const el = new Audio(url)
    el.loop = true
    el.volume = this.volume
    this.audioEl = el
    el.play().catch(() => {
      // If the file can't play, fall back to the siren so the driver is still alerted.
      this.audioEl = null
      this.playSiren()
      this.playing = 'uploaded'
    })
  }
}
