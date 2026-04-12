'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'
import { setMuted, isMuted } from '@/lib/sound'
import { useState } from 'react'

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: '▦' },
  { href: '/customers', label: 'Customers', icon: '◈' },
  { href: '/staff/workers', label: 'Staff', icon: '◉' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const clearToken = useAuthStore((s) => s.clearToken)
  const [muted, setMutedState] = useState(isMuted())

  async function handleLogout() {
    clearToken()
    await fetch('/api/auth/token', { method: 'DELETE' })
    router.push('/login')
  }

  function toggleMute() {
    const next = !muted
    setMuted(next)
    setMutedState(next)
  }

  return (
    <aside className="w-56 min-h-screen bg-surface border-r border-white/5 flex flex-col py-6 px-4">
      {/* Logo */}
      <div className="mb-8">
        <span className="text-xl font-black text-p0 tracking-tight">FORESIGHT</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1">
        {NAV.map(({ href, label, icon }) => {
          const active =
            href === '/staff/workers'
              ? pathname.startsWith('/staff')
              : pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                active
                  ? 'bg-p0/20 text-p1 border border-p0/30'
                  : 'text-muted hover:text-ftext hover:bg-white/5'
              }`}
            >
              <span className="text-base">{icon}</span>
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="space-y-2">
        <button
          onClick={toggleMute}
          className="w-full text-left px-3 py-2 text-xs text-muted hover:text-ftext rounded-lg hover:bg-white/5 transition-all"
        >
          {muted ? 'Sound off' : 'Sound on'}
        </button>
        <button
          onClick={handleLogout}
          className="w-full text-left px-3 py-2 text-xs text-muted hover:text-pd1 rounded-lg hover:bg-white/5 transition-all"
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}
