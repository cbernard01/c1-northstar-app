import { screen, waitFor } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import React from 'react'

import { render, testAccessibility } from '@/__tests__/utils/test-utils'
import { AuthWrapper } from '@/components/layout/AuthWrapper'
import { useAuthStore } from '@/stores/authStore'

// Mock dependencies
jest.mock('next-auth/react')
jest.mock('next/navigation')
jest.mock('@/stores/authStore')

const mockUseSession = useSession as jest.MockedFunction<typeof useSession>
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>
const mockUseAuthStore = useAuthStore as jest.MockedFunction<typeof useAuthStore>

const mockPush = jest.fn()
const mockSetUser = jest.fn()
const mockSetLoading = jest.fn()

// Mock the router before each test
const mockRouterReturn = {
  push: mockPush,
  replace: jest.fn(),
  prefetch: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  refresh: jest.fn(),
}

describe('AuthWrapper', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Set up router mock
    ;(mockUseRouter as jest.Mock).mockReturnValue(mockRouterReturn)
    
    mockUseAuthStore.mockReturnValue({
      user: null,
      isAuthenticated: false,
      setUser: mockSetUser,
      setLoading: mockSetLoading,
    })
  })

  describe('Loading State', () => {
    it('shows loading state when session is loading', () => {
      mockUseSession.mockReturnValue({
        data: null,
        status: 'loading',
      })
      
      render(
        <AuthWrapper>
          <div>Protected Content</div>
        </AuthWrapper>
      )
      
      expect(screen.getByText('Checking authentication...')).toBeInTheDocument()
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
      expect(mockSetLoading).toHaveBeenCalledWith(true)
    })

    it('shows loading spinner with proper accessibility', () => {
      mockUseSession.mockReturnValue({
        data: null,
        status: 'loading',
      })
      
      render(
        <AuthWrapper>
          <div>Protected Content</div>
        </AuthWrapper>
      )
      
      const loadingText = screen.getByText('Checking authentication...')
      expect(loadingText).toBeInTheDocument()
      
      // Check for spinner (should have animate-spin class)
      const spinner = document.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
    })
  })

  describe('Unauthenticated State', () => {
    it('redirects to signin when unauthenticated', async () => {
      mockUseSession.mockReturnValue({
        data: null,
        status: 'unauthenticated',
      })
      
      render(
        <AuthWrapper>
          <div>Protected Content</div>
        </AuthWrapper>
      )
      
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/signin')
        expect(mockSetUser).toHaveBeenCalledWith(null)
      })
      
      expect(screen.getByText('Redirecting...')).toBeInTheDocument()
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
    })

    it('shows redirecting state when not authenticated', () => {
      mockUseSession.mockReturnValue({
        data: null,
        status: 'unauthenticated',
      })
      
      mockUseAuthStore.mockReturnValue({
        user: null,
        isAuthenticated: false,
        setUser: mockSetUser,
        setLoading: mockSetLoading,
      })
      
      render(
        <AuthWrapper>
          <div>Protected Content</div>
        </AuthWrapper>
      )
      
      expect(screen.getByText('Redirecting...')).toBeInTheDocument()
    })
  })

  describe('Authenticated State', () => {
    const mockSession = {
      user: {
        id: '123',
        name: 'John Doe',
        email: 'john@example.com',
        image: 'https://example.com/avatar.jpg',
        role: 'admin',
      },
      expires: '2024-12-31',
    }

    it('renders children when authenticated', async () => {
      mockUseSession.mockReturnValue({
        data: mockSession,
        status: 'authenticated',
      })
      
      mockUseAuthStore.mockReturnValue({
        user: {
          id: '123',
          name: 'John Doe',
          email: 'john@example.com',
          avatar: 'https://example.com/avatar.jpg',
          role: 'admin',
        },
        isAuthenticated: true,
        setUser: mockSetUser,
        setLoading: mockSetLoading,
      })
      
      render(
        <AuthWrapper>
          <div>Protected Content</div>
        </AuthWrapper>
      )
      
      await waitFor(() => {
        expect(screen.getByText('Protected Content')).toBeInTheDocument()
      })
      
      expect(mockSetUser).toHaveBeenCalledWith({
        id: '123',
        name: 'John Doe',
        email: 'john@example.com',
        avatar: 'https://example.com/avatar.jpg',
        role: 'admin',
      })
    })

    it('handles session user without role', async () => {
      const sessionWithoutRole = {
        ...mockSession,
        user: {
          ...mockSession.user,
          role: undefined,
        },
      }
      
      mockUseSession.mockReturnValue({
        data: sessionWithoutRole,
        status: 'authenticated',
      })
      
      mockUseAuthStore.mockReturnValue({
        user: null,
        isAuthenticated: true,
        setUser: mockSetUser,
        setLoading: mockSetLoading,
      })
      
      render(
        <AuthWrapper>
          <div>Protected Content</div>
        </AuthWrapper>
      )
      
      await waitFor(() => {
        expect(mockSetUser).toHaveBeenCalledWith({
          id: '123',
          name: 'John Doe',
          email: 'john@example.com',
          avatar: 'https://example.com/avatar.jpg',
          role: 'user', // Default role
        })
      })
    })

    it('handles session user with missing fields', async () => {
      const incompleteSession = {
        user: {
          id: undefined,
          name: undefined,
          email: undefined,
          image: undefined,
        },
        expires: '2024-12-31',
      }
      
      mockUseSession.mockReturnValue({
        data: incompleteSession,
        status: 'authenticated',
      })
      
      mockUseAuthStore.mockReturnValue({
        user: null,
        isAuthenticated: true,
        setUser: mockSetUser,
        setLoading: mockSetLoading,
      })
      
      render(
        <AuthWrapper>
          <div>Protected Content</div>
        </AuthWrapper>
      )
      
      await waitFor(() => {
        expect(mockSetUser).toHaveBeenCalledWith({
          id: '',
          name: '',
          email: '',
          avatar: undefined,
          role: 'user',
        })
      })
    })
  })

  describe('Store Integration', () => {
    it('calls setLoading when session status is loading', () => {
      mockUseSession.mockReturnValue({
        data: null,
        status: 'loading',
      })
      
      render(
        <AuthWrapper>
          <div>Protected Content</div>
        </AuthWrapper>
      )
      
      expect(mockSetLoading).toHaveBeenCalledWith(true)
    })

    it('calls setUser with null when unauthenticated', async () => {
      mockUseSession.mockReturnValue({
        data: null,
        status: 'unauthenticated',
      })
      
      render(
        <AuthWrapper>
          <div>Protected Content</div>
        </AuthWrapper>
      )
      
      await waitFor(() => {
        expect(mockSetUser).toHaveBeenCalledWith(null)
      })
    })
  })

  describe('Accessibility', () => {
    it('has no accessibility violations in loading state', async () => {
      mockUseSession.mockReturnValue({
        data: null,
        status: 'loading',
      })
      
      const { container } = render(
        <AuthWrapper>
          <div>Protected Content</div>
        </AuthWrapper>
      )
      
      await testAccessibility(container)
    })

    it('has no accessibility violations in redirecting state', async () => {
      mockUseSession.mockReturnValue({
        data: null,
        status: 'unauthenticated',
      })
      
      const { container } = render(
        <AuthWrapper>
          <div>Protected Content</div>
        </AuthWrapper>
      )
      
      await testAccessibility(container)
    })

    it('provides meaningful loading text for screen readers', () => {
      mockUseSession.mockReturnValue({
        data: null,
        status: 'loading',
      })
      
      render(
        <AuthWrapper>
          <div>Protected Content</div>
        </AuthWrapper>
      )
      
      const loadingText = screen.getByText('Checking authentication...')
      expect(loadingText).toBeInTheDocument()
      expect(loadingText).toHaveClass('text-muted-foreground')
    })
  })

  describe('Edge Cases', () => {
    it('handles session status changes', async () => {
      const { rerender } = render(
        <AuthWrapper>
          <div>Protected Content</div>
        </AuthWrapper>
      )
      
      // Start with loading
      mockUseSession.mockReturnValue({
        data: null,
        status: 'loading',
      })
      
      rerender(
        <AuthWrapper>
          <div>Protected Content</div>
        </AuthWrapper>
      )
      
      expect(screen.getByText('Checking authentication...')).toBeInTheDocument()
      
      // Change to authenticated
      const authenticatedSession = {
        user: {
          id: '123',
          name: 'John Doe',
          email: 'john@example.com',
        },
        expires: '2024-12-31',
      }
      
      mockUseSession.mockReturnValue({
        data: authenticatedSession,
        status: 'authenticated',
      })
      
      mockUseAuthStore.mockReturnValue({
        user: {
          id: '123',
          name: 'John Doe',
          email: 'john@example.com',
          avatar: undefined,
          role: 'user',
        },
        isAuthenticated: true,
        setUser: mockSetUser,
        setLoading: mockSetLoading,
      })
      
      rerender(
        <AuthWrapper>
          <div>Protected Content</div>
        </AuthWrapper>
      )
      
      await waitFor(() => {
        expect(screen.getByText('Protected Content')).toBeInTheDocument()
      })
    })
  })
})