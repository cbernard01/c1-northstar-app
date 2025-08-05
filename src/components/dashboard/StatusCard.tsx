'use client'

import { 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  XCircle, 
  Loader2,
  MoreHorizontal,
  Play,
  Pause,
  RotateCcw
} from 'lucide-react'
import React from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

import type { JobStatus } from '@/stores/jobStore'


interface StatusCardProps {
  title: string
  value: string | number
  status: JobStatus
  progress?: number
  subtitle?: string
  actions?: React.ReactNode
  onClick?: () => void
  onAction?: (action: 'pause' | 'resume' | 'retry' | 'cancel') => void
  showProgress?: boolean
  lastUpdated?: Date
}

const statusConfig = {
  running: {
    icon: Loader2,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    borderColor: 'border-primary/20',
    label: 'Running',
    animate: true,
  },
  completed: {
    icon: CheckCircle,
    color: 'text-success-600',
    bgColor: 'bg-success-50',
    borderColor: 'border-success-200',
    label: 'Completed',
    animate: false,
  },
  failed: {
    icon: XCircle,
    color: 'text-error-600',
    bgColor: 'bg-error-50',
    borderColor: 'border-error-200',
    label: 'Failed',
    animate: false,
  },
  pending: {
    icon: Clock,
    color: 'text-warning-600',
    bgColor: 'bg-warning-50',
    borderColor: 'border-warning-200',
    label: 'Pending',
    animate: false,
  },
  queued: {
    icon: Clock,
    color: 'text-secondary-600',
    bgColor: 'bg-secondary-50',
    borderColor: 'border-secondary-200',
    label: 'Queued',
    animate: false,
  },
}

export function StatusCard({
  title,
  value,
  status,
  progress = 0,
  subtitle,
  actions,
  onClick,
  onAction,
  showProgress = false,
  lastUpdated,
}: StatusCardProps) {
  const config = statusConfig[status]
  const Icon = config.icon
  const [showActions, setShowActions] = React.useState(false)

  const handleCardClick = () => {
    if (onClick) {
      onClick()
    }
  }

  const formatLastUpdated = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    return `${days}d ago`
  }

  return (
    <Card 
      className={cn(
        'relative overflow-hidden transition-all duration-200 ease-out hover:shadow-md border-l-4',
        config.borderColor,
        onClick && 'cursor-pointer hover:-translate-y-0.5',
        'group'
      )}
      onClick={handleCardClick}
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-sm font-medium text-muted-foreground mb-1">
              {title}
            </h3>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl font-bold text-foreground">
                {value}
              </span>
              {subtitle && (
                <span className="text-sm text-muted-foreground">
                  {subtitle}
                </span>
              )}
            </div>
          </div>

          {/* Status indicator */}
          <div className="flex items-center space-x-2">
            <div className={cn(
              'flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
              config.bgColor,
              config.color
            )}>
              <Icon className={cn(
                'h-3.5 w-3.5',
                config.animate && 'animate-spin'
              )} />
              <span>{config.label}</span>
            </div>

            {/* Actions menu */}
            {onAction && (
              <div className="relative">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowActions(!showActions)
                  }}
                  className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>

                {showActions && (
                  <div className="absolute right-0 top-full mt-1 w-32 bg-white border border-border rounded-md shadow-lg py-1 z-10">
                    {status === 'running' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onAction('pause')
                          setShowActions(false)
                        }}
                        className="flex items-center space-x-2 w-full px-3 py-1.5 text-sm text-foreground hover:bg-muted"
                      >
                        <Pause className="h-3 w-3" />
                        <span>Pause</span>
                      </button>
                    )}
                    
                    {(status === 'pending' || status === 'queued') && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onAction('resume')
                          setShowActions(false)
                        }}
                        className="flex items-center space-x-2 w-full px-3 py-1.5 text-sm text-foreground hover:bg-muted"
                      >
                        <Play className="h-3 w-3" />
                        <span>Resume</span>
                      </button>
                    )}
                    
                    {status === 'failed' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onAction('retry')
                          setShowActions(false)
                        }}
                        className="flex items-center space-x-2 w-full px-3 py-1.5 text-sm text-foreground hover:bg-muted"
                      >
                        <RotateCcw className="h-3 w-3" />
                        <span>Retry</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {showProgress && (status === 'running' || status === 'pending') && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>Progress</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress 
              value={progress} 
              variant={status === 'running' ? 'default' : 'warning'}
              className="h-1.5"
            />
          </div>
        )}

        {/* Last updated */}
        {lastUpdated && (
          <div className="mt-3 pt-3 border-t border-border/50">
            <p className="text-xs text-muted-foreground">
              Updated {formatLastUpdated(lastUpdated)}
            </p>
          </div>
        )}

        {/* Custom actions */}
        {actions && (
          <div className="mt-4">
            {actions}
          </div>
        )}
      </div>

      {/* Click outside to close actions */}
      {showActions && (
        <div
          className="fixed inset-0 z-0"
          onClick={(e) => {
            e.stopPropagation()
            setShowActions(false)
          }}
        />
      )}
    </Card>
  )
}