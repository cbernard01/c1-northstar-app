import { apiClient } from './apiClient'

import type { UploadFile } from '@/stores/uploadStore'

export interface UploadResponse {
  fileId: string
  name: string
  size: number
  type: string
  uploadedAt: string
  processingJobId?: string
}

export interface ProcessingResult {
  accountsFound: number
  accountsCreated: number
  accountsUpdated: number
  insightsGenerated: number
  technologiesIdentified: string[]
  errors: string[]
  warnings: string[]
  processingTime: number
}

class UploadService {
  private readonly CHUNK_SIZE = 1024 * 1024 * 2 // 2MB chunks
  private abortControllers = new Map<string, AbortController>()

  async uploadFile(
    file: File,
    onProgress?: (progress: number) => void,
    useChunkUpload = true
  ): Promise<UploadResponse> {
    if (useChunkUpload && file.size > this.CHUNK_SIZE) {
      return this.uploadFileInChunks(file, onProgress)
    }
    
    return this.uploadFileSimple(file, onProgress)
  }

  private async uploadFileSimple(
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<UploadResponse> {
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('metadata', JSON.stringify({
        originalName: file.name,
        size: file.size,
        type: file.type,
        uploadedAt: new Date().toISOString(),
      }))

      const response = await apiClient.upload<UploadResponse>(
        '/upload',
        formData,
        onProgress
      )

      return response.data
    } catch (error) {
      console.error('Failed to upload file:', error)
      throw error
    }
  }

  private async uploadFileInChunks(
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<UploadResponse> {
    const totalChunks = Math.ceil(file.size / this.CHUNK_SIZE)
    const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // Create abort controller for this upload
    const abortController = new AbortController()
    this.abortControllers.set(uploadId, abortController)

    try {
      // Initialize chunked upload
      const initResponse = await apiClient.post<{ uploadId: string }>('/upload/init', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        totalChunks,
        uploadId
      })

      const serverUploadId = initResponse.data.uploadId
      let uploadedBytes = 0

      // Upload chunks
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        if (abortController.signal.aborted) {
          throw new Error('Upload cancelled')
        }

        const start = chunkIndex * this.CHUNK_SIZE
        const end = Math.min(start + this.CHUNK_SIZE, file.size)
        const chunk = file.slice(start, end)

        const chunkFormData = new FormData()
        chunkFormData.append('chunk', chunk)
        chunkFormData.append('chunkIndex', chunkIndex.toString())
        chunkFormData.append('uploadId', serverUploadId)
        chunkFormData.append('totalChunks', totalChunks.toString())

        await fetch('/api/upload/chunk', {
          method: 'POST',
          body: chunkFormData,
          signal: abortController.signal
        })

        uploadedBytes += chunk.size
        const progress = Math.round((uploadedBytes / file.size) * 100)
        onProgress?.(progress)
      }

      // Complete the upload
      const response = await apiClient.post<UploadResponse>('/upload/complete', {
        uploadId: serverUploadId,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type
      })

      this.abortControllers.delete(uploadId)
      return response.data

    } catch (error) {
      // Cleanup on error
      this.abortControllers.delete(uploadId)
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Upload cancelled')
      }
      
