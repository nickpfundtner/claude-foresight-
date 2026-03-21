'use client'
import { useRouter } from 'next/navigation'
import { CustomerSummary } from '@/lib/hooks/useCustomers'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'

interface Props {
  customers: CustomerSummary[]
  loading?: boolean
  onOutreach: (customer: CustomerSummary) => void
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function CustomerTable({ customers, loading = false, onOutreach }: Props) {
  const router = useRouter()

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
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-muted uppercase tracking-wider text-xs border-b border-white/5">
            <th className="text-left pb-3 font-medium">Name</th>
            <th className="text-left pb-3 font-medium">Last Visit</th>
            <th className="text-right pb-3 font-medium">Spent</th>
            <th className="text-right pb-3 font-medium">Visits</th>
            <th className="text-center pb-3 font-medium">Risk</th>
            <th className="text-center pb-3 font-medium">Outreach</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((c) => (
            <tr
              key={c.id}
              onClick={() => router.push(`/customers/${c.id}`)}
              className="border-b border-white/5 cursor-pointer hover:border-l-2 hover:border-l-p0 hover:bg-p0/5 transition-all"
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
              <td className="py-3 text-center" onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" className="text-xs py-1 px-3" onClick={() => onOutreach(c)}>
                  ⚡ Outreach
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
