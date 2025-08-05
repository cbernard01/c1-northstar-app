'use client'

import { BarChart3, Download, Calendar } from 'lucide-react'
import React from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export default function ReportsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-h1 text-foreground mb-2">
          Reports &amp; Analytics
        </h1>
        <p className="text-body text-muted-foreground">
          Generate comprehensive reports on your accounts, insights, and sales intelligence data.
        </p>
      </div>

      <Card className="p-12 text-center">
        <BarChart3 className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
        <h3 className="text-h4 text-foreground mb-2">
          Reports Coming Soon
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Advanced reporting and analytics features will be available here.
        </p>
        <Button variant="outline">
          <Calendar className="h-4 w-4 mr-2" />
          Schedule Demo
        </Button>
      </Card>
    </div>
  )
}