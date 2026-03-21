import React from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useOverview } from '@/lib/hooks/useOverview'
import api from '@/lib/api'

jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: { get: jest.fn() }
}))
const mockedApi = api as jest.Mocked<typeof api>

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useOverview', () => {
  it('returns overview data on success', async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: { total_customers: 42, high_risk_count: 5, total_revenue: 9999, avg_visits_per_customer: 3.2 }
    })
    const { result } = renderHook(() => useOverview(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.total_customers).toBe(42)
  })
})
