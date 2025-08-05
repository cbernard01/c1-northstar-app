'use client'

import { FileText, Database, FileSpreadsheet, Info } from 'lucide-react'
import React from 'react'

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { FileUploadZone } from '@/components/upload/FileUploadZone'

const supportedFormats = [
  {
    type: 'CSV',
    extension: '.csv',
    description: 'Comma-separated values for account data',
    icon: FileSpreadsheet,
  },
  {
    type: 'Excel',
    extension: '.xlsx, .xls',
    description: 'Microsoft Excel workbooks',
    icon: FileSpreadsheet,
  },
  {
    type: 'PDF',
    extension: '.pdf',
    description: 'Company reports and documents',
    icon: FileText,
  },
  {
    type: 'JSON',
    extension: '.json',
    description: 'Structured data in JSON format',
    icon: Database,
  },
]

export default function UploadPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-h1 text-foreground mb-2">
          Upload Data Files
        </h1>
        <p className="text-body text-muted-foreground">
          Upload your account data files to start generating insights.
        </p>
      </div>

      <FileUploadZone
        maxFiles={10}
        maxFileSize={50 * 1024 * 1024}
        acceptedTypes={['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.csv', '.txt', '.json']}
        onFilesSelected={(files) => {
          console.log('Files selected:', files)
        }}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <div className="p-6">
            <h2 className="text-h3 text-foreground mb-4">
              Supported File Formats
            </h2>
            <div className="space-y-4">
              {supportedFormats.map((format) => {
                const Icon = format.icon
                return (
                  <div key={format.type} className="flex items-start space-x-3">
                    <div className="p-2 bg-muted rounded-lg flex-shrink-0">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-sm font-medium text-foreground">
                          {format.type}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {format.extension}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format.description}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <h2 className="text-h3 text-foreground mb-4">
              Processing Information
            </h2>
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                  1
                </div>
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-1">
                    File Analysis
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    We extract and parse data from your uploaded files.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                  2
                </div>
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-1">
                    AI Processing
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Our AI analyzes the content to identify companies and technologies.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                  3
                </div>
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-1">
                    Results Ready
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    View the generated insights and explore the data.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="mt-6 p-3 bg-muted/50 rounded-lg">
              <div className="flex items-start space-x-2">
                <Info className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">
                    Processing time varies based on file size and complexity.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}