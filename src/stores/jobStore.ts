import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'pending'

export interface Job {
  id: string
  type: 'account_analysis' | 'data_export' | 'insight_generation'
  title: string
  description?: string
  status: JobStatus
  progress: number
  createdAt: Date
  updatedAt: Date
  startedAt?: Date
  completedAt?: Date
  failedAt?: Date
  errorMessage?: string
  result?: unknown
  metadata?: Record<string, unknown>
}

interface JobState {
  jobs: Job[]
  activeJobs: Job[]
  isLoading: boolean
  selectedJob: Job | null
  
  // Filters
  statusFilter: JobStatus | 'all'
  typeFilter: string | 'all'
  
  // Actions
  setJobs: (jobs: Job[]) => void
  addJob: (job: Job) => void
  updateJob: (id: string, updates: Partial<Job>) => void
  removeJob: (id: string) => void
  setSelectedJob: (job: Job | null) => void
  setLoading: (loading: boolean) => void
  setStatusFilter: (status: JobStatus | 'all') => void
  setTypeFilter: (type: string | 'all') => void
  
  // Computed
  getFilteredJobs: () => Job[]
  getJobsByStatus: (status: JobStatus) => Job[]
  getActiveJobsCount: () => number
}

export const useJobStore = create<JobState>()(
  devtools(
    (set, get) => ({
      jobs: [],
      activeJobs: [],
      isLoading: false,
      selectedJob: null,
      statusFilter: 'all',
      typeFilter: 'all',

      setJobs: (jobs) => {
        const activeJobs = jobs.filter(job => job.status === 'running' || job.status === 'pending')
        set({ jobs, activeJobs })
      },

      addJob: (job) => {
        const { jobs } = get()
        const newJobs = [job, ...jobs]
        const activeJobs = newJobs.filter(j => j.status === 'running' || j.status === 'pending')
        set({ jobs: newJobs, activeJobs })
      },

      updateJob: (id, updates) => {
        const { jobs } = get()
        const updatedJobs = jobs.map(job => 
          job.id === id 
            ? { ...job, ...updates, updatedAt: new Date() }
            : job
        )
        const activeJobs = updatedJobs.filter(j => j.status === 'running' || j.status === 'pending')
        set({ jobs: updatedJobs, activeJobs })
      },

      removeJob: (id) => {
        const { jobs, selectedJob } = get()
        const filteredJobs = jobs.filter(job => job.id !== id)
        const activeJobs = filteredJobs.filter(j => j.status === 'running' || j.status === 'pending')
        set({ 
          jobs: filteredJobs, 
          activeJobs,
          selectedJob: selectedJob?.id === id ? null : selectedJob 
        })
      },

      setSelectedJob: (selectedJob) => {
        set({ selectedJob })
      },

      setLoading: (isLoading) => {
        set({ isLoading })
      },

      setStatusFilter: (statusFilter) => {
        set({ statusFilter })
      },

      setTypeFilter: (typeFilter) => {
        set({ typeFilter })
      },

      getFilteredJobs: () => {
        const { jobs, statusFilter, typeFilter } = get()
        return jobs.filter(job => {
          const statusMatch = statusFilter === 'all' || job.status === statusFilter
          const typeMatch = typeFilter === 'all' || job.type === typeFilter
          return statusMatch && typeMatch
        })
      },

      getJobsByStatus: (status) => {
        const { jobs } = get()
        return jobs.filter(job => job.status === status)
      },

      getActiveJobsCount: () => {
        const { activeJobs } = get()
        return activeJobs.length
      },
    }),
    {
      name: 'job-store',
    }
  )
)