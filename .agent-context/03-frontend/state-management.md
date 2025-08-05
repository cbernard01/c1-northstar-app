# State Management Architecture

## Overview

The C1 Northstar application uses **Zustand** for state management, providing a simple and efficient way to manage global application state. The architecture follows a modular approach with separate stores for different domains.

## Store Structure

```
src/stores/
├── authStore.ts          # User authentication state
├── jobStore.ts           # Job queue and processing state
├── accountStore.ts       # Account data with filters and pagination
├── insightStore.ts       # AI insights with categories and bookmarking
├── uploadStore.ts        # File upload state with progress tracking
└── chatStore.ts          # Chat messages and AI assistant context
```

## Data Flow Architecture

```
External Sources → API Services → Zustand Stores → React Components → UI
     ↓                ↓              ↓               ↓            ↓
- REST APIs      - apiClient    - Global State  - Local State  - User Interface
- WebSocket      - jobService   - Computed      - Effects      - Events
- File Upload    - uploadService  Values        - Handlers     - Interactions
- SSE Streams    - chatService   - Actions       - Validation   - Feedback
```

## Store Responsibilities

### AuthStore (`authStore.ts`)

**Purpose**: Manages user authentication state and session data.

**State**:
```typescript
interface AuthState {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
}
```

**Actions**:
- `setUser(user)` - Set authenticated user
- `setLoading(loading)` - Update loading state
- `logout()` - Clear user session

**Usage**:
```typescript
const { user, isAuthenticated, setUser, logout } = useAuthStore()
```

**Integration**:
- Connected to NextAuth session
- Updates automatically on auth state changes
- Used by AuthWrapper for route protection

---

### JobStore (`jobStore.ts`)

**Purpose**: Manages job queue, processing status, and real-time updates.

**State**:
```typescript
interface JobState {
  jobs: Job[]
  activeJobs: Job[]
  isLoading: boolean
  selectedJob: Job | null
  statusFilter: JobStatus | 'all'
  typeFilter: string | 'all'
}
```

**Key Features**:
- Real-time job updates via WebSocket/SSE
- Filtering by status and type
- Active job tracking for UI indicators
- Job progress monitoring

**Actions**:
- `setJobs(jobs)` - Set job list
- `addJob(job)` - Add new job
- `updateJob(id, updates)` - Update job status/progress
- `removeJob(id)` - Remove job
- `setStatusFilter(status)` - Filter by status
- `getActiveJobsCount()` - Get count of active jobs

**Real-time Integration**:
```typescript
// WebSocket updates
websocketService.subscribeToJobUpdates((update) => {
  updateJob(update.id, {
    status: update.status,
    progress: update.progress,
    result: update.result
  })
})
```

---

### AccountStore (`accountStore.ts`)

**Purpose**: Manages account data with search, filtering, and pagination.

**State**:
```typescript
interface AccountState {
  accounts: Account[]
  filteredAccounts: Account[]
  isLoading: boolean
  selectedAccount: Account | null
  searchQuery: string
  filters: {
    industry: string[]
    size: string[]
    location: string[]
    technology: string[]
  }
  sortBy: string
  sortOrder: 'asc' | 'desc'
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}
```

**Key Features**:
- Full-text search across account fields
- Multi-faceted filtering (industry, size, location, technology)
- Sorting by multiple criteria
- Pagination with configurable page sizes
- Computed filtered results

**Actions**:
- `setAccounts(accounts)` - Set account list
- `setSearchQuery(query)` - Update search
- `setFilter(type, values)` - Update filters
- `setSorting(field, order)` - Update sorting
- `setPage(page)` - Change pagination
- `getFilteredAccounts()` - Get computed results

**Usage Example**:
```typescript
const {
  filteredAccounts,
  searchQuery,
  filters,
  setSearchQuery,
  setFilter,
  pagination
} = useAccountStore()

// Search
setSearchQuery('technology company')

// Filter by industry
setFilter('industry', ['Technology', 'Healthcare'])

// Get results
const results = getFilteredAccounts()
```

---

### InsightStore (`insightStore.ts`)

**Purpose**: Manages AI-generated insights with categorization and bookmarking.

