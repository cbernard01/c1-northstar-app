'use client'

import { 
  Clock,
  FileText,
  Building2,
  Lightbulb,
  Upload,
  CheckCircle,
  AlertCircle,
  MoreHorizontal,
  ExternalLink
} from 'lucide-react'
import React from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface ActivityItem {
  id: string
  type: 'file_upload' | 'account_analysis' | 'insight_generated' | 'job_completed' | 'job_failed'
  title: string
  description: string
  timestamp: Date
  status?: 'success' | 'warning' | 'error' | 'info'
  metadata?: {
    accountName?: string
    fileName?: string
    insightCount?: number
    processingTime?: string
    [key: string]: any
  }
}

interface RecentActivityProps {
  className?: string
  maxItems?: number
  showViewAll?: boolean
  onViewAll?: () => void
}

const activityConfig = {
  file_upload: {
    icon: Upload,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    label: 'File Upload',
  },
  account_analysis: {
    icon: Building2,
    color: 'text-secondary-600',
    bgColor: 'bg-secondary-50',
    label: 'Account Analysis',
  },
  insight_generated: {
    icon: Lightbulb,
    color: 'text-warning-600',
    bgColor: 'bg-warning-50',
    label: 'Insight Generated',
  },
  job_completed: {
    icon: CheckCircle,
    color: 'text-success-600',
    bgColor: 'bg-success-50',
    label: 'Job Completed',
  },
  job_failed: {
    icon: AlertCircle,
    color: 'text-error-600',
    bgColor: 'bg-error-50',
    label: 'Job Failed',
  },
}

export function RecentActivity({ 
  className,
  maxItems = 10,
  showViewAll = true,
  onViewAll 
}: RecentActivityProps) {
  // Mock data - in real app, this would come from props or API
  const activities: ActivityItem[] = [
    {
      id: '1',
      type: 'insight_generated',
      title: 'New insights generated for Acme Corp',
      description: '15 new insights discovered from recent data analysis',
      timestamp: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
      status: 'success',
      metadata: {
        accountName: 'Acme Corp',
        insightCount: 15,
      },
    },
    {
      id: '2',
      type: 'job_completed',
      title: 'Account analysis completed',
      description: 'Successfully processed customer-data-2024.xlsx',
      timestamp: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
      status: 'success',
      metadata: {
        fileName: 'customer-data-2024.xlsx',
        processingTime: '2.3s',
      },
    },
    {
      id: '3',
      type: 'file_upload',
      title: 'File upload completed',
      description: 'enterprise-accounts.csv uploaded and processing started',
      timestamp: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
      status: 'info',
      metadata: {
        fileName: 'enterprise-accounts.csv',
      },
    },
    {
      id: '4',
      type: 'account_analysis',
      title: 'Tech startup analysis',
      description: 'Completed technology stack analysis for 247 startups',
      timestamp: new Date(Date.now() - 45 * 60 * 1000), // 45 minutes ago
      status: 'success',
      metadata: {
        accountName: 'Tech Startups Batch',
      },
    },
    {
      id: '5',
      type: 'job_failed',
      title: 'Processing failed',
      description: 'Failed to process malformed-data.xlsx - invalid format',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      status: 'error',
      metadata: {
        fileName: 'malformed-data.xlsx',
      },
    },
  ]

  const formatTimestamp = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return date.toLocaleDateString()
  }

  const displayedActivities = activities.slice(0, maxItems)

  return (
    <Card className={cn('', className)}>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              Recent Activity
            </h3>
            <p className="text-sm text-muted-foreground">
              Latest updates and processing events
            </p>
          </div>
          
          {showViewAll && (
            <Button
              variant="outline"
              size="sm"
              onClick={onViewAll}
              className="flex items-center space-x-1"
            >
              <span>View All</span>
              <ExternalLink className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* Activity list */}
        <div className="space-y-4">
          {displayedActivities.map((activity, index) => {
            const config = activityConfig[activity.type]
            const Icon = config.icon

            return (
              <div
                key={activity.id}
                className={cn(
                  'flex items-start space-x-3 p-3 rounded-lg border border-border/50 hover:border-border transition-colors group',
                  index === 0 && 'bg-muted/20' // Highlight most recent
                )}
              >
                {/* Icon */}
                <div className={cn(
                  'p-2 rounded-lg flex-shrink-0',
                  config.bgColor
                )}>
                  <Icon className={cn('h-4 w-4', config.color)} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-foreground mb-1 truncate">
                        {activity.title}
                      </h4>
                      <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                        {activity.description}
                      </p>
                      
                      {/* Metadata */}
                      {activity.metadata && (
                        <div className="flex items-center space-x-3 text-xs text-muted-foreground">
                          {activity.metadata.accountName && (
                            <span className="flex items-center space-x-1">
                              <Building2 className="h-3 w-3" />
                              <span>{activity.metadata.accountName}</span>
                            </span>
                          )}
                          {activity.metadata.fileName && (
                            <span className="flex items-center space-x-1">
                              <FileText className="h-3 w-3" />
                              <span>{activity.metadata.fileName}</span>
                            </span>
                          )}
                          {activity.metadata.insightCount && (
                            <span className="flex items-center space-x-1">
                              <Lightbulb className="h-3 w-3" />
                              <span>{activity.metadata.insightCount} insights</span>
                            </span>
                          )}
                          {activity.metadata.processingTime && (
                            <span className="flex items-center space-x-1">
                              <Clock className="h-3 w-3" />
                              <span>{activity.metadata.processingTime}</span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Status and timestamp */}
                    <div className="flex flex-col items-end space-y-2 flex-shrink-0 ml-2">
                      {activity.status && (
                        <Badge 
                          variant={
                            activity.status === 'success' ? 'success' :
                            activity.status === 'warning' ? 'warning' :
                            activity.status === 'error' ? 'error' :
                            'secondary'
                          }
                          className="text-xs"
                        >
                          {activity.status}
                        </Badge>
                      )}
                      
                      <span className="text-xs text-muted-foreground">
                        {formatTimestamp(activity.timestamp)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Empty state */}
        {displayedActivities.length === 0 && (
          <div className="text-center py-8">
            <Clock className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <h4 className="text-sm font-medium text-foreground mb-2">
              No recent activity
            </h4>
            <p className="text-xs text-muted-foreground">
              Activity will appear here as you use the platform
            </p>
          </div>
        )}
      </div>
    </Card>
  )
}