import { apiClient } from './apiClient'

export interface ExportRequest {
  type: 'accounts' | 'insights' | 'jobs' | 'reports'
  format: 'csv' | 'xlsx' | 'json'
  filters?: Record<string, any>
  columns?: string[]
  includeMetadata?: boolean
  dateRange?: {
    start: string
    end: string
  }
}

export interface ExportJob {
  id: string
  type: string
  format: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  progress: number
  createdAt: string
  completedAt?: string
  downloadUrl?: string
  fileSize?: number
  recordCount?: number
  error?: string
}

class ExportService {
  async createExport(request: ExportRequest): Promise<ExportJob> {
    try {
      const response = await apiClient.post<ExportJob>('/export', request)
      return response.data
    } catch (error) {
      console.error('Failed to create export:', error)
      throw error
    }
  }

  async getExportStatus(exportId: string): Promise<ExportJob> {
    try {
      const response = await apiClient.get<ExportJob>(`/export/${exportId}`)
      return response.data
    } catch (error) {
      console.error('Failed to get export status:', error)
      throw error
    }
  }

  async downloadExport(exportId: string): Promise<Blob> {
    try {
      const response = await fetch(`/api/export/${exportId}/download`)
      
      if (!response.ok) {
        throw new Error('Failed to download export')
      }
      
      return await response.blob()
    } catch (error) {
      console.error('Failed to download export:', error)
      throw error
    }
  }

