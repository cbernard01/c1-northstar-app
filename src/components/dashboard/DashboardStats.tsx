'use client'

import { 
  Building2, 
  Lightbulb, 
  TrendingUp, 
  Clock,
  Users,
  Target,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react'
import React from 'react'

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface StatItem {
  id: string
  label: string
  value: string | number
  previousValue?: string | number
  change?: number
  changeLabel?: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  bgColor: string
  description?: string
}

interface DashboardStatsProps {
  className?: string
}

export function DashboardStats({ className }: DashboardStatsProps) {
  // Mock data - in real app, this would come from props or stores
  const stats: StatItem[] = [
    {
      id: 'accounts',
      label: 'Total Accounts',
      value: '2,847',
      previousValue: '2,653',
      change: 7.3,
      changeLabel: 'vs last month',
      icon: Building2,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      description: 'Active accounts in database',
    },
    {
      id: 'insights',
      label: 'Insights Generated',
      value: '14,623',
      previousValue: '12,847',
      change: 13.8,
      changeLabel: 'vs last month', 
      icon: Lightbulb,
      color: 'text-warning-600',
      bgColor: 'bg-warning-50',
      description: 'AI-generated insights',
    },
    {
      id: 'confidence',
      label: 'Avg Confidence',
      value: '84%',
      previousValue: '81%',
      change: 3.7,
      changeLabel: 'vs last month',
      icon: Target,
      color: 'text-success-600',
      bgColor: 'bg-success-50',
      description: 'Average insight confidence',
    },
    {
      id: 'processing',
      label: 'Processing Time',
      value: '2.3s',
      previousValue: '3.1s',
      change: -25.8,
      changeLabel: 'vs last month',
      icon: Clock,
      color: 'text-secondary-600',
      bgColor: 'bg-secondary-50',
      description: 'Average processing time',
    },
  ]

  const formatChange = (change: number) => {
    const isPositive = change > 0
    const isNegative = change < 0
    
    return {
      isPositive,
      isNegative,
      formatted: `${isPositive ? '+' : ''}${change.toFixed(1)}%`,
      icon: isPositive ? ArrowUpRight : ArrowDownRight,
      color: isPositive ? 'text-success-600' : isNegative ? 'text-error-600' : 'text-muted-foreground',
    }
  }

  return (
    <div className={cn('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6', className)}>
      {stats.map((stat) => {
        const Icon = stat.icon
        const changeData = stat.change ? formatChange(stat.change) : null
        const ChangeIcon = changeData?.icon

        return (
          <Card key={stat.id} className="relative overflow-hidden group hover:shadow-md transition-all duration-200">
            <div className="p-6">
              {/* Header with icon */}
              <div className="flex items-center justify-between mb-4">
                <div className={cn(
                  'p-2.5 rounded-lg',
                  stat.bgColor
                )}>
                  <Icon className={cn('h-5 w-5', stat.color)} />
                </div>
                
                {changeData && ChangeIcon && (
                  <div className="flex items-center space-x-1">
                    <ChangeIcon className={cn('h-3 w-3', changeData.color)} />
                    <span className={cn('text-xs font-medium', changeData.color)}>
                      {changeData.formatted}
                    </span>
                  </div>
                )}
              </div>

              {/* Value */}
              <div className="mb-2">
                <h3 className="text-2xl font-bold text-foreground tracking-tight">
                  {stat.value}
                </h3>
                <p className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </p>
              </div>

              {/* Description */}
              {stat.description && (
                <p className="text-xs text-muted-foreground mb-3">
                  {stat.description}
                </p>
              )}

              {/* Change details */}
              {changeData && stat.changeLabel && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {stat.changeLabel}
                  </span>
                  {stat.previousValue && (
                    <span className="text-muted-foreground">
                      from {stat.previousValue}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Subtle gradient overlay on hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-black/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" />
          </Card>
        )
      })}
    </div>
  )
}