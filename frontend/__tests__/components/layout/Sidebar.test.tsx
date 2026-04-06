// frontend/__tests__/components/layout/Sidebar.test.tsx
import React from 'react'
import { render, screen } from '@testing-library/react'
import Sidebar from '@/components/layout/Sidebar'

jest.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({ push: jest.fn() }),
}))
jest.mock('@/lib/store', () => ({
  useAuthStore: (selector: (s: { clearToken: () => void }) => unknown) =>
    selector({ clearToken: jest.fn() }),
}))
jest.mock('@/lib/sound', () => ({
  setMuted: jest.fn(),
  isMuted: () => false,
}))

describe('Sidebar', () => {
  it('renders nav links', () => {
    render(<Sidebar />)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Customers')).toBeInTheDocument()
  })

  it('shows FORESIGHT logo', () => {
    render(<Sidebar />)
    expect(screen.getByText('FORESIGHT')).toBeInTheDocument()
  })
})
