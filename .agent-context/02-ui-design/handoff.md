# UI Design Handoff for Frontend Development

## Overview
This document provides implementation guidance for the C1 Northstar Sales Intelligence Platform MVP visual design. All specifications are optimized for rapid development using Next.js 15, TailwindCSS, and ShadCN UI.

## Design System Implementation

### 1. Core Setup
```bash
# Install required dependencies
npm install tailwindcss @radix-ui/themes class-variance-authority
npm install framer-motion lucide-react
```

### 2. Tailwind Configuration
Use the color tokens and spacing from `design-system.json`:
- Primary: `#0ea5e9` (sky-500)
- Secondary: `#64748b` (slate-500)
- Success: `#22c55e` (green-500)
- Warning: `#f59e0b` (amber-500)
- Error: `#ef4444` (red-500)

### 3. Component Priority Order
Implement components in this sequence for maximum efficiency:

**Sprint 1 (Days 1-2)**:
- Base layout with sidebar navigation
- Authentication wrapper with EntraID
- Button, Card, and Badge components
- Loading skeletons and spinners

**Sprint 2 (Days 3-4)**:
- File upload with drag-drop
- Data table with pagination
- Progress bars and status indicators
- Form components (inputs, selects)

**Sprint 3 (Days 5-6)**:
- Real-time WebSocket indicators
- Chat interface with streaming
- Toast notifications
- Export functionality

## Key Implementation Notes

### Animation Performance
- Use CSS transforms and opacity for animations (GPU-accelerated)
- Implement `will-change` property sparingly
- Use `framer-motion` for complex interactions
- Test with Chrome DevTools Performance tab

### Accessibility Requirements
- All interactive elements must have focus states
- Minimum contrast ratio: 4.5:1 for normal text
- Support keyboard navigation throughout
- Include aria-labels for icon-only buttons
- Implement `prefers-reduced-motion` media query

### State Management
- Use Zustand for global state (job queue, user session)
- Local state for component-specific interactions
- Optimistic updates for better perceived performance
- WebSocket real-time updates via Socket.io

### Data Handling
- Virtualize tables for 9,000+ accounts (use `react-window`)
- Implement pagination with 50 items per page default
- Cache search results for 5 minutes
- Debounce search input by 300ms

## Component Specifications

### Dashboard Components
```tsx
// Job Status Card
<Card className="p-6 hover:shadow-lg transition-shadow duration-150">
  <Badge variant={status} className="animate-pulse">
    {jobStatus}
  </Badge>
  <Progress value={progress} className="mt-4" />
</Card>
```

### Import Interface
```tsx
// Drag-Drop Zone
<div className="border-2 border-dashed border-slate-300 
  hover:border-sky-500 hover:bg-sky-50/50 
  transition-all duration-200">
  {/* Drop zone content */}
</div>
```

### Real-time Updates
```tsx
// WebSocket indicator
<div className="animate-pulse">
  <div className="w-2 h-2 bg-green-500 rounded-full" />
</div>
```

## Micro-interactions Implementation

### 1. Progress Animations
Use the specifications from `mockups.json`:
- Milestone pulses at 25%, 50%, 75%
- Color transition from blue to green
- Completion bounce (transform: translateY(-2px))

### 2. Status Transitions
- Fade duration: 150ms with ease-out
- Scale transform: 0.95 to 1
- Use `transition-all` Tailwind utility

### 3. Loading States
- Shimmer: Use CSS keyframe animation
- Skeleton pulse: `animate-pulse` utility
- Stagger delays with CSS variables

## Performance Checklist

✅ Lazy load heavy components  
✅ Optimize images with Next.js Image component  
✅ Use dynamic imports for modals  
✅ Implement virtual scrolling for long lists  
✅ Cache API responses appropriately  
✅ Debounce user inputs  
✅ Use React.memo for expensive renders  

## Testing Requirements

### Visual Testing
- Cross-browser: Chrome, Firefox, Safari, Edge
- Responsive breakpoints: 1440px (default), 1920px (large)
- Dark mode preparation (CSS variables ready)

### Interaction Testing
- All hover states functioning
- Keyboard navigation complete
- Screen reader compatibility
- Loading state coverage
- Error state handling

## Design Token Usage

Reference `design-system.json` for:
- Color values and semantic meanings
- Typography scale and line heights
- Spacing increments (8px grid)
- Border radius values
- Shadow definitions
- Animation timing functions

## File References

- **Design System**: `.agent-context/02-ui-design/design-system.json`
- **Components**: `.agent-context/02-ui-design/components.md`
- **Interactions**: `.agent-context/02-ui-design/mockups.json`
- **Brand Guide**: `.agent-context/02-ui-design/brand-guidelines.md`
- **Wireframes**: `.agent-context/01-ux-planning/wireframes.json`

## Support & Questions

For design clarifications:
1. Check the brand guidelines first
2. Reference the component specifications
3. Follow the established patterns
4. Maintain consistency above creativity

## Success Metrics

- Page load: <2 seconds
- Real-time update latency: <1 second
- Smooth animations: 60fps
- Accessibility score: 100%
- Zero design inconsistencies

---

**Remember**: This is an enterprise B2B application. Prioritize clarity, efficiency, and professionalism over decorative elements. Every design decision should enhance productivity for power users transitioning from CLI tools.