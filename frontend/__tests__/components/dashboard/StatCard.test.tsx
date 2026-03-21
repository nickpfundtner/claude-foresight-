import React from 'react'
import { render, screen } from '@testing-library/react'
import StatCard from '@/components/dashboard/StatCard'

describe('StatCard', () => {
  it('renders label', () => {
    render(<StatCard label="Total Customers" value={42} color="var(--p0)" />)
    expect(screen.getByText('Total Customers')).toBeInTheDocument()
  })

  it('renders skeleton when loading', () => {
    const { container } = render(<StatCard label="Total Customers" value={0} color="var(--p0)" loading />)
    expect(container.querySelector('.skeleton')).toBeInTheDocument()
  })
})
