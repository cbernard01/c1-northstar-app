import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface User {
  id: string
  name: string
  email: string
  avatar?: string
  role: string
}

interface AuthState {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  
  // Actions
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  devtools(
    (set) => ({
      user: null,
      isLoading: false, // Start as false, NextAuth will handle loading state
      isAuthenticated: false,

      setUser: (user) => {
        set({ 
          user, 
          isAuthenticated: user !== null,
          isLoading: false 
        })
      },

      setLoading: (isLoading) => {
        set({ isLoading })
      },

      logout: () => {
        set({ 
          user: null, 
          isAuthenticated: false,
          isLoading: false 
        })
      },
    }),
    {
      name: 'auth-store',
    }
  )
)