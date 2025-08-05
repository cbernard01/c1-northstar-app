'use client'

import { 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  XCircle, 
  Loader2, 
  Pause
} from 'lucide-react'
import React from 'react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

import type { JobStatus } from '@/stores/jobStore'


interface JobStatusBadgeProps {
  status: JobStatus
  className?: string
  showIcon?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const statusConfig = {
  running: {
    icon: Loader2,
    label: 'Running',
    variant: 'default' as const,
    className: 'bg-primary/10 text-primary border-primary/20',
    animate: true,
  },
  completed: {
    icon: CheckCircle,
    label: 'Completed',
    variant: 'secondary' as const,
    className: 'bg-success-50 text-success-700 border-success-200',
    animate: false,
  },
  failed: {
    icon: XCircle,
    label: 'Failed',
    variant: 'destructive' as const,
    className: 'bg-error-50 text-error-700 border-error-200',
    animate: false,
  },
  pending: {
    icon: Clock,
    label: 'Pending',
    variant: 'outline' as const,
    className: 'bg-warning-50 text-warning-700 border-warning-200',
    animate: false,
  },
  queued: {
    icon: Pause,
    label: 'Queued',
    variant: 'secondary' as const,
    className: 'bg-secondary-50 text-secondary-700 border-secondary-200',
    animate: false,
  },
}

const sizeConfig = {
  sm: {
    badge: 'text-xs px-2 py-1',
    icon: 'h-3 w-3',
  },
  md: {
    badge: 'text-sm px-2.5 py-1',
    icon: 'h-3.5 w-3.5',
  },
  lg: {
    badge: 'text-sm px-3 py-1.5',
    icon: 'h-4 w-4',
  },
}

export function JobStatusBadge({ 
  status, 
  className, 
  showIcon = true, 
  size = 'md' 
}: JobStatusBadgeProps) {
  const config = statusConfig[status]
  const sizeStyles = sizeConfig[size]
  const Icon = config.icon

  return (
    <Badge
      variant={config.variant}
      className={cn(
        'inline-flex items-center border font-medium',
        config.className,
        sizeStyles.badge,
        className
      )}
    >
      {showIcon && (
        <Icon 
          className={cn(
            sizeStyles.icon,
            'mr-1.5',
            config.animate && 'animate-spin'
          )} 
        />
      )}
      {config.label}
    </Badge>
  )
}