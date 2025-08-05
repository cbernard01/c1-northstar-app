# C1 Northstar MVP - Component Specifications

## Overview
This document provides detailed specifications for all UI components in the C1 Northstar Sales Intelligence Platform, designed for rapid implementation with ShadCN UI and Tailwind CSS.

## Global Layout Components

### Header Component
```typescript
interface HeaderProps {
  user: {
    name: string;
    email: string;
    avatar?: string;
  };
}
```

**Specifications:**
- Height: 64px fixed
- Background: white with subtle shadow
- Logo: 200x32px, positioned at left
- User profile: 96x32px, positioned at right
- Navigation: centered, 600px max-width

**Tailwind Classes:**
```css
/* Header container */
.header {
  @apply h-16 bg-white border-b border-slate-200 shadow-sm fixed top-0 left-0 right-0 z-50;
}

/* Logo area */
.header-logo {
  @apply flex items-center px-6 py-4 h-full;
}

/* User profile */
.header-profile {
  @apply flex items-center gap-3 px-6 py-4 h-full hover:bg-slate-50 transition-colors;
}
```

### Sidebar Navigation
```typescript
interface SidebarProps {
  activeRoute: string;
  navigationItems: NavigationItem[];
}

interface NavigationItem {
  id: string;
  label: string;
  icon: React.ComponentType;
  href: string;
  badge?: number;
}
```

**Specifications:**
- Width: 256px fixed
- Background: slate-50 with subtle gradient
- Navigation items: 48px height with hover states
- Icons: 20x20px, positioned left
- Active state: blue accent with background highlight

**Tailwind Classes:**
```css
/* Sidebar container */
.sidebar {
  @apply w-64 bg-slate-50 border-r border-slate-200 fixed left-0 top-16 bottom-0 overflow-y-auto;
}

/* Navigation item */
.nav-item {
  @apply flex items-center px-6 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors;
}

/* Active navigation item */
.nav-item-active {
  @apply bg-blue-50 text-blue-700 border-r-2 border-blue-600;
}
```

## Button Components

### Primary Button
```typescript
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}
```

**Variant Specifications:**

**Primary Button:**
```css
.btn-primary {
  @apply bg-blue-600 text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2;
}
```

**Secondary Button:**
```css
.btn-secondary {
  @apply bg-slate-100 text-slate-900 hover:bg-slate-200 focus:ring-2 focus:ring-slate-500 focus:ring-offset-2;
}
```

**Outline Button:**
```css
.btn-outline {
  @apply border border-slate-300 text-slate-700 hover:bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2;
}
```

**Size Specifications:**
- Small: 32px height, 8px/12px padding
- Medium: 40px height, 10px/16px padding  
- Large: 48px height, 12px/20px padding

## Card Components

### Status Card (Dashboard)
```typescript
interface StatusCardProps {
  title: string;
  value: string | number;
  status: 'running' | 'completed' | 'failed' | 'pending';
  progress?: number;
  subtitle?: string;
  actions?: React.ReactNode;
}
```

**Specifications:**
- Dimensions: 352x180px (desktop), responsive
- Border radius: 8px
- Padding: 24px
- Shadow: subtle elevation
- Status indicator: colored dot + label

**Tailwind Implementation:**
```css
.status-card {
  @apply bg-white rounded-lg border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow;
}

.status-indicator {
  @apply flex items-center gap-2 text-sm font-medium;
}

.status-dot {
  @apply w-2 h-2 rounded-full;
}

/* Status variants */
.status-running { @apply bg-blue-500; }
.status-completed { @apply bg-green-500; }
.status-failed { @apply bg-red-500; }
.status-pending { @apply bg-amber-500; }
```

### Account Card (Explorer)
```typescript
interface AccountCardProps {
  account: {
    id: string;
    name: string;
    industry: string;
    size: string;
    technologies: string[];
    lastUpdated: Date;
    insightCount: number;
    confidence: number;
  };
  onClick?: (accountId: string) => void;
}
```

