'use client'
import { useRef, useEffect, useState, useCallback } from 'react'

interface DataPoint { label: string; value: number }
type Tab = '6M' | '3M' | '1M'

const MOCK: Record<Tab, DataPoint[]> = {
  '6M': [
    { label: 'Oct', value: 4200 }, { label: 'Nov', value: 5100 }, { label: 'Dec', value: 6800 },
    { label: 'Jan', value: 5900 }, { label: 'Feb', value: 7200 }, { label: 'Mar', value: 8100 },
  ],
  '3M': [
    { label: 'Jan', value: 5900 }, { label: 'Feb', value: 7200 }, { label: 'Mar', value: 8100 },
  ],
  '1M': [
    { label: 'Wk1', value: 1800 }, { label: 'Wk2', value: 2100 }, { label: 'Wk3', value: 1950 }, { label: 'Wk4', value: 2250 },
  ],
}

interface LineChartProps {
  data?: DataPoint[]
}

export default function LineChart({ data }: LineChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [tab, setTab] = useState<Tab>('6M')
  const animRef = useRef<number>(0)

  const points = data ?? MOCK[tab]

  const draw = useCallback((pts: DataPoint[]) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const W = canvas.width
    const H = canvas.height

    const pad = { top: 20, right: 24, bottom: 40, left: 48 }
    const innerW = W - pad.left - pad.right
    const innerH = H - pad.top - pad.bottom
    const maxVal = Math.max(...pts.map((p) => p.value)) * 1.1 || 1

    const duration = 2000
    const start = performance.now()

    function frame(now: number) {
      const t = Math.min((now - start) / duration, 1)
      ctx.clearRect(0, 0, W, H)

      // Grid lines
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'
      ctx.lineWidth = 1
      for (let i = 0; i <= 4; i++) {
        const y = pad.top + (innerH * i) / 4
        ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke()
      }

      // X labels
      ctx.fillStyle = 'rgba(107,90,82,0.9)'
      ctx.font = '11px Inter, sans-serif'
      ctx.textAlign = 'center'
      pts.forEach((p, i) => {
        const x = pad.left + (i / Math.max(pts.length - 1, 1)) * innerW
        ctx.fillText(p.label, x, H - 10)
      })

      // Clip to animated width
      const clipX = pad.left + t * innerW
      ctx.save()
      ctx.beginPath()
      ctx.rect(0, 0, clipX, H)
      ctx.clip()

      // Gradient fill
      const grad = ctx.createLinearGradient(0, pad.top, 0, H - pad.bottom)
      grad.addColorStop(0, 'rgba(255,96,64,0.3)')
      grad.addColorStop(1, 'rgba(255,96,64,0)')

      // Build bezier path
      function ptX(i: number) { return pad.left + (i / Math.max(pts.length - 1, 1)) * innerW }
      function ptY(i: number) { return pad.top + innerH * (1 - pts[i].value / maxVal) }

      ctx.beginPath()
      pts.forEach((_, i) => {
        const x = ptX(i); const y = ptY(i)
        if (i === 0) { ctx.moveTo(x, y) }
        else {
          const px = ptX(i - 1); const py = ptY(i - 1)
          ctx.bezierCurveTo(px + (x - px) * 0.5, py, px + (x - px) * 0.5, y, x, y)
        }
      })
      // Fill path
      const lastX = ptX(pts.length - 1)
      ctx.lineTo(lastX, H - pad.bottom)
      ctx.lineTo(pad.left, H - pad.bottom)
      ctx.closePath()
      ctx.fillStyle = grad
      ctx.fill()

      // Draw line
      ctx.beginPath()
      pts.forEach((_, i) => {
        const x = ptX(i); const y = ptY(i)
        if (i === 0) { ctx.moveTo(x, y) }
        else {
          const px = ptX(i - 1); const py = ptY(i - 1)
          ctx.bezierCurveTo(px + (x - px) * 0.5, py, px + (x - px) * 0.5, y, x, y)
        }
      })
      ctx.strokeStyle = '#FF6040'
      ctx.lineWidth = 2.5
      ctx.stroke()

      // Pulsing live dot at last point
      const ldx = ptX(pts.length - 1)
      const ldy = ptY(pts.length - 1)
      const pulse = Math.sin(now / 300) * 0.4 + 0.6
      ctx.beginPath()
      ctx.arc(ldx, ldy, 5 * pulse, 0, Math.PI * 2)
      ctx.fillStyle = '#FF6040'
      ctx.fill()

      ctx.restore()

      if (t < 1 || true) animRef.current = requestAnimationFrame(frame) // keep pulsing dot alive
    }

    if (animRef.current) cancelAnimationFrame(animRef.current)
    animRef.current = requestAnimationFrame(frame)
  }, [])

  useEffect(() => {
    draw(points)
    const handler = () => { if (!document.hidden) draw(points) }
    document.addEventListener('visibilitychange', handler)
    return () => {
      document.removeEventListener('visibilitychange', handler)
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [points, draw])

  return (
    <div className="bg-surface rounded-2xl border border-white/5 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-ftext">Revenue</h3>
        <div className="flex gap-1">
          {(['6M', '3M', '1M'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1 rounded text-xs font-mono transition-all ${
                tab === t ? 'bg-p0/20 text-p1 border border-p0/40' : 'text-muted hover:text-ftext'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <canvas ref={canvasRef} width={560} height={220} className="w-full" />
    </div>
  )
}
