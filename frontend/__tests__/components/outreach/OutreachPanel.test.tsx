import React from 'react'
import { render, screen } from '@testing-library/react'
import OutreachPanel from '@/components/outreach/OutreachPanel'

jest.mock('@/lib/api', () => ({ __esModule: true, default: { post: jest.fn() } }))
jest.mock('@/lib/sound', () => ({ sounds: { aiGenerating: jest.fn(), success: jest.fn(), error: jest.fn() } }))
jest.mock('@/components/ui/Button', () => ({
  __esModule: true,
  default: ({ children, onClick, disabled }: any) => <button onClick={onClick} disabled={disabled}>{children}</button>,
}))
jest.mock('@/components/ui/Toast', () => ({
  __esModule: true,
  default: ({ message }: any) => <div>{message}</div>,
}))

describe('OutreachPanel', () => {
  it('shows generate button when no draft', () => {
    render(<OutreachPanel customerId="1" customerName="Alice" onClose={jest.fn()} />)
    expect(screen.getByText(/generate/i)).toBeInTheDocument()
  })

  it('shows customer name in header', () => {
    render(<OutreachPanel customerId="1" customerName="Alice" onClose={jest.fn()} />)
    expect(screen.getByText(/Alice/)).toBeInTheDocument()
  })
})
