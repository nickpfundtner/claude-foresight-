import React from 'react'
import { render, screen } from '@testing-library/react'
import DonutChart from '@/components/dashboard/DonutChart'

describe('DonutChart', () => {
  it('renders a canvas element', () => {
    const { container } = render(<DonutChart low={10} medium={5} high={3} />)
    expect(container.querySelector('canvas')).toBeInTheDocument()
  })

  it('renders the title', () => {
    render(<DonutChart low={10} medium={5} high={3} />)
    expect(screen.getByText('Churn Risk')).toBeInTheDocument()
  })

  it('renders center count label when high > 0', () => {
    const { container } = render(<DonutChart low={10} medium={5} high={3} />)
    expect(screen.getByText(/at risk/i)).toBeInTheDocument()
    // Verify the high count appears in the center overlay (before the "at risk" text in DOM order)
    const centerOverlay = container.querySelector('.absolute.inset-0')
    expect(centerOverlay).toHaveTextContent('3')
    expect(centerOverlay).toHaveTextContent(/at risk/i)
  })

  it('renders legend labels', () => {
    render(<DonutChart low={10} medium={5} high={3} />)
    expect(screen.getByText('Low')).toBeInTheDocument()
    expect(screen.getByText('Medium')).toBeInTheDocument()
    expect(screen.getByText('High')).toBeInTheDocument()
  })
})
