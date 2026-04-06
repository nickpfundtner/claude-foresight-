'use client'
import { useState } from 'react'
import api from '@/lib/api'
import { sounds } from '@/lib/sound'
import Button from '@/components/ui/Button'
import Toast from '@/components/ui/Toast'

interface Props {
  customerId: string
  customerName: string
  onClose: () => void
  initialDraft?: string
  initialSubject?: string
}

export default function OutreachPanel({ customerId, customerName, onClose, initialDraft = '', initialSubject = '' }: Props) {
  const [draft, setDraft] = useState(initialDraft)
  const [subject, setSubject] = useState(initialSubject)
  const [autoMode, setAutoMode] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  async function handleGenerate() {
    setLoading(true)
    sounds.aiGenerating()
    try {
      const res = await api.post(`/outreach/${customerId}/generate`)
      setDraft(res.data.draft)
      setSubject(res.data.subject)
      if (autoMode) await handleSend(res.data.draft, res.data.subject)
    } catch {
      sounds.error()
      setToast({ msg: 'Failed to generate draft', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  async function handleSend(d = draft, s = subject) {
    setLoading(true)
    try {
      await api.post(`/outreach/${customerId}/send`, { draft: d, subject: s, channel: 'email' })
      sounds.success()
      setSent(true)
      setToast({ msg: `Email sent to ${customerName}!`, type: 'success' })
    } catch {
      sounds.error()
      setToast({ msg: 'Failed to send email', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-surface rounded-2xl border border-p0/30 p-6 space-y-5" style={{ boxShadow: '0 0 30px 4px rgba(255,96,64,0.12)' }}>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-ftext">⚡ AI Outreach — {customerName}</h3>
        <button onClick={onClose} className="text-muted hover:text-ftext text-lg">×</button>
      </div>

      {/* Auto mode toggle */}
      <label className="flex items-center gap-3 text-sm cursor-pointer select-none">
        <div
          onClick={() => setAutoMode((v) => !v)}
          className={`w-10 h-5 rounded-full relative transition-colors ${autoMode ? 'bg-p0' : 'bg-white/10'}`}
        >
          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow ${autoMode ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </div>
        <span className="text-muted">Auto-send <span className="text-xs">(off by default — sends without review)</span></span>
      </label>

      {!draft && !sent && (
        <Button onClick={handleGenerate} disabled={loading} className="w-full">
          {loading ? 'Generating…' : '⚡ Generate Outreach Draft'}
        </Button>
      )}

      {draft && !sent && (
        <div className="space-y-3">
          <div>
            <p className="text-xs text-muted mb-1">Subject</p>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full bg-bg border border-p0/30 rounded-lg px-3 py-2 text-sm text-ftext focus:outline-none focus:border-p0 transition-all"
            />
          </div>
          <div>
            <p className="text-xs text-muted mb-1">Message</p>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={6}
              className="w-full bg-bg border border-p0/30 rounded-lg px-3 py-2 text-sm text-ftext focus:outline-none focus:border-p0 transition-all resize-none"
              style={{ boxShadow: '0 0 12px 2px rgba(255,96,64,0.1)' }}
            />
          </div>
          <Button onClick={() => handleSend()} disabled={loading} className="w-full">
            {loading ? 'Sending…' : 'Send Email'}
          </Button>
        </div>
      )}

      {sent && (
        <p className="text-center text-p2 font-medium text-sm py-4">Email sent successfully.</p>
      )}

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
