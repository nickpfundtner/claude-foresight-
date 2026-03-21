import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

export interface CustomerSummary {
  id: string
  name: string
  email: string
  total_visits: number
  total_spent: number
  last_visit_at: string
  churn_risk: 'High' | 'Medium' | 'Low'
  churn_risk_score: number
}

export function useCustomers() {
  return useQuery<CustomerSummary[]>({
    queryKey: ['customers'],
    queryFn: () => api.get('/dashboard/customers').then((r) => r.data),
    staleTime: 60_000,
    retry: false,
  })
}
