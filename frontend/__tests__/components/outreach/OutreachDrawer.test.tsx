import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import OutreachDrawer from '@/components/outreach/OutreachDrawer'
import { CustomerSummary } from '@/lib/hooks/useCustomers'

jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}))
jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: {
    post: jest.fn().mockResolvedValue({
      data: { draft: 'Hi Alice, we miss you!', subject: 'We miss you' },
    }),
  },
}))
jest.mock('@/lib/sound', () => ({
  sounds: { aiGenerating: jest.fn(), success: jest.fn(), error: jest.fn(), click: jest.fn() },
}))
jest.mock('@/components/ui/Button', () => ({
  __esModule: true,
  default: ({ children, onClick, disabled }: any) => (
    <button onClick={onClick} disabled={disabled}>{children}</button>
  ),
}))

const CUSTOMER: CustomerSummary = {
  id: '1', name: 'Alice Smith', email: 'alice@test.com',
  total_visits: 12, total_spent: 340.50, last_visit_at: '2026-03-01T00:00:00Z',
  churn_risk: 'Low', churn_risk_score: 0.2,
}

describe('OutreachDrawer', () => {
  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <OutreachDrawer isOpen={false} customer={null} onClose={jest.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders customer name when open', () => {
    render(<OutreachDrawer isOpen={true} customer={CUSTOMER} onClose={jest.fn()} />)
    expect(screen.getByText('Alice Smith')).toBeInTheDocument()
  })

  it('calls onClose when × button clicked', () => {
    const fn = jest.fn()
    render(<OutreachDrawer isOpen={true} customer={CUSTOMER} onClose={fn} />)
    fireEvent.click(screen.getByRole('button', { name: '×' }))
    expect(fn).toHaveBeenCalled()
  })

  it('shows Generate Draft button before generating', () => {
    render(<OutreachDrawer isOpen={true} customer={CUSTOMER} onClose={jest.fn()} />)
    expect(screen.getByText(/generate draft/i)).toBeInTheDocument()
  })

  it('shows draft after generate completes', async () => {
    render(<OutreachDrawer isOpen={true} customer={CUSTOMER} onClose={jest.fn()} />)
    fireEvent.click(screen.getByText(/generate draft/i))
    await waitFor(() => {
      // Draft body div contains the text (possibly split by spans)
      expect(screen.getByText(/we miss you/i)).toBeInTheDocument()
    })
  })

  it('shows Copy Draft button after draft is loaded', async () => {
    render(<OutreachDrawer isOpen={true} customer={CUSTOMER} onClose={jest.fn()} />)
    fireEvent.click(screen.getByText(/generate draft/i))
    await waitFor(() => expect(screen.getByText(/copy draft/i)).toBeInTheDocument())
  })
})
