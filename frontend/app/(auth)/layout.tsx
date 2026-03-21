import ParticleCanvas from '@/components/layout/ParticleCanvas'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg relative">
      <ParticleCanvas />
      <div className="relative z-10">{children}</div>
    </div>
  )
}
