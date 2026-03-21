export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center gap-6 p-8">
      <span className="text-2xl font-black text-p0 tracking-tight">FORESIGHT</span>
      <div className="w-full max-w-md">{children}</div>
    </div>
  )
}
