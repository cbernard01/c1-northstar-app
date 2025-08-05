'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { 
  Play, 
  FileText, 
  Lightbulb, 
  Download,
  Settings,
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle
} from 'lucide-react'
import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { jobService } from '@/services/jobService'
import { useAccountStore } from '@/stores/accountStore'
import { useJobStore } from '@/stores/jobStore'


const jobFormSchema = z.object({
  type: z.enum(['account_analysis', 'data_export', 'insight_generation']),
  title: z.string().min(1, 'Title is required').max(100, 'Title too long'),
  description: z.string().optional(),
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
  template: z.string().optional(),
  config: z.object({
    accountIds: z.array(z.string()).optional(),
    filters: z.record(z.any()).optional(),
    exportFormat: z.enum(['json', 'csv', 'xlsx']).optional(),
    includeInsights: z.boolean().optional(),
    scheduleType: z.enum(['immediate', 'scheduled']).default('immediate'),
    scheduledAt: z.string().optional(),
    notifications: z.object({
      onComplete: z.boolean().default(true),
      onError: z.boolean().default(true),
      email: z.string().email().optional(),
    }).optional(),
  }).optional(),
})

type JobFormData = z.infer<typeof jobFormSchema>

const JOB_TEMPLATES = {
  account_analysis: [
    {
      id: 'full_analysis',
      name: 'Full Account Analysis',
      description: 'Complete analysis of all account data including technologies, contacts, and insights',
      config: { includeInsights: true, exportFormat: 'json' as const }
    },
    {
      id: 'tech_stack_analysis',
      name: 'Technology Stack Analysis',
      description: 'Focus on identifying and analyzing technology stacks',
      config: { includeInsights: false, exportFormat: 'csv' as const }
    },
    {
      id: 'contact_analysis',
      name: 'Contact Analysis',
      description: 'Analyze contact information and relationships',
      config: { includeInsights: true, exportFormat: 'xlsx' as const }
    }
  ],
  data_export: [
    {
      id: 'full_export',
      name: 'Full Data Export',
      description: 'Export all account data with insights',
      config: { includeInsights: true, exportFormat: 'xlsx' as const }
    },
    {
      id: 'accounts_only',
      name: 'Accounts Only',
      description: 'Export account information without insights',
      config: { includeInsights: false, exportFormat: 'csv' as const }
    },
    {
      id: 'insights_only',
      name: 'Insights Only',
      description: 'Export generated insights and recommendations',
      config: { includeInsights: true, exportFormat: 'json' as const }
    }
  ],
  insight_generation: [
    {
      id: 'ai_insights',
      name: 'AI-Generated Insights',
      description: 'Generate AI-powered insights for selected accounts',
      config: { includeInsights: true, exportFormat: 'json' as const }
    },
    {
      id: 'trend_analysis',
      name: 'Trend Analysis',
      description: 'Analyze trends and patterns in account data',
      config: { includeInsights: true, exportFormat: 'xlsx' as const }
    },
    {
      id: 'competitive_analysis',
      name: 'Competitive Analysis',
      description: 'Compare accounts and identify competitive advantages',
      config: { includeInsights: true, exportFormat: 'json' as const }
    }
  ]
}

interface JobSubmissionFormProps {
  onSubmit?: (job: any) => void
  onCancel?: () => void
  initialData?: Partial<JobFormData>
}

