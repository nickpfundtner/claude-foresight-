'use client'
import { ButtonHTMLAttributes, useRef } from 'react'
import { sounds } from '@/lib/sound'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost'
}

export default function Button({ variant = 'primary', className = '', onClick, children, ...props }: ButtonProps) {
  const ref = useRef<HTMLButtonElement>(null)

  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    sounds.click()
    // Ripple
    const btn = ref.current
    if (btn) {
      const ripple = document.createElement('span')
      const rect = btn.getBoundingClientRect()
      const size = Math.max(rect.width, rect.height)
      ripple.style.cssText = `
        position:absolute;width:${size}px;height:${size}px;
        left:${e.clientX - rect.left - size / 2}px;
        top:${e.clientY - rect.top - size / 2}px;
        border-radius:50%;background:rgba(255,255,255,0.25);
        transform:scale(0);animation:ripple 0.5s ease-out forwards;pointer-events:none;
      `
      btn.appendChild(ripple)
      setTimeout(() => ripple.remove(), 500)
    }
    onClick?.(e)
  }

  const base =
    'relative overflow-hidden px-4 py-2 rounded-lg font-semibold text-sm transition-all cursor-pointer select-none'
  const variants = {
    primary:
      'bg-p0 text-white shadow-[0_0_12px_2px_rgba(255,96,64,0.4)] hover:shadow-[0_0_20px_6px_rgba(255,96,64,0.6)] hover:bg-p1 active:scale-95',
    ghost:
      'border border-p0/40 text-p1 hover:border-p0 hover:bg-p0/10 active:scale-95',
  }

  return (
    <button
      ref={ref}
      className={`${base} ${variants[variant]} ${className}`}
      onClick={handleClick}
      {...props}
    >
      {children}
    </button>
  )
}
