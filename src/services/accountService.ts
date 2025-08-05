import { apiClient, type ApiResponse } from './apiClient'

import type { Account } from '@/stores/accountStore'

export interface AccountsListResponse {
  accounts: Account[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface AccountSearchParams {
  search?: string
  industry?: string[]
  size?: string[]
  technologies?: string[]
  confidenceRange?: [number, number]
  hasInsights?: boolean
  page?: number
  pageSize?: number
  sortBy?: 'name' | 'lastUpdated' | 'confidence' | 'insightCount'
  sortOrder?: 'asc' | 'desc'
}

export interface CreateAccountRequest {
  name: string
  industry: string
  size: 'startup' | 'small' | 'medium' | 'large' | 'enterprise'
  website?: string
  description?: string
  location?: {
    city: string
    state: string
    country: string
  }
  technologies?: string[]
  metadata?: Record<string, unknown>
}

export interface UpdateAccountRequest extends Partial<CreateAccountRequest> {
  technologies?: string[]
  confidence?: number
  insightCount?: number
}

export interface AccountAnalysisRequest {
  accountId: string
  analysisType: 'full' | 'technology' | 'competitive' | 'financial'
  priority: 'low' | 'medium' | 'high'
}

class AccountService {
  async getAccounts(params?: AccountSearchParams): Promise<AccountsListResponse> {
    try {
      // Convert params to string values for API client
      const apiParams = params ? Object.fromEntries(
        Object.entries({
          ...params,
          page: params.page?.toString(),
          pageSize: params.pageSize?.toString(),
          industry: params.industry?.join(','),
          size: params.size?.join(','),
          technologies: params.technologies?.join(','),
          confidenceRange: params.confidenceRange?.join(','),
          hasInsights: params.hasInsights?.toString()
        }).filter(([_, value]) => value !== undefined && value !== '')
      ) as Record<string, string | number> : undefined;
      
      const response = await apiClient.get<AccountsListResponse>('/accounts', apiParams)
      return response.data
    } catch (error) {
      console.error('Failed to fetch accounts:', error)
      throw error
    }
  }

  async getAccount(id: string): Promise<Account> {
    try {
      const response = await apiClient.get<Account>(`/accounts/${id}`)
      return response.data
    } catch (error) {
      console.error('Failed to fetch account:', error)
      throw error
    }
  }

  async createAccount(accountData: CreateAccountRequest): Promise<Account> {
    try {
      const response = await apiClient.post<Account>('/accounts', accountData)
      return response.data
    } catch (error) {
      console.error('Failed to create account:', error)
      throw error
    }
  }

  async updateAccount(id: string, updates: UpdateAccountRequest): Promise<Account> {
    try {
      const response = await apiClient.patch<Account>(`/accounts/${id}`, updates)
      return response.data
    } catch (error) {
      console.error('Failed to update account:', error)
      throw error
    }
  }

  async deleteAccount(id: string): Promise<void> {
    try {
      await apiClient.delete(`/accounts/${id}`)
    } catch (error) {
      console.error('Failed to delete account:', error)
      throw error
    }
  }

  async searchAccounts(query: string, limit = 10): Promise<Account[]> {
    try {
      const response = await apiClient.get<Account[]>('/accounts/search', { 
        q: query, 
        limit: limit.toString() 
      })
      return response.data
    } catch (error) {
      console.error('Failed to search accounts:', error)
      throw error
    }
  }

  async getAccountSuggestions(partial: string, limit = 5): Promise<string[]> {
    try {
      const response = await apiClient.get<string[]>('/accounts/suggestions', { 
        q: partial, 
        limit 
      })
      return response.data
    } catch (error) {
      console.error('Failed to get account suggestions:', error)
      return []
    }
  }

  async analyzeAccount(request: AccountAnalysisRequest): Promise<{ jobId: string }> {
    try {
      const response = await apiClient.post<{ jobId: string }>('/accounts/analyze', request)
      return response.data
    } catch (error) {
      console.error('Failed to start account analysis:', error)
      throw error
    }
  }

  async getAccountInsights(id: string): Promise<any[]> {
    try {
      const response = await apiClient.get<any[]>(`/accounts/${id}/insights`)
      return response.data
    } catch (error) {
      console.error('Failed to fetch account insights:', error)
      throw error
    }
  }

  async getAccountTechnologies(id: string): Promise<string[]> {
    try {
      const response = await apiClient.get<string[]>(`/accounts/${id}/technologies`)
      return response.data
    } catch (error) {
      console.error('Failed to fetch account technologies:', error)
      throw error
    }
  }

  async updateAccountTechnologies(id: string, technologies: string[]): Promise<Account> {
    try {
      const response = await apiClient.patch<Account>(`/accounts/${id}/technologies`, { 
        technologies 
      })
      return response.data
    } catch (error) {
      console.error('Failed to update account technologies:', error)
      throw error
    }
  }

  async getAccountContacts(id: string): Promise<any[]> {
    try {
      const response = await apiClient.get<any[]>(`/accounts/${id}/contacts`)
      return response.data
    } catch (error) {
      console.error('Failed to fetch account contacts:', error)
      throw error
    }
  }

  async addAccountContact(id: string, contact: any): Promise<any> {
    try {
      const response = await apiClient.post<any>(`/accounts/${id}/contacts`, contact)
      return response.data
    } catch (error) {
      console.error('Failed to add account contact:', error)
      throw error
    }
  }

  // Bulk operations
  async bulkUpdateAccounts(updates: { id: string; data: UpdateAccountRequest }[]): Promise<Account[]> {
    try {
      const response = await apiClient.post<Account[]>('/accounts/bulk-update', { updates })
      return response.data
    } catch (error) {
      console.error('Failed to bulk update accounts:', error)
      throw error
    }
  }

  async bulkDeleteAccounts(ids: string[]): Promise<void> {
    try {
      await apiClient.post('/accounts/bulk-delete', { ids })
    } catch (error) {
      console.error('Failed to bulk delete accounts:', error)
      throw error
    }
  }

  async exportAccounts(filters?: AccountSearchParams): Promise<Blob> {
    try {
      const params = new URLSearchParams(filters as any).toString()
      const response = await fetch(`/api/accounts/export?${params}`)
      
      if (!response.ok) {
        throw new Error('Failed to export accounts')
      }
      
      return await response.blob()
    } catch (error) {
      console.error('Failed to export accounts:', error)
      throw error
    }
  }

  // Statistics and aggregations
  async getAccountStats(): Promise<{
    total: number
    byIndustry: Record<string, number>
    bySize: Record<string, number>
    byConfidence: Record<string, number>
    averageConfidence: number
    totalInsights: number
  }> {
    try {
      const response = await apiClient.get('/accounts/stats')
      return response.data as {
        total: number
        byIndustry: Record<string, number>
        bySize: Record<string, number>
        byConfidence: Record<string, number>
        averageConfidence: number
        totalInsights: number
      }
    } catch (error) {
      console.error('Failed to fetch account stats:', error)
      throw error
    }
  }

  async getIndustryList(): Promise<string[]> {
    try {
      const response = await apiClient.get<string[]>('/accounts/industries')
      return response.data
    } catch (error) {
      console.error('Failed to fetch industries:', error)
      return []
    }
  }

  async getTechnologyList(): Promise<string[]> {
    try {
      const response = await apiClient.get<string[]>('/accounts/technologies')
      return response.data
    } catch (error) {
      console.error('Failed to fetch technologies:', error)
      return []
    }
  }
}

export const accountService = new AccountService()