import React from 'react'
import { render, screen } from '@testing-library/react'
import DashboardPage from '@/app/(app)/dashboard/page'

jest.mock('@/lib/hooks/useOverview', () => ({
  useOverview: jest.fn(),
}))
jest.mock('@/lib/hooks/useCustomers', () => ({
  useCustomers: jest.fn(),
}))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('@/components/dashboard/StatCard', () => ({
  __esModule: true,
  default: ({ label, loading }: any) => loading ? <div className="skeleton" /> : <div>{label}</div>,
}))
jest.mock('@/components/dashboard/LineChart', () => ({ __esModule: true, default: () => <div>LineChart</div> }))
jest.mock('@/components/dashboard/BarChart', () => ({ __esModule: true, default: () => <div>BarChart</div> }))
jest.mock('@/components/dashboard/CustomerTable', () => ({
  __esModule: true,
  default: ({ loading }: any) => loading ? <div className="skeleton" /> : <div>CustomerTable</div>,
}))
jest.mock('@/components/outreach/OutreachPanel', () => ({ __esModule: true, default: () => <div>OutreachPanel</div> }))
jest.mock('@/components/ui/Toast', () => ({ __esModule: true, default: () => null }))
jest.mock('@/lib/api', () => ({ __esModule: true, default: { post: jest.fn() } }))
jest.mock('@/lib/sound', () => ({ sounds: { aiGenerating: jest.fn(), success: jest.fn(), error: jest.fn() } }))

import { useOverview } from '@/lib/hooks/useOverview'
import { useCustomers } from '@/lib/hooks/useCustomers'

describe('DashboardPage', () => {
  it('shows skeletons while loading', () => {
    (useOverview as jest.Mock).mockReturnValue({ data: undefined, isLoading: true })
    ;(useCustomers as jest.Mock).mockReturnValue({ data: undefined, isLoading: true })
    const { container } = render(<DashboardPage />)
    expect(container.querySelectorAll('.skeleton').length).toBeGreaterThan(0)
  })

  it('shows stat card labels when data loaded', () => {
    (useOverview as jest.Mock).mockReturnValue({
      data: { total_customers: 100, high_risk_count: 5, total_revenue: 5000, avg_visits_per_customer: 3 },
      isLoading: false,
    })
    ;(useCustomers as jest.Mock).mockReturnValue({ data: [], isLoading: false })
    render(<DashboardPage />)
    expect(screen.getByText('Total Customers')).toBeInTheDocument()
  })
})
