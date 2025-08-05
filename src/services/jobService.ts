import { apiClient } from './apiClient'

import type { Job, JobStatus } from '@/stores/jobStore'

export interface CreateJobRequest {
  type: 'account_analysis' | 'data_export' | 'insight_generation'
  title: string
  description?: string
  metadata?: Record<string, unknown>
}

export interface JobsListResponse {
  jobs: Job[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface JobProgressUpdate {
  id: string
  status: JobStatus
  progress: number
  message?: string
  result?: unknown
}

class JobService {
  private eventSource: EventSource | null = null

  async getJobs(params?: {
    page?: number
    pageSize?: number
    status?: JobStatus
    type?: string
  }): Promise<JobsListResponse> {
    try {
      // Convert params to string values for API client
      const apiParams = params ? Object.fromEntries(
        Object.entries({
          ...params,
          page: params.page?.toString(),
          pageSize: params.pageSize?.toString()
        }).filter(([_, value]) => value !== undefined && value !== '')
      ) as Record<string, string | number> : undefined;
      
      const response = await apiClient.get<JobsListResponse>('/jobs', apiParams)
      return response.data
    } catch (error) {
      console.error('Failed to fetch jobs:', error)
      throw error
    }
  }

  async getJob(id: string): Promise<Job> {
    try {
      const response = await apiClient.get<Job>(`/jobs/${id}`)
      return response.data
    } catch (error) {
      console.error('Failed to fetch job:', error)
      throw error
    }
  }

  async createJob(jobData: CreateJobRequest): Promise<Job> {
    try {
      const response = await apiClient.post<Job>('/jobs', jobData)
      return response.data
    } catch (error) {
      console.error('Failed to create job:', error)
      throw error
    }
  }

  async cancelJob(id: string): Promise<void> {
    try {
      await apiClient.delete(`/jobs/${id}/cancel`)
    } catch (error) {
      console.error('Failed to cancel job:', error)
      throw error
    }
  }

  async retryJob(id: string): Promise<Job> {
    try {
      const response = await apiClient.post<Job>(`/jobs/${id}/retry`)
      return response.data
    } catch (error) {
      console.error('Failed to retry job:', error)
      throw error
    }
  }

  async getJobLogs(id: string): Promise<string[]> {
    try {
      const response = await apiClient.get<string[]>(`/jobs/${id}/logs`)
      return response.data
    } catch (error) {
      console.error('Failed to fetch job logs:', error)
      throw error
    }
  }

  async downloadJobResult(id: string): Promise<Blob> {
    try {
      const response = await fetch(`/api/jobs/${id}/download`)
      if (!response.ok) {
        throw new Error('Failed to download job result')
      }
      return await response.blob()
    } catch (error) {
      console.error('Failed to download job result:', error)
      throw error
    }
  }

  // Real-time job updates via Server-Sent Events
  subscribeToJobUpdates(
    onUpdate: (update: JobProgressUpdate) => void,
    onError?: (error: Event) => void
  ): () => void {
    if (this.eventSource) {
      this.eventSource.close()
    }

    this.eventSource = new EventSource('/api/jobs/stream')

    this.eventSource.addEventListener('job-update', (event) => {
      try {
        const update: JobProgressUpdate = JSON.parse(event.data)
        onUpdate(update)
      } catch (error) {
        console.error('Failed to parse job update:', error)
      }
    })

    this.eventSource.addEventListener('error', (error) => {
      console.error('Job updates stream error:', error)
      if (onError) {
        onError(error)
      }
    })

    // Return cleanup function
    return () => {
      if (this.eventSource) {
        this.eventSource.close()
        this.eventSource = null
      }
    }
  }

  // Bulk operations
  async deleteMultipleJobs(ids: string[]): Promise<void> {
    try {
      await apiClient.post('/jobs/bulk-delete', { ids })
    } catch (error) {
      console.error('Failed to delete jobs:', error)
      throw error
    }
  }

  async retryMultipleJobs(ids: string[]): Promise<Job[]> {
    try {
      const response = await apiClient.post<Job[]>('/jobs/bulk-retry', { ids })
      return response.data
    } catch (error) {
      console.error('Failed to retry jobs:', error)
      throw error
    }
  }

  // Job statistics
  async getJobStats(): Promise<{
    total: number
    running: number
    completed: number
    failed: number
    queued: number
    pending: number
  }> {
    try {
      const response = await apiClient.get('/jobs/stats')
      return response.data as {
        total: number;
        running: number;
        completed: number;
        failed: number;
        queued: number;
        pending: number;
      }
    } catch (error) {
      console.error('Failed to fetch job stats:', error)
      throw error
    }
  }
}

export const jobService = new JobService()