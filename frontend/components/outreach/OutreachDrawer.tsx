'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CustomerSummary } from '@/lib/hooks/useCustomers'
import Button from '@/components/ui/Button'
import api from '@/lib/api'
import { sounds } from '@/lib/sound'

interface Props {
  isOpen: boolean
  customer: CustomerSummary | null
  onClose: () => void
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function highlightName(text: string, name: string): React.ReactNode {
  const firstName = name.split(' ')[0]
  const parts = text.split(new RegExp(`(${firstName})`, 'gi'))
  return parts.map((part, i) =>
    part.toLowerCase() === firstName.toLowerCase()
      ? <span key={i} style={{ color: '#FF6040', fontWeight: 600 }}>{part}</span>
      : part
  )
}

export default function OutreachDrawer({ isOpen, customer, onClose }: Props) {
  const [draft, setDraft] = useState('')
  const [subject, setSubject] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setDraft('')
    setSubject('')
    setCopied(false)
  }, [customer?.id])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  async function handleGenerate() {
    if (!customer) return
    setLoading(true)
    sounds.aiGenerating()
    try {
      const res = await api.post(`/outreach/${customer.id}/generate`)
      setDraft(res.data.draft)
      setSubject(res.data.subject)
    } catch {
      sounds.error()
    } finally {
      setLoading(false)
    }
  }

  function handleCopy() {
    if (!draft) return
    navigator.clipboard.writeText(`${subject}\n\n${draft}`)
    sounds.success()
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!isOpen || !customer) return null

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="fixed right-0 top-0 h-full z-50 flex flex-col"
        style={{
          width: 'min(480px, 100vw)',
          background: '#0e0b0a',
          borderLeft: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '-8px 0 40px rgba(0,0,0,0.6)',
        }}
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 35 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #FF6040, #FF5090)' }}
            >
              {customer.name.charAt(0)}
            </div>
            <span className="font-semibold text-ftext">{customer.name}</span>
          </div>
          <button
            aria-label="×"
            onClick={onClose}
            className="text-muted hover:text-ftext text-xl leading-none transition-colors"
          >
            ×
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 px-6 py-4 border-b border-white/5">
          <div className="text-center">
            <p className="text-xs text-muted uppercase tracking-wider mb-1">Last Visit</p>
            <p className="text-sm font-mono text-ftext">{formatDate(customer.last_visit_at)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted uppercase tracking-wider mb-1">Churn Risk</p>
            <p className={`text-sm font-bold ${customer.churn_risk === 'High' ? 'text-red-400' : customer.churn_risk === 'Medium' ? 'text-amber-400' : 'text-green-400'}`}>
              {customer.churn_risk}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted uppercase tracking-wider mb-1">Total Spent</p>
            <p className="text-sm font-mono text-ftext">${customer.total_spent.toFixed(0)}</p>
          </div>
        </div>

        {/* Draft area */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted">AI Outreach Draft</p>

          {!draft && (
            <Button onClick={handleGenerate} disabled={loading} className="w-full">
              {loading ? 'Generating…' : '⚡ Generate Draft'}
            </Button>
          )}

          {draft && (
            <>
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
                <div
                  className="w-full bg-bg border border-p0/20 rounded-lg px-3 py-3 text-sm text-ftext leading-relaxed whitespace-pre-wrap"
                  style={{ minHeight: '8rem', boxShadow: '0 0 12px 2px rgba(255,96,64,0.08)' }}
                >
                  {highlightName(draft, customer.name)}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Action buttons */}
        {draft && (
          <div className="px-6 py-4 border-t border-white/5 flex gap-3">
            <Button variant="ghost" onClick={handleGenerate} disabled={loading} className="flex-1">
              {loading ? 'Regenerating…' : '↻ Regenerate'}
            </Button>
            <Button onClick={handleCopy} className="flex-1">
              {copied ? '✓ Copied!' : 'Copy Draft'}
            </Button>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
