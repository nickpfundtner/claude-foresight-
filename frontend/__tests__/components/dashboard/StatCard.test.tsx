import React from 'react'
import { render, screen } from '@testing-library/react'
import StatCard from '@/components/dashboard/StatCard'

describe('StatCard', () => {
  it('renders label', () => {
    render(<StatCard label="Total Customers" value={42} maxValue={100} color="var(--p0)" />)
    expect(screen.getByText('Total Customers')).toBeInTheDocument()
  })

  it('renders skeleton when loading', () => {
    const { container } = render(<StatCard label="Total Customers" value={0} maxValue={100} color="var(--p0)" loading />)
    expect(container.querySelector('.skeleton')).toBeInTheDocument()
  })

  it('renders SVG progress ring when not loading', () => {
    const { container } = render(<StatCard label="Revenue" value={50} maxValue={100} color="var(--p0)" />)
    expect(container.querySelector('svg')).toBeInTheDocument()
    expect(container.querySelector('circle')).toBeInTheDocument()
  })

  it('ring is red when value is below threshold', () => {
    const { container } = render(<StatCard label="Risk" value={10} maxValue={100} color="var(--p0)" thresholdPct={0.5} />)
    const circles = container.querySelectorAll('circle')
    const ring = circles[1]
    expect(ring.getAttribute('stroke')).toBe('#FF3040')
  })

  it('ring is green when value is at or above threshold', () => {
    const { container } = render(<StatCard label="Risk" value={80} maxValue={100} color="var(--p0)" thresholdPct={0.5} />)
    const circles = container.querySelectorAll('circle')
    const ring = circles[1]
    expect(ring.getAttribute('stroke')).toBe('#40FF80')
  })
})
