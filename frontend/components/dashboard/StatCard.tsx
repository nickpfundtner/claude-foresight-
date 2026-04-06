'use client'
import { useEffect, useState } from 'react'

interface StatCardProps {
  label: string
  value: number
  maxValue: number
  color: string
  prefix?: string
  suffix?: string
  decimals?: number
  loading?: boolean
  thresholdPct?: number
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

function ProgressRing({ value, maxValue, thresholdPct = 0.5 }: { value: number; maxValue: number; thresholdPct?: number }) {
  const [progress, setProgress] = useState(0)
  const radius = 36
  const stroke = 3
  const normalised = radius - stroke / 2
  const circumference = 2 * Math.PI * normalised
  const pct = maxValue > 0 ? Math.min(value / maxValue, 1) : 0
  const ringColor = pct >= thresholdPct ? '#40FF80' : '#FF3040'

  useEffect(() => {
    const timer = setTimeout(() => setProgress(pct), 50)
    return () => clearTimeout(timer)
  }, [pct])

  const dashOffset = circumference * (1 - progress)

  return (
    <svg
      width={radius * 2}
      height={radius * 2}
      className="absolute top-3 right-3 opacity-30 -rotate-90"
    >
      <circle
        cx={radius}
        cy={radius}
        r={normalised}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={stroke}
      />
      <circle
        cx={radius}
        cy={radius}
        r={normalised}
        fill="none"
        stroke={ringColor}
        strokeWidth={stroke}
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
      />
    </svg>
  )
}

export default function StatCard({ label, value, maxValue, color, prefix = '', suffix = '', decimals = 0, loading = false, thresholdPct = 0.5 }: StatCardProps) {
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
      className="relative bg-surface rounded-2xl p-6 border border-white/5 transition-all hover:border-white/10"
      style={{ boxShadow: `0 0 20px 2px ${color}22` }}
    >
      <ProgressRing value={value} maxValue={maxValue} thresholdPct={thresholdPct} />
      <p className="text-xs font-semibold uppercase tracking-widest text-muted mb-2">{label}</p>
      <p className="text-3xl font-black" style={{ color }}>
        {prefix}{display}{suffix}
      </p>
    </div>
  )
}
