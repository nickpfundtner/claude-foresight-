import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  token: string | null
  role: 'owner' | 'worker' | null
  userName: string | null
  userRoleName: string | null
  setUser: (token: string, role: 'owner' | 'worker', userName?: string | null, userRoleName?: string | null) => void
  clearToken: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      role: null,
      userName: null,
      userRoleName: null,
      setUser: (token, role, userName = null, userRoleName = null) =>
        set({ token, role, userName, userRoleName }),
      clearToken: () => set({ token: null, role: null, userName: null, userRoleName: null }),
    }),
    { name: 'foresight_auth' }
  )
)
