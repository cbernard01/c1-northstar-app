import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

export type UploadStatus = 'idle' | 'uploading' | 'processing' | 'completed' | 'failed'

export interface UploadFile {
  id: string
  file: File
  name: string
  size: number
  type: string
  status: UploadStatus
  progress: number
  uploadedAt?: Date
  completedAt?: Date
  failedAt?: Date
  errorMessage?: string
  processingJobId?: string
  result?: {
    accountsFound: number
    insightsGenerated: number
    technologiesIdentified: string[]
    confidence: number
  }
}

interface UploadState {
  files: UploadFile[]
  isUploading: boolean
  dragActive: boolean
  totalProgress: number
  acceptedTypes: string[]
  maxFileSize: number
  maxFiles: number
  
  // Actions
  addFiles: (files: File[]) => void
  removeFile: (id: string) => void
  updateFile: (id: string, updates: Partial<UploadFile>) => void
  clearCompleted: () => void
  clearAll: () => void
  
  // Drag and drop
  setDragActive: (active: boolean) => void
  
  // Upload control
  startUpload: (id: string) => void
  pauseUpload: (id: string) => void
  retryUpload: (id: string) => void
  
  // Configuration
  setAcceptedTypes: (types: string[]) => void
  setMaxFileSize: (size: number) => void
  setMaxFiles: (count: number) => void
  
  // Computed
  getUploadingFiles: () => UploadFile[]
  getCompletedFiles: () => UploadFile[]
  getFailedFiles: () => UploadFile[]
  getTotalUploadProgress: () => number
}

export const useUploadStore = create<UploadState>()(
  devtools(
    (set, get) => ({
      files: [],
      isUploading: false,
      dragActive: false,
      totalProgress: 0,
      acceptedTypes: ['.pdf', '.docx', '.xlsx', '.csv', '.txt'],
      maxFileSize: 50 * 1024 * 1024, // 50MB
      maxFiles: 10,

      addFiles: (newFiles) => {
        const { files, maxFiles, maxFileSize, acceptedTypes } = get()
        
        // Filter and validate files
        const validFiles = newFiles
          .filter(file => {
            // Check file count limit
            if (files.length >= maxFiles) return false
            
            // Check file size
            if (file.size > maxFileSize) return false
            
            // Check file type
            const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()
            if (!acceptedTypes.includes(fileExtension)) return false
            
            // Check for duplicates
            const isDuplicate = files.some(existingFile => 
              existingFile.name === file.name && existingFile.size === file.size
            )
            if (isDuplicate) return false
            
            return true
          })
          .map(file => ({
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            file,
            name: file.name,
            size: file.size,
            type: file.type,
            status: 'idle' as UploadStatus,
            progress: 0,
          }))
        
        if (validFiles.length > 0) {
          set({ files: [...files, ...validFiles] })
        }
      },

      removeFile: (id) => {
        const { files } = get()
        const updatedFiles = files.filter(file => file.id !== id)
        set({ files: updatedFiles })
        
        // Update upload status
        const uploadingFiles = updatedFiles.filter(f => f.status === 'uploading')
        set({ isUploading: uploadingFiles.length > 0 })
      },

      updateFile: (id, updates) => {
        const { files } = get()
        const updatedFiles = files.map(file => 
          file.id === id ? { ...file, ...updates } : file
        )
        set({ files: updatedFiles })
        
        // Update global upload status
        const uploadingFiles = updatedFiles.filter(f => f.status === 'uploading')
        const totalProgress = get().getTotalUploadProgress()
        set({ 
          isUploading: uploadingFiles.length > 0,
          totalProgress 
        })
      },

      clearCompleted: () => {
        const { files } = get()
        const remainingFiles = files.filter(file => 
          file.status !== 'completed' && file.status !== 'failed'
        )
        set({ files: remainingFiles })
      },

      clearAll: () => {
        set({ 
          files: [],
          isUploading: false,
          totalProgress: 0 
        })
      },

      setDragActive: (dragActive) => {
        set({ dragActive })
      },

      startUpload: (id) => {
        get().updateFile(id, { 
          status: 'uploading',
          progress: 0,
          uploadedAt: new Date(),
          errorMessage: undefined
        })
      },

      pauseUpload: (id) => {
        get().updateFile(id, { status: 'idle' })
      },

      retryUpload: (id) => {
        get().updateFile(id, { 
          status: 'idle',
          progress: 0,
          errorMessage: undefined,
          failedAt: undefined
        })
      },

      setAcceptedTypes: (acceptedTypes) => {
        set({ acceptedTypes })
      },

      setMaxFileSize: (maxFileSize) => {
        set({ maxFileSize })
      },

      setMaxFiles: (maxFiles) => {
        set({ maxFiles })
      },

      getUploadingFiles: () => {
        const { files } = get()
        return files.filter(file => 
          file.status === 'uploading' || file.status === 'processing'
        )
      },

      getCompletedFiles: () => {
        const { files } = get()
        return files.filter(file => file.status === 'completed')
      },

      getFailedFiles: () => {
        const { files } = get()
        return files.filter(file => file.status === 'failed')
      },

      getTotalUploadProgress: () => {
        const { files } = get()
        if (files.length === 0) return 0
        
        const totalProgress = files.reduce((sum, file) => sum + file.progress, 0)
        return Math.round(totalProgress / files.length)
      },
    }),
    {
      name: 'upload-store',
    }
  )
)