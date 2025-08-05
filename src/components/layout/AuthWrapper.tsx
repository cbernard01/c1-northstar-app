'use client'

import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import React, { useEffect } from 'react'

import { useAuthStore } from '@/stores/authStore'

interface AuthWrapperProps {
  children: React.ReactNode
}

export function AuthWrapper({ children }: AuthWrapperProps) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { setUser, setLoading } = useAuthStore()
  
  // Development mode bypass - remove this in production
  const isDevelopment = process.env.NODE_ENV === 'development'
  const bypassAuth = isDevelopment && !process.env.NEXT_PUBLIC_REQUIRE_AUTH

  useEffect(() => {
    // Development bypass
    if (bypassAuth) {
      const mockUser = {
        id: 'dev-user-1',
        name: 'Development User',
        email: 'dev@example.com',
        avatar: undefined,
        role: 'admin',
      }
      setUser(mockUser)
      setLoading(false)
      return
    }

    if (status === 'loading') {
      setLoading(true)
      return
    }

    if (status === 'unauthenticated') {
      setUser(null)
      router.push('/signin')
      return
    }

    if (status === 'authenticated' && session?.user) {
      const userData = {
        id: session.user.id || '',
        name: session.user.name || '',
        email: session.user.email || '',
        avatar: session.user.image || undefined,
        role: (session.user as any).role || 'user',
      }
      
      setUser(userData)
    }
  }, [session, status, setUser, setLoading, router, bypassAuth])

  // Development bypass - show content immediately
  if (bypassAuth) {
    return <>{children}</>
  }

  // Show loading state while checking authentication
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Checking authentication...</p>
        </div>
      </div>
    )
  }

  // Redirect to signin if not authenticated
  if (status === 'unauthenticated') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <p className="text-muted-foreground">Redirecting...</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}