export function JobSubmissionForm({ onSubmit, onCancel, initialData }: JobSubmissionFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const { addJob } = useJobStore()
  const { accounts } = useAccountStore()

  const form = useForm<JobFormData>({
    resolver: zodResolver(jobFormSchema),
    defaultValues: {
      type: 'account_analysis',
      priority: 'normal',
      config: {
        scheduleType: 'immediate',
        notifications: {
          onComplete: true,
          onError: true,
        }
      },
      ...initialData,
    },
  })

  const watchType = form.watch('type')
  const watchScheduleType = form.watch('config.scheduleType')
  
  const availableTemplates = JOB_TEMPLATES[watchType] || []

  const handleTemplateSelect = (templateId: string) => {
    const template = availableTemplates.find(t => t.id === templateId)
    if (template) {
      setSelectedTemplate(templateId)
      form.setValue('title', template.name)
      form.setValue('description', template.description)
      form.setValue('template', templateId)
      form.setValue('config', { ...form.getValues('config'), ...template.config })
    }
  }

  const handleSubmit = async (data: JobFormData) => {
    setIsSubmitting(true)
    
    try {
      const jobData = {
        type: data.type,
        title: data.title,
        description: data.description,
        metadata: {
          priority: data.priority,
          template: data.template,
          config: data.config,
          createdBy: 'user', // This would come from auth
        }
      }

      const job = await jobService.createJob(jobData)
      addJob(job)
      
      toast.success('Job created successfully', {
        description: `${job.title} has been added to the queue`,
        action: {
          label: 'View Jobs',
          onClick: () => window.location.href = '/jobs'
        }
      })
      
      onSubmit?.(job)
      form.reset()
      setSelectedTemplate('')
      
    } catch (error) {
      console.error('Failed to create job:', error)
      toast.error('Failed to create job', {
        description: error instanceof Error ? error.message : 'Please try again'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const getJobTypeIcon = (type: string) => {
    switch (type) {
      case 'account_analysis':
        return FileText
      case 'insight_generation':
        return Lightbulb
      case 'data_export':
        return Download
      default:
        return Settings
    }
  }

  const getJobTypeLabel = (type: string) => {
    switch (type) {
      case 'account_analysis':
        return 'Account Analysis'
      case 'insight_generation':
        return 'Insight Generation'
      case 'data_export':
        return 'Data Export'
      default:
        return 'Custom Job'
    }
  }

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Create New Job</h2>
            <p className="text-sm text-muted-foreground">
              Configure and submit a new processing job
            </p>
          </div>
          <Badge variant="outline" className="text-xs">
            {accounts.length} accounts available
          </Badge>
        </div>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          {/* Job Type Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Job Type</Label>
            <RadioGroup
              value={form.watch('type')}
              onValueChange={(value) => form.setValue('type', value as any)}
              className="grid grid-cols-3 gap-4"
            >
              {['account_analysis', 'insight_generation', 'data_export'].map((type) => {
                const Icon = getJobTypeIcon(type)
                return (
                  <div key={type}>
                    <RadioGroupItem value={type} id={type} className="sr-only" />
                    <Label
                      htmlFor={type}
                      className={`
                        flex flex-col items-center space-y-2 p-4 border-2 rounded-lg cursor-pointer transition-all
                        ${form.watch('type') === type 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border hover:border-primary/50'
                        }
                      `}
                    >
                      <Icon className="h-6 w-6" />
                      <span className="text-sm font-medium text-center">
                        {getJobTypeLabel(type)}
                      </span>
                    </Label>
                  </div>
                )
              })}
            </RadioGroup>
          </div>

          {/* Template Selection */}
          {availableTemplates.length > 0 && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Templates</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {availableTemplates.map((template) => (
                  <div
                    key={template.id}
                    onClick={() => handleTemplateSelect(template.id)}
                    className={`
                      p-4 border rounded-lg cursor-pointer transition-all
                      ${selectedTemplate === template.id 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border hover:border-primary/50'
                      }
                    `}
                  >
                    <h4 className="font-medium text-sm">{template.name}</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      {template.description}
                    </p>
                    {selectedTemplate === template.id && (
                      <CheckCircle className="h-4 w-4 text-primary mt-2" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Job Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Job Title *</Label>
              <Input
                id="title"
                {...form.register('title')}
                placeholder="Enter job title"
                className={form.formState.errors.title ? 'border-destructive' : ''}
              />
              {form.formState.errors.title && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {form.formState.errors.title.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={form.watch('priority')}
                onValueChange={(value) => form.setValue('priority', value as any)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...form.register('description')}
              placeholder="Optional job description"
              rows={3}
            />
          </div>

          {/* Schedule */}
          <div className="space-y-4">
            <Label className="text-sm font-medium">Schedule</Label>
            <RadioGroup
              value={form.watch('config.scheduleType')}
              onValueChange={(value) => form.setValue('config.scheduleType', value as any)}
              className="flex space-x-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="immediate" id="immediate" />
                <Label htmlFor="immediate" className="flex items-center space-x-2 cursor-pointer">
                  <Play className="h-4 w-4" />
                  <span>Run immediately</span>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="scheduled" id="scheduled" />
                <Label htmlFor="scheduled" className="flex items-center space-x-2 cursor-pointer">
                  <Calendar className="h-4 w-4" />
                  <span>Schedule for later</span>
                </Label>
              </div>
            </RadioGroup>

            {watchScheduleType === 'scheduled' && (
              <div className="pl-6 space-y-2">
                <Label htmlFor="scheduledAt">Schedule Date & Time</Label>
                <Input
                  id="scheduledAt"
                  type="datetime-local"
                  {...form.register('config.scheduledAt')}
                  min={new Date().toISOString().slice(0, 16)}
                />
              </div>
            )}
          </div>

          {/* Advanced Configuration */}
          <div className="space-y-4">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="h-auto p-0 text-sm text-muted-foreground hover:text-foreground"
            >
              <Settings className="h-4 w-4 mr-2" />
              {showAdvanced ? 'Hide' : 'Show'} Advanced Options
            </Button>

            {showAdvanced && (
              <div className="pl-6 space-y-4 border-l-2 border-border">
                {/* Export Format */}
                {watchType === 'data_export' && (
                  <div className="space-y-2">
                    <Label>Export Format</Label>
                    <Select
                      value={form.watch('config.exportFormat')}
                      onValueChange={(value) => form.setValue('config.exportFormat', value as any)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select format" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="json">JSON</SelectItem>
                        <SelectItem value="csv">CSV</SelectItem>
                        <SelectItem value="xlsx">Excel</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Notifications */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Notifications</Label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="notifyComplete"
                        checked={form.watch('config.notifications.onComplete')}
                        onCheckedChange={(checked) => 
                          form.setValue('config.notifications.onComplete', !!checked)
                        }
                      />
                      <Label htmlFor="notifyComplete" className="text-sm cursor-pointer">
                        Notify when job completes
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="notifyError"
                        checked={form.watch('config.notifications.onError')}
                        onCheckedChange={(checked) => 
                          form.setValue('config.notifications.onError', !!checked)
                        }
                      />
                      <Label htmlFor="notifyError" className="text-sm cursor-pointer">
                        Notify on errors
                      </Label>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Submit Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-border">
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Create Job
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </Card>
  )
}