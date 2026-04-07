'use client'
import { useRef, useEffect, useState, useCallback } from 'react'

type Tab = 'All' | 'New' | 'VIP'

const MOCK: Record<Tab, { label: string; value: number }[]> = {
  All:  [{ label: '<$25', value: 28 }, { label: '$25-50', value: 55 }, { label: '$50-100', value: 40 }, { label: '>$100', value: 18 }],
  New:  [{ label: '<$25', value: 45 }, { label: '$25-50', value: 32 }, { label: '$50-100', value: 14 }, { label: '>$100', value: 5 }],
  VIP:  [{ label: '<$25', value: 4 }, { label: '$25-50', value: 18 }, { label: '$50-100', value: 52 }, { label: '>$100', value: 38 }],
}

const COLORS: Record<Tab, string[]> = {
  All: ['#FFD0BB', '#FF8060', '#FF6040', '#E04020'],
  New: ['#FFE0D0', '#FFAA88', '#FF8060', '#FF6040'],
  VIP: ['#FF6040', '#FF5090', '#E04080', '#C03060'],
}

export default function SpendBarChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [tab, setTab] = useState<Tab>('All')
  const animRef = useRef<number>(0)

  const draw = useCallback((t: Tab) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const W = canvas.width
    const H = canvas.height
    const pts = MOCK[t]
    const colors = COLORS[t]
    const pad = { top: 20, right: 24, bottom: 40, left: 44 }
    const innerW = W - pad.left - pad.right
    const innerH = H - pad.top - pad.bottom
    const maxVal = Math.max(...pts.map((p) => p.value)) * 1.15 || 1
    const barW = (innerW / pts.length) * 0.6
    const gap = (innerW / pts.length) * 0.4

    const duration = 800
    const stagger = 100
    const start = performance.now()

    function frame(now: number) {
      ctx!.clearRect(0, 0, W, H)

      ctx!.strokeStyle = 'rgba(255,255,255,0.06)'
      ctx!.lineWidth = 1
      for (let i = 0; i <= 4; i++) {
        const y = pad.top + (innerH * i) / 4
        ctx!.beginPath(); ctx!.moveTo(pad.left, y); ctx!.lineTo(W - pad.right, y); ctx!.stroke()
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

        const grad = ctx!.createLinearGradient(0, y, 0, y + barH)
        grad.addColorStop(0, colors[i % colors.length])
        grad.addColorStop(1, colors[i % colors.length] + '66')
        ctx!.fillStyle = grad
        ctx!.beginPath()
        if ('roundRect' in ctx!) {
          ctx!.roundRect(x, y, barW, barH, [4, 4, 0, 0])
        } else {
          ctx!.rect(x, y, barW, barH)
        }
        ctx!.fill()

        if (eased > 0.8) {
          ctx!.fillStyle = colors[i % colors.length]
          ctx!.font = '11px JetBrains Mono, monospace'
          ctx!.textAlign = 'center'
          ctx!.fillText(`$${p.value}`, x + barW / 2, y - 6)
        }

        ctx!.fillStyle = 'rgba(107,90,82,0.9)'
        ctx!.font = '11px Inter, sans-serif'
        ctx!.textAlign = 'center'
        ctx!.fillText(p.label, x + barW / 2, H - 10)
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
        <h3 className="text-sm font-semibold text-ftext">Avg Spend / Visit</h3>
        <div className="flex gap-1">
          {(['All', 'New', 'VIP'] as Tab[]).map((t) => (
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
