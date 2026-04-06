'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { sounds } from '@/lib/sound'
import Button from '@/components/ui/Button'
import Toast from '@/components/ui/Toast'

type Stage = 'connect' | 'connected' | 'synced'

export default function ConnectPage() {
  const router = useRouter()
  const [token, setToken] = useState('')
  const [stage, setStage] = useState<Stage>('connect')
  const [merchantName, setMerchantName] = useState('')
  const [syncResult, setSyncResult] = useState<{ synced_customers: number; synced_transactions: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await api.post('/square/connect', { access_token: token })
      setMerchantName(res.data.merchant_name)
      setStage('connected')
      sounds.success()
    } catch {
      sounds.error()
      setToast({ msg: 'Failed to connect Square account', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  async function handleSync() {
    setLoading(true)
    sounds.aiGenerating()
    try {
      const res = await api.post('/square/sync')
      setSyncResult(res.data)
      setStage('synced')
      sounds.success()
      setToast({ msg: `Synced ${res.data.synced_customers} customers!`, type: 'success' })
      setTimeout(() => router.push('/dashboard'), 1800)
    } catch {
      sounds.error()
      setToast({ msg: 'Sync failed — please try again', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-surface rounded-2xl border border-white/10 p-8 space-y-6">
      <h2 className="text-xl font-bold text-ftext">Connect Square</h2>
      <p className="text-sm text-muted">
        Paste your Square access token below.{' '}
        <span className="text-p2">Phase 1 — OAuth redirect coming in Phase 2.</span>
      </p>

      {stage === 'connect' && (
        <form onSubmit={handleConnect} className="space-y-4">
          <input
            type="text"
            placeholder="sq0atp-..."
            value={token}
            onChange={(e) => setToken(e.target.value)}
            required
            className="w-full bg-bg border border-white/10 rounded-lg px-4 py-3 text-sm text-ftext placeholder-muted focus:outline-none focus:border-p0 transition-all font-mono"
          />
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Connecting…' : 'Connect Square'}
          </Button>
        </form>
      )}

      {stage === 'connected' && (
        <div className="space-y-4">
          <p className="text-sm text-p2">Connected as <strong className="text-ftext">{merchantName}</strong></p>
          <Button onClick={handleSync} disabled={loading} className="w-full">
            {loading ? 'Syncing…' : 'Sync Now'}
          </Button>
        </div>
      )}

      {stage === 'synced' && syncResult && (
        <p className="text-sm text-p2">
          Synced {syncResult.synced_customers} customers and {syncResult.synced_transactions} transactions. Redirecting…
        </p>
      )}

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
