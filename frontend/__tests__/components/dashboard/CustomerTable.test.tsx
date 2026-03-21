import React from 'react'
import { render, screen } from '@testing-library/react'
import CustomerTable from '@/components/dashboard/CustomerTable'
import { CustomerSummary } from '@/lib/hooks/useCustomers'

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('@/components/ui/Badge', () => ({
  __esModule: true,
  default: ({ risk }: { risk: string }) => <span>{risk}</span>,
}))
jest.mock('@/components/ui/Button', () => ({
  __esModule: true,
  default: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
}))

const CUSTOMERS: CustomerSummary[] = [
  {
    id: '1', name: 'Alice Smith', email: 'alice@test.com',
    total_visits: 12, total_spent: 340.50, last_visit_at: '2026-03-01T00:00:00Z',
    churn_risk: 'Low', churn_risk_score: 0.2,
  },
]

describe('CustomerTable', () => {
  it('renders customer name', () => {
    render(<CustomerTable customers={CUSTOMERS} onOutreach={jest.fn()} />)
    expect(screen.getByText('Alice Smith')).toBeInTheDocument()
  })

  it('renders skeleton when loading', () => {
    const { container } = render(<CustomerTable customers={[]} loading onOutreach={jest.fn()} />)
    expect(container.querySelector('.skeleton')).toBeInTheDocument()
  })
})
