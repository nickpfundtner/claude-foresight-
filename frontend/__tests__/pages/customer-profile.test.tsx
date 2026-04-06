import React from 'react'
import { render, screen } from '@testing-library/react'
import CustomerProfilePage from '@/app/(app)/customers/[id]/page'

jest.mock('@/lib/hooks/useCustomers', () => ({ useCustomers: jest.fn() }))
jest.mock('@/lib/hooks/usePrediction', () => ({ usePrediction: jest.fn() }))
jest.mock('next/navigation', () => ({
  useParams: () => ({ id: '1' }),
  useRouter: () => ({ push: jest.fn() }),
}))
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: jest.fn() }) }))
jest.mock('@/components/ui/Badge', () => ({ __esModule: true, default: ({ risk }: any) => <span>{risk}</span> }))
jest.mock('@/components/ui/Button', () => ({ __esModule: true, default: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button> }))
jest.mock('@/components/ui/Toast', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/outreach/OutreachPanel', () => ({ __esModule: true, default: () => <div>OutreachPanel</div> }))
jest.mock('@/lib/api', () => ({ __esModule: true, default: { post: jest.fn() } }))
jest.mock('@/lib/sound', () => ({ sounds: { aiGenerating: jest.fn(), success: jest.fn(), error: jest.fn() } }))

import { useCustomers } from '@/lib/hooks/useCustomers'
import { usePrediction } from '@/lib/hooks/usePrediction'

const CUSTOMER = {
  id: '1', name: 'Alice Smith', email: 'alice@test.com',
  total_visits: 5, total_spent: 120, last_visit_at: '2026-03-01T00:00:00Z',
  churn_risk: 'Low' as const, churn_risk_score: 0.2,
}

describe('CustomerProfilePage', () => {
  it('renders customer name when data loaded', () => {
    (useCustomers as jest.Mock).mockReturnValue({ data: [CUSTOMER], isLoading: false })
    ;(usePrediction as jest.Mock).mockReturnValue({ data: undefined, isLoading: true, isError: false })
    render(<CustomerProfilePage />)
    expect(screen.getByText('Alice Smith')).toBeInTheDocument()
  })

  it('shows not found when customer missing', () => {
    (useCustomers as jest.Mock).mockReturnValue({ data: [], isLoading: false })
    ;(usePrediction as jest.Mock).mockReturnValue({ data: undefined, isLoading: false, isError: false })
    render(<CustomerProfilePage />)
    expect(screen.getByText(/not found/i)).toBeInTheDocument()
  })
})
