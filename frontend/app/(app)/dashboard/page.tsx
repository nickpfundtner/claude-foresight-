'use client'
import { useState } from 'react'
import { useOverview } from '@/lib/hooks/useOverview'
import { useCustomers, CustomerSummary } from '@/lib/hooks/useCustomers'
import StatCard from '@/components/dashboard/StatCard'
import LineChart from '@/components/dashboard/LineChart'
import BarChart from '@/components/dashboard/BarChart'
import CustomerTable from '@/components/dashboard/CustomerTable'
import OutreachPanel from '@/components/outreach/OutreachPanel'
import Toast from '@/components/ui/Toast'
import api from '@/lib/api'
import { sounds } from '@/lib/sound'

export default function DashboardPage() {
  const { data: overview, isLoading: overviewLoading } = useOverview()
  const { data: customers = [], isLoading: customersLoading } = useCustomers()
  const [outreachCustomer, setOutreachCustomer] = useState<CustomerSummary | null>(null)
  const [batchLoading, setBatchLoading] = useState(false)
  const [batchDrafts, setBatchDrafts] = useState<{ customer_id: string; draft: string; subject: string }[]>([])
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const highRisk = customers.filter((c) => c.churn_risk === 'High')

  async function handleBatchOutreach() {
    setBatchLoading(true)
    sounds.aiGenerating()
    try {
      const res = await api.post('/outreach/batch', {
        customer_ids: highRisk.map((c) => c.id),
        auto_send: false,
      })
      setBatchDrafts(res.data.drafts)
      sounds.success()
      setToast({ msg: `Generated ${res.data.drafts.length} outreach drafts`, type: 'success' })
    } catch {
      sounds.error()
      setToast({ msg: 'Batch generation failed', type: 'error' })
    } finally {
      setBatchLoading(false)
    }
  }

  return (
    <div className="space-y-8 max-w-7xl">
      <h1 className="text-2xl font-bold text-ftext">Dashboard</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Total Customers" value={overview?.total_customers ?? 0} color="var(--p0)" loading={overviewLoading} />
        <StatCard label="High Churn Risk" value={overview?.high_risk_count ?? 0} color="var(--pd1)" loading={overviewLoading} />
        <StatCard label="Total Revenue" value={overview?.total_revenue ?? 0} color="var(--p1)" prefix="$" loading={overviewLoading} />
        <StatCard label="Avg Visits" value={overview?.avg_visits_per_customer ?? 0} color="var(--p2)" decimals={1} loading={overviewLoading} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <LineChart />
        <BarChart />
      </div>

      {/* Customer table */}
      <div className="bg-surface rounded-2xl border border-white/5 p-6">
        <h2 className="text-sm font-semibold text-ftext mb-4">Customers</h2>
        <CustomerTable
          customers={customers}
          loading={customersLoading}
          onOutreach={(c) => setOutreachCustomer(c)}
        />
      </div>

      {/* High-risk outreach strip */}
      {highRisk.length > 0 && !outreachCustomer && batchDrafts.length === 0 && (
        <div className="bg-pd1/10 border border-pd1/30 rounded-2xl p-5 flex items-center justify-between">
          <p className="text-sm text-ftext">
            <strong className="text-pd1">{highRisk.length}</strong> high-risk customers need attention
          </p>
          <button
            onClick={handleBatchOutreach}
            disabled={batchLoading}
            className="px-4 py-2 bg-pd1/20 border border-pd1/40 text-pd1 text-sm font-semibold rounded-lg hover:bg-pd1/30 transition-all disabled:opacity-50"
          >
            {batchLoading ? 'Generating\u2026' : '\u26a1 Generate All Outreach'}
          </button>
        </div>
      )}

      {/* Individual outreach panel */}
      {outreachCustomer && (
        <OutreachPanel
          customerId={outreachCustomer.id}
          customerName={outreachCustomer.name}
          onClose={() => setOutreachCustomer(null)}
        />
      )}

      {/* Batch drafts review */}
      {batchDrafts.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-ftext">Outreach Drafts ({batchDrafts.length})</h2>
          {batchDrafts.map((d) => {
            const customer = customers.find((c) => c.id === d.customer_id)
            return customer ? (
              <OutreachPanel
                key={d.customer_id}
                customerId={d.customer_id}
                customerName={customer.name}
                initialDraft={d.draft}
                initialSubject={d.subject}
                onClose={() => setBatchDrafts((prev) => prev.filter((x) => x.customer_id !== d.customer_id))}
              />
            ) : null
          })}
        </div>
      )}

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
