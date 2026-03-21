'use client'
import { useRef, useEffect, useState, useCallback } from 'react'

type Tab = 'Freq' | 'Risk' | 'Spend'

const MOCK: Record<Tab, { label: string; value: number }[]> = {
  Freq:  [{ label: '1-2', value: 34 }, { label: '3-5', value: 58 }, { label: '6-10', value: 40 }, { label: '11+', value: 22 }],
  Risk:  [{ label: 'Low', value: 55 }, { label: 'Med', value: 30 }, { label: 'High', value: 18 }],
  Spend: [{ label: '<$50', value: 40 }, { label: '$50-150', value: 62 }, { label: '>$150', value: 28 }],
}

const COLORS: Record<Tab, string[]> = {
  Freq:  ['#FF8060', '#FF6040', '#E04020', '#B82E10'],
  Risk:  ['#FFAA88', '#FF6040', '#E04020'],
  Spend: ['#FFD0BB', '#FF8060', '#FF6040'],
}

export default function BarChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [tab, setTab] = useState<Tab>('Freq')
  const animRef = useRef<number>(0)

  const draw = useCallback((t: Tab) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const W = canvas.width
    const H = canvas.height
    const pts = MOCK[t]
    const colors = COLORS[t]
    const pad = { top: 20, right: 24, bottom: 40, left: 40 }
    const innerW = W - pad.left - pad.right
    const innerH = H - pad.top - pad.bottom
    const maxVal = Math.max(...pts.map((p) => p.value)) * 1.15 || 1
    const barW = (innerW / pts.length) * 0.6
    const gap = (innerW / pts.length) * 0.4

    const duration = 800
    const stagger = 100
    const start = performance.now()

    function frame(now: number) {
      ctx.clearRect(0, 0, W, H)

      // Grid
      ctx.strokeStyle = 'rgba(255,255,255,0.06)'
      ctx.lineWidth = 1
      for (let i = 0; i <= 4; i++) {
        const y = pad.top + (innerH * i) / 4
        ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke()
      }

      let stillAnimating = false
      pts.forEach((p, i) => {
        const elapsed = now - start - i * stagger
        const progress = Math.min(Math.max(elapsed / duration, 0), 1)
        const eased = 1 - Math.pow(1 - progress, 3)
        if (progress < 1) stillAnimating = true

        const barH = innerH * (p.value / maxVal) * eased
        const x = pad.left + i * (barW + gap) + gap / 2
        const y = pad.top + innerH - barH

        const grad = ctx.createLinearGradient(0, y, 0, y + barH)
        grad.addColorStop(0, colors[i % colors.length])
        grad.addColorStop(1, colors[i % colors.length] + '66')
        ctx.fillStyle = grad
        ctx.beginPath()
        // roundRect with fallback for older environments
        if (ctx.roundRect) {
          ctx.roundRect(x, y, barW, barH, [4, 4, 0, 0])
        } else {
          ctx.rect(x, y, barW, barH)
        }
        ctx.fill()

        // Value label
        if (eased > 0.8) {
          ctx.fillStyle = colors[i % colors.length]
          ctx.font = '11px JetBrains Mono, monospace'
          ctx.textAlign = 'center'
          ctx.fillText(String(p.value), x + barW / 2, y - 6)
        }

        // X label
        ctx.fillStyle = 'rgba(107,90,82,0.9)'
        ctx.font = '11px Inter, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(p.label, x + barW / 2, H - 10)
      })

      if (stillAnimating) animRef.current = requestAnimationFrame(frame)
    }

    if (animRef.current) cancelAnimationFrame(animRef.current)
    animRef.current = requestAnimationFrame(frame)
  }, [])

  useEffect(() => {
    draw(tab)
    const handler = () => { if (!document.hidden) draw(tab) }
    document.addEventListener('visibilitychange', handler)
    return () => {
      document.removeEventListener('visibilitychange', handler)
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [tab, draw])

  return (
    <div className="bg-surface rounded-2xl border border-white/5 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-ftext">Visit Distribution</h3>
        <div className="flex gap-1">
          {(['Freq', 'Risk', 'Spend'] as Tab[]).map((t) => (
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
