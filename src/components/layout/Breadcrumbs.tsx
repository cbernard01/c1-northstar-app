'use client'

import { ChevronRight, Home } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React from 'react'

import { cn } from '@/lib/utils'

interface BreadcrumbItem {
  label: string
  href: string
  current?: boolean
}

interface BreadcrumbsProps {
  className?: string
  items?: BreadcrumbItem[]
}

export function Breadcrumbs({ className, items }: BreadcrumbsProps) {
  const pathname = usePathname()

  // Generate breadcrumbs from pathname if items not provided
  const breadcrumbItems = items || generateBreadcrumbsFromPath(pathname)

  if (breadcrumbItems.length <= 1) {
    return null
  }

  return (
    <nav className={cn('flex items-center space-x-1 text-sm text-muted-foreground', className)}>
      <Link
        href="/dashboard"
        className="flex items-center hover:text-foreground transition-colors"
      >
        <Home className="h-4 w-4" />
        <span className="sr-only">Home</span>
      </Link>

      {breadcrumbItems.map((item, index) => (
        <React.Fragment key={item.href}>
          <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
          
          {item.current || index === breadcrumbItems.length - 1 ? (
            <span className="font-medium text-foreground">
              {item.label}
            </span>
          ) : (
            <Link
              href={item.href}
              className="hover:text-foreground transition-colors"
            >
              {item.label}
            </Link>
          )}
        </React.Fragment>
      ))}
    </nav>
  )
}

function generateBreadcrumbsFromPath(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split('/').filter(Boolean)
  const breadcrumbs: BreadcrumbItem[] = []

  let currentPath = ''

  segments.forEach((segment, index) => {
    currentPath += `/${segment}`
    
    // Skip if it's the root dashboard
    if (segment === 'dashboard' && index === 0) {
      return
    }

    const label = formatSegmentLabel(segment)
    const isLast = index === segments.length - 1

    breadcrumbs.push({
      label,
      href: currentPath,
      current: isLast
    })
  })

  return breadcrumbs
}

function formatSegmentLabel(segment: string): string {
  // Handle special cases
  const specialCases: Record<string, string> = {
    'accounts': 'Account Explorer',
    'insights': 'Insight Viewer',
    'jobs': 'Job Queue',
    'upload': 'File Upload',
    'reports': 'Reports',
    'chat': 'AI Assistant',
    'settings': 'Settings'
  }

  if (specialCases[segment]) {
    return specialCases[segment]
  }

  // Handle IDs (UUIDs or similar)
  if (segment.match(/^[a-f0-9-]{8,}$/i)) {
    return `ID: ${segment.substring(0, 8)}...`
  }

  // Default formatting: capitalize and replace hyphens/underscores
  return segment
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

// Hook for managing breadcrumbs programmatically
export function useBreadcrumbs() {
  const [customBreadcrumbs, setCustomBreadcrumbs] = React.useState<BreadcrumbItem[] | null>(null)
  
  const setBreadcrumbs = React.useCallback((items: BreadcrumbItem[]) => {
    setCustomBreadcrumbs(items)
  }, [])
  
  const clearBreadcrumbs = React.useCallback(() => {
    setCustomBreadcrumbs(null)
  }, [])
  
  return {
    breadcrumbs: customBreadcrumbs,
    setBreadcrumbs,
    clearBreadcrumbs
  }
}