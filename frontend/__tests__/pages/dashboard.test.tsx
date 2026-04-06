import React from 'react'
import { render, screen } from '@testing-library/react'
import DashboardPage from '@/app/(app)/dashboard/page'

jest.mock('@/lib/hooks/useOverview', () => ({ useOverview: jest.fn() }))
jest.mock('@/lib/hooks/useCustomers', () => ({ useCustomers: jest.fn() }))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('framer-motion', () => ({
  motion: { div: ({ children, ...props }: any) => <div {...props}>{children}</div>, h1: ({ children, ...props }: any) => <h1 {...props}>{children}</h1> },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}))
jest.mock('@/components/dashboard/StatCard', () => ({
  __esModule: true,
  default: ({ label, loading }: any) => loading ? <div className="skeleton" /> : <div>{label}</div>,
}))
jest.mock('@/components/dashboard/LineChart', () => ({ __esModule: true, default: () => <div>LineChart</div> }))
jest.mock('@/components/dashboard/BarChart', () => ({ __esModule: true, default: () => <div>BarChart</div> }))
jest.mock('@/components/dashboard/DonutChart', () => ({ __esModule: true, default: () => <div>DonutChart</div> }))
jest.mock('@/components/dashboard/SpendBarChart', () => ({ __esModule: true, default: () => <div>SpendBarChart</div> }))
jest.mock('@/components/dashboard/CustomerTable', () => ({
  __esModule: true,
  default: ({ loading }: any) => loading ? <div className="skeleton" /> : <div>CustomerTable</div>,
}))
jest.mock('@/components/dashboard/UrgencyStrip', () => ({
  __esModule: true,
  default: ({ count }: any) => count > 0 ? <div>UrgencyStrip</div> : null,
}))
jest.mock('@/components/outreach/OutreachDrawer', () => ({
  __esModule: true,
  default: () => <div>OutreachDrawer</div>,
}))
jest.mock('@/components/ui/Toast', () => ({ __esModule: true, default: () => null }))
jest.mock('@/lib/api', () => ({ __esModule: true, default: { post: jest.fn() } }))
jest.mock('@/lib/sound', () => ({ sounds: { aiGenerating: jest.fn(), success: jest.fn(), error: jest.fn() } }))

import { useOverview } from '@/lib/hooks/useOverview'
import { useCustomers } from '@/lib/hooks/useCustomers'

const OVERVIEW = { total_customers: 100, high_risk_count: 5, total_revenue: 5000, avg_visits_per_customer: 3 }
const CUSTOMERS = [
  { id: '1', name: 'Alice', email: 'a@test.com', total_visits: 5, total_spent: 100, last_visit_at: '2026-01-01T00:00:00Z', churn_risk: 'Low', churn_risk_score: 0.1 },
  { id: '2', name: 'Bob', email: 'b@test.com', total_visits: 1, total_spent: 20, last_visit_at: '2025-10-01T00:00:00Z', churn_risk: 'High', churn_risk_score: 0.9 },
]

describe('DashboardPage', () => {
  it('shows skeletons while loading', () => {
    (useOverview as jest.Mock).mockReturnValue({ data: undefined, isLoading: true })
    ;(useCustomers as jest.Mock).mockReturnValue({ data: undefined, isLoading: true })
    const { container } = render(<DashboardPage />)
    expect(container.querySelectorAll('.skeleton').length).toBeGreaterThan(0)
  })

  it('shows stat card labels when data loaded', () => {
    (useOverview as jest.Mock).mockReturnValue({ data: OVERVIEW, isLoading: false })
    ;(useCustomers as jest.Mock).mockReturnValue({ data: [], isLoading: false })
    render(<DashboardPage />)
    expect(screen.getByText('Total Customers')).toBeInTheDocument()
  })

  it('renders DonutChart and SpendBarChart', () => {
    (useOverview as jest.Mock).mockReturnValue({ data: OVERVIEW, isLoading: false })
    ;(useCustomers as jest.Mock).mockReturnValue({ data: CUSTOMERS, isLoading: false })
    render(<DashboardPage />)
    expect(screen.getByText('DonutChart')).toBeInTheDocument()
    expect(screen.getByText('SpendBarChart')).toBeInTheDocument()
  })

  it('renders UrgencyStrip when high-risk customers exist', () => {
    (useOverview as jest.Mock).mockReturnValue({ data: OVERVIEW, isLoading: false })
    ;(useCustomers as jest.Mock).mockReturnValue({ data: CUSTOMERS, isLoading: false })
    render(<DashboardPage />)
    expect(screen.getByText('UrgencyStrip')).toBeInTheDocument()
  })

  it('renders OutreachDrawer', () => {
    (useOverview as jest.Mock).mockReturnValue({ data: OVERVIEW, isLoading: false })
    ;(useCustomers as jest.Mock).mockReturnValue({ data: CUSTOMERS, isLoading: false })
    render(<DashboardPage />)
    expect(screen.getByText('OutreachDrawer')).toBeInTheDocument()
  })
})
