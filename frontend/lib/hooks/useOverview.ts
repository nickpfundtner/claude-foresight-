import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

export interface OverviewStats {
  total_customers: number
  high_risk_count: number
  total_revenue: number
  avg_visits_per_customer: number
}

export function useOverview() {
  return useQuery<OverviewStats>({
    queryKey: ['overview'],
    queryFn: () => api.get('/dashboard/overview').then((r) => r.data),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  })
}
