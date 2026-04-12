import Providers from '@/app/providers'

export default function TrainingLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <div className="min-h-screen bg-bg text-ftext">
        {children}
      </div>
    </Providers>
  )
}