**State**:
```typescript
interface InsightState {
  insights: Insight[]
  categories: string[]
  isLoading: boolean
  selectedInsight: Insight | null
  filters: {
    category: string
    confidence: number
    dateRange: [Date, Date] | null
    bookmarkedOnly: boolean
  }
}
```

**Key Features**:
- Insight categorization and tagging
- Confidence-based filtering
- Bookmark management
- Date range filtering
- Account-specific insights

**Actions**:
- `setInsights(insights)` - Set insight list
- `addInsight(insight)` - Add new insight
- `updateInsight(id, updates)` - Update insight
- `toggleBookmark(id)` - Toggle bookmark status
- `setCategory(category)` - Filter by category
- `getInsightsByAccount(accountId)` - Get account insights

---

### UploadStore (`uploadStore.ts`)

**Purpose**: Manages file upload state with progress tracking and validation.

**State**:
```typescript
interface UploadState {
  files: UploadFile[]
  isUploading: boolean
  dragActive: boolean
  totalProgress: number
  acceptedTypes: string[]
  maxFileSize: number
  maxFiles: number
}
```

**Key Features**:
- Multi-file upload support
- Real-time progress tracking
- File validation (type, size)
- Drag-and-drop support
- Upload history and retry

**Actions**:
- `addFiles(files)` - Add files to upload queue
- `removeFile(id)` - Remove file
- `updateFile(id, updates)` - Update file status/progress
- `setDragActive(active)` - Update drag state
- `clearCompleted()` - Clear completed uploads

**Integration with Upload Service**:
```typescript
// File upload with progress
await uploadService.uploadFile(file, (progress) => {
  updateFile(fileId, { progress, status: 'uploading' })
})
```

---

### ChatStore (`chatStore.ts`)

**Purpose**: Manages chat sessions and AI assistant interactions.

**State**:
```typescript
interface ChatState {
  sessions: ChatSession[]
  currentSessionId: string | null
  isLoading: boolean
  isStreaming: boolean
  context: {
    accountId?: string
    accountName?: string
  } | null
}
```

**Key Features**:
- Multiple chat sessions
- Context-aware conversations
- Message history persistence
- Streaming response support
- Account-specific context

**Actions**:
- `createSession(context)` - Create new chat session
- `setCurrentSession(id)` - Switch active session
- `addMessage(sessionId, message)` - Add message to session
- `setContext(context)` - Set conversation context
- `clearSessions()` - Clear all sessions

## State Persistence

### Local Storage
Currently, state is not persisted to localStorage, but can be easily added:

```typescript
// Example: Persist auth state
export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set, get) => ({
        // state and actions
      }),
      {
        name: 'auth-store',
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({ user: state.user })
      }
    )
  )
)
```

### Session Storage
For temporary data that should not persist across browser sessions:

```typescript
import { createJSONStorage } from 'zustand/middleware'

// Use sessionStorage instead
{
  name: 'temp-store',
  storage: createJSONStorage(() => sessionStorage)
}
```

## Real-time Updates

### WebSocket Integration

The application uses WebSocket connections for real-time updates:

```typescript
// In AppLayout.tsx
useEffect(() => {
  // Connect to WebSocket
  websocketService.connect()

  // Subscribe to job updates
  const cleanup = websocketService.subscribeToJobUpdates((update) => {
    updateJob(update.id, {
      status: update.status,
      progress: update.progress
    })
  })

  return cleanup
}, [])
```

### Server-Sent Events (SSE)

Fallback for job updates when WebSocket is unavailable:

```typescript
// In jobService.ts
subscribeToJobUpdates((update) => {
  if (!websocketService.isConnected()) {
    // Use SSE as fallback
    updateJob(update.id, update)
  }
})
```

## Error Handling

### Store-level Error Handling

Each store includes error handling:

```typescript
interface StoreState {
  error: string | null
  isError: boolean
}

// Actions
setError: (error: string | null) => void
clearError: () => void
```

### API Error Integration

Errors are propagated from API services to stores:

```typescript
try {
  const jobs = await jobService.getJobs()
  setJobs(jobs)
  clearError()
} catch (error) {
  setError(error.message)
  setLoading(false)
}
```

## Performance Optimizations

