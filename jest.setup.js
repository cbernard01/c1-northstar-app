import '@testing-library/jest-dom'
import 'jest-axe/extend-expect'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(),
  }),
  usePathname: () => '/',
}))

// Mock NextAuth
jest.mock('next-auth/react', () => ({
  useSession: jest.fn(() => ({
    data: null,
    status: 'loading',
  })),
  signIn: jest.fn(),
  signOut: jest.fn(),
  SessionProvider: ({ children }) => children,
}))

// Zustand stores are mocked individually in test files when needed

// Services are mocked individually in test files when needed

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Upload: ({ className, ...props }) => <div data-testid="upload-icon" className={className} {...props} />,
  File: ({ className, ...props }) => <div data-testid="file-icon" className={className} {...props} />,
  X: ({ className, ...props }) => <div data-testid="x-icon" className={className} {...props} />,
  CheckCircle: ({ className, ...props }) => <div data-testid="check-circle-icon" className={className} {...props} />,
  AlertCircle: ({ className, ...props }) => <div data-testid="alert-circle-icon" className={className} {...props} />,
  Loader2: ({ className, ...props }) => <div data-testid="loader-icon" className={className} {...props} />,
  Pause: ({ className, ...props }) => <div data-testid="pause-icon" className={className} {...props} />,
  Play: ({ className, ...props }) => <div data-testid="play-icon" className={className} {...props} />,
  FileText: ({ className, ...props }) => <div data-testid="file-text-icon" className={className} {...props} />,
  FileSpreadsheet: ({ className, ...props }) => <div data-testid="file-spreadsheet-icon" className={className} {...props} />,
  FileJson: ({ className, ...props }) => <div data-testid="file-json-icon" className={className} {...props} />,
  Building2: ({ className, ...props }) => <div data-testid="building-icon" className={className} {...props} />,
  Lightbulb: ({ className, ...props }) => <div data-testid="lightbulb-icon" className={className} {...props} />,
  TrendingUp: ({ className, ...props }) => <div data-testid="trending-up-icon" className={className} {...props} />,
  Clock: ({ className, ...props }) => <div data-testid="clock-icon" className={className} {...props} />,
  Users: ({ className, ...props }) => <div data-testid="users-icon" className={className} {...props} />,
  Target: ({ className, ...props }) => <div data-testid="target-icon" className={className} {...props} />,
  ArrowUpRight: ({ className, ...props }) => <div data-testid="arrow-up-right-icon" className={className} {...props} />,
  ArrowDownRight: ({ className, ...props }) => <div data-testid="arrow-down-right-icon" className={className} {...props} />,
  XCircle: ({ className, ...props }) => <div data-testid="x-circle-icon" className={className} {...props} />,
  MoreHorizontal: ({ className, ...props }) => <div data-testid="more-horizontal-icon" className={className} {...props} />,
  RotateCcw: ({ className, ...props }) => <div data-testid="rotate-ccw-icon" className={className} {...props} />,
}))

// Mock react-icons
jest.mock('react-icons/bs', () => ({
  BsMicrosoft: ({ className, ...props }) => <div data-testid="microsoft-icon" className={className} {...props} />,
}))

// Mock file operations
Object.defineProperty(window, 'File', {
  value: class MockFile {
    constructor(fileBits, fileName, options) {
      this.name = fileName
      this.size = fileBits[0] ? fileBits[0].length : 0
      this.type = options?.type || ''
    }
  },
})

Object.defineProperty(window, 'FileList', {
  value: class MockFileList {
    constructor(files) {
      this.length = files.length
      files.forEach((file, index) => {
        this[index] = file
      })
    }
  },
})

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

// Silence console.error during tests unless it's an actual error
const originalError = console.error
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is deprecated')
    ) {
      return
    }
    originalError.call(console, ...args)
  }
})

afterAll(() => {
  console.error = originalError
})