      console.error('Failed to upload file in chunks:', error)
      throw error
    }
  }

  async uploadMultipleFiles(
    files: File[],
    onProgress?: (fileIndex: number, progress: number) => void,
    onFileComplete?: (fileIndex: number, result: UploadResponse) => void,
    onFileError?: (fileIndex: number, error: Error) => void,
    maxConcurrent = 3
  ): Promise<UploadResponse[]> {
    const results: (UploadResponse | null)[] = new Array(files.length).fill(null)
    const errors: (Error | null)[] = new Array(files.length).fill(null)
    
    // Upload files with concurrency limit
    const uploadPromises = files.map(async (file, index) => {
      try {
        const result = await this.uploadFile(file, (progress) => {
          onProgress?.(index, progress)
        })
        
        results[index] = result
        onFileComplete?.(index, result)
        return result
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Upload failed')
        errors[index] = err
        onFileError?.(index, err)
        console.error(`Failed to upload file ${index}:`, error)
        return null
      }
    })

    // Execute with concurrency limit
    const chunks = []
    for (let i = 0; i < uploadPromises.length; i += maxConcurrent) {
      chunks.push(uploadPromises.slice(i, i + maxConcurrent))
    }

    for (const chunk of chunks) {
      await Promise.all(chunk)
    }

    // Return only successful uploads
    return results.filter((result): result is UploadResponse => result !== null)
  }

  cancelUpload(uploadId?: string): void {
    if (uploadId && this.abortControllers.has(uploadId)) {
      this.abortControllers.get(uploadId)!.abort()
      this.abortControllers.delete(uploadId)
    } else {
      // Cancel all uploads
      this.abortControllers.forEach((controller) => controller.abort())
      this.abortControllers.clear()
    }
  }

  isUploadInProgress(uploadId?: string): boolean {
    if (uploadId) {
      return this.abortControllers.has(uploadId)
    }
    return this.abortControllers.size > 0
  }

  async getUploadStatus(fileId: string): Promise<{
    status: 'uploading' | 'processing' | 'completed' | 'failed'
    progress: number
    error?: string
    result?: ProcessingResult
  }> {
    try {
      const response = await apiClient.get(`/upload/${fileId}/status`)
      return response.data as {
        status: 'uploading' | 'processing' | 'completed' | 'failed';
        progress: number;
        error?: string;
        result?: ProcessingResult;
      }
    } catch (error) {
      console.error('Failed to get upload status:', error)
      throw error
    }
  }

  async getProcessingResult(fileId: string): Promise<ProcessingResult> {
    try {
      const response = await apiClient.get<ProcessingResult>(`/upload/${fileId}/result`)
      return response.data
    } catch (error) {
      console.error('Failed to get processing result:', error)
      throw error
    }
  }

  async deleteUploadedFile(fileId: string): Promise<void> {
    try {
      await apiClient.delete(`/upload/${fileId}`)
    } catch (error) {
      console.error('Failed to delete uploaded file:', error)
      throw error
    }
  }

  async getUploadHistory(params?: {
    page?: number
    pageSize?: number
    status?: string
    dateRange?: [string, string]
  }): Promise<{
    uploads: UploadFile[]
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
          pageSize: params.pageSize?.toString(),
          dateRange: params.dateRange?.join(',')
        }).filter(([_, value]) => value !== undefined && value !== '')
      ) as Record<string, string | number> : undefined;
      
      const response = await apiClient.get('/upload/history', apiParams)
      return response.data as {
        uploads: UploadFile[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
      }
    } catch (error) {
      console.error('Failed to get upload history:', error)
      throw error
    }
  }

  async retryProcessing(fileId: string): Promise<{ jobId: string }> {
    try {
      const response = await apiClient.post<{ jobId: string }>(`/upload/${fileId}/retry`)
      return response.data
    } catch (error) {
      console.error('Failed to retry processing:', error)
      throw error
    }
  }

  async downloadProcessedData(fileId: string, format: 'json' | 'csv' | 'xlsx' = 'json'): Promise<Blob> {
    try {
      const response = await fetch(`/api/upload/${fileId}/download?format=${format}`)
      
      if (!response.ok) {
        throw new Error('Failed to download processed data')
      }
      
      return await response.blob()
    } catch (error) {
      console.error('Failed to download processed data:', error)
      throw error
    }
  }

  // File validation
  validateFile(file: File, options: {
    maxSize?: number
    allowedTypes?: string[]
    allowedExtensions?: string[]
  } = {}): { valid: boolean; errors: string[] } {
    const errors: string[] = []
    const { maxSize = 50 * 1024 * 1024, allowedTypes = [], allowedExtensions = [] } = options

    // Check file size
    if (file.size > maxSize) {
      errors.push(`File size exceeds ${Math.round(maxSize / 1024 / 1024)}MB limit`)
    }

    // Check file type
    if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
      errors.push(`File type ${file.type} is not allowed`)
    }

    // Check file extension
    if (allowedExtensions.length > 0) {
      const extension = '.' + file.name.split('.').pop()?.toLowerCase()
      if (!allowedExtensions.includes(extension)) {
        errors.push(`File extension ${extension} is not allowed`)
      }
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  // Bulk operations
  async bulkDeleteUploads(fileIds: string[]): Promise<void> {
    try {
      await apiClient.post('/upload/bulk-delete', { fileIds })
    } catch (error) {
      console.error('Failed to bulk delete uploads:', error)
      throw error
    }
  }

  async getUploadStats(): Promise<{
    totalUploads: number
    totalSize: number
    successRate: number
    averageProcessingTime: number
    byStatus: Record<string, number>
    byType: Record<string, number>
  }> {
    try {
      const response = await apiClient.get('/upload/stats')
      return response.data as {
        totalUploads: number;
        totalSize: number;
        successRate: number;
        averageProcessingTime: number;
        byStatus: Record<string, number>;
        byType: Record<string, number>;
      }
    } catch (error) {
      console.error('Failed to get upload stats:', error)
      throw error
    }
  }

  // Drag and drop utilities
  async handleFileDrop(
    event: DragEvent,
    validationOptions?: Parameters<typeof this.validateFile>[1]
  ): Promise<{ validFiles: File[]; invalidFiles: { file: File; errors: string[] }[] }> {
    event.preventDefault()
    event.stopPropagation()

    const files = Array.from(event.dataTransfer?.files || [])
    const validFiles: File[] = []
    const invalidFiles: { file: File; errors: string[] }[] = []

    for (const file of files) {
      const validation = this.validateFile(file, validationOptions)
      if (validation.valid) {
        validFiles.push(file)
      } else {
        invalidFiles.push({ file, errors: validation.errors })
      }
    }

    return { validFiles, invalidFiles }
  }
}

export const uploadService = new UploadService()