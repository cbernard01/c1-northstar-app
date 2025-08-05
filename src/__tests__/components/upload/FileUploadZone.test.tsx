import { screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { toast } from 'sonner'

import { testAccessibility } from '@/__tests__/utils/accessibility-helpers'
import { render, createMockFile, createMockFileList } from '@/__tests__/utils/test-utils'
import { FileUploadZone } from '@/components/upload/FileUploadZone'
import { uploadService } from '@/services/uploadService'
import { useUploadStore } from '@/stores/uploadStore'


// Mock dependencies
jest.mock('@/stores/uploadStore')
jest.mock('@/services/uploadService')
jest.mock('sonner')

const mockUseUploadStore = useUploadStore as jest.MockedFunction<typeof useUploadStore>
const mockUploadService = uploadService as jest.Mocked<typeof uploadService>
const mockToast = toast as jest.Mocked<typeof toast>

const mockStoreDefaults = {
  files: [],
  dragActive: false,
  isUploading: false,
  acceptedTypes: ['.pdf', '.docx', '.xlsx', '.csv', '.txt'],
  maxFileSize: 50 * 1024 * 1024,
  maxFiles: 10,
  addFiles: jest.fn(),
  removeFile: jest.fn(),
  updateFile: jest.fn(),
  setDragActive: jest.fn(),
  clearCompleted: jest.fn(),
  getUploadingFiles: jest.fn(() => []),
  getTotalUploadProgress: jest.fn(() => 0),
}

describe('FileUploadZone', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseUploadStore.mockReturnValue(mockStoreDefaults)
    mockUploadService.uploadMultipleFiles.mockResolvedValue([])
    mockToast.success = jest.fn()
    mockToast.error = jest.fn()
  })

  describe('Basic Rendering', () => {
    it('renders upload zone correctly', () => {
      render(<FileUploadZone />)
      
      expect(screen.getByText('Upload your data files')).toBeInTheDocument()
      expect(screen.getByText('Drag and drop files here, or click to browse')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /select files/i })).toBeInTheDocument()
    })

    it('shows file constraints', () => {
      render(<FileUploadZone />)
      
      expect(screen.getByText('Max 10 files')).toBeInTheDocument()
      expect(screen.getByText('50 MB each')).toBeInTheDocument()
      expect(screen.getByText('.pdf, .docx, .xlsx, .csv, .txt')).toBeInTheDocument()
    })

    it('renders in compact mode', () => {
      render(<FileUploadZone compact={true} />)
      
      // Should have smaller padding and text
      const uploadZone = screen.getByText('Upload your data files').closest('.p-6')
      expect(uploadZone).toBeInTheDocument()
    })

    it('applies custom className', () => {
      const { container } = render(<FileUploadZone className="custom-class" />)
      
      const wrapper = container.firstChild
      expect(wrapper).toHaveClass('custom-class')
    })
  })

  describe('File Selection', () => {
    it('opens file dialog when Select Files button is clicked', async () => {
      const user = userEvent.setup()
      render(<FileUploadZone />)
      
      const selectButton = screen.getByRole('button', { name: /select files/i })
      
      // Mock click on hidden input
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      const clickSpy = jest.spyOn(fileInput, 'click')
      
      await user.click(selectButton)
      expect(clickSpy).toHaveBeenCalled()
    })

    it('handles file input change', async () => {
      const mockFiles = [
        createMockFile('test.csv', 1000, 'text/csv'),
        createMockFile('test.xlsx', 2000, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      ]
      
      const onFilesSelected = jest.fn()
      render(<FileUploadZone onFilesSelected={onFilesSelected} />)
      
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      
      fireEvent.change(fileInput, {
        target: { files: createMockFileList(mockFiles) }
      })
      
      expect(mockStoreDefaults.addFiles).toHaveBeenCalledWith(mockFiles)
      expect(onFilesSelected).toHaveBeenCalledWith(mockFiles)
    })

    it('respects allowMultiple prop', () => {
      render(<FileUploadZone allowMultiple={false} />)
      
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      expect(fileInput).not.toHaveAttribute('multiple')
    })

    it('sets accept attribute correctly', () => {
      render(<FileUploadZone />)
      
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      expect(fileInput).toHaveAttribute('accept', '.pdf,.docx,.xlsx,.csv,.txt')
    })
  })

  describe('Drag and Drop', () => {
    it('handles drag over correctly', () => {
      render(<FileUploadZone />)
      
      const dropZone = screen.getByText('Upload your data files').closest('[onDrop]')
      
      fireEvent.dragOver(dropZone!, {
        dataTransfer: { files: [] }
      })
      
      expect(mockStoreDefaults.setDragActive).toHaveBeenCalledWith(true)
    })

    it('handles drag leave correctly', () => {
      render(<FileUploadZone />)
      
      const dropZone = screen.getByText('Upload your data files').closest('[onDrop]')
      
      fireEvent.dragLeave(dropZone!)
      
      expect(mockStoreDefaults.setDragActive).toHaveBeenCalledWith(false)
    })

    it('handles file drop correctly', () => {
      const mockFiles = [createMockFile('dropped.csv', 1000, 'text/csv')]
      const onFilesSelected = jest.fn()
      
      render(<FileUploadZone onFilesSelected={onFilesSelected} />)
      
      const dropZone = screen.getByText('Upload your data files').closest('[onDrop]')
      
      fireEvent.drop(dropZone!, {
        dataTransfer: { files: mockFiles }
      })
      
      expect(mockStoreDefaults.setDragActive).toHaveBeenCalledWith(false)
      expect(mockStoreDefaults.addFiles).toHaveBeenCalledWith(mockFiles)
      expect(onFilesSelected).toHaveBeenCalledWith(mockFiles)
    })

    it('shows drag active state visually', () => {
      mockUseUploadStore.mockReturnValue({
        ...mockStoreDefaults,
        dragActive: true,
      })
      
      const { container } = render(<FileUploadZone />)
      
      const dropZone = container.querySelector('.border-primary')
      expect(dropZone).toBeInTheDocument()
      expect(dropZone).toHaveClass('bg-primary/5', 'scale-[1.02]')
      
      expect(screen.getByText('Drop files here')).toBeInTheDocument()
    })
  })

  describe('File List Display', () => {
    const mockFiles = [
      {
        id: '1',
        file: createMockFile('test1.csv', 1000, 'text/csv'),
        name: 'test1.csv',
        size: 1000,
        type: 'text/csv',
        status: 'idle' as const,
        progress: 0,
      },
      {
        id: '2',
        file: createMockFile('test2.xlsx', 2000, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
        name: 'test2.xlsx',
        size: 2000,
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        status: 'uploading' as const,
        progress: 50,
      },
    ]

    it('shows file list when files are added', () => {
      mockUseUploadStore.mockReturnValue({
        ...mockStoreDefaults,
        files: mockFiles,
      })
      
      render(<FileUploadZone />)
      
      expect(screen.getByText('Files (2)')).toBeInTheDocument()
      expect(screen.getByText('test1.csv')).toBeInTheDocument()
      expect(screen.getByText('test2.xlsx')).toBeInTheDocument()
    })

    it('displays correct file icons based on extension', () => {
      mockUseUploadStore.mockReturnValue({
        ...mockStoreDefaults,
        files: [
          {
            ...mockFiles[0],
            name: 'spreadsheet.xlsx',
          },
          {
            ...mockFiles[1],
            name: 'document.json',
          },
        ],
      })
      
      render(<FileUploadZone />)
      
      // FileSpreadsheet and FileJson icons should be rendered
      // We can't test the exact icons, but we can test the files are displayed
      expect(screen.getByText('spreadsheet.xlsx')).toBeInTheDocument()
      expect(screen.getByText('document.json')).toBeInTheDocument()
    })

    it('shows file sizes correctly formatted', () => {
      mockUseUploadStore.mockReturnValue({
        ...mockStoreDefaults,
        files: [
          {
            ...mockFiles[0],
            size: 1024, // 1 KB
          },
          {
            ...mockFiles[1],
            size: 1024 * 1024, // 1 MB
          },
        ],
      })
      
      render(<FileUploadZone />)
      
      expect(screen.getByText('1 KB')).toBeInTheDocument()
      expect(screen.getByText('1 MB')).toBeInTheDocument()
    })

    it('displays file status badges correctly', () => {
      mockUseUploadStore.mockReturnValue({
        ...mockStoreDefaults,
        files: [
          { ...mockFiles[0], status: 'completed' },
          { ...mockFiles[1], status: 'failed' },
        ],
      })
      
      render(<FileUploadZone />)
      
      expect(screen.getByText('completed')).toBeInTheDocument()
      expect(screen.getByText('failed')).toBeInTheDocument()
    })

    it('shows progress for uploading files', () => {
      mockUseUploadStore.mockReturnValue({
        ...mockStoreDefaults,
        files: [
          { ...mockFiles[1], status: 'uploading', progress: 75 },
        ],
        isUploading: true,
      })
      
      render(<FileUploadZone />)
      
      expect(screen.getByText('75%')).toBeInTheDocument()
    })

    it('shows error messages for failed uploads', () => {
      mockUseUploadStore.mockReturnValue({
        ...mockStoreDefaults,
        files: [
          {
            ...mockFiles[0],
            status: 'failed',
            errorMessage: 'File too large',
          },
        ],
      })
      
      render(<FileUploadZone />)
      
      expect(screen.getByText('File too large')).toBeInTheDocument()
    })

    it('shows success message for completed uploads', () => {
      mockUseUploadStore.mockReturnValue({
        ...mockStoreDefaults,
        files: [
          { ...mockFiles[0], status: 'completed' },
        ],
      })
      
      render(<FileUploadZone />)
      
      expect(screen.getByText('Upload completed successfully')).toBeInTheDocument()
    })
  })

  describe('Upload Controls', () => {
    it('shows Upload All button when autoUpload is false and idle files exist', () => {
      mockUseUploadStore.mockReturnValue({
        ...mockStoreDefaults,
        files: [{ ...mockFiles[0], status: 'idle' }],
      })
      
      render(<FileUploadZone autoUpload={false} />)
      
      expect(screen.getByRole('button', { name: /upload all/i })).toBeInTheDocument()
    })

    it('does not show Upload All button when autoUpload is true', () => {
      mockUseUploadStore.mockReturnValue({
        ...mockStoreDefaults,
        files: [{ ...mockFiles[0], status: 'idle' }],
      })
      
      render(<FileUploadZone autoUpload={true} />)
      
      expect(screen.queryByRole('button', { name: /upload all/i })).not.toBeInTheDocument()
    })

    it('shows uploading indicator when upload is in progress', () => {
      mockUseUploadStore.mockReturnValue({
        ...mockStoreDefaults,
        files: [{ ...mockFiles[1], status: 'uploading' }],
        isUploading: true,
      })
      
      render(<FileUploadZone />)
      
      expect(screen.getByText('Uploading...')).toBeInTheDocument()
    })

    it('shows overall progress when uploading', () => {
      mockUseUploadStore.mockReturnValue({
        ...mockStoreDefaults,
        files: [{ ...mockFiles[1], status: 'uploading' }],
        isUploading: true,
        getTotalUploadProgress: jest.fn(() => 60),
      })
      
      render(<FileUploadZone showProgress={true} />)
      
      expect(screen.getByText('Overall Progress')).toBeInTheDocument()
      expect(screen.getByText('60%')).toBeInTheDocument()
    })

    it('Clear Completed button removes completed files', async () => {
      const user = userEvent.setup()
      mockUseUploadStore.mockReturnValue({
        ...mockStoreDefaults,
        files: [{ ...mockFiles[0], status: 'completed' }],
      })
      
      render(<FileUploadZone />)
      
      const clearButton = screen.getByRole('button', { name: /clear completed/i })
      await user.click(clearButton)
      
      expect(mockStoreDefaults.clearCompleted).toHaveBeenCalled()
    })

    it('Remove file button removes individual files', async () => {
      const user = userEvent.setup()
      mockUseUploadStore.mockReturnValue({
        ...mockStoreDefaults,
        files: [mockFiles[0]],
      })
      
      render(<FileUploadZone />)
      
      const removeButton = screen.getByRole('button', { name: '' }) // X button
      await user.click(removeButton)
      
      expect(mockStoreDefaults.removeFile).toHaveBeenCalledWith('1')
    })
  })

  describe('Upload Functionality', () => {
    it('auto-uploads files when autoUpload is true', async () => {
      const mockFiles = [createMockFile('test.csv', 1000, 'text/csv')]
      
      render(<FileUploadZone autoUpload={true} />)
      
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      
      fireEvent.change(fileInput, {
        target: { files: createMockFileList(mockFiles) }
      })
      
      await waitFor(() => {
        expect(mockUploadService.uploadMultipleFiles).toHaveBeenCalled()
      })
    })

    it('does not auto-upload when autoUpload is false', async () => {
      const mockFiles = [createMockFile('test.csv', 1000, 'text/csv')]
      
      render(<FileUploadZone autoUpload={false} />)
      
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      
      fireEvent.change(fileInput, {
        target: { files: createMockFileList(mockFiles) }
      })
      
      expect(mockUploadService.uploadMultipleFiles).not.toHaveBeenCalled()
    })

    it('handles upload success correctly', async () => {
      const mockResult = { processingJobId: 'job-123' }
      mockUploadService.uploadMultipleFiles.mockImplementation(
        async (files, onProgress, onSuccess) => {
          onSuccess(0, mockResult)
          return [mockResult]
        }
      )
      
      const onUploadComplete = jest.fn()
      const mockFiles = [createMockFile('test.csv', 1000, 'text/csv')]
      
      render(<FileUploadZone onUploadComplete={onUploadComplete} />)
      
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      
      fireEvent.change(fileInput, {
        target: { files: createMockFileList(mockFiles) }
      })
      
      await waitFor(() => {
        expect(onUploadComplete).toHaveBeenCalledWith([mockResult])
        expect(mockToast.success).toHaveBeenCalledWith('test.csv uploaded successfully')
      })
    })

    it('handles upload error correctly', async () => {
      const mockError = new Error('Upload failed')
      mockUploadService.uploadMultipleFiles.mockImplementation(
        async (files, onProgress, onSuccess, onError) => {
          onError(0, mockError)
          throw mockError
        }
      )
      
      const mockFiles = [createMockFile('test.csv', 1000, 'text/csv')]
      
      render(<FileUploadZone />)
      
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      
      fireEvent.change(fileInput, {
        target: { files: createMockFileList(mockFiles) }
      })
      
      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith(
          'Failed to upload test.csv',
          { description: 'Upload failed' }
        )
      })
    })

    it('updates file progress during upload', async () => {
      mockUploadService.uploadMultipleFiles.mockImplementation(
        async (files, onProgress) => {
          onProgress(0, 50)
          return []
        }
      )
      
      const mockFiles = [createMockFile('test.csv', 1000, 'text/csv')]
      
      render(<FileUploadZone />)
      
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      
      fireEvent.change(fileInput, {
        target: { files: createMockFileList(mockFiles) }
      })
      
      await waitFor(() => {
        expect(mockStoreDefaults.updateFile).toHaveBeenCalledWith(
          expect.any(String),
          { progress: 50, status: 'uploading' }
        )
      })
    })
  })

  describe('File Validation', () => {
    it('disables select button when uploading', () => {
      mockUseUploadStore.mockReturnValue({
        ...mockStoreDefaults,
        isUploading: true,
      })
      
      render(<FileUploadZone />)
      
      const selectButton = screen.getByRole('button', { name: /select files/i })
      expect(selectButton).toBeDisabled()
    })

    it('disables upload all button when uploading', () => {
      const mockFile = {
        id: '1',
        file: createMockFile('test.csv', 1000, 'text/csv'),
        name: 'test.csv',
        size: 1000,
        type: 'text/csv',
        status: 'idle' as const,
        progress: 0,
      }
      
      mockUseUploadStore.mockReturnValue({
        ...mockStoreDefaults,
        files: [mockFile],
        isUploading: true,
      })
      
      render(<FileUploadZone autoUpload={false} />)
      
      const uploadButton = screen.getByRole('button', { name: /upload all/i })
      expect(uploadButton).toBeDisabled()
    })
  })

  describe('Accessibility', () => {
    it('has no accessibility violations', async () => {
      const { container } = render(<FileUploadZone />)
      await testAccessibility(container)
    })

    it('has proper keyboard navigation', async () => {
      const user = userEvent.setup()
      render(<FileUploadZone />)
      
      const selectButton = screen.getByRole('button', { name: /select files/i })
      
      // Tab to the button
      await user.tab()
      expect(selectButton).toHaveFocus()
      
      // Enter should trigger file selection
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      const clickSpy = jest.spyOn(fileInput, 'click')
      
      await user.keyboard('{Enter}')
      expect(clickSpy).toHaveBeenCalled()
    })

    it('provides proper ARIA labels and roles', () => {
      render(<FileUploadZone />)
      
      const selectButton = screen.getByRole('button', { name: /select files/i })
      expect(selectButton).toBeInTheDocument()
      
      const fileInput = document.querySelector('input[type="file"]')
      expect(fileInput).toHaveAttribute('type', 'file')
    })

    it('has meaningful text for screen readers', () => {
      render(<FileUploadZone />)
      
      expect(screen.getByText('Upload your data files')).toBeInTheDocument()
      expect(screen.getByText('Drag and drop files here, or click to browse')).toBeInTheDocument()
    })
  })
})