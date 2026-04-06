import React from 'react'
import { render, screen } from '@testing-library/react'
import SpendBarChart from '@/components/dashboard/SpendBarChart'

describe('SpendBarChart', () => {
  it('renders a canvas element', () => {
    const { container } = render(<SpendBarChart />)
    expect(container.querySelector('canvas')).toBeInTheDocument()
  })

  it('renders the title', () => {
    render(<SpendBarChart />)
    expect(screen.getByText('Avg Spend / Visit')).toBeInTheDocument()
  })

  it('renders tabs All, New, VIP', () => {
    render(<SpendBarChart />)
    expect(screen.getByText('All')).toBeInTheDocument()
    expect(screen.getByText('New')).toBeInTheDocument()
    expect(screen.getByText('VIP')).toBeInTheDocument()
  })

  it('clicking a tab does not throw', () => {
    render(<SpendBarChart />)
    expect(() => {
      screen.getByText('VIP').click()
    }).not.toThrow()
  })
})
