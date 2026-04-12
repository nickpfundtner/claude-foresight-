import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const token = body?.token
  const role = body?.role ?? 'owner'

  if (typeof token !== 'string' || token.length === 0) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 })
  }

  const res = NextResponse.json({ ok: true })
  const cookieOpts = {
    httpOnly: true,
    sameSite: 'strict' as const,
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
    secure: process.env.NODE_ENV === 'production',
  }
  res.cookies.set('foresight_token', token, cookieOpts)
  res.cookies.set('foresight_role', role, cookieOpts)
  return res
}

export async function DELETE(_req: NextRequest) {
  const res = NextResponse.json({ ok: true })
  const clearOpts = {
    httpOnly: true,
    sameSite: 'strict' as const,
    path: '/',
    maxAge: 0,
    secure: process.env.NODE_ENV === 'production',
  }
  res.cookies.set('foresight_token', '', clearOpts)
  res.cookies.set('foresight_role', '', clearOpts)
  return res
}
