import { act, renderHook } from '@testing-library/react'

import { createMockFile } from '@/__tests__/utils/test-utils'
import { useUploadStore } from '@/stores/uploadStore'

// Mock zustand devtools
jest.mock('zustand/middleware', () => ({
  devtools: (fn: any) => fn,
}))

describe('UploadStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    act(() => {
      useUploadStore.setState({
        files: [],
        isUploading: false,
        dragActive: false,
        totalProgress: 0,
        acceptedTypes: ['.pdf', '.docx', '.xlsx', '.csv', '.txt'],
        maxFileSize: 50 * 1024 * 1024,
        maxFiles: 10,
      })
    })
  })

  describe('Initial State', () => {
    it('has correct initial state', () => {
      const { result } = renderHook(() => useUploadStore())
      
      expect(result.current.files).toEqual([])
      expect(result.current.isUploading).toBe(false)
      expect(result.current.dragActive).toBe(false)
      expect(result.current.totalProgress).toBe(0)
      expect(result.current.acceptedTypes).toEqual(['.pdf', '.docx', '.xlsx', '.csv', '.txt'])
      expect(result.current.maxFileSize).toBe(50 * 1024 * 1024)
      expect(result.current.maxFiles).toBe(10)
    })
  })

  describe('addFiles Action', () => {
    it('adds valid files correctly', () => {
      const { result } = renderHook(() => useUploadStore())
      
      const mockFiles = [
        createMockFile('test1.csv', 1000, 'text/csv'),
        createMockFile('test2.pdf', 2000, 'application/pdf'),
      ]
      
      act(() => {
        result.current.addFiles(mockFiles)
      })
      
      expect(result.current.files).toHaveLength(2)
      expect(result.current.files[0].name).toBe('test1.csv')
      expect(result.current.files[1].name).toBe('test2.pdf')
      expect(result.current.files[0].status).toBe('idle')
      expect(result.current.files[0].progress).toBe(0)
    })

    it('filters out files exceeding size limit', () => {
      const { result } = renderHook(() => useUploadStore())
      
      const largeFile = createMockFile('large.csv', 100 * 1024 * 1024, 'text/csv') // 100MB
      const normalFile = createMockFile('normal.csv', 1000, 'text/csv')
      
      act(() => {
        result.current.addFiles([largeFile, normalFile])
      })
      
      expect(result.current.files).toHaveLength(1)
      expect(result.current.files[0].name).toBe('normal.csv')
    })

    it('filters out unsupported file types', () => {
      const { result } = renderHook(() => useUploadStore())
      
      const invalidFile = createMockFile('test.exe', 1000, 'application/x-executable')
      const validFile = createMockFile('test.csv', 1000, 'text/csv')
      
      act(() => {
        result.current.addFiles([invalidFile, validFile])
      })
      
      expect(result.current.files).toHaveLength(1)
      expect(result.current.files[0].name).toBe('test.csv')
    })

    it('prevents duplicate files', () => {
      const { result } = renderHook(() => useUploadStore())
      
      const file1 = createMockFile('test.csv', 1000, 'text/csv')
      const file2 = createMockFile('test.csv', 1000, 'text/csv') // Same name and size
      
      act(() => {
        result.current.addFiles([file1])
      })
      
      expect(result.current.files).toHaveLength(1)
      
      act(() => {
        result.current.addFiles([file2])
      })
      
      // Should still have only one file
      expect(result.current.files).toHaveLength(1)
    })

    it('respects max files limit', () => {
      const { result } = renderHook(() => useUploadStore())
      
      // Set max files to 2
      act(() => {
        result.current.setMaxFiles(2)
      })
      
      const files = [
        createMockFile('test1.csv', 1000, 'text/csv'),
        createMockFile('test2.csv', 1000, 'text/csv'),
        createMockFile('test3.csv', 1000, 'text/csv'), // Should be rejected
      ]
      
      act(() => {
        result.current.addFiles(files)
      })
      
      expect(result.current.files).toHaveLength(2)
    })

    it('generates unique IDs for files', () => {
      const { result } = renderHook(() => useUploadStore())
      
      const mockFiles = [
        createMockFile('test1.csv', 1000, 'text/csv'),
        createMockFile('test2.csv', 1000, 'text/csv'),
      ]
      
      act(() => {
        result.current.addFiles(mockFiles)
      })
      
      const ids = result.current.files.map(f => f.id)
      expect(ids[0]).not.toBe(ids[1])
      expect(ids[0]).toMatch(/^\d+-[a-z0-9]+$/)
    })
  })

  describe('removeFile Action', () => {
    it('removes file by ID', () => {
      const { result } = renderHook(() => useUploadStore())
      
      const mockFile = createMockFile('test.csv', 1000, 'text/csv')
      
      act(() => {
        result.current.addFiles([mockFile])
      })
      
      const fileId = result.current.files[0].id
      
      act(() => {
        result.current.removeFile(fileId)
      })
      
      expect(result.current.files).toHaveLength(0)
    })

    it('updates upload status when removing uploading files', () => {
      const { result } = renderHook(() => useUploadStore())
      
      const mockFile = createMockFile('test.csv', 1000, 'text/csv')
      
      act(() => {
        result.current.addFiles([mockFile])
      })
      
      const fileId = result.current.files[0].id
      
      // Set file to uploading
      act(() => {
        result.current.updateFile(fileId, { status: 'uploading' })
      })
      
      expect(result.current.isUploading).toBe(true)
      
      // Remove the file
      act(() => {
        result.current.removeFile(fileId)
      })
      
      expect(result.current.isUploading).toBe(false)
    })
  })

  describe('updateFile Action', () => {
    it('updates file properties correctly', () => {
      const { result } = renderHook(() => useUploadStore())
      
      const mockFile = createMockFile('test.csv', 1000, 'text/csv')
      
      act(() => {
        result.current.addFiles([mockFile])
      })
      
      const fileId = result.current.files[0].id
      
      act(() => {
        result.current.updateFile(fileId, {
          status: 'uploading',
          progress: 50,
        })
      })
      
      expect(result.current.files[0].status).toBe('uploading')
      expect(result.current.files[0].progress).toBe(50)
    })

    it('updates global upload status based on file states', () => {
      const { result } = renderHook(() => useUploadStore())
      
      const mockFile = createMockFile('test.csv', 1000, 'text/csv')
      
      act(() => {
        result.current.addFiles([mockFile])
      })
      
      const fileId = result.current.files[0].id
      
      // Start uploading
      act(() => {
        result.current.updateFile(fileId, { status: 'uploading' })
      })
      
      expect(result.current.isUploading).toBe(true)
      
      // Complete upload
      act(() => {
        result.current.updateFile(fileId, { status: 'completed' })
      })
      
      expect(result.current.isUploading).toBe(false)
    })

    it('does not update non-existent files', () => {
      const { result } = renderHook(() => useUploadStore())
      
      const mockFile = createMockFile('test.csv', 1000, 'text/csv')
      
      act(() => {
        result.current.addFiles([mockFile])
      })
      
      const originalFile = result.current.files[0]
      
      act(() => {
        result.current.updateFile('non-existent-id', { status: 'uploading' })
      })
      
      // File should remain unchanged
      expect(result.current.files[0]).toEqual(originalFile)
    })
  })

  describe('clearCompleted Action', () => {
    it('removes completed and failed files', () => {
      const { result } = renderHook(() => useUploadStore())
      
      const mockFiles = [
        createMockFile('completed.csv', 1000, 'text/csv'),
        createMockFile('failed.csv', 1000, 'text/csv'),
        createMockFile('uploading.csv', 1000, 'text/csv'),
        createMockFile('idle.csv', 1000, 'text/csv'),
      ]
      
      act(() => {
        result.current.addFiles(mockFiles)
      })
      
      const files = result.current.files
      
      // Set different statuses
      act(() => {
        result.current.updateFile(files[0].id, { status: 'completed' })
        result.current.updateFile(files[1].id, { status: 'failed' })
        result.current.updateFile(files[2].id, { status: 'uploading' })
        // files[3] remains 'idle'
      })
      
      act(() => {
        result.current.clearCompleted()
      })
      
      expect(result.current.files).toHaveLength(2)
      expect(result.current.files.map(f => f.status)).toEqual(['uploading', 'idle'])
    })
  })

  describe('clearAll Action', () => {
    it('clears all files and resets state', () => {
      const { result } = renderHook(() => useUploadStore())
      
      const mockFiles = [createMockFile('test.csv', 1000, 'text/csv')]
      
      act(() => {
        result.current.addFiles(mockFiles)
        result.current.updateFile(result.current.files[0].id, { status: 'uploading' })
      })
      
      expect(result.current.files).toHaveLength(1)
      expect(result.current.isUploading).toBe(true)
      
      act(() => {
        result.current.clearAll()
      })
      
      expect(result.current.files).toHaveLength(0)
      expect(result.current.isUploading).toBe(false)
      expect(result.current.totalProgress).toBe(0)
    })
  })

  describe('Drag and Drop Actions', () => {
    it('sets drag active state', () => {
      const { result } = renderHook(() => useUploadStore())
      
      act(() => {
        result.current.setDragActive(true)
      })
      
      expect(result.current.dragActive).toBe(true)
      
      act(() => {
        result.current.setDragActive(false)
      })
      
      expect(result.current.dragActive).toBe(false)
    })
  })

  describe('Upload Control Actions', () => {
    it('starts upload correctly', () => {
      const { result } = renderHook(() => useUploadStore())
      
      const mockFile = createMockFile('test.csv', 1000, 'text/csv')
      
      act(() => {
        result.current.addFiles([mockFile])
      })
      
      const fileId = result.current.files[0].id
      
      act(() => {
        result.current.startUpload(fileId)
      })
      
      const updatedFile = result.current.files[0]
      expect(updatedFile.status).toBe('uploading')
      expect(updatedFile.progress).toBe(0)
      expect(updatedFile.uploadedAt).toBeInstanceOf(Date)
      expect(updatedFile.errorMessage).toBeUndefined()
    })

    it('pauses upload correctly', () => {
      const { result } = renderHook(() => useUploadStore())
      
      const mockFile = createMockFile('test.csv', 1000, 'text/csv')
      
      act(() => {
        result.current.addFiles([mockFile])
      })
      
      const fileId = result.current.files[0].id
      
      act(() => {
        result.current.startUpload(fileId)
        result.current.pauseUpload(fileId)
      })
      
      expect(result.current.files[0].status).toBe('idle')
    })

    it('retries upload correctly', () => {
      const { result } = renderHook(() => useUploadStore())
      
      const mockFile = createMockFile('test.csv', 1000, 'text/csv')
      
      act(() => {
        result.current.addFiles([mockFile])
      })
      
      const fileId = result.current.files[0].id
      
      // Set as failed first
      act(() => {
        result.current.updateFile(fileId, {
          status: 'failed',
          errorMessage: 'Upload failed',
          failedAt: new Date(),
        })
      })
      
      act(() => {
        result.current.retryUpload(fileId)
      })
      
      const file = result.current.files[0]
      expect(file.status).toBe('idle')
      expect(file.progress).toBe(0)
      expect(file.errorMessage).toBeUndefined()
      expect(file.failedAt).toBeUndefined()
    })
  })

  describe('Configuration Actions', () => {
    it('sets accepted types', () => {
      const { result } = renderHook(() => useUploadStore())
      
      const newTypes = ['.jpg', '.png']
      
      act(() => {
        result.current.setAcceptedTypes(newTypes)
      })
      
      expect(result.current.acceptedTypes).toEqual(newTypes)
    })

    it('sets max file size', () => {
      const { result } = renderHook(() => useUploadStore())
      
      const newSize = 10 * 1024 * 1024 // 10MB
      
      act(() => {
        result.current.setMaxFileSize(newSize)
      })
      
      expect(result.current.maxFileSize).toBe(newSize)
    })

    it('sets max files count', () => {
      const { result } = renderHook(() => useUploadStore())
      
      act(() => {
        result.current.setMaxFiles(5)
      })
      
      expect(result.current.maxFiles).toBe(5)
    })
  })

  describe('Computed Functions', () => {
    let testResult: any
    
    beforeEach(() => {
      testResult = renderHook(() => useUploadStore())
      
      const mockFiles = [
        createMockFile('idle.csv', 1000, 'text/csv'),
        createMockFile('uploading.csv', 1000, 'text/csv'),
        createMockFile('processing.csv', 1000, 'text/csv'),
        createMockFile('completed.csv', 1000, 'text/csv'),
        createMockFile('failed.csv', 1000, 'text/csv'),
      ]
      
      act(() => {
        testResult.result.current.addFiles(mockFiles)
        const files = testResult.result.current.files
        testResult.result.current.updateFile(files[1].id, { status: 'uploading', progress: 50 })
        testResult.result.current.updateFile(files[2].id, { status: 'processing', progress: 80 })
        testResult.result.current.updateFile(files[3].id, { status: 'completed', progress: 100 })
        testResult.result.current.updateFile(files[4].id, { status: 'failed', progress: 30 })
      })
    })

    it('getUploadingFiles returns uploading and processing files', () => {
      const uploadingFiles = testResult.result.current.getUploadingFiles()
      expect(uploadingFiles).toHaveLength(2)
      expect(uploadingFiles.map(f => f.status)).toEqual(['uploading', 'processing'])
    })

    it('getCompletedFiles returns completed files', () => {
      const completedFiles = testResult.result.current.getCompletedFiles()
      expect(completedFiles).toHaveLength(1)
      expect(completedFiles[0].status).toBe('completed')
    })

    it('getFailedFiles returns failed files', () => {
      const failedFiles = testResult.result.current.getFailedFiles()
      expect(failedFiles).toHaveLength(1)
      expect(failedFiles[0].status).toBe('failed')
    })

    it('getTotalUploadProgress calculates average progress', () => {
      // Progress: 0, 50, 80, 100, 30 = 260 / 5 = 52
      const totalProgress = testResult.result.current.getTotalUploadProgress()
      expect(totalProgress).toBe(52)
    })

    it('getTotalUploadProgress returns 0 for empty files', () => {
      const { result } = renderHook(() => useUploadStore())
      
      act(() => {
        result.current.clearAll()
      })
      
      const totalProgress = result.current.getTotalUploadProgress()
      expect(totalProgress).toBe(0)
    })
  })

  describe('Edge Cases', () => {
    it('handles file with no extension', () => {
      const { result } = renderHook(() => useUploadStore())
      
      const fileWithoutExtension = createMockFile('README', 1000, 'text/plain')
      
      act(() => {
        result.current.addFiles([fileWithoutExtension])
      })
      
      // Should be filtered out as it doesn't match accepted types
      expect(result.current.files).toHaveLength(0)
    })

    it('handles files with uppercase extensions', () => {
      const { result } = renderHook(() => useUploadStore())
      
      const uppercaseFile = createMockFile('test.CSV', 1000, 'text/csv')
      
      act(() => {
        result.current.addFiles([uppercaseFile])
      })
      
      // Should be accepted as extension check is case-insensitive
      expect(result.current.files).toHaveLength(1)
    })

    it('handles zero-byte files', () => {
      const { result } = renderHook(() => useUploadStore())
      
      const zeroByteFile = createMockFile('empty.csv', 0, 'text/csv')
      
      act(() => {
        result.current.addFiles([zeroByteFile])
      })
      
      expect(result.current.files).toHaveLength(1)
      expect(result.current.files[0].size).toBe(0)
    })

    it('handles updating progress to 100%', () => {
      const { result } = renderHook(() => useUploadStore())
      
      const mockFile = createMockFile('test.csv', 1000, 'text/csv')
      
      act(() => {
        result.current.addFiles([mockFile])
      })
      
      const fileId = result.current.files[0].id
      
      act(() => {
        result.current.updateFile(fileId, { progress: 100 })
      })
      
      expect(result.current.files[0].progress).toBe(100)
    })
  })
})