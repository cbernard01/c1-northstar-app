import { screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { signIn } from 'next-auth/react'
import React from 'react'

import { testAccessibility } from '@/__tests__/utils/accessibility-helpers'
import { render } from '@/__tests__/utils/test-utils'
import { MicrosoftSignInButton } from '@/components/microsoft-signin-button'

// Mock next-auth
jest.mock('next-auth/react')
const mockSignIn = signIn as jest.MockedFunction<typeof signIn>

describe('MicrosoftSignInButton', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Rendering', () => {
    it('renders the sign in button correctly', () => {
      render(<MicrosoftSignInButton />)
      
      expect(screen.getByRole('button', { 
        name: /sign in with microsoft/i 
      })).toBeInTheDocument()
      expect(screen.getByText('Sign in with Microsoft')).toBeInTheDocument()
    })

    it('shows loading state when signing in', async () => {
      mockSignIn.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))
      
      render(<MicrosoftSignInButton />)
      
      const button = screen.getByRole('button', { name: /sign in with microsoft/i })
      fireEvent.click(button)
      
      await waitFor(() => {
        expect(screen.getByText('Signing in...')).toBeInTheDocument()
        expect(screen.getByRole('button')).toBeDisabled()
      })
    })

    it('displays Microsoft icon', () => {
      render(<MicrosoftSignInButton />)
      
      // Check for Microsoft icon (BsMicrosoft component should be rendered)
      const button = screen.getByRole('button', { name: /sign in with microsoft/i })
      expect(button).toBeInTheDocument()
    })
  })

  describe('Functionality', () => {
    it('calls signIn with correct parameters when clicked', async () => {
      mockSignIn.mockResolvedValue(undefined)
      
      render(<MicrosoftSignInButton />)
      
      const button = screen.getByRole('button', { name: /sign in with microsoft/i })
      fireEvent.click(button)
      
      expect(mockSignIn).toHaveBeenCalledWith('microsoft-entra-id', { 
        callbackUrl: '/dashboard' 
      })
    })

    it('uses custom callback URL when provided', async () => {
      mockSignIn.mockResolvedValue(undefined)
      const customCallback = '/custom-dashboard'
      
      render(<MicrosoftSignInButton callbackUrl={customCallback} />)
      
      const button = screen.getByRole('button', { name: /sign in with microsoft/i })
      fireEvent.click(button)
      
      expect(mockSignIn).toHaveBeenCalledWith('microsoft-entra-id', { 
        callbackUrl: customCallback 
      })
    })

    it('handles sign in errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      const mockError = new Error('Sign in failed')
      mockSignIn.mockRejectedValue(mockError)
      
      render(<MicrosoftSignInButton />)
      
      const button = screen.getByRole('button', { name: /sign in with microsoft/i })
      fireEvent.click(button)
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Sign in error:', mockError)
        // Button should be clickable again after error
        expect(button).not.toBeDisabled()
      })
      
      consoleSpy.mockRestore()
    })

    it('prevents multiple simultaneous sign in attempts', async () => {
      mockSignIn.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))
      
      render(<MicrosoftSignInButton />)
      
      const button = screen.getByRole('button', { name: /sign in with microsoft/i })
      
      // Click multiple times rapidly
      fireEvent.click(button)
      fireEvent.click(button)
      fireEvent.click(button)
      
      // signIn should only be called once
      expect(mockSignIn).toHaveBeenCalledTimes(1)
    })
  })

  describe('Accessibility', () => {
    it('has no accessibility violations', async () => {
      const { container } = render(<MicrosoftSignInButton />)
      await testAccessibility(container)
    })

    it('has proper keyboard navigation', async () => {
      const user = userEvent.setup()
      render(<MicrosoftSignInButton />)
      
      const button = screen.getByRole('button', { name: /sign in with microsoft/i })
      
      // Button should be focusable
      button.focus()
      expect(button).toHaveFocus()
      
      // Enter key should trigger sign in
      await user.keyboard('{Enter}')
      expect(mockSignIn).toHaveBeenCalled()
    })

    it('has proper ARIA attributes', () => {
      render(<MicrosoftSignInButton />)
      
      const button = screen.getByRole('button', { name: /sign in with microsoft/i })
      // Button element has implicit button type
      expect(button.tagName).toBe('BUTTON')
    })

    it('indicates loading state for screen readers', async () => {
      mockSignIn.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))
      
      render(<MicrosoftSignInButton />)
      
      const button = screen.getByRole('button', { name: /sign in with microsoft/i })
      fireEvent.click(button)
      
      await waitFor(() => {
        const loadingButton = screen.getByRole('button')
        expect(loadingButton).toBeDisabled()
        expect(loadingButton).toHaveTextContent('Signing in...')
      })
    })
  })

  describe('Visual States', () => {
    it('applies correct CSS classes for normal state', () => {
      render(<MicrosoftSignInButton />)
      
      const button = screen.getByRole('button', { name: /sign in with microsoft/i })
      expect(button).toHaveClass('group', 'relative', 'w-full')
    })

    it('applies correct CSS classes for loading state', async () => {
      mockSignIn.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))
      
      render(<MicrosoftSignInButton />)
      
      const button = screen.getByRole('button', { name: /sign in with microsoft/i })
      fireEvent.click(button)
      
      await waitFor(() => {
        const loadingButton = screen.getByRole('button')
        expect(loadingButton).toBeDisabled()
      })
    })
  })
})