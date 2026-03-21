import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

export interface PredictionResponse {
  customer_id: string
  customer_name: string
  churn_risk: 'High' | 'Medium' | 'Low'
  churn_risk_score: number
  predicted_next_visit_days: number
  predicted_ltv: number
  top_products: string[]
  insight_summary: string
  generated_at: string
}

export function usePrediction(customerId: string) {
  return useQuery<PredictionResponse>({
    queryKey: ['prediction', customerId],
    queryFn: () => api.get(`/predictions/${customerId}`).then((r) => r.data),
    staleTime: 5 * 60_000,
    retry: false,
  })
}
