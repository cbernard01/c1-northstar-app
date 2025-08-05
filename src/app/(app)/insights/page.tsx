'use client'

import { Lightbulb, Star, Building2 } from 'lucide-react'
import React from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export default function InsightsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h1 text-foreground mb-2">
          Insight Viewer
        </h1>
        <p className="text-body text-muted-foreground">
          Explore AI-generated insights about your accounts. Filter by category, search content, and bookmark important findings.
        </p>
      </div>

      <Card className="p-12 text-center">
        <Lightbulb className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
        <h3 className="text-h4 text-foreground mb-2">
          Insights Coming Soon
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Upload account data to start generating AI insights.
        </p>
        <Button onClick={() => window.location.href = '/upload'}>
          Upload Data
        </Button>
      </Card>
    </div>
  )
}