'use client'
import { CustomerSummary } from '@/lib/hooks/useCustomers'
import Badge from '@/components/ui/Badge'

interface Props {
  customers: CustomerSummary[]
  loading?: boolean
  onOutreach: (customer: CustomerSummary) => void
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function churnBarColor(risk: CustomerSummary['churn_risk']) {
  if (risk === 'High') return '#FF3040'
  if (risk === 'Medium') return '#FFB040'
  return '#40FF80'
}

export default function CustomerTable({ customers, loading = false, onOutreach }: Props) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton h-12 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <>
      <style>{`
        @keyframes pulse-risk {
          0%, 100% { border-left-color: rgba(255,48,64,0.8); }
          50% { border-left-color: rgba(255,48,64,0.2); }
        }
        .pulse-risk {
          border-left: 3px solid rgba(255,48,64,0.8);
          animation: pulse-risk 2s ease-in-out infinite;
        }
      `}</style>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted uppercase tracking-wider text-xs border-b border-white/5">
              <th className="text-left pb-3 font-medium">Name</th>
              <th className="text-left pb-3 font-medium">Last Visit</th>
              <th className="text-right pb-3 font-medium">Spent</th>
              <th className="text-right pb-3 font-medium">Visits</th>
              <th className="text-center pb-3 font-medium">Risk</th>
              <th className="text-left pb-3 pl-4 font-medium">Churn Score</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr
                key={c.id}
                data-risk={c.churn_risk}
                onClick={() => onOutreach(c)}
                className={`border-b border-white/5 cursor-pointer hover:bg-p0/5 transition-all hover:translate-x-1 ${c.churn_risk === 'High' ? 'pulse-risk' : ''}`}
              >
                <td className="py-3 pr-4">
                  <div className="font-medium text-ftext">{c.name}</div>
                  <div className="text-muted text-xs">{c.email}</div>
                </td>
                <td className="py-3 pr-4 text-muted">{formatDate(c.last_visit_at)}</td>
                <td className="py-3 pr-4 text-right font-mono text-ftext">${c.total_spent.toFixed(2)}</td>
                <td className="py-3 pr-4 text-right text-muted">{c.total_visits}</td>
                <td className="py-3 text-center">
                  <Badge risk={c.churn_risk} />
                </td>
                <td className="py-3 pl-4">
                  <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      data-testid="churn-bar"
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.round(c.churn_risk_score * 100)}%`,
                        background: churnBarColor(c.churn_risk),
                        boxShadow: `0 0 6px ${churnBarColor(c.churn_risk)}88`,
                      }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