  async getExportHistory(params?: {
    page?: number
    pageSize?: number
    type?: string
    status?: string
  }): Promise<{
    exports: ExportJob[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  }> {
    try {
      // Convert params to string values for API client
      const apiParams = params ? Object.fromEntries(
        Object.entries({
          ...params,
          page: params.page?.toString(),
          pageSize: params.pageSize?.toString()
        }).filter(([_, value]) => value !== undefined && value !== '')
      ) as Record<string, string | number> : undefined;
      
      const response = await apiClient.get('/export/history', apiParams)
      return response.data as {
        exports: ExportJob[]; 
        total: number; 
        page: number; 
        pageSize: number; 
        totalPages: number;
      }
    } catch (error) {
      console.error('Failed to get export history:', error)
      throw error
    }
  }

  async cancelExport(exportId: string): Promise<void> {
    try {
      await apiClient.delete(`/export/${exportId}`)
    } catch (error) {
      console.error('Failed to cancel export:', error)
      throw error
    }
  }

  // Client-side CSV generation for immediate exports
  generateCSV(data: any[], filename: string): void {
    if (data.length === 0) {
      throw new Error('No data to export')
    }

    // Get all unique keys from all objects
    const keys = new Set<string>()
    data.forEach(item => {
      Object.keys(item).forEach(key => keys.add(key))
    })

    const headers = Array.from(keys)
    
    // Create CSV content
    const csvContent = [
      // Header row
      headers.map(header => this.escapeCSVField(header)).join(','),
      // Data rows
      ...data.map(item => 
        headers.map(header => {
          const value = item[header]
          return this.escapeCSVField(this.formatValue(value))
        }).join(',')
      )
    ].join('\n')

    this.downloadCSV(csvContent, filename)
  }

  private escapeCSVField(field: string): string {
    if (field === null || field === undefined) {
      return ''
    }
    
    const stringField = String(field)
    
    // If field contains comma, newline, or quote, wrap in quotes and escape quotes
    if (stringField.includes(',') || stringField.includes('\n') || stringField.includes('"')) {
      return `"${stringField.replace(/"/g, '""')}"`
    }
    
    return stringField
  }

  private formatValue(value: any): string {
    if (value === null || value === undefined) {
      return ''
    }
    
    if (typeof value === 'object') {
      if (Array.isArray(value)) {
        return value.join('; ')
      }
      if (value instanceof Date) {
        return value.toISOString()
      }
      return JSON.stringify(value)
    }
    
    return String(value)
  }

  private downloadCSV(content: string, filename: string): void {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  // Predefined export configurations
  getExportConfig(type: string): Partial<ExportRequest> {
    const configs: Record<string, Partial<ExportRequest>> = {
      'accounts-full': {
        type: 'accounts',
        format: 'xlsx',
        includeMetadata: true,
        columns: [
          'id', 'name', 'domain', 'industry', 'size', 'location',
          'technologies', 'contacts', 'insights', 'createdAt', 'updatedAt'
        ]
      },
      'accounts-basic': {
        type: 'accounts',
        format: 'csv',
        includeMetadata: false,
        columns: ['id', 'name', 'domain', 'industry', 'size', 'location']
      },
      'insights-summary': {
        type: 'insights',
        format: 'csv',
        includeMetadata: true,
        columns: [
          'id', 'accountId', 'accountName', 'type', 'title', 
          'confidence', 'category', 'createdAt'
        ]
      },
      'insights-detailed': {
        type: 'insights',
        format: 'xlsx',
        includeMetadata: true,
        columns: [
          'id', 'accountId', 'accountName', 'type', 'title', 'description',
          'confidence', 'category', 'tags', 'metadata', 'createdAt'
        ]
      },
      'jobs-history': {
        type: 'jobs',
        format: 'csv',
        includeMetadata: true,
        columns: [
          'id', 'type', 'title', 'status', 'progress', 'createdAt',
          'startedAt', 'completedAt', 'errorMessage'
        ]
      }
    }

    return configs[type] || {}
  }

  // Quick export functions
  async exportAccounts(filters?: Record<string, any>, format: 'csv' | 'xlsx' = 'csv'): Promise<ExportJob> {
    return this.createExport({
      type: 'accounts',
      format,
      filters,
      ...this.getExportConfig('accounts-full')
    })
  }

  async exportInsights(filters?: Record<string, any>, format: 'csv' | 'xlsx' = 'csv'): Promise<ExportJob> {
    return this.createExport({
      type: 'insights',
      format,
      filters,
      ...this.getExportConfig('insights-detailed')
    })
  }

  async exportJobs(filters?: Record<string, any>, format: 'csv' | 'xlsx' = 'csv'): Promise<ExportJob> {
    return this.createExport({
      type: 'jobs',
      format,
      filters,
      ...this.getExportConfig('jobs-history')
    })
  }

  // Batch operations
  async createBulkExport(requests: ExportRequest[]): Promise<ExportJob[]> {
    try {
      const response = await apiClient.post<ExportJob[]>('/export/bulk', { requests })
      return response.data
    } catch (error) {
      console.error('Failed to create bulk export:', error)
      throw error
    }
  }

  // Export templates
  getAvailableTemplates(): Array<{
    id: string
    name: string
    description: string
    config: Partial<ExportRequest>
  }> {
    return [
      {
        id: 'accounts-full',
        name: 'Complete Account Export',
        description: 'All account data including technologies, contacts, and insights',
        config: this.getExportConfig('accounts-full')
      },
      {
        id: 'accounts-basic',
        name: 'Basic Account Export',
        description: 'Essential account information only',
        config: this.getExportConfig('accounts-basic')
      },
      {
        id: 'insights-summary',
        name: 'Insights Summary',
        description: 'Key insight metrics and categories',
        config: this.getExportConfig('insights-summary')
      },
      {
        id: 'insights-detailed',
        name: 'Detailed Insights Export',
        description: 'Complete insight data with descriptions and metadata',
        config: this.getExportConfig('insights-detailed')
      },
      {
        id: 'jobs-history',
        name: 'Job History Export',
        description: 'Processing job history and statistics',
        config: this.getExportConfig('jobs-history')
      }
    ]
  }

  // Utility functions
  async getExportPreview(request: ExportRequest, limit = 100): Promise<{
    columns: string[]
    sample: unknown[]
    totalCount: number
  }> {
    try {
      const response = await apiClient.post('/export/preview', { ...request, limit })
      return response.data as { columns: string[]; sample: unknown[]; totalCount: number; }
    } catch (error) {
      console.error('Failed to get export preview:', error)
      throw error
    }
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes'
    
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  getEstimatedFileSize(recordCount: number, format: string): string {
    // Rough estimates based on format
    const bytesPerRecord = {
      csv: 200,    // ~200 bytes per record
      xlsx: 300,   // ~300 bytes per record (with formatting)
      json: 400    // ~400 bytes per record (with structure)
    }

    const estimatedBytes = recordCount * (bytesPerRecord[format as keyof typeof bytesPerRecord] || 250)
    return this.formatFileSize(estimatedBytes)
  }
}

export const exportService = new ExportService()