'use client'

import { formatDistanceToNow } from 'date-fns'
import { 
  ListTodo, 
  Plus, 
  Filter, 
  MoreHorizontal,
  Play,
  Pause,
  Trash2,
  RefreshCw,
  Download
} from 'lucide-react'
import React, { useState } from 'react'

import { JobStatusBadge } from '@/components/jobs/JobStatusBadge'
import { JobSubmissionForm } from '@/components/jobs/JobSubmissionForm'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useJobStore } from '@/stores/jobStore'

export default function JobsPage() {
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const { 
    jobs, 
    isLoading, 
    getFilteredJobs, 
    getActiveJobsCount,
    setStatusFilter: updateStatusFilter 
  } = useJobStore()

  const filteredJobs = getFilteredJobs()
  const activeJobsCount = getActiveJobsCount()

  const handleFilterChange = (status: string) => {
    setStatusFilter(status)
    updateStatusFilter(status as any)
  }

  const getJobTypeLabel = (type: string) => {
    switch (type) {
      case 'account_analysis':
        return 'Account Analysis'
      case 'insight_generation':
        return 'Insight Generation'
      case 'data_export':
        return 'Data Export'
      default:
        return 'Custom Job'
    }
  }

  const formatDate = (date: Date) => {
    return formatDistanceToNow(date, { addSuffix: true })
  }

  if (showCreateForm) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              Create New Job
            </h1>
            <p className="text-muted-foreground">
              Configure and submit a new processing job
            </p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => setShowCreateForm(false)}
          >
            Back to Jobs
          </Button>
        </div>
        
        <JobSubmissionForm 
          onSubmit={() => setShowCreateForm(false)}
          onCancel={() => setShowCreateForm(false)}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Job Queue
          </h1>
          <p className="text-muted-foreground">
            Monitor and manage your data processing jobs. Track progress, view results, and troubleshoot issues.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {activeJobsCount > 0 && (
            <Badge variant="secondary" className="px-3 py-1">
              {activeJobsCount} active
            </Badge>
          )}
          <Button onClick={() => setShowCreateForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Job
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filter by status:</span>
          </div>
          <div className="flex items-center space-x-2">
            {['all', 'queued', 'running', 'completed', 'failed'].map((status) => (
              <Button
                key={status}
                variant={statusFilter === status ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleFilterChange(status)}
                className="capitalize"
              >
                {status}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      {/* Job List */}
      {isLoading ? (
        <Card className="p-12 text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Loading jobs...</p>
        </Card>
      ) : filteredJobs.length === 0 ? (
        <Card className="p-12 text-center">
          <ListTodo className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-foreground mb-2">
            {statusFilter === 'all' ? 'No jobs found' : `No ${statusFilter} jobs`}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {statusFilter === 'all' 
              ? 'Create your first job to get started with data processing.'
              : `No jobs with status "${statusFilter}" found.`
            }
          </p>
          <div className="flex items-center justify-center space-x-3">
            <Button onClick={() => setShowCreateForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Job
            </Button>
            <Button variant="outline" onClick={() => window.location.href = '/upload'}>
              <ListTodo className="h-4 w-4 mr-2" />
              Upload Data
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredJobs.map((job) => (
            <Card key={job.id} className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-lg font-semibold text-foreground">
                      {job.title}
                    </h3>
                    <JobStatusBadge status={job.status} />
                    <Badge variant="outline">
                      {getJobTypeLabel(job.type)}
                    </Badge>
                  </div>
                  
                  {job.description && (
                    <p className="text-sm text-muted-foreground mb-3">
                      {job.description}
                    </p>
                  )}
                  
                  <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                    <span>Created {formatDate(job.createdAt)}</span>
                    {job.startedAt && (
                      <span>Started {formatDate(job.startedAt)}</span>
                    )}
                    {job.completedAt && (
                      <span>Completed {formatDate(job.completedAt)}</span>
                    )}
                  </div>
                  
                  {/* Progress Bar */}
                  {(job.status === 'running' || job.status === 'pending') && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span>Progress</span>
                        <span>{job.progress}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div 
                          className="bg-primary h-2 rounded-full transition-all duration-300" 
                          style={{ width: `${job.progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                  
                  {/* Error Message */}
                  {job.status === 'failed' && job.errorMessage && (
                    <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                      <p className="text-sm text-destructive">
                        {job.errorMessage}
                      </p>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center space-x-2">
                  {job.status === 'completed' && (
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  )}
                  
                  {job.status === 'failed' && (
                    <Button variant="outline" size="sm">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Retry
                    </Button>
                  )}
                  
                  <Button variant="ghost" size="sm">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}