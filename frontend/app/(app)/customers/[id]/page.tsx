'use client'
import { useParams } from 'next/navigation'
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useCustomers } from '@/lib/hooks/useCustomers'
import { usePrediction } from '@/lib/hooks/usePrediction'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import OutreachPanel from '@/components/outreach/OutreachPanel'
import Toast from '@/components/ui/Toast'
import api from '@/lib/api'
import { sounds } from '@/lib/sound'

export default function CustomerProfilePage() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const { data: customers = [], isLoading: cLoading } = useCustomers()
  const { data: prediction, isLoading: pLoading, isError: pError } = usePrediction(id)
  const [showOutreach, setShowOutreach] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const customer = customers.find((c) => c.id === id)

  const predictionStale =
    prediction &&
    new Date(prediction.generated_at) < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  async function handleRefreshPrediction() {
    setRefreshing(true)
    sounds.aiGenerating()
    try {
      await api.post(`/predictions/${id}/refresh`)
      await qc.invalidateQueries({ queryKey: ['prediction', id] })
      sounds.success()
    } catch {
      sounds.error()
      setToast({ msg: 'Failed to refresh prediction', type: 'error' })
    } finally {
      setRefreshing(false)
    }
  }

  if (cLoading) {
    return (
      <div className="space-y-4 max-w-3xl">
        <div className="skeleton h-8 w-48" />
        <div className="skeleton h-48 w-full rounded-2xl" />
      </div>
    )
  }

  if (!customer) {
    return <p className="text-muted">Customer not found.</p>
  }

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ftext">{customer.name}</h1>
          <p className="text-muted text-sm">{customer.email}</p>
        </div>
        <Badge risk={customer.churn_risk} />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-surface rounded-xl border border-white/5 p-4">
          <p className="text-xs text-muted mb-1">Visits</p>
          <p className="text-xl font-bold text-p1">{customer.total_visits}</p>
        </div>
        <div className="bg-surface rounded-xl border border-white/5 p-4">
          <p className="text-xs text-muted mb-1">Total Spent</p>
          <p className="text-xl font-bold text-p1">${customer.total_spent.toFixed(2)}</p>
        </div>
        <div className="bg-surface rounded-xl border border-white/5 p-4">
          <p className="text-xs text-muted mb-1">Last Visit</p>
          <p className="text-xl font-bold text-p1">
            {new Date(customer.last_visit_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Prediction card */}
      <div className="bg-surface rounded-2xl border border-white/5 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ftext">AI Prediction</h2>
          {predictionStale && (
            <Button variant="ghost" onClick={handleRefreshPrediction} disabled={refreshing} className="text-xs">
              {refreshing ? 'Refreshing…' : '↻ Refresh'}
            </Button>
          )}
        </div>

        {pLoading && (
          <div className="space-y-3">
            <div className="skeleton h-4 w-3/4" />
            <div className="skeleton h-4 w-1/2" />
            <div className="skeleton h-20 w-full" />
          </div>
        )}

        {pError && !pLoading && (
          <div className="text-center py-6 space-y-3">
            <p className="text-muted text-sm">No prediction yet</p>
            <Button onClick={handleRefreshPrediction} disabled={refreshing}>
              {refreshing ? 'Generating…' : '⚡ Generate Prediction'}
            </Button>
          </div>
        )}

        {prediction && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-muted mb-1">Risk Score</p>
                <p className="text-lg font-bold text-pd1">{(prediction.churn_risk_score * 100).toFixed(0)}%</p>
              </div>
              <div>
                <p className="text-xs text-muted mb-1">Next Visit</p>
                <p className="text-lg font-bold text-p1">in {prediction.predicted_next_visit_days}d</p>
              </div>
              <div>
                <p className="text-xs text-muted mb-1">Predicted LTV</p>
                <p className="text-lg font-bold text-p2">${prediction.predicted_ltv.toFixed(0)}</p>
              </div>
            </div>

            {prediction.top_products.length > 0 && (
              <div>
                <p className="text-xs text-muted mb-2">Top Products</p>
                <div className="flex flex-wrap gap-2">
                  {prediction.top_products.map((p) => (
                    <span key={p} className="px-2 py-1 bg-p0/10 border border-p0/20 rounded text-xs text-p1 font-mono">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="text-xs text-muted mb-2">Insight</p>
              <p className="text-sm text-ftext leading-relaxed">{prediction.insight_summary}</p>
            </div>
          </div>
        )}
      </div>

      {/* Outreach */}
      {!showOutreach && (
        <Button onClick={() => setShowOutreach(true)} className="w-full">
          ⚡ Generate Outreach
        </Button>
      )}

      {showOutreach && (
        <OutreachPanel
          customerId={id}
          customerName={customer.name}
          onClose={() => setShowOutreach(false)}
        />
      )}

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