### Computed Values

Expensive calculations are memoized:

```typescript
// In accountStore.ts
getFilteredAccounts: () => {
  const { accounts, searchQuery, filters } = get()
  
  return accounts.filter(account => {
    // Complex filtering logic
    const matchesSearch = searchQuery ? 
      account.name.toLowerCase().includes(searchQuery.toLowerCase()) : true
    
    const matchesFilters = filters.industry.length === 0 ||
      filters.industry.includes(account.industry)
    
    return matchesSearch && matchesFilters
  })
}
```

### Selective Subscriptions

Components only subscribe to needed state slices:

```typescript
// Only subscribe to specific fields
const isLoading = useJobStore(state => state.isLoading)
const activeCount = useJobStore(state => state.getActiveJobsCount())

// Avoid subscribing to entire store
const { jobs, ...everything } = useJobStore() // ❌ Re-renders on any change
```

## DevTools Integration

All stores include Redux DevTools support:

```typescript
export const useJobStore = create<JobState>()(
  devtools(
    (set, get) => ({
      // state and actions
    }),
    {
      name: 'job-store', // Shows in DevTools
    }
  )
)
```

### DevTools Usage

1. Install Redux DevTools browser extension
2. Open browser developer tools
3. Navigate to Redux tab
4. Select store from dropdown
5. Inspect state, actions, and time-travel debug

## Testing State Management

### Unit Tests

```typescript
import { renderHook, act } from '@testing-library/react'
import { useJobStore } from '@/stores/jobStore'

test('should add job to store', () => {
  const { result } = renderHook(() => useJobStore())
  
  act(() => {
    result.current.addJob(mockJob)
  })
  
  expect(result.current.jobs).toHaveLength(1)
  expect(result.current.jobs[0]).toEqual(mockJob)
})
```

### Integration Tests

```typescript
import { render, screen } from '@testing-library/react'
import { JobList } from '@/components/jobs/JobList'

test('should display jobs from store', () => {
  // Setup store state
  useJobStore.setState({
    jobs: [mockJob1, mockJob2],
    isLoading: false
  })
  
  render(<JobList />)
  
  expect(screen.getByText(mockJob1.title)).toBeInTheDocument()
  expect(screen.getByText(mockJob2.title)).toBeInTheDocument()
})
```

## Migration Guide

### From Redux to Zustand

If migrating from Redux:

1. **Actions**: Redux actions become store methods
2. **Reducers**: Reducer logic moves into store methods
3. **Selectors**: Become computed properties or store methods
4. **Middleware**: Use Zustand middleware (devtools, persist, etc.)
5. **Connect**: Replace with direct store hooks

### Adding New Stores

1. Create store file in `src/stores/`
2. Define TypeScript interfaces
3. Implement store with devtools
4. Add real-time subscriptions if needed
5. Export typed hooks
6. Update documentation

## Best Practices

### Do's ✅

- Keep stores focused on single domains
- Use TypeScript for type safety
- Include DevTools integration
- Handle loading and error states
- Use computed values for derived state
- Subscribe to specific state slices
- Clean up subscriptions in useEffect

### Don'ts ❌

- Don't put all state in one large store
- Don't subscribe to entire store unnecessarily
- Don't mutate state directly (Zustand allows it but avoid for clarity)
- Don't forget error handling
- Don't ignore real-time update cleanup
- Don't skip TypeScript interfaces

## Future Enhancements

### Planned Features

1. **State Persistence**: Add localStorage/sessionStorage persistence
2. **Optimistic Updates**: Implement optimistic UI updates
3. **Offline Support**: Add offline state management
4. **State Synchronization**: Sync state across browser tabs
5. **Advanced Caching**: Implement request caching and invalidation
6. **State Analytics**: Track state changes for debugging

### Performance Monitoring

Consider adding state performance monitoring:

```typescript
// Monitor store performance
const perfStore = create(
  subscribeWithSelector(
    devtools(
      (set, get) => ({
        // store implementation
      }),
      {
        name: 'perf-store',
        serialize: true // Enable time-travel debugging
      }
    )
  )
)
```

This architecture provides a scalable, maintainable state management solution that can grow with the application's needs while maintaining performance and developer experience.