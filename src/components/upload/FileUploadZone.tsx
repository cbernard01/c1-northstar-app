'use client'

import { 
  Upload, 
  File, 
  X, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  Pause, 
  Play,
  FileText,
  FileSpreadsheet,
  FileJson
} from 'lucide-react'
import React, { useState, useCallback } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { uploadService } from '@/services/uploadService'
import { useUploadStore } from '@/stores/uploadStore'


interface FileUploadZoneProps {
  className?: string
  onFilesSelected?: (files: File[]) => void
  onUploadComplete?: (results: any[]) => void
  autoUpload?: boolean
  allowMultiple?: boolean
  showProgress?: boolean
  compact?: boolean
}

export function FileUploadZone({
  className,
  onFilesSelected,
  onUploadComplete,
  autoUpload = true,
  allowMultiple = true,
  showProgress = true,
  compact = false
}: FileUploadZoneProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const {
    files,
    dragActive,
    isUploading,
    acceptedTypes,
    maxFileSize,
    maxFiles,
    addFiles,
    removeFile,
    updateFile,
    setDragActive,
    clearCompleted,
    getUploadingFiles,
    getTotalUploadProgress
  } = useUploadStore()
  
  const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set())

  const handleFileSelect = useCallback(async (selectedFiles: File[]) => {
    addFiles(selectedFiles)
    onFilesSelected?.(selectedFiles)
    
    if (autoUpload) {
      await handleUpload(selectedFiles)
    }
  }, [addFiles, onFilesSelected, autoUpload])

  const handleUpload = useCallback(async (filesToUpload?: File[]) => {
    const targetFiles = filesToUpload || files.filter(f => f.status === 'idle').map(f => f.file)
    
    if (targetFiles.length === 0) return

    const results: any[] = []
    
    try {
      await uploadService.uploadMultipleFiles(
        targetFiles,
        (fileIndex, progress) => {
          const file = targetFiles[fileIndex]
          const uploadFile = files.find(f => f.file === file)
          if (uploadFile) {
            updateFile(uploadFile.id, { progress, status: 'uploading' })
          }
        },
        (fileIndex, result) => {
          const file = targetFiles[fileIndex]
          const uploadFile = files.find(f => f.file === file)
          if (uploadFile) {
            updateFile(uploadFile.id, {
              status: 'completed',
              progress: 100,
              completedAt: new Date(),
              processingJobId: result.processingJobId
            })
            results.push(result)
            toast.success(`${file.name} uploaded successfully`)
          }
        },
        (fileIndex, error) => {
          const file = targetFiles[fileIndex]
          const uploadFile = files.find(f => f.file === file)
          if (uploadFile) {
            updateFile(uploadFile.id, {
              status: 'failed',
              errorMessage: error.message,
              failedAt: new Date()
            })
            toast.error(`Failed to upload ${file.name}`, {
              description: error.message
            })
          }
        }
      )
      
      if (results.length > 0) {
        onUploadComplete?.(results)
      }
    } catch (error) {
      console.error('Upload failed:', error)
      toast.error('Upload failed', {
        description: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }, [files, updateFile, onUploadComplete])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    handleFileSelect(selectedFiles)
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    
    const droppedFiles = Array.from(e.dataTransfer.files)
    handleFileSelect(droppedFiles)
  }, [handleFileSelect, setDragActive])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(true)
  }, [setDragActive])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
  }, [setDragActive])

  const getFileIcon = (file: File) => {
    const extension = file.name.split('.').pop()?.toLowerCase()
    switch (extension) {
      case 'csv':
      case 'xlsx':
      case 'xls':
        return FileSpreadsheet
      case 'json':
        return FileJson
      default:
        return FileText
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Upload Zone */}
      <Card 
        className={cn(
          'relative border-2 border-dashed transition-all duration-200',
          dragActive 
            ? 'border-primary bg-primary/5 scale-[1.02]' 
            : 'border-border hover:border-primary/50',
          compact ? 'p-6' : 'p-12'
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <div className="text-center">
          <div className={cn(
            'mx-auto mb-4 p-3 rounded-full transition-colors',
            dragActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          )}>
            <Upload className={cn(compact ? 'h-6 w-6' : 'h-8 w-8')} />
          </div>
          
          <h3 className={cn(
            'text-foreground mb-2',
            compact ? 'text-lg font-medium' : 'text-xl font-semibold'
          )}>
            {dragActive ? 'Drop files here' : 'Upload your data files'}
          </h3>
          
          <p className={cn(
            'text-muted-foreground mb-6',
            compact ? 'text-sm' : 'text-base'
          )}>
            Drag and drop files here, or click to browse
          </p>
          
          <Button
            onClick={() => fileInputRef.current?.click()}
            className="mb-4"
            disabled={isUploading}
          >
            <Upload className="h-4 w-4 mr-2" />
            Select Files
          </Button>
          
          <div className="flex items-center justify-center space-x-4 text-xs text-muted-foreground">
            <span>Max {maxFiles} files</span>
            <span>•</span>
            <span>{formatFileSize(maxFileSize)} each</span>
            <span>•</span>
            <span>{acceptedTypes.join(', ')}</span>
          </div>
        </div>
        
        <input
          ref={fileInputRef}
          type="file"
          multiple={allowMultiple}
          accept={acceptedTypes.join(',')}
          onChange={handleInputChange}
          className="hidden"
        />
      </Card>

      {/* File List */}
      {files.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium text-foreground">
              Files ({files.length})
            </h4>
            <div className="flex items-center space-x-2">
              {isUploading && (
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Uploading...</span>
                </div>
              )}
              {!autoUpload && files.some(f => f.status === 'idle') && (
                <Button
                  size="sm"
                  onClick={() => handleUpload()}
                  disabled={isUploading}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload All
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={clearCompleted}
              >
                Clear Completed
              </Button>
            </div>
          </div>

          {/* Overall Progress */}
          {showProgress && isUploading && (
            <div className="mb-4">
              <div className="flex items-center justify-between text-sm mb-2">
                <span>Overall Progress</span>
                <span>{getTotalUploadProgress()}%</span>
              </div>
              <Progress value={getTotalUploadProgress()} className="h-2" />
            </div>
          )}

          {/* File Items */}
          <div className="space-y-3">
            {files.map((uploadFile) => {
              const Icon = getFileIcon(uploadFile.file)
              return (
                <div
                  key={uploadFile.id}
                  className="flex items-center space-x-3 p-3 border border-border rounded-lg"
                >
                  <Icon className="h-5 w-5 text-muted-foreground" />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-foreground truncate">
                        {uploadFile.name}
                      </p>
                      <div className="flex items-center space-x-2">
                        <Badge
                          variant={
                            uploadFile.status === 'completed' ? 'default' :
                            uploadFile.status === 'failed' ? 'destructive' :
                            uploadFile.status === 'uploading' ? 'secondary' : 'outline'
                          }
                        >
                          {uploadFile.status}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(uploadFile.id)}
                          className="h-6 w-6 p-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(uploadFile.size)}
                      </p>
                      
                      {uploadFile.status === 'uploading' && (
                        <p className="text-xs text-muted-foreground">
                          {uploadFile.progress}%
                        </p>
                      )}
                    </div>
                    
                    {/* Progress Bar */}
                    {showProgress && uploadFile.status === 'uploading' && (
                      <Progress 
                        value={uploadFile.progress} 
                        className="h-1 mt-2" 
                      />
                    )}
                    
                    {/* Error Message */}
                    {uploadFile.status === 'failed' && uploadFile.errorMessage && (
                      <p className="text-xs text-destructive mt-1 flex items-center">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        {uploadFile.errorMessage}
                      </p>
                    )}
                    
                    {/* Success Message */}
                    {uploadFile.status === 'completed' && (
                      <p className="text-xs text-green-600 mt-1 flex items-center">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Upload completed successfully
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}