'use client'

import { 
  LayoutDashboard,
  Upload,
  Building2,
  Lightbulb,
  MessageSquare,
  ListTodo,
  Settings,
  FileText,
  BarChart3,
  X
} from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import React from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAccountStore } from '@/stores/accountStore'
import { useInsightStore } from '@/stores/insightStore'
import { useJobStore } from '@/stores/jobStore'

interface NavigationItem {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  href: string
  badge?: number
  description?: string
}

interface SidebarProps {
  open: boolean
  onClose: () => void
  isMobile: boolean
}

export function Sidebar({ open, onClose, isMobile }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { getActiveJobsCount } = useJobStore()
  const { accounts } = useAccountStore()
  const { insights } = useInsightStore()

  const activeJobsCount = getActiveJobsCount()
  const accountsCount = accounts.length
  const insightsCount = insights.length

  const navigationItems: NavigationItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      href: '/dashboard',
      description: 'Overview and key metrics',
    },
    {
      id: 'upload',
      label: 'File Upload',
      icon: Upload,
      href: '/upload',
      description: 'Upload and process data files',
    },
    {
      id: 'accounts',
      label: 'Account Explorer',
      icon: Building2,
      href: '/accounts',
      badge: accountsCount > 0 ? accountsCount : undefined,
      description: 'Browse and manage accounts',
    },
    {
      id: 'insights',
      label: 'Insight Viewer',
      icon: Lightbulb,
      href: '/insights',
      badge: insightsCount > 0 ? insightsCount : undefined,
      description: 'View generated insights',
    },
    {
      id: 'chat',
      label: 'AI Assistant',
      icon: MessageSquare,
      href: '/chat',
      description: 'Chat with AI about accounts',
    },
    {
      id: 'jobs',
      label: 'Job Queue',
      icon: ListTodo,
      href: '/jobs',
      badge: activeJobsCount > 0 ? activeJobsCount : undefined,
      description: 'Monitor processing jobs',
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: BarChart3,
      href: '/reports',
      description: 'Analytics and reports',
    },
  ]

  const handleNavigation = (href: string) => {
    router.push(href)
    if (isMobile) {
      onClose()
    }
  }

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard' || pathname === '/'
    }
    return pathname.startsWith(href)
  }

  return (
    <>
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 z-40 w-64 bg-background border-r border-border transition-all duration-300 ease-out',
          'top-[6.5rem] bottom-0', // Header (4rem) + Breadcrumbs (2.5rem)
          open ? 'translate-x-0' : '-translate-x-full',
          isMobile ? 'z-50 shadow-xl' : 'shadow-sm'
        )}
        aria-hidden={!open}
      >
        {/* Mobile close button */}
        {isMobile && (
          <div className="flex justify-end p-4 pb-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="p-2"
              aria-label="Close sidebar"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Sidebar content container */}
        <div className="flex flex-col h-full">
          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto scrollbar-thin p-4">
            <div className="space-y-1">
              {navigationItems.map((item) => {
                const active = isActive(item.href)
                const Icon = item.icon

                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavigation(item.href)}
                    className={cn(
                      'flex items-center justify-between w-full px-3 py-2.5 text-left rounded-md text-sm font-medium transition-all duration-150 ease-out group',
                      active
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    )}
                  >
                    <div className="flex items-center space-x-3">
                      <Icon className={cn(
                        'h-5 w-5 transition-colors flex-shrink-0',
                        active 
                          ? 'text-primary-foreground' 
                          : 'text-muted-foreground group-hover:text-foreground'
                      )} />
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="leading-none truncate">{item.label}</span>
                        {item.description && (
                          <span className={cn(
                            'text-xs mt-0.5 transition-colors truncate',
                            active 
                              ? 'text-primary-foreground/70' 
                              : 'text-muted-foreground/70 group-hover:text-foreground/70'
                          )}>
                            {item.description}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {item.badge && (
                      <Badge 
                        variant={active ? "secondary" : "outline"}
                        className={cn(
                          'ml-2 text-xs flex-shrink-0',
                          active 
                            ? 'bg-primary-foreground/20 text-primary-foreground border-primary-foreground/30' 
                            : ''
                        )}
                      >
                        {item.badge > 999 ? '999+' : item.badge}
                      </Badge>
                    )}
                  </button>
                )
              })}
            </div>
          </nav>

          {/* Footer section */}
          <div className="flex-shrink-0 p-4 border-t border-border bg-muted/20">
            <button
              onClick={() => handleNavigation('/settings')}
              className={cn(
                'flex items-center space-x-3 w-full px-3 py-2.5 text-left rounded-md text-sm font-medium transition-colors',
                isActive('/settings')
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              <Settings className="h-5 w-5 flex-shrink-0" />
              <span>Settings</span>
            </button>
            
            {/* Version info */}
            <div className="mt-4 px-3">
              <p className="text-xs text-muted-foreground">
                Version 1.0.0-MVP
              </p>
              <p className="text-xs text-muted-foreground">
                Built with ❤️ by C1
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}