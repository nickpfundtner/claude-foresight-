import { POST, DELETE } from '@/app/api/auth/token/route'
import { NextRequest } from 'next/server'

describe('auth token route', () => {
  it('POST sets foresight_token cookie', async () => {
    const req = new NextRequest('http://localhost/api/auth/token', {
      method: 'POST',
      body: JSON.stringify({ token: 'test.jwt.token' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const cookie = res.headers.get('set-cookie')
    expect(cookie).toContain('foresight_token=test.jwt.token')
    expect(cookie).toContain('HttpOnly')
  })

  it('DELETE clears foresight_token cookie', async () => {
    const req = new NextRequest('http://localhost/api/auth/token', { method: 'DELETE' })
    const res = await DELETE(req)
    expect(res.status).toBe(200)
    const cookie = res.headers.get('set-cookie')
    expect(cookie).toContain('foresight_token=')
    expect(cookie).toContain('Max-Age=0')
  })
})
