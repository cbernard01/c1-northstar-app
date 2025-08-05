import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

export interface Account {
  id: string
  name: string
  industry: string
  size: 'startup' | 'small' | 'medium' | 'large' | 'enterprise'
  revenue?: string
  employees?: number
  website?: string
  description?: string
  technologies: string[]
  lastUpdated: Date
  insightCount: number
  confidence: number
  location?: {
    city: string
    state: string
    country: string
  }
  contacts?: {
    name: string
    role: string
    email?: string
    linkedIn?: string
  }[]
  metadata?: Record<string, unknown>
}

interface AccountFilters {
  search: string
  industry: string[]
  size: string[]
  technologies: string[]
  confidenceRange: [number, number]
  hasInsights: boolean | null
}

interface Pagination {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

interface AccountState {
  accounts: Account[]
  filteredAccounts: Account[]
  selectedAccount: Account | null
  isLoading: boolean
  error: string | null
  
  // Filters
  filters: AccountFilters
  sortBy: 'name' | 'lastUpdated' | 'confidence' | 'insightCount'
  sortOrder: 'asc' | 'desc'
  
  // Pagination
  pagination: Pagination
  
  // Actions
  setAccounts: (accounts: Account[]) => void
  addAccount: (account: Account) => void
  updateAccount: (id: string, updates: Partial<Account>) => void
  removeAccount: (id: string) => void
  setSelectedAccount: (account: Account | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  
  // Filter actions
  updateFilters: (filters: Partial<AccountFilters>) => void
  clearFilters: () => void
  setSorting: (sortBy: AccountState['sortBy'], sortOrder: 'asc' | 'desc') => void
  
  // Pagination actions
  setPage: (page: number) => void
  setPageSize: (pageSize: number) => void
  
  // Computed
  applyFiltersAndSorting: () => void
  getAccountById: (id: string) => Account | undefined
  getUniqueIndustries: () => string[]
  getUniqueTechnologies: () => string[]
}

const defaultFilters: AccountFilters = {
  search: '',
  industry: [],
  size: [],
  technologies: [],
  confidenceRange: [0, 100],
  hasInsights: null,
}

const defaultPagination: Pagination = {
  page: 1,
  pageSize: 25,
  total: 0,
  totalPages: 0,
}

export const useAccountStore = create<AccountState>()(
  devtools(
    (set, get) => ({
      accounts: [],
      filteredAccounts: [],
      selectedAccount: null,
      isLoading: false,
      error: null,
      filters: defaultFilters,
      sortBy: 'lastUpdated',
      sortOrder: 'desc',
      pagination: defaultPagination,

      setAccounts: (accounts) => {
        set({ accounts })
        get().applyFiltersAndSorting()
      },

      addAccount: (account) => {
        const { accounts } = get()
        set({ accounts: [account, ...accounts] })
        get().applyFiltersAndSorting()
      },

      updateAccount: (id, updates) => {
        const { accounts } = get()
        const updatedAccounts = accounts.map(account => 
          account.id === id 
            ? { ...account, ...updates, lastUpdated: new Date() }
            : account
        )
        set({ accounts: updatedAccounts })
        get().applyFiltersAndSorting()
      },

      removeAccount: (id) => {
        const { accounts, selectedAccount } = get()
        const filteredAccounts = accounts.filter(account => account.id !== id)
        set({ 
          accounts: filteredAccounts,
          selectedAccount: selectedAccount?.id === id ? null : selectedAccount 
        })
        get().applyFiltersAndSorting()
      },

      setSelectedAccount: (selectedAccount) => {
        set({ selectedAccount })
      },

      setLoading: (isLoading) => {
        set({ isLoading })
      },

      setError: (error) => {
        set({ error })
      },

      updateFilters: (newFilters) => {
        const { filters } = get()
        set({ 
          filters: { ...filters, ...newFilters },
          pagination: { ...get().pagination, page: 1 }
        })
        get().applyFiltersAndSorting()
      },

      clearFilters: () => {
        set({ 
          filters: defaultFilters,
          pagination: { ...get().pagination, page: 1 }
        })
        get().applyFiltersAndSorting()
      },

      setSorting: (sortBy, sortOrder) => {
        set({ sortBy, sortOrder })
        get().applyFiltersAndSorting()
      },

      setPage: (page) => {
        set({ pagination: { ...get().pagination, page } })
      },

      setPageSize: (pageSize) => {
        set({ pagination: { ...get().pagination, pageSize, page: 1 } })
      },

      applyFiltersAndSorting: () => {
        const { accounts, filters, sortBy, sortOrder, pagination } = get()
        
        // Apply filters
        const filtered = accounts.filter(account => {
          // Search filter
          if (filters.search) {
            const searchLower = filters.search.toLowerCase()
            const matchesSearch = 
              account.name.toLowerCase().includes(searchLower) ||
              account.industry.toLowerCase().includes(searchLower) ||
              account.technologies.some(tech => tech.toLowerCase().includes(searchLower))
            if (!matchesSearch) return false
          }
          
          // Industry filter
          if (filters.industry.length > 0 && !filters.industry.includes(account.industry)) {
            return false
          }
          
          // Size filter
          if (filters.size.length > 0 && !filters.size.includes(account.size)) {
            return false
          }
          
          // Technology filter
          if (filters.technologies.length > 0) {
            const hasMatchingTech = filters.technologies.some(tech => 
              account.technologies.includes(tech)
            )
            if (!hasMatchingTech) return false
          }
          
          // Confidence range filter
          if (account.confidence < filters.confidenceRange[0] || account.confidence > filters.confidenceRange[1]) {
            return false
          }
          
          // Has insights filter
          if (filters.hasInsights !== null) {
            if (filters.hasInsights && account.insightCount === 0) return false
            if (!filters.hasInsights && account.insightCount > 0) return false
          }
          
          return true
        })
        
        // Apply sorting
        filtered.sort((a, b) => {
          let aValue: string | number
          let bValue: string | number
          
          switch (sortBy) {
            case 'name':
              aValue = a.name.toLowerCase()
              bValue = b.name.toLowerCase()
              break
            case 'lastUpdated':
              aValue = a.lastUpdated.getTime()
              bValue = b.lastUpdated.getTime()
              break
            case 'confidence':
              aValue = a.confidence
              bValue = b.confidence
              break
            case 'insightCount':
              aValue = a.insightCount
              bValue = b.insightCount
              break
            default:
              return 0
          }
          
          if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1
          if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1
          return 0
        })
        
        // Update pagination
        const total = filtered.length
        const totalPages = Math.ceil(total / pagination.pageSize)
        
        set({ 
          filteredAccounts: filtered,
          pagination: { ...pagination, total, totalPages }
        })
      },

      getAccountById: (id) => {
        const { accounts } = get()
        return accounts.find(account => account.id === id)
      },

      getUniqueIndustries: () => {
        const { accounts } = get()
        const industries = new Set(accounts.map(account => account.industry))
        return Array.from(industries).sort()
      },

      getUniqueTechnologies: () => {
        const { accounts } = get()
        const technologies = new Set(accounts.flatMap(account => account.technologies))
        return Array.from(technologies).sort()
      },
    }),
    {
      name: 'account-store',
    }
  )
)