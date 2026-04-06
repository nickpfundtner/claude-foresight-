'use client'
import { useEffect } from 'react'

interface ToastProps {
  message: string
  type?: 'success' | 'error'
  onClose: () => void
}

export default function Toast({ message, type = 'success', onClose }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500)
    return () => clearTimeout(t)
  }, [onClose])

  const color = type === 'success' ? 'border-p0 text-p1' : 'border-pd1 text-pd1'

  return (
    <div className={`toast-enter fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl border bg-surface text-sm font-medium shadow-xl ${color}`}>
      {message}
    </div>
  )
}
