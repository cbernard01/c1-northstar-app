# C1 Northstar MVP - Navigation Structure & Routing

## Navigation Architecture

### Primary Navigation Menu
Located in global header (x: 300, y: 16, width: 600, height: 32)

```
Dashboard | Import | Jobs | Accounts | Results | Chat
```

### Navigation Hierarchy

```
C1 Northstar Platform
├── Dashboard (/) - Job status overview and quick actions
├── Import (/import) - File upload and validation
│   ├── Accounts (/import?type=accounts)
│   ├── Products (/import?type=products)
│   ├── Assets (/import?type=assets)
│   └── Opportunities (/import?type=opportunities)
├── Jobs (/jobs) - Job queue monitoring and management
│   ├── Active Jobs (/jobs?status=active)
│   ├── Completed (/jobs?status=completed)
│   ├── Failed (/jobs?status=failed)
│   └── Job Detail (/jobs/:jobId)
├── Accounts (/accounts) - Account exploration and search
│   ├── Search Results (/accounts?search=query)
│   ├── Filtered View (/accounts?filters=industry,size,tech)
│   └── Account Detail (/accounts/:accountId)
│       ├── Overview (/accounts/:accountId/overview)
│       ├── Technology Stack (/accounts/:accountId/tech-stack)
│       ├── Opportunities (/accounts/:accountId/opportunities)
│       ├── AI Insights (/accounts/:accountId/insights)
│       └── Timeline (/accounts/:accountId/timeline)
├── Results (/results) - AI insights and export functionality
│   ├── Customer Ecosystem (/results?category=ecosystem)
│   ├── Customer Value (/results?category=value)
│   ├── Customer Interests (/results?category=interests)
│   ├── Next Steps (/results?category=next-steps)
│   └── Export History (/results/exports)
└── Chat (/chat) - AI chat interface
    ├── Account Context (/chat?account=:accountId)
    └── Chat History (/chat/history)
```

## Routing Patterns

### URL Structure
- Base URLs: `/dashboard`, `/import`, `/jobs`, `/accounts`, `/results`, `/chat`
- Query Parameters: Used for filtering, searching, and state management
- Dynamic Routes: `:accountId`, `:jobId` for detail views
- Hash Fragments: Not used in MVP (reserved for future deep linking)

### Route Guards
- All routes require authentication via Microsoft EntraID
- No role-based permissions for MVP (single-tenant)
- Session persistence across browser restarts

### State Management in URLs
- **Search State**: `?search=query&filters=industry:tech,size:large`
- **Pagination**: `?page=2&limit=50`
- **Job Filters**: `?status=active&type=import&date=today`
- **Result Categories**: `?category=ecosystem&confidence=high`
- **Chat Context**: `?account=12345&thread=abc123`

## Breadcrumb Navigation

### Pattern
`Home > Section > Page > Detail`

### Examples
- `Dashboard`
- `Dashboard > Import > Accounts`
- `Dashboard > Jobs > Job #12345`
- `Dashboard > Accounts > Acme Corp > Technology Stack`
- `Dashboard > Results > Customer Ecosystem`
- `Dashboard > Chat > Acme Corp Context`

### Implementation
- Position: x: 304, y: 88, width: 1088, height: 24
- Interactive breadcrumbs (clickable to navigate back)
- Current page not clickable, different visual treatment
- Ellipsis truncation for long paths on smaller screens

## Quick Action Patterns

### Dashboard Quick Actions
- **Upload Files** → `/import`
- **Create Job** → `/jobs` (modal overlay)
- **Explore Accounts** → `/accounts`
- **View Results** → `/results`

### Contextual Actions
- **From Account Detail** → "Chat about this account" → `/chat?account=:id`
- **From Results** → "Export insights" → Inline export modal
- **From Jobs** → "Retry failed job" → Inline retry action
- **From Chat** → "View account details" → `/accounts/:id`

## Mobile Navigation (Future Enhancement)

### Responsive Patterns
- **Desktop (>1200px)**: Full horizontal navigation
- **Tablet (768-1199px)**: Compressed navigation with icons
- **Mobile (<768px)**: Hamburger menu (out of scope for MVP)

