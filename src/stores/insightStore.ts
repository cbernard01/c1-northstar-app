import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

export type InsightCategory = 'ecosystem' | 'value' | 'interests' | 'next_steps'

export interface EvidenceLink {
  id: string
  title: string
  url: string
  type: 'document' | 'website' | 'social' | 'news' | 'report'
  snippet?: string
  publishedAt?: Date
}

export interface Insight {
  id: string
  accountId: string
  category: InsightCategory
  title: string
  content: string
  confidence: number
  evidence: EvidenceLink[]
  timestamp: Date
  isBookmarked: boolean
  tags: string[]
  metadata?: Record<string, unknown>
}

interface InsightFilters {
  accountId?: string
  categories: InsightCategory[]
  confidenceRange: [number, number]
  dateRange: [Date, Date] | null
  bookmarked: boolean | null
  tags: string[]
  search: string
}

interface InsightState {
  insights: Insight[]
  filteredInsights: Insight[]
  selectedInsight: Insight | null
  isLoading: boolean
  error: string | null
  
  // Filters
  filters: InsightFilters
  sortBy: 'timestamp' | 'confidence' | 'title'
  sortOrder: 'asc' | 'desc'
  selectedCategory: InsightCategory | 'all'
  
  // Actions
  setInsights: (insights: Insight[]) => void
  addInsight: (insight: Insight) => void
  updateInsight: (id: string, updates: Partial<Insight>) => void
  removeInsight: (id: string) => void
  setSelectedInsight: (insight: Insight | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  
  // Filter actions
  updateFilters: (filters: Partial<InsightFilters>) => void
  clearFilters: () => void
  setSelectedCategory: (category: InsightCategory | 'all') => void
  setSorting: (sortBy: InsightState['sortBy'], sortOrder: 'asc' | 'desc') => void
  
  // Bookmark actions
  toggleBookmark: (id: string) => void
  
  // Computed
  applyFiltersAndSorting: () => void
  getInsightsByAccount: (accountId: string) => Insight[]
  getInsightsByCategory: (category: InsightCategory) => Insight[]
  getInsightCountByCategory: () => Record<InsightCategory, number>
  getUniqueTagsForAccount: (accountId?: string) => string[]
  getAverageConfidenceForAccount: (accountId: string) => number
}

const defaultFilters: InsightFilters = {
  categories: [],
  confidenceRange: [0, 100],
  dateRange: null,
  bookmarked: null,
  tags: [],
  search: '',
}

export const useInsightStore = create<InsightState>()(
  devtools(
    (set, get) => ({
      insights: [],
      filteredInsights: [],
      selectedInsight: null,
      isLoading: false,
      error: null,
      filters: defaultFilters,
      sortBy: 'timestamp',
      sortOrder: 'desc',
      selectedCategory: 'all',

      setInsights: (insights) => {
        set({ insights })
        get().applyFiltersAndSorting()
      },

      addInsight: (insight) => {
        const { insights } = get()
        set({ insights: [insight, ...insights] })
        get().applyFiltersAndSorting()
      },

      updateInsight: (id, updates) => {
        const { insights } = get()
        const updatedInsights = insights.map(insight => 
          insight.id === id 
            ? { ...insight, ...updates }
            : insight
        )
        set({ insights: updatedInsights })
        get().applyFiltersAndSorting()
      },

      removeInsight: (id) => {
        const { insights, selectedInsight } = get()
        const filteredInsights = insights.filter(insight => insight.id !== id)
        set({ 
          insights: filteredInsights,
          selectedInsight: selectedInsight?.id === id ? null : selectedInsight 
        })
        get().applyFiltersAndSorting()
      },

      setSelectedInsight: (selectedInsight) => {
        set({ selectedInsight })
      },

      setLoading: (isLoading) => {
        set({ isLoading })
      },

      setError: (error) => {
        set({ error })
      },

      updateFilters: (newFilters) => {
        const { filters } = get()
        set({ filters: { ...filters, ...newFilters } })
        get().applyFiltersAndSorting()
      },

      clearFilters: () => {
        set({ filters: defaultFilters })
        get().applyFiltersAndSorting()
      },

      setSelectedCategory: (selectedCategory) => {
        set({ selectedCategory })
        
        // Update filters to match category selection
        const { filters } = get()
        const categories = selectedCategory === 'all' ? [] : [selectedCategory]
        set({ filters: { ...filters, categories } })
        get().applyFiltersAndSorting()
      },

      setSorting: (sortBy, sortOrder) => {
        set({ sortBy, sortOrder })
        get().applyFiltersAndSorting()
      },

      toggleBookmark: (id) => {
        const { insights } = get()
        const updatedInsights = insights.map(insight => 
          insight.id === id 
            ? { ...insight, isBookmarked: !insight.isBookmarked }
            : insight
        )
        set({ insights: updatedInsights })
        get().applyFiltersAndSorting()
      },

      applyFiltersAndSorting: () => {
        const { insights, filters, sortBy, sortOrder } = get()
        
        // Apply filters
        const filtered = insights.filter(insight => {
          // Account filter
          if (filters.accountId && insight.accountId !== filters.accountId) {
            return false
          }
          
          // Category filter
          if (filters.categories.length > 0 && !filters.categories.includes(insight.category)) {
            return false
          }
          
          // Confidence range filter
          if (insight.confidence < filters.confidenceRange[0] || insight.confidence > filters.confidenceRange[1]) {
            return false
          }
          
          // Date range filter
          if (filters.dateRange) {
            const [startDate, endDate] = filters.dateRange
            if (insight.timestamp < startDate || insight.timestamp > endDate) {
              return false
            }
          }
          
          // Bookmark filter
          if (filters.bookmarked !== null && insight.isBookmarked !== filters.bookmarked) {
            return false
          }
          
          // Tags filter
          if (filters.tags.length > 0) {
            const hasMatchingTag = filters.tags.some(tag => insight.tags.includes(tag))
            if (!hasMatchingTag) return false
          }
          
          // Search filter
          if (filters.search) {
            const searchLower = filters.search.toLowerCase()
            const matchesSearch = 
              insight.title.toLowerCase().includes(searchLower) ||
              insight.content.toLowerCase().includes(searchLower) ||
              insight.tags.some(tag => tag.toLowerCase().includes(searchLower))
            if (!matchesSearch) return false
          }
          
          return true
        })
        
        // Apply sorting
        filtered.sort((a, b) => {
          let aValue: string | number
          let bValue: string | number
          
          switch (sortBy) {
            case 'timestamp':
              aValue = a.timestamp.getTime()
              bValue = b.timestamp.getTime()
              break
            case 'confidence':
              aValue = a.confidence
              bValue = b.confidence
              break
            case 'title':
              aValue = a.title.toLowerCase()
              bValue = b.title.toLowerCase()
              break
            default:
              return 0
          }
          
          if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1
          if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1
          return 0
        })
        
        set({ filteredInsights: filtered })
      },

      getInsightsByAccount: (accountId) => {
        const { insights } = get()
        return insights.filter(insight => insight.accountId === accountId)
      },

      getInsightsByCategory: (category) => {
        const { insights } = get()
        return insights.filter(insight => insight.category === category)
      },

      getInsightCountByCategory: () => {
        const { insights } = get()
        const counts: Record<InsightCategory, number> = {
          ecosystem: 0,
          value: 0,
          interests: 0,
          next_steps: 0,
        }
        
        insights.forEach(insight => {
          counts[insight.category]++
        })
        
        return counts
      },

      getUniqueTagsForAccount: (accountId) => {
        const { insights } = get()
        const relevantInsights = accountId 
          ? insights.filter(insight => insight.accountId === accountId)
          : insights
        
        const allTags = relevantInsights.flatMap(insight => insight.tags)
        return Array.from(new Set(allTags)).sort()
      },

      getAverageConfidenceForAccount: (accountId) => {
        const { insights } = get()
        const accountInsights = insights.filter(insight => insight.accountId === accountId)
        
        if (accountInsights.length === 0) return 0
        
        const totalConfidence = accountInsights.reduce((sum, insight) => sum + insight.confidence, 0)
        return Math.round(totalConfidence / accountInsights.length)
      },
    }),
    {
      name: 'insight-store',
    }
  )
)