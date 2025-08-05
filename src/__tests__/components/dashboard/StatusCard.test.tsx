import { screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

import { render, testAccessibility } from '@/__tests__/utils/test-utils'
import { StatusCard } from '@/components/dashboard/StatusCard'

import type { JobStatus } from '@/stores/jobStore'

const mockOnClick = jest.fn()
const mockOnAction = jest.fn()

const defaultProps = {
  title: 'Test Job',
  value: '100',
  status: 'running' as JobStatus,
}

describe('StatusCard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('renders with required props', () => {
      render(<StatusCard {...defaultProps} />)
      
      expect(screen.getByText('Test Job')).toBeInTheDocument()
      expect(screen.getByText('100')).toBeInTheDocument()
      expect(screen.getByText('Running')).toBeInTheDocument()
    })

    it('displays subtitle when provided', () => {
      render(<StatusCard {...defaultProps} subtitle="records" />)
      
      expect(screen.getByText('records')).toBeInTheDocument()
    })

    it('shows custom actions when provided', () => {
      const customActions = <button>Custom Action</button>
      render(<StatusCard {...defaultProps} actions={customActions} />)
      
      expect(screen.getByText('Custom Action')).toBeInTheDocument()
    })
  })

  describe('Status Variants', () => {
    const statuses: JobStatus[] = ['running', 'completed', 'failed', 'pending', 'queued']
    
    statuses.forEach(status => {
      it(`renders ${status} status correctly`, () => {
        render(<StatusCard {...defaultProps} status={status} />)
        
        const statusLabels = {
          running: 'Running',
          completed: 'Completed',
          failed: 'Failed',
          pending: 'Pending',
          queued: 'Queued',
        }
        
        expect(screen.getByText(statusLabels[status])).toBeInTheDocument()
      })
    })

    it('shows spinning animation for running status', () => {
      const { container } = render(<StatusCard {...defaultProps} status="running" />)
      
      const spinningIcon = container.querySelector('.animate-spin')
      expect(spinningIcon).toBeInTheDocument()
    })

    it('does not show spinning animation for completed status', () => {
      const { container } = render(<StatusCard {...defaultProps} status="completed" />)
      
      const spinningIcon = container.querySelector('.animate-spin')
      expect(spinningIcon).not.toBeInTheDocument()
    })
  })

  describe('Progress Bar', () => {
    it('shows progress bar when showProgress is true and status is running', () => {
      render(
        <StatusCard 
          {...defaultProps} 
          status="running" 
          showProgress={true} 
          progress={75} 
        />
      )
      
      expect(screen.getByText('Progress')).toBeInTheDocument()
      expect(screen.getByText('75%')).toBeInTheDocument()
    })

    it('shows progress bar for pending status', () => {
      render(
        <StatusCard 
          {...defaultProps} 
          status="pending" 
          showProgress={true} 
          progress={25} 
        />
      )
      
      expect(screen.getByText('Progress')).toBeInTheDocument()
      expect(screen.getByText('25%')).toBeInTheDocument()
    })

    it('does not show progress bar when showProgress is false', () => {
      render(
        <StatusCard 
          {...defaultProps} 
          status="running" 
          showProgress={false} 
          progress={75} 
        />
      )
      
      expect(screen.queryByText('Progress')).not.toBeInTheDocument()
    })

    it('does not show progress bar for completed status', () => {
      render(
        <StatusCard 
          {...defaultProps} 
          status="completed" 
          showProgress={true} 
          progress={100} 
        />
      )
      
      expect(screen.queryByText('Progress')).not.toBeInTheDocument()
    })
  })

  describe('Last Updated', () => {
    it('displays formatted last updated time', () => {
      const lastUpdated = new Date(Date.now() - 5 * 60 * 1000) // 5 minutes ago
      render(<StatusCard {...defaultProps} lastUpdated={lastUpdated} />)
      
      expect(screen.getByText(/Updated \d+m ago/)).toBeInTheDocument()
    })

    it('shows "Just now" for very recent updates', () => {
      const lastUpdated = new Date(Date.now() - 30 * 1000) // 30 seconds ago
      render(<StatusCard {...defaultProps} lastUpdated={lastUpdated} />)
      
      expect(screen.getByText('Updated Just now')).toBeInTheDocument()
    })

    it('shows hours for older updates', () => {
      const lastUpdated = new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
      render(<StatusCard {...defaultProps} lastUpdated={lastUpdated} />)
      
      expect(screen.getByText(/Updated \d+h ago/)).toBeInTheDocument()
    })

    it('shows days for very old updates', () => {
      const lastUpdated = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
      render(<StatusCard {...defaultProps} lastUpdated={lastUpdated} />)
      
      expect(screen.getByText(/Updated \d+d ago/)).toBeInTheDocument()
    })
  })

  describe('Click Handlers', () => {
    it('calls onClick when card is clicked', async () => {
      const user = userEvent.setup()
      render(<StatusCard {...defaultProps} onClick={mockOnClick} />)
      
      const card = screen.getByRole('generic').closest('.cursor-pointer')
      expect(card).toBeInTheDocument()
      
      await user.click(card!)
      expect(mockOnClick).toHaveBeenCalledTimes(1)
    })

    it('applies cursor-pointer class when onClick is provided', () => {
      const { container } = render(<StatusCard {...defaultProps} onClick={mockOnClick} />)
      
      const clickableCard = container.querySelector('.cursor-pointer')
      expect(clickableCard).toBeInTheDocument()
    })

    it('does not apply cursor-pointer class when onClick is not provided', () => {
      const { container } = render(<StatusCard {...defaultProps} />)
      
      const clickableCard = container.querySelector('.cursor-pointer')
      expect(clickableCard).not.toBeInTheDocument()
    })
  })

  describe('Action Menu', () => {
    it('shows actions menu button on hover when onAction is provided', () => {
      render(<StatusCard {...defaultProps} onAction={mockOnAction} />)
      
      const actionButton = screen.getByRole('button')
      expect(actionButton).toHaveClass('opacity-0', 'group-hover:opacity-100')
    })

    it('opens actions menu when button is clicked', async () => {
      const user = userEvent.setup()
      render(<StatusCard {...defaultProps} status="running" onAction={mockOnAction} />)
      
      const actionButton = screen.getByRole('button')
      await user.click(actionButton)
      
      expect(screen.getByText('Pause')).toBeInTheDocument()
    })

    it('shows pause action for running status', async () => {
      const user = userEvent.setup()
      render(<StatusCard {...defaultProps} status="running" onAction={mockOnAction} />)
      
      const actionButton = screen.getByRole('button')
      await user.click(actionButton)
      
      const pauseButton = screen.getByText('Pause')
      expect(pauseButton).toBeInTheDocument()
      
      await user.click(pauseButton)
      expect(mockOnAction).toHaveBeenCalledWith('pause')
    })

    it('shows resume action for pending status', async () => {
      const user = userEvent.setup()
      render(<StatusCard {...defaultProps} status="pending" onAction={mockOnAction} />)
      
      const actionButton = screen.getByRole('button')
      await user.click(actionButton)
      
      const resumeButton = screen.getByText('Resume')
      expect(resumeButton).toBeInTheDocument()
      
      await user.click(resumeButton)
      expect(mockOnAction).toHaveBeenCalledWith('resume')
    })

    it('shows retry action for failed status', async () => {
      const user = userEvent.setup()
      render(<StatusCard {...defaultProps} status="failed" onAction={mockOnAction} />)
      
      const actionButton = screen.getByRole('button')
      await user.click(actionButton)
      
      const retryButton = screen.getByText('Retry')
      expect(retryButton).toBeInTheDocument()
      
      await user.click(retryButton)
      expect(mockOnAction).toHaveBeenCalledWith('retry')
    })

    it('closes actions menu when clicking outside', async () => {
      const user = userEvent.setup()
      render(<StatusCard {...defaultProps} status="running" onAction={mockOnAction} />)
      
      // Open menu
      const actionButton = screen.getByRole('button')
      await user.click(actionButton)
      expect(screen.getByText('Pause')).toBeInTheDocument()
      
      // Click outside (this is simulated by the fixed overlay)
      const overlay = document.querySelector('.fixed.inset-0')
      expect(overlay).toBeInTheDocument()
      
      if (overlay) {
        fireEvent.click(overlay)
        await waitFor(() => {
          expect(screen.queryByText('Pause')).not.toBeInTheDocument()
        })
      }
    })

    it('prevents card click when action button is clicked', async () => {
      const user = userEvent.setup()
      render(
        <StatusCard 
          {...defaultProps} 
          onClick={mockOnClick} 
          onAction={mockOnAction} 
        />
      )
      
      const actionButton = screen.getByRole('button')
      await user.click(actionButton)
      
      // Card click should not be triggered
      expect(mockOnClick).not.toHaveBeenCalled()
    })
  })

  describe('Styling and CSS Classes', () => {
    it('applies correct border color for different statuses', () => {
      const { container: runningContainer } = render(
        <StatusCard {...defaultProps} status="running" />
      )
      const { container: failedContainer } = render(
        <StatusCard {...defaultProps} status="failed" />
      )
      
      const runningCard = runningContainer.querySelector('.border-l-4')
      const failedCard = failedContainer.querySelector('.border-l-4')
      
      expect(runningCard).toHaveClass('border-primary/20')
      expect(failedCard).toHaveClass('border-error-200')
    })

    it('applies hover effects', () => {
      const { container } = render(<StatusCard {...defaultProps} onClick={mockOnClick} />)
      
      const card = container.querySelector('.hover\\:shadow-md')
      expect(card).toBeInTheDocument()
      
      const hoverTransform = container.querySelector('.hover\\:-translate-y-0\\.5')
      expect(hoverTransform).toBeInTheDocument()
    })

    it('has proper transition classes', () => {
      const { container } = render(<StatusCard {...defaultProps} />)
      
      const transitionElement = container.querySelector('.transition-all')
      expect(transitionElement).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has no accessibility violations', async () => {
      const { container } = render(<StatusCard {...defaultProps} />)
      await testAccessibility(container)
    })

    it('has proper semantic structure', () => {
      render(<StatusCard {...defaultProps} />)
      
      // Title should be properly structured
      const title = screen.getByText('Test Job')
      expect(title).toHaveClass('text-sm', 'font-medium', 'text-muted-foreground')
      
      // Value should be prominent
      const value = screen.getByText('100')
      expect(value).toHaveClass('text-2xl', 'font-bold', 'text-foreground')
    })

    it('provides proper contrast for status indicators', () => {
      const { container } = render(<StatusCard {...defaultProps} status="running" />)
      
      const statusIndicator = container.querySelector('.text-primary')
      expect(statusIndicator).toBeInTheDocument()
    })

    it('has accessible action buttons', async () => {
      const user = userEvent.setup()
      render(<StatusCard {...defaultProps} status="running" onAction={mockOnAction} />)
      
      const actionButton = screen.getByRole('button')
      expect(actionButton).toBeInTheDocument()
      
      // Button should be keyboard accessible
      actionButton.focus()
      expect(actionButton).toHaveFocus()
    })
  })

  describe('Edge Cases', () => {
    it('handles zero progress correctly', () => {
      render(
        <StatusCard 
          {...defaultProps} 
          status="running" 
          showProgress={true} 
          progress={0} 
        />
      )
      
      expect(screen.getByText('0%')).toBeInTheDocument()
    })

    it('handles 100% progress correctly', () => {
      render(
        <StatusCard 
          {...defaultProps} 
          status="running" 
          showProgress={true} 
          progress={100} 
        />
      )
      
      expect(screen.getByText('100%')).toBeInTheDocument()
    })

    it('handles empty string values', () => {
      render(<StatusCard {...defaultProps} value="" />)
      
      const value = screen.getByText('')
      expect(value).toBeInTheDocument()
    })

    it('handles very long titles', () => {
      const longTitle = 'This is a very long title that might wrap to multiple lines'
      render(<StatusCard {...defaultProps} title={longTitle} />)
      
      expect(screen.getByText(longTitle)).toBeInTheDocument()
    })
  })
})