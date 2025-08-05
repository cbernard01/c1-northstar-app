import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, RenderOptions } from '@testing-library/react'
import { SessionProvider } from 'next-auth/react'
import React from 'react'

// Mock session data
export const mockSession = {
  user: {
    id: '1',
    name: 'Test User',
    email: 'test@example.com',
    image: 'https://example.com/avatar.jpg',
  },
  expires: '2024-12-31',
}

// Create a new QueryClient for each test
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  })

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  session?: typeof mockSession | null
  queryClient?: QueryClient
}

// Custom render function with providers
export function renderWithProviders(
  ui: React.ReactElement,
  {
    session = mockSession,
    queryClient = createTestQueryClient(),
    ...renderOptions
  }: CustomRenderOptions = {}
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <SessionProvider session={session}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </SessionProvider>
    )
  }
  return render(ui, { wrapper: Wrapper, ...renderOptions })
}

// Mock file creation helper
export function createMockFile(
  name: string,
  size: number,
  type: string = 'text/plain'
): File {
  const file = new File(['a'.repeat(size)], name, { type })
  return file
}

// Mock file list creation helper
export function createMockFileList(files: File[]): FileList {
  const fileList = {
    length: files.length,
    item: (index: number) => files[index] || null,
    ...files.reduce((acc, file, index) => ({ ...acc, [index]: file }), {}),
  }
  return fileList as FileList
}

// Wait for async operations
export const waitFor = (callback: () => void, timeout = 1000) => {
  return new Promise((resolve, reject) => {
    const startTime = Date.now()
    const check = () => {
      try {
        callback()
        resolve(true)
      } catch (error) {
        if (Date.now() - startTime >= timeout) {
          reject(error)
        } else {
          setTimeout(check, 10)
        }
      }
    }
    check()
  })
}

// Mock implementations for common patterns
export const mockFetch = (response: any, status = 200) => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(response),
      text: () => Promise.resolve(JSON.stringify(response)),
    })
  ) as jest.Mock
}

// Re-export everything from RTL
export * from '@testing-library/react'
export { renderWithProviders as render }

// Test the test utilities themselves
describe('Test Utils', () => {
  it('should export helper functions', () => {
    expect(typeof renderWithProviders).toBe('function')
    expect(typeof createMockFile).toBe('function')
    expect(typeof createMockFileList).toBe('function')
    expect(typeof mockFetch).toBe('function')
  })
})