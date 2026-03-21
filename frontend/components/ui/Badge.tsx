interface BadgeProps {
  risk: 'High' | 'Medium' | 'Low'
}

const styles = {
  High:   'bg-pd1/20 text-pd1 border border-pd1/40 glow-pulse',
  Medium: 'bg-p0/20 text-p0 border border-p0/40',
  Low:    'bg-p2/20 text-p2 border border-p2/40',
}

export default function Badge({ risk }: BadgeProps) {
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-mono font-semibold ${styles[risk]}`}>
      {risk}
    </span>
  )
}
