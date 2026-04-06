import { render, screen, fireEvent } from '@testing-library/react'
import Button from '@/components/ui/Button'

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByText('Click me')).toBeInTheDocument()
  })

  it('calls onClick', () => {
    const fn = jest.fn()
    render(<Button onClick={fn}>Go</Button>)
    fireEvent.click(screen.getByText('Go'))
    expect(fn).toHaveBeenCalled()
  })

  it('is disabled when disabled prop is set', () => {
    render(<Button disabled>Nope</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('primary button has gradient background style', () => {
    const { getByRole } = render(<Button>Save</Button>)
    const btn = getByRole('button')
    expect(btn).toHaveStyle('background: linear-gradient(135deg, #FF6040, #FF5090)')
  })

  it('does not call onClick when disabled', () => {
    const fn = jest.fn()
    render(<Button disabled onClick={fn}>Nope</Button>)
    fireEvent.click(screen.getByRole('button'))
    expect(fn).not.toHaveBeenCalled()
  })

  it('ghost variant renders with border class', () => {
    const { getByRole } = render(<Button variant="ghost">Ghost</Button>)
    expect(getByRole('button').className).toContain('border')
  })
})
