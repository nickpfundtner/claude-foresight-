'use client'
import { useEffect, useState } from 'react'

interface StatCardProps {
  label: string
  value: number
  color: string
  prefix?: string
  suffix?: string
  decimals?: number
  loading?: boolean
}

function useAnimatedCount(target: number, decimals = 0, duration = 1800) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (target === 0) return
    let start = 0
    const step = target / (duration / 16)
    const timer = setInterval(() => {
      start += step
      if (start >= target) { setCount(target); clearInterval(timer) }
      else setCount(start)
    }, 16)
    return () => clearInterval(timer)
  }, [target, duration])
  return decimals > 0 ? count.toFixed(decimals) : Math.round(count).toLocaleString()
}

export default function StatCard({ label, value, color, prefix = '', suffix = '', decimals = 0, loading = false }: StatCardProps) {
  const display = useAnimatedCount(value, decimals)

  if (loading) {
    return (
      <div className="bg-surface rounded-2xl p-6 border border-white/5">
        <div className="skeleton h-4 w-24 mb-3" />
        <div className="skeleton h-8 w-32" />
      </div>
    )
  }

  return (
    <div
      className="bg-surface rounded-2xl p-6 border border-white/5 transition-all hover:border-white/10"
      style={{ boxShadow: `0 0 20px 2px ${color}22` }}
    >
      <p className="text-xs font-semibold uppercase tracking-widest text-muted mb-2">{label}</p>
      <p className="text-3xl font-black" style={{ color }}>
        {prefix}{display}{suffix}
      </p>
    </div>
  )
}