**Specifications:**
- Dimensions: 392x180px
- Interactive hover states
- Technology stack preview (max 3 tags)
- Confidence score visualization
- Quick action buttons

## Form Components

### File Upload Zone
```typescript
interface FileUploadProps {
  acceptedTypes: string[];
  maxSize: number;
  onFilesSelected: (files: File[]) => void;
  dragActive?: boolean;
  uploading?: boolean;
}
```

**Specifications:**
- Minimum height: 320px
- Drag and drop area with visual feedback
- File type validation display
- Progress indicator during upload
- Multiple file support

**Tailwind Implementation:**
```css
.upload-zone {
  @apply border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors;
}

.upload-zone-active {
  @apply border-blue-500 bg-blue-50;
}

.upload-zone-error {
  @apply border-red-300 bg-red-50;
}
```

### Search Input
```typescript
interface SearchInputProps {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  debounceMs?: number;
  loading?: boolean;
}
```

**Specifications:**
- Height: 40px
- Icon: search (left), loading spinner (right when active)
- Debounced input (300ms default)
- Clear button when value present

## Data Display Components

### Data Table
```typescript
interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  pagination?: PaginationConfig;
  sorting?: SortingConfig;
  selection?: SelectionConfig;
  loading?: boolean;
}
```

**Specifications:**
- Row height: 48px
- Header height: 56px
- Cell padding: 12px 16px
- Sortable columns with indicators
- Row selection with checkboxes
- Loading skeleton states

**Tailwind Implementation:**
```css
.data-table {
  @apply w-full border border-slate-200 rounded-lg overflow-hidden;
}

.table-header {
  @apply bg-slate-50 border-b border-slate-200;
}

.table-row {
  @apply border-b border-slate-100 hover:bg-slate-50 transition-colors;
}

.table-cell {
  @apply px-4 py-3 text-sm text-slate-900;
}
```

### Progress Bar
```typescript
interface ProgressBarProps {
  value: number;
  max?: number;
  variant: 'default' | 'success' | 'warning' | 'error';
  size: 'sm' | 'md' | 'lg';
  showPercentage?: boolean;
  animated?: boolean;
}
```

**Size Specifications:**
- Small: 4px height
- Medium: 8px height
- Large: 12px height

**Variant Colors:**
- Default: blue-500
- Success: green-500
- Warning: amber-500
- Error: red-500

## Insight Components

### Insight Card
```typescript
interface InsightCardProps {
  insight: {
    id: string;
    category: 'ecosystem' | 'value' | 'interests' | 'next_steps';
    title: string;
    content: string;
    confidence: number;
    evidence: EvidenceLink[];
    timestamp: Date;
  };
  onEvidenceClick?: (evidence: EvidenceLink) => void;
}
```

**Specifications:**
- Dimensions: 352x200px
- Category color coding
- Confidence score badge (top-right)
- Evidence links (bottom-left)
- Expandable content on hover

### Confidence Badge
```typescript
interface ConfidenceBadgeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
}
```

**Score Ranges:**
- High (80-100%): green background
- Medium (60-79%): amber background  
- Low (0-59%): red background

**Tailwind Implementation:**
```css
.confidence-badge {
  @apply inline-flex items-center px-2 py-1 rounded text-xs font-medium;
}

.confidence-high {
  @apply bg-green-100 text-green-800;
}

.confidence-medium {
  @apply bg-amber-100 text-amber-800;
}

.confidence-low {
  @apply bg-red-100 text-red-800;
}
```

## Chat Components

### Chat Message
```typescript
interface ChatMessageProps {
  message: {
    id: string;
    type: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    sources?: SourceAttribution[];
    streaming?: boolean;
  };
}
```

**Specifications:**
- User messages: right-aligned, blue background
- Assistant messages: left-aligned, white background
- Max width: 600px (user), 800px (assistant)
- Streaming indicator for real-time responses

