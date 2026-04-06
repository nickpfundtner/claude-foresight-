// frontend/__tests__/pages/login.test.tsx
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import LoginPage from '@/app/(auth)/login/page'

jest.mock('@/lib/api', () => ({ __esModule: true, default: { post: jest.fn() } }))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('@/lib/store', () => ({
  useAuthStore: (selector: (s: { setToken: (t: string) => void }) => unknown) =>
    selector({ setToken: jest.fn() }),
}))
jest.mock('@/lib/sound', () => ({ sounds: { success: jest.fn(), error: jest.fn() } }))
jest.mock('@/components/ui/Button', () => ({
  __esModule: true,
  default: ({ children, onClick, disabled, type }: any) => (
    <button onClick={onClick} disabled={disabled} type={type}>{children}</button>
  ),
}))
jest.mock('@/components/ui/Toast', () => ({
  __esModule: true,
  default: ({ message }: any) => <div>{message}</div>,
}))

import api from '@/lib/api'
const mockedApi = api as jest.Mocked<typeof api>

describe('LoginPage', () => {
  beforeEach(() => { global.fetch = jest.fn().mockResolvedValue({ ok: true }) })

  it('renders email and password fields', () => {
    render(<LoginPage />)
    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument()
  })

  it('calls backend on submit', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { access_token: 'tok' } })
    render(<LoginPage />)
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'pass' } })
    fireEvent.click(screen.getByText('Sign In'))
    await waitFor(() => expect(mockedApi.post).toHaveBeenCalledWith('/auth/login', { username: 'a@b.com', password: 'pass' }))
  })
})
