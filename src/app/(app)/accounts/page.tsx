'use client'

import { 
  Search,
  Filter,
  Building2,
  MapPin,
  Globe,
  Users,
  TrendingUp,
  Plus,
  MoreHorizontal
} from 'lucide-react'
import React from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

// Mock data - in real app this would come from the store
const mockAccounts = [
  {
    id: '1',
    name: 'Acme Corporation',
    industry: 'Technology',
    size: 'Enterprise',
    location: 'San Francisco, CA',
    website: 'acme.com',
    employees: 5000,
    technologies: ['React', 'Node.js', 'AWS', 'PostgreSQL'],
    confidence: 89,
    insightCount: 24,
    lastUpdated: new Date('2024-01-15'),
  },
  {
    id: '2',
    name: 'TechStart Inc',
    industry: 'SaaS',
    size: 'Startup',
    location: 'Austin, TX',
    website: 'techstart.io',
    employees: 45,
    technologies: ['Vue.js', 'Python', 'Docker', 'MongoDB'],
    confidence: 76,
    insightCount: 12,
    lastUpdated: new Date('2024-01-14'),
  },
  {
    id: '3',
    name: 'Global Dynamics',
    industry: 'Manufacturing',
    size: 'Large',
    location: 'Detroit, MI',
    website: 'globaldynamics.com',
    employees: 12000,
    technologies: ['Java', 'Oracle', 'SAP', 'Kubernetes'],
    confidence: 92,
    insightCount: 31,
    lastUpdated: new Date('2024-01-13'),
  },
]

const getConfidenceColor = (confidence: number) => {
  if (confidence >= 80) return 'text-success-600 bg-success-50 border-success-200'
  if (confidence >= 60) return 'text-warning-600 bg-warning-50 border-warning-200'
  return 'text-error-600 bg-error-50 border-error-200'
}

const getSizeColor = (size: string) => {
  switch (size.toLowerCase()) {
    case 'enterprise': return 'bg-primary/10 text-primary border-primary/20'
    case 'large': return 'bg-secondary-50 text-secondary-700 border-secondary-200'
    case 'medium': return 'bg-warning-50 text-warning-700 border-warning-200'
    case 'small': return 'bg-success-50 text-success-700 border-success-200'
    case 'startup': return 'bg-error-50 text-error-700 border-error-200'
    default: return 'bg-muted text-muted-foreground border-border'
  }
}

export default function AccountsPage() {
  const [searchQuery, setSearchQuery] = React.useState('')
  const [selectedFilters, setSelectedFilters] = React.useState<string[]>([])
  const [showFilters, setShowFilters] = React.useState(false)

  const filteredAccounts = mockAccounts.filter(account => {
    const matchesSearch = !searchQuery || 
      account.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      account.industry.toLowerCase().includes(searchQuery.toLowerCase()) ||
      account.technologies.some(tech => tech.toLowerCase().includes(searchQuery.toLowerCase()))
    
    return matchesSearch
  })

  const formatLastUpdated = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / 86400000)
    
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days} days ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-h1 text-foreground mb-2">
          Account Explorer
        </h1>
        <p className="text-body text-muted-foreground">
          Browse and analyze your account database. Search by company name, industry, or technology stack.
        </p>
      </div>

      {/* Search and Filters */}
      <Card>
        <div className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search accounts, industries, or technologies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {/* Filter Button */}
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center space-x-2"
            >
              <Filter className="h-4 w-4" />
              <span>Filters</span>
              {selectedFilters.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {selectedFilters.length}
                </Badge>
              )}
            </Button>
            
            {/* Add Account Button */}
            <Button className="flex items-center space-x-2">
              <Plus className="h-4 w-4" />
              <span>Add Account</span>
            </Button>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="mt-6 pt-6 border-t border-border">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-3">Industry</h3>
                  <div className="space-y-2">
                    {['Technology', 'SaaS', 'Manufacturing', 'Healthcare', 'Finance'].map(industry => (
                      <label key={industry} className="flex items-center space-x-2">
                        <input type="checkbox" className="rounded" />
                        <span className="text-sm text-muted-foreground">{industry}</span>
                      </label>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-3">Company Size</h3>
                  <div className="space-y-2">
                    {['Startup', 'Small', 'Medium', 'Large', 'Enterprise'].map(size => (
                      <label key={size} className="flex items-center space-x-2">
                        <input type="checkbox" className="rounded" />
                        <span className="text-sm text-muted-foreground">{size}</span>
                      </label>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-3">Technologies</h3>
                  <div className="space-y-2">
                    {['React', 'Node.js', 'Python', 'AWS', 'Docker'].map(tech => (
                      <label key={tech} className="flex items-center space-x-2">
                        <input type="checkbox" className="rounded" />
                        <span className="text-sm text-muted-foreground">{tech}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Results Summary */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {filteredAccounts.length} of {mockAccounts.length} accounts
        </p>
        
        <div className="flex items-center space-x-4">
          <span className="text-sm text-muted-foreground">Sort by:</span>
          <select className="text-sm border border-border rounded px-2 py-1">
            <option>Last Updated</option>
            <option>Company Name</option>
            <option>Confidence Score</option>
            <option>Insight Count</option>
          </select>
        </div>
      </div>

      {/* Account Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredAccounts.map((account) => (
          <Card key={account.id} className="group hover:shadow-md transition-all duration-200 cursor-pointer hover:-translate-y-1">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-h4 text-foreground mb-1 truncate">
                    {account.name}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {account.industry}
                  </p>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Badge 
                    className={cn('text-xs', getConfidenceColor(account.confidence))}
                  >
                    {account.confidence}% confidence
                  </Badge>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Company Details */}
              <div className="space-y-3 mb-4">
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <Building2 className="h-4 w-4 flex-shrink-0" />
                  <Badge className={cn('text-xs', getSizeColor(account.size))}>
                    {account.size}
                  </Badge>
                  <span>•</span>
                  <Users className="h-4 w-4 flex-shrink-0" />
                  <span>{account.employees?.toLocaleString()} employees</span>
                </div>
                
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 flex-shrink-0" />
                  <span>{account.location}</span>
                </div>
                
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <Globe className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{account.website}</span>
                </div>
              </div>

              {/* Technologies */}
              <div className="mb-4">
                <p className="text-xs text-muted-foreground mb-2">Technologies:</p>
                <div className="flex flex-wrap gap-1">
                  {account.technologies.slice(0, 3).map((tech) => (
                    <Badge key={tech} variant="outline" className="text-xs">
                      {tech}
                    </Badge>
                  ))}
                  {account.technologies.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{account.technologies.length - 3} more
                    </Badge>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t border-border">
                <div className="flex items-center space-x-1">
                  <TrendingUp className="h-3 w-3" />
                  <span>{account.insightCount} insights</span>
                </div>
                <span>Updated {formatLastUpdated(account.lastUpdated)}</span>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {filteredAccounts.length === 0 && (
        <Card className="p-12 text-center">
          <Building2 className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
          <h3 className="text-h4 text-foreground mb-2">
            No accounts found
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {searchQuery 
              ? `No accounts match "${searchQuery}". Try adjusting your search or filters.`
              : 'Upload data files to start building your account database.'
            }
          </p>
          {!searchQuery && (
            <Button onClick={() => window.location.href = '/upload'}>
              <Plus className="h-4 w-4 mr-2" />
              Upload Data
            </Button>
          )}
        </Card>
      )}
    </div>
  )
}