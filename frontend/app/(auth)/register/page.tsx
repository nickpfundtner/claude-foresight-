'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import api from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { sounds } from '@/lib/sound'
import Button from '@/components/ui/Button'
import Toast from '@/components/ui/Toast'

export default function RegisterPage() {
  const router = useRouter()
  const setUser = useAuthStore((s) => s.setUser)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await api.post('/auth/register', { email, password })
      const { access_token, role: returnedRole, name, role_name } = res.data
      setUser(access_token, returnedRole ?? 'owner', name, role_name)
      await fetch('/api/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: access_token, role: returnedRole ?? 'owner' }),
      })
      sounds.success()
      router.push('/connect')
    } catch (err: any) {
      sounds.error()
      setToast({ msg: err.response?.data?.detail ?? 'Registration failed', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const inputClass =
    'w-full bg-surface border border-white/10 rounded-lg px-4 py-3 text-sm text-ftext placeholder-muted focus:outline-none focus:border-p0 focus:shadow-[0_0_0_2px_rgba(255,96,64,0.3)] transition-all'

  return (
    <div className="w-full max-w-sm space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-black text-p0 tracking-tight mb-1">FORESIGHT</h1>
        <p className="text-muted text-sm">Create your account</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputClass} />
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required className={inputClass} />
        <Button type="submit" disabled={loading} className="w-full py-3 text-base">
          {loading ? 'Creating account…' : 'Create Account'}
        </Button>
      </form>
      <p className="text-center text-sm text-muted">
        Already have an account?{' '}
        <Link href="/login" className="text-p1 hover:underline">Sign in</Link>
      </p>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
