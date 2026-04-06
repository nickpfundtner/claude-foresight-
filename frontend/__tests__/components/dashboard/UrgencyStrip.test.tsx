import React from 'react'
import { render, screen } from '@testing-library/react'
import UrgencyStrip from '@/components/dashboard/UrgencyStrip'

describe('UrgencyStrip', () => {
  it('renders message with count when count > 0', () => {
    render(<UrgencyStrip count={3} />)
    expect(screen.getByText(/3 customers at high churn risk/i)).toBeInTheDocument()
  })

  it('renders nothing when count is 0', () => {
    const { container } = render(<UrgencyStrip count={0} />)
    expect(container.firstChild).toBeNull()
  })

  it('uses singular "customer" when count is 1', () => {
    render(<UrgencyStrip count={1} />)
    expect(screen.getByText(/1 customer at high churn risk/i)).toBeInTheDocument()
  })
})
