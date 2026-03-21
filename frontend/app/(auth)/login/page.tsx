'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { sounds } from '@/lib/sound'
import Button from '@/components/ui/Button'
import Toast from '@/components/ui/Toast'

export default function LoginPage() {
  const router = useRouter()
  const setToken = useAuthStore((s) => s.setToken)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [shake, setShake] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await api.post('/auth/login', { username: email, password })
      const { access_token } = res.data
      setToken(access_token)
      await fetch('/api/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: access_token }),
      })
      sounds.success()
      router.push('/dashboard')
    } catch {
      sounds.error()
      setShake(true)
      setToast({ msg: 'Invalid email or password', type: 'error' })
      setTimeout(() => setShake(false), 500)
    } finally {
      setLoading(false)
    }
  }

  const inputClass =
    'w-full bg-surface border border-white/10 rounded-lg px-4 py-3 text-sm text-ftext placeholder-muted focus:outline-none focus:border-p0 focus:shadow-[0_0_0_2px_rgba(255,96,64,0.3)] transition-all'

  return (
    <div className={`w-full max-w-sm space-y-8 ${shake ? 'animate-[shake_0.4s_ease-in-out]' : ''}`}>
      <div className="text-center">
        <h1 className="text-3xl font-black text-p0 tracking-tight mb-1">FORESIGHT</h1>
        <p className="text-muted text-sm">Sign in to your account</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className={inputClass}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className={inputClass}
        />
        <Button type="submit" disabled={loading} className="w-full py-3 text-base">
          {loading ? 'Signing in…' : 'Sign In'}
        </Button>
      </form>
      <p className="text-center text-sm text-muted">
        No account?{' '}
        <Link href="/register" className="text-p1 hover:underline">Register</Link>
      </p>
      {toast && (
        <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  )
}
