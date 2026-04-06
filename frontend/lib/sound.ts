let _muted = false

if (typeof window !== 'undefined') {
  _muted = localStorage.getItem('foresight_muted') === 'true'
}

export function isMuted(): boolean {
  return _muted
}

export function setMuted(val: boolean): void {
  _muted = val
  if (typeof window !== 'undefined') {
    localStorage.setItem('foresight_muted', String(val))
  }
}

export function playTone(
  frequency: number,
  type: OscillatorType = 'sine',
  durationMs: number = 80,
  volume: number = 0.15,
): void {
  if (_muted || typeof window === 'undefined') return
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = type
    osc.frequency.setValueAtTime(frequency, ctx.currentTime)
    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + durationMs / 1000)
  } catch {
    // AudioContext not available (SSR / test)
  }
}

export function playFreqSweep(startHz: number, endHz: number, durationMs: number): void {
  if (_muted || typeof window === 'undefined') return
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    const dur = durationMs / 1000
    osc.frequency.setValueAtTime(startHz, ctx.currentTime)
    osc.frequency.linearRampToValueAtTime(endHz, ctx.currentTime + dur)
    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + dur)
  } catch {
    // ignore
  }
}

export const sounds = {
  click:   () => playTone(880, 'sine', 80),
  hover:   () => playTone(1200, 'sine', 40, 0.03),
  error:   () => playTone(220, 'sine', 200),
  success: () => {
    setTimeout(() => playTone(523, 'sine', 120), 0)
    setTimeout(() => playTone(659, 'sine', 120), 120)
    setTimeout(() => playTone(784, 'sine', 120), 240)
  },
  aiGenerating: () => playFreqSweep(300, 900, 400),
  sync:         () => playFreqSweep(400, 800, 300),
}
