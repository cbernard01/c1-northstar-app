'use client'

import { 
  Menu, 
  Bell, 
  Search, 
  Settings, 
  LogOut, 
  User,
  Loader2,
  ArrowLeft
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import React from 'react'

import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { useJobStore } from '@/stores/jobStore'

interface HeaderProps {
  onMenuClick: () => void
  sidebarOpen: boolean
  showBackButton?: boolean
  onBackClick?: () => void
  isLoading?: boolean
}

export function Header({ onMenuClick, sidebarOpen, showBackButton, onBackClick, isLoading }: HeaderProps) {
  const router = useRouter()
  const { user } = useAuthStore()
  const { getActiveJobsCount } = useJobStore()
  const [searchValue, setSearchValue] = React.useState('')
  const [showUserMenu, setShowUserMenu] = React.useState(false)
  const [showNotifications, setShowNotifications] = React.useState(false)

  const activeJobsCount = getActiveJobsCount()

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/signin' })
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchValue.trim()) {
      router.push(`/accounts?search=${encodeURIComponent(searchValue)}`)
    }
  }

  const handleBackClick = () => {
    if (onBackClick) {
      onBackClick()
    } else {
      router.back()
    }
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-border shadow-sm">
      {/* Main header bar */}
      <div className="flex items-center justify-between h-16 px-4">
        {/* Left section */}
        <div className="flex items-center space-x-4">
          {/* Back button or Menu button */}
          {showBackButton ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackClick}
              className="p-2"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={onMenuClick}
              className="p-2"
              aria-label="Toggle sidebar"
            >
              <Menu className="h-5 w-5" />
            </Button>
          )}
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">C1</span>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-semibold text-foreground">
                Northstar
              </h1>
              <p className="text-xs text-muted-foreground -mt-1">
                Sales Intelligence
              </p>
            </div>
          </div>
        </div>

        {/* Center section - Search */}
        <div className="flex-1 max-w-xl mx-8">
          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search accounts, insights, or technologies..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="pl-10 pr-4 py-2 w-full"
              disabled={isLoading}
            />
            {isLoading && (
              <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
            )}
          </form>
        </div>

        {/* Right section */}
        <div className="flex items-center space-x-2">
          {/* Loading indicator */}
          {isLoading && (
            <div className="flex items-center space-x-2 px-3 py-1.5 bg-muted rounded-full">
              <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
              <span className="text-sm font-medium text-muted-foreground">
                Loading...
              </span>
            </div>
          )}
          
          {/* Active jobs indicator */}
          {!isLoading && activeJobsCount > 0 && (
            <div className="flex items-center space-x-2 px-3 py-1.5 bg-primary/10 rounded-full">
              <Loader2 className="h-4 w-4 text-primary animate-spin" />
              <span className="text-sm font-medium text-primary">
                {activeJobsCount} active
              </span>
            </div>
          )}

          {/* Notifications */}
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 relative"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              {activeJobsCount > 0 && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                >
                  {activeJobsCount > 9 ? '9+' : activeJobsCount}
                </Badge>
              )}
            </Button>

            {/* Notifications dropdown */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white border border-border rounded-lg shadow-lg py-2 z-50">
                <div className="px-4 py-2 border-b border-border">
                  <h3 className="font-medium text-foreground">Notifications</h3>
                </div>
                {activeJobsCount > 0 ? (
                  <div className="px-4 py-3">
                    <div className="flex items-center space-x-3">
                      <Loader2 className="h-4 w-4 text-primary animate-spin" />
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {activeJobsCount} job{activeJobsCount > 1 ? 's' : ''} running
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Processing account data...
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="px-4 py-8 text-center">
                    <p className="text-sm text-muted-foreground">
                      No new notifications
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Settings */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/settings')}
            className="p-2"
            aria-label="Settings"
          >
            <Settings className="h-5 w-5" />
          </Button>

          {/* User menu */}
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center space-x-2 px-3 py-2"
            >
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-6 h-6 rounded-full"
                />
              ) : (
                <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                  <User className="h-3 w-3 text-white" />
                </div>
              )}
              <span className="hidden sm:block text-sm font-medium">
                {user?.name?.split(' ')[0] || 'User'}
              </span>
            </Button>

            {/* User dropdown */}
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white border border-border rounded-lg shadow-lg py-2 z-50">
                <div className="px-4 py-3 border-b border-border">
                  <p className="text-sm font-medium text-foreground">
                    {user?.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {user?.email}
                  </p>
                </div>
                
                <div className="py-1">
                  <button
                    onClick={() => {
                      router.push('/settings')
                      setShowUserMenu(false)
                    }}
                    className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                  >
                    <Settings className="h-4 w-4" />
                    <span>Settings</span>
                  </button>
                  
                  <button
                    onClick={handleSignOut}
                    className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Sign out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Breadcrumbs bar */}
      <div className="h-10 px-4 border-b border-border bg-muted/30 flex items-center">
        <Breadcrumbs />
      </div>

      {/* Close dropdowns when clicking outside */}
      {(showUserMenu || showNotifications) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setShowUserMenu(false)
            setShowNotifications(false)
          }}
        />
      )}
    </header>
  )
}