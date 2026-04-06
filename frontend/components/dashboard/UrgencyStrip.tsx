'use client'

interface Props {
  count: number
}

export default function UrgencyStrip({ count }: Props) {
  if (count === 0) return null

  const label = count === 1 ? '1 customer at high churn risk' : `${count} customers at high churn risk`

  return (
    <div
      className="relative overflow-hidden rounded-xl px-5 py-3 text-sm font-medium text-red-300"
      style={{
        background: 'linear-gradient(90deg, rgba(255,48,64,0.12), rgba(255,96,64,0.12))',
        border: '1px solid rgba(255,48,64,0.25)',
      }}
    >
      <span
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(255,96,64,0.15) 50%, transparent 100%)',
          animation: 'shimmer 4s ease-in-out infinite',
          backgroundSize: '200% 100%',
        }}
      />
      <span className="relative">
        ⚠ {label} — act today
      </span>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </div>
  )
}
