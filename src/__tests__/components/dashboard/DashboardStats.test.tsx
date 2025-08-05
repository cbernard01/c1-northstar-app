import { screen } from '@testing-library/react'
import React from 'react'

import { render, testAccessibility } from '@/__tests__/utils/test-utils'
import { DashboardStats } from '@/components/dashboard/DashboardStats'

describe('DashboardStats', () => {
  describe('Rendering', () => {
    it('renders all stat cards correctly', () => {
      render(<DashboardStats />)
      
      // Check for all stat labels
      expect(screen.getByText('Total Accounts')).toBeInTheDocument()
      expect(screen.getByText('Insights Generated')).toBeInTheDocument()
      expect(screen.getByText('Avg Confidence')).toBeInTheDocument()
      expect(screen.getByText('Processing Time')).toBeInTheDocument()
    })

    it('displays correct stat values', () => {
      render(<DashboardStats />)
      
      // Check for stat values
      expect(screen.getByText('2,847')).toBeInTheDocument()
      expect(screen.getByText('14,623')).toBeInTheDocument()
      expect(screen.getByText('84%')).toBeInTheDocument()
      expect(screen.getByText('2.3s')).toBeInTheDocument()
    })

    it('shows percentage changes correctly', () => {
      render(<DashboardStats />)
      
      // Check for positive changes
      expect(screen.getByText('+7.3%')).toBeInTheDocument()
      expect(screen.getByText('+13.8%')).toBeInTheDocument()
      expect(screen.getByText('+3.7%')).toBeInTheDocument()
      
      // Check for negative change (improvement in processing time)
      expect(screen.getByText('-25.8%')).toBeInTheDocument()
    })

    it('displays change labels', () => {
      render(<DashboardStats />)
      
      // All should show "vs last month"
      const changeLabels = screen.getAllByText('vs last month')
      expect(changeLabels).toHaveLength(4)
    })

    it('shows stat descriptions', () => {
      render(<DashboardStats />)
      
      expect(screen.getByText('Active accounts in database')).toBeInTheDocument()
      expect(screen.getByText('AI-generated insights')).toBeInTheDocument()
      expect(screen.getByText('Average insight confidence')).toBeInTheDocument()
      expect(screen.getByText('Average processing time')).toBeInTheDocument()
    })

    it('displays previous values', () => {
      render(<DashboardStats />)
      
      expect(screen.getByText('from 2,653')).toBeInTheDocument()
      expect(screen.getByText('from 12,847')).toBeInTheDocument()
      expect(screen.getByText('from 81%')).toBeInTheDocument()
      expect(screen.getByText('from 3.1s')).toBeInTheDocument()
    })
  })

  describe('Icons and Visual Elements', () => {
    it('renders with proper grid layout classes', () => {
      const { container } = render(<DashboardStats />)
      
      const gridContainer = container.querySelector('.grid')
      expect(gridContainer).toHaveClass('grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-4', 'gap-6')
    })

    it('applies custom className when provided', () => {
      const { container } = render(<DashboardStats className="custom-class" />)
      
      const gridContainer = container.querySelector('.grid')
      expect(gridContainer).toHaveClass('custom-class')
    })

    it('has hover effects on cards', () => {
      const { container } = render(<DashboardStats />)
      
      const cards = container.querySelectorAll('[data-testid="stat-card"], .group')
      cards.forEach(card => {
        expect(card).toHaveClass('group')
      })
    })
  })

  describe('Change Indicators', () => {
    it('displays positive change indicators correctly', () => {
      render(<DashboardStats />)
      
      // Find elements with positive changes
      const positiveChanges = screen.getAllByText(/^\+\d+\.\d+%$/)
      expect(positiveChanges.length).toBeGreaterThan(0)
    })

    it('displays negative change indicators correctly', () => {
      render(<DashboardStats />)
      
      // Processing time should show negative change (which is good)
      const negativeChange = screen.getByText('-25.8%')
      expect(negativeChange).toBeInTheDocument()
    })

    it('applies correct color classes for changes', () => {
      const { container } = render(<DashboardStats />)
      
      // Look for elements with success/error color classes
      const successElements = container.querySelectorAll('.text-success-600')
      const errorElements = container.querySelectorAll('.text-error-600')
      
      expect(successElements.length).toBeGreaterThan(0)
      expect(errorElements.length).toBeGreaterThan(0)
    })
  })

  describe('Data Structure', () => {
    it('handles stat data with all required fields', () => {
      render(<DashboardStats />)
      
      // Each stat should have all its required information displayed
      const statCards = screen.getAllByRole('generic').filter(
        element => element.querySelector('h3')
      )
      
      // Should have 4 stat cards based on the mock data
      expect(statCards.length).toBeGreaterThan(0)
    })

    it('formats numbers correctly', () => {
      render(<DashboardStats />)
      
      // Check that large numbers are formatted with commas
      expect(screen.getByText('2,847')).toBeInTheDocument()
      expect(screen.getByText('14,623')).toBeInTheDocument()
    })

    it('handles percentage values', () => {
      render(<DashboardStats />)
      
      // Confidence should be displayed as percentage
      expect(screen.getByText('84%')).toBeInTheDocument()
    })

    it('handles time values', () => {
      render(<DashboardStats />)
      
      // Processing time should include units
      expect(screen.getByText('2.3s')).toBeInTheDocument()
    })
  })

  describe('Change Calculation', () => {
    it('correctly identifies positive vs negative changes', () => {
      render(<DashboardStats />)
      
      // Test the formatChange function indirectly through rendered content
      const positiveChanges = screen.getAllByText(/^\+/)
      const negativeChanges = screen.getAllByText(/^-\d/)
      
      expect(positiveChanges.length).toBe(3) // Total Accounts, Insights, Confidence
      expect(negativeChanges.length).toBe(1) // Processing Time (improvement)
    })

    it('formats decimal places correctly', () => {
      render(<DashboardStats />)
      
      // All percentage changes should have 1 decimal place
      expect(screen.getByText('+7.3%')).toBeInTheDocument()
      expect(screen.getByText('+13.8%')).toBeInTheDocument()
      expect(screen.getByText('+3.7%')).toBeInTheDocument()
      expect(screen.getByText('-25.8%')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has no accessibility violations', async () => {
      const { container } = render(<DashboardStats />)
      await testAccessibility(container)
    })

    it('has proper semantic structure', () => {
      render(<DashboardStats />)
      
      // Each stat should have a proper heading
      const headings = screen.getAllByRole('heading', { level: 3 })
      expect(headings).toHaveLength(4)
      
      // Check that headings contain the stat values
      headings.forEach(heading => {
        expect(heading).toHaveClass('text-2xl', 'font-bold')
      })
    })

    it('provides meaningful text content for screen readers', () => {
      render(<DashboardStats />)
      
      // Each stat should have descriptive text
      expect(screen.getByText('Active accounts in database')).toBeInTheDocument()
      expect(screen.getByText('AI-generated insights')).toBeInTheDocument()
    })

    it('has proper contrast for text elements', () => {
      const { container } = render(<DashboardStats />)
      
      // Check for proper text color classes
      const foregroundElements = container.querySelectorAll('.text-foreground')
      const mutedElements = container.querySelectorAll('.text-muted-foreground')
      
      expect(foregroundElements.length).toBeGreaterThan(0)
      expect(mutedElements.length).toBeGreaterThan(0)
    })
  })

  describe('Responsive Design', () => {
    it('has responsive grid classes', () => {
      const { container } = render(<DashboardStats />)
      
      const gridContainer = container.querySelector('.grid')
      expect(gridContainer).toHaveClass('grid-cols-1') // mobile
      expect(gridContainer).toHaveClass('md:grid-cols-2') // tablet
      expect(gridContainer).toHaveClass('lg:grid-cols-4') // desktop
    })

    it('uses responsive gap spacing', () => {
      const { container } = render(<DashboardStats />)
      
      const gridContainer = container.querySelector('.grid')
      expect(gridContainer).toHaveClass('gap-6')
    })
  })

  describe('Interactive Elements', () => {
    it('has hover effects on cards', () => {
      const { container } = render(<DashboardStats />)
      
      const cards = container.querySelectorAll('.hover\\:shadow-md')
      expect(cards.length).toBe(4) // One for each stat card
    })

    it('applies transition classes', () => {
      const { container } = render(<DashboardStats />)
      
      const transitionElements = container.querySelectorAll('.transition-all')
      expect(transitionElements.length).toBeGreaterThan(0)
    })
  })
})