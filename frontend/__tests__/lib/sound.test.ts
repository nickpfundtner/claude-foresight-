import { playTone, setMuted, isMuted } from '@/lib/sound'

describe('sound system', () => {
  afterEach(() => {
    setMuted(false) // reset state
  })

  it('isMuted defaults to false', () => {
    expect(isMuted()).toBe(false)
  })

  it('setMuted(true) mutes', () => {
    setMuted(true)
    expect(isMuted()).toBe(true)
  })

  it('playTone does not throw when muted', () => {
    setMuted(true)
    expect(() => playTone(880, 'sine', 80)).not.toThrow()
  })

  it('playTone does not throw in test environment (no AudioContext)', () => {
    expect(() => playTone(880, 'sine', 80)).not.toThrow()
  })
})
