import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
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

const LOW: CustomerSummary = {
  id: '1', name: 'Alice Smith', email: 'alice@test.com',
  total_visits: 12, total_spent: 340.50, last_visit_at: '2026-03-01T00:00:00Z',
  churn_risk: 'Low', churn_risk_score: 0.2,
}
const HIGH: CustomerSummary = {
  id: '2', name: 'Bob Jones', email: 'bob@test.com',
  total_visits: 2, total_spent: 40, last_visit_at: '2025-12-01T00:00:00Z',
  churn_risk: 'High', churn_risk_score: 0.85,
}

describe('CustomerTable', () => {
  it('renders customer name', () => {
    render(<CustomerTable customers={[LOW]} onOutreach={jest.fn()} />)
    expect(screen.getByText('Alice Smith')).toBeInTheDocument()
  })

  it('renders skeleton when loading', () => {
    const { container } = render(<CustomerTable customers={[]} loading onOutreach={jest.fn()} />)
    expect(container.querySelector('.skeleton')).toBeInTheDocument()
  })

  it('renders churn mini-bar for each customer', () => {
    const { container } = render(<CustomerTable customers={[LOW]} onOutreach={jest.fn()} />)
    expect(container.querySelector('[data-testid="churn-bar"]')).toBeInTheDocument()
  })

  it('mini-bar width reflects churn_risk_score', () => {
    const { container } = render(<CustomerTable customers={[LOW]} onOutreach={jest.fn()} />)
    const bar = container.querySelector('[data-testid="churn-bar"]') as HTMLElement
    expect(bar.style.width).toBe('20%')
  })

  it('row click calls onOutreach with the customer', () => {
    const fn = jest.fn()
    render(<CustomerTable customers={[LOW]} onOutreach={fn} />)
    fireEvent.click(screen.getByText('Alice Smith'))
    expect(fn).toHaveBeenCalledWith(LOW)
  })

  it('high-risk row has pulse class', () => {
    const { container } = render(<CustomerTable customers={[HIGH]} onOutreach={jest.fn()} />)
    const row = container.querySelector('tr[data-risk="High"]')
    expect(row?.className).toMatch(/pulse-risk/)
  })
})
