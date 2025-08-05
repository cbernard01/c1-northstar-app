'use client'

import React, { useState, useEffect } from 'react'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'
import { jobService } from '@/services/jobService'
import { websocketService } from '@/services/websocketService'
import { useJobStore } from '@/stores/jobStore'

import { AuthWrapper } from './AuthWrapper'
import { Header } from './Header'
import { Sidebar } from './Sidebar'


interface AppLayoutProps {
  children: React.ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const { setJobs, updateJob } = useJobStore()

  // Handle responsive sidebar
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      if (mobile) {
        setSidebarOpen(false)
      }
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Set up real-time updates
  useEffect(() => {

    // Connect to WebSocket (disabled for now)
    // websocketService.connect().catch(error => {
    //   console.warn('WebSocket connection failed:', error)
    // })

    // Subscribe to job updates
    const jobUpdateCleanup = websocketService.subscribeToJobUpdates((update) => {
      updateJob(update.id, {
        status: update.status,
        progress: update.progress,
        result: update.result,
      })
      
      // Show notifications for completed/failed jobs
      if (update.status === 'completed') {
        toast.success('Job completed successfully', {
          description: `Job ${update.id} has finished processing`
        })
      } else if (update.status === 'failed') {
        toast.error('Job failed', {
          description: update.message || `Job ${update.id} encountered an error`
        })
      }
    })

    // Subscribe to general notifications
    const notificationCleanup = websocketService.subscribeToNotifications((notification) => {
      const toastFn = {
        info: toast.info,
        success: toast.success,
        warning: toast.warning,
        error: toast.error
      }[notification.type] || toast.info
      
      toastFn(notification.title, {
        description: notification.message
      })
    })

    // Fallback to SSE for job updates if WebSocket fails (disabled for now)
    // const sseCleanup = jobService.subscribeToJobUpdates(
    //   (update) => {
    //     if (!websocketService.isConnected()) {
    //       updateJob(update.id, {
    //         status: update.status,
    //         progress: update.progress,
    //         result: update.result,
    //       })
    //     }
    //   },
    //   (error) => {
    //     console.error('Job updates stream error:', error)
    //   }
    // )

    // Load initial jobs (disabled for now - API not ready)
    // jobService.getJobs({ pageSize: 50 })
    //   .then(response => setJobs(response.jobs))
    //   .catch(error => console.error('Failed to load jobs:', error))

    return () => {
      jobUpdateCleanup()
      notificationCleanup()
      // sseCleanup()
    }
  }, [setJobs, updateJob])

  return (
    <AuthWrapper>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <Header 
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          sidebarOpen={sidebarOpen}
        />

        <div className="flex min-h-[calc(100vh-6.5rem)]"> {/* Full height minus header */}
          {/* Sidebar */}
          <Sidebar 
            open={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            isMobile={isMobile}
          />

          {/* Main Content */}
          <main 
            className={cn(
              'flex-1 transition-all duration-300 ease-out min-h-full',
              'pt-[6.5rem]', // Header (4rem) + Breadcrumbs (2.5rem)
              sidebarOpen && !isMobile ? 'ml-64' : 'ml-0'
            )}
          >
            <div className="p-6 min-h-[calc(100vh-6.5rem)]">
              {children}
            </div>
          </main>
        </div>

        {/* Mobile sidebar overlay */}
        {isMobile && sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 sidebar-backdrop z-39 md:hidden transition-opacity duration-300"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          />
        )}
      </div>
    </AuthWrapper>
  )
}