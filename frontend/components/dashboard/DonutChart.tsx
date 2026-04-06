'use client'
import { useRef, useEffect, useCallback } from 'react'

interface Props {
  low: number
  medium: number
  high: number
}

const SEGMENTS = [
  { key: 'low' as const, label: 'Low', color: '#40FF80' },
  { key: 'medium' as const, label: 'Medium', color: '#FFB040' },
  { key: 'high' as const, label: 'High', color: '#FF3040' },
]

export default function DonutChart({ low, medium, high }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const W = canvas.width
    const H = canvas.height
    const cx = W / 2
    const cy = H / 2
    const outerR = Math.min(W, H) / 2 - 8
    const innerR = outerR * 0.62

    const total = low + medium + high || 1
    const values = { low, medium, high }
    const angles = SEGMENTS.map((s) => (values[s.key] / total) * Math.PI * 2)

    const duration = 900
    const start = performance.now()

    function frame(now: number) {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)

      ctx!.clearRect(0, 0, W, H)

      let startAngle = -Math.PI / 2
      SEGMENTS.forEach((seg, i) => {
        const endAngle = startAngle + angles[i] * eased
        ctx!.beginPath()
        ctx!.arc(cx, cy, outerR, startAngle, endAngle)
        ctx!.arc(cx, cy, innerR, endAngle, startAngle, true)
        ctx!.closePath()
        ctx!.fillStyle = seg.color + (i === 2 ? 'ff' : 'cc')
        ctx!.fill()
        startAngle = startAngle + angles[i]
      })

      if (t < 1) animRef.current = requestAnimationFrame(frame)
    }

    if (animRef.current) cancelAnimationFrame(animRef.current)
    animRef.current = requestAnimationFrame(frame)
  }, [low, medium, high])

  useEffect(() => {
    draw()
    const handler = () => { if (!document.hidden) draw() }
    document.addEventListener('visibilitychange', handler)
    return () => {
      document.removeEventListener('visibilitychange', handler)
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [draw])

  return (
    <div className="bg-surface rounded-2xl border border-white/5 p-6">
      <h3 className="text-sm font-semibold text-ftext mb-4">Churn Risk</h3>
      <div className="flex items-center gap-6">
        <div className="relative flex-shrink-0">
          <canvas ref={canvasRef} width={160} height={160} />
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-2xl font-black text-red-400">{high}</span>
            <span className="text-xs text-muted">at risk</span>
          </div>
        </div>
        <div className="space-y-2 text-sm">
          {SEGMENTS.map((s) => (
            <div key={s.key} className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
              <span className="text-muted">{s.label}</span>
              <span className="font-mono text-ftext ml-auto pl-4">
                {s.key === 'low' ? low : s.key === 'medium' ? medium : high}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