## Navigation State Indicators

### Active States
- **Current Page**: Primary color, bold text
- **Hover States**: Secondary color, subtle animation
- **Loading States**: Skeleton placeholders during navigation

### Progress Indicators
- **Job Processing**: Real-time progress in navigation badge
- **File Upload**: Progress indicator in import section
- **Data Loading**: Loading spinners during page transitions

## Keyboard Navigation

### Shortcuts (Future Enhancement)
- `Alt + D`: Dashboard
- `Alt + I`: Import
- `Alt + J`: Jobs
- `Alt + A`: Accounts
- `Alt + R`: Results
- `Alt + C`: Chat
- `Ctrl + K`: Global search (future)

### Tab Order
1. Skip to main content link
2. Global navigation menu items
3. Page-specific actions
4. Main content interactive elements
5. Footer links (if present)

## Error State Navigation

### 404 Not Found
- Clear message with navigation options
- Link back to dashboard
- Search functionality to find intended content

### Authentication Errors
- Redirect to Microsoft EntraID login
- Return to intended page after successful authentication
- Session timeout warnings with extend session option

### Permission Errors
- Clear explanation (not applicable for MVP single-tenant)
- Alternative navigation suggestions
- Contact support option

## Search Integration

### Global Search (Future Enhancement)
- Search across accounts, jobs, and results
- Autocomplete suggestions
- Recent searches
- Search filters and facets

### Page-Specific Search
- **Accounts**: Full-text search with filters
- **Jobs**: Search by job ID, type, or status
- **Results**: Search insights by category or confidence
- **Chat**: Search conversation history

## Performance Considerations

### Navigation Loading
- Instant navigation between cached pages
- Progressive loading for data-heavy sections
- Preload critical navigation destinations

### State Persistence
- Maintain scroll position on back navigation
- Preserve form state during navigation
- Cache frequently accessed navigation data

### Analytics Integration
- Track navigation patterns
- Monitor page load performance
- Identify navigation bottlenecks

## Implementation Priority

### Sprint 1: Core Navigation
- Basic routing setup with Next.js App Router
- Primary navigation menu
- Dashboard and authentication flow

### Sprint 2: Section Navigation
- Import and Jobs section routing
- Basic breadcrumb implementation
- Quick action navigation

### Sprint 3: Detail Navigation
- Account detail routing with tabs
- Dynamic route parameters
- State management in URLs

### Sprint 4: Advanced Navigation
- Results section with category filtering
- Export navigation flows
- Navigation state indicators

### Sprint 5: AI Integration
- Chat routing with context
- Cross-section navigation (account to chat)
- Real-time navigation updates

### Sprint 6: Polish & Optimization
- Performance optimizations
- Error state handling
- Navigation accessibility improvements

## Technical Implementation Notes

### Next.js App Router Structure
```
app/
├── layout.tsx (global layout with navigation)
├── page.tsx (dashboard)
├── import/
│   ├── layout.tsx
│   └── page.tsx
├── jobs/
│   ├── layout.tsx
│   ├── page.tsx
│   └── [jobId]/
│       └── page.tsx
├── accounts/
│   ├── layout.tsx
│   ├── page.tsx
│   └── [accountId]/
│       ├── layout.tsx
│       ├── page.tsx
│       ├── overview/
│       ├── tech-stack/
│       ├── opportunities/
│       ├── insights/
│       └── timeline/
├── results/
│   ├── layout.tsx
│   └── page.tsx
└── chat/
    ├── layout.tsx
    └── page.tsx
```

### State Management
- URL state for filters, search, pagination
- Local storage for user preferences
- Session storage for temporary navigation state
- WebSocket state for real-time updates

### Accessibility
- Semantic HTML navigation structure
- ARIA labels for navigation landmarks
- Focus management during navigation
- Screen reader friendly breadcrumbs

This navigation structure provides a clear, scalable foundation for the C1 Northstar MVP while maintaining flexibility for future enhancements.