**Tailwind Implementation:**
```css
.chat-message-user {
  @apply ml-auto max-w-lg bg-blue-600 text-white rounded-lg px-4 py-2 shadow-sm;
}

.chat-message-assistant {
  @apply mr-auto max-w-2xl bg-white border border-slate-200 rounded-lg px-4 py-2 shadow-sm;
}

.chat-streaming {
  @apply after:content-[''] after:inline-block after:w-1 after:h-4 after:bg-blue-600 after:animate-pulse;
}
```

### Chat Input
```typescript
interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  suggestions?: string[];
}
```

**Specifications:**
- Height: 80px (multiline support)
- Auto-resize up to 120px max
- Send button: 48x48px
- Keyboard shortcuts: Enter to send, Shift+Enter for newline

## Filter Components

### Filter Chip
```typescript
interface FilterChipProps {
  label: string;
  value: string;
  active?: boolean;
  removable?: boolean;
  onToggle?: () => void;
  onRemove?: () => void;
}
```

**Specifications:**
- Height: 32px
- Padding: 8px 12px
- Border radius: 16px (pill shape)
- Active state: blue background
- Remove icon: 16x16px

### Filter Panel
```typescript
interface FilterPanelProps {
  title: string;
  options: FilterOption[];
  selectedValues: string[];
  onSelectionChange: (values: string[]) => void;
  searchable?: boolean;
  multiSelect?: boolean;
}
```

**Specifications:**
- Max height: 300px with scroll
- Option height: 36px
- Checkbox/radio button alignment
- Search input when searchable

## Loading States

### Skeleton Components
All components should have corresponding skeleton states:

```css
.skeleton {
  @apply animate-pulse bg-slate-200 rounded;
}

.skeleton-text {
  @apply h-4 bg-slate-200 rounded w-3/4;
}

.skeleton-card {
  @apply h-48 bg-slate-200 rounded-lg;
}

.skeleton-table-row {
  @apply h-12 bg-slate-100 border-b border-slate-200;
}
```

### Loading Spinner
```typescript
interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'secondary';
}
```

**Size Specifications:**
- Small: 16x16px
- Medium: 24x24px
- Large: 32x32px

## Error States

### Error Message
```typescript
interface ErrorMessageProps {
  title?: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  variant?: 'inline' | 'toast' | 'page';
}
```

**Specifications:**
- Inline: red text with icon
- Toast: slide-in notification, auto-dismiss
- Page: centered with illustration

### Validation Message
```typescript
interface ValidationMessageProps {
  message: string;
  type: 'error' | 'warning' | 'success';
  field?: string;
}
```

## Responsive Behavior

### Mobile Adaptations (< 768px)
- Sidebar: converts to overlay/drawer
- Cards: full-width, stacked layout
- Tables: horizontal scroll or simplified view
- Buttons: minimum 44px touch target

### Tablet Adaptations (768px - 1199px)
- Sidebar: collapsible with icons only
- Grid layouts: 2-column instead of 3-column
- Reduced padding and margins

## Implementation Notes

### ShadCN UI Integration
All components should extend ShadCN UI base components where available:
- Button → extends ShadCN Button
- Input → extends ShadCN Input
- Card → extends ShadCN Card
- Table → extends ShadCN Table

### Tailwind CSS Classes
Use design tokens from the design system JSON for consistent spacing, colors, and typography. Avoid hardcoded values.

### Accessibility Requirements
- All interactive elements: keyboard navigation
- Focus indicators: 2px blue ring with 2px offset
- Screen reader support: proper ARIA labels
- Color contrast: minimum AA compliance (4.5:1)
- Touch targets: minimum 44px for mobile

### Performance Considerations
- Virtualized tables for large datasets (9,000+ accounts)
- Lazy loading for images and heavy components
- Debounced search inputs (300ms)
- Memoized complex calculations

This component specification provides the foundation for rapid development while maintaining consistency and enterprise-grade quality throughout the C1 Northstar platform.