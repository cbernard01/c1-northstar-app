# C1 Northstar MVP - Agent Workflow Instructions

## How to Execute These Workflows

Each phase must be run sequentially. Provide the phase prompt to your agent orchestration system and ensure agents read/write to the specified files.

---

## PHASE 1: UX & PLANNING

**Agents**: > First use the [ux-researcher] to analyze user needs, then use the [sprint-prioritizer] to organize features

**Prompt**:
```
You are building the UX foundation for C1 Northstar Sales Intelligence Platform MVP.

INPUTS:
- Read: .agent-context/00-requirements/features.md
- Read: .agent-context/00-requirements/constraints.md

TASKS:
1. Using [ux-researcher]:
   - Define 6 primary user flows:
     a. File upload and import workflow
     b. Job creation and monitoring workflow
     c. Account exploration workflow
     d. Insight review and export workflow
     e. AI chat interaction workflow
     f. Dashboard navigation workflow
   - Create user journey maps for each flow
   - Identify pain points from CLI to web transition
   - Save to: .agent-context/01-ux-planning/user-flows.md

2. Using [sprint-prioritizer]:
   - Organize features into 6-day sprint chunks
   - Define MVP feature priorities
   - Create wireframe specifications for each page:
     * Dashboard layout
     * Import interface layout
     * Job queue layout
     * Account explorer layout
     * Insights viewer layout
     * Chat interface layout
   - Save wireframes as JSON: .agent-context/01-ux-planning/wireframes.json
   - Save navigation structure: .agent-context/01-ux-planning/navigation.md

OUTPUTS:
- user-flows.md with complete journey maps
- wireframes.json with layout coordinates and component positions
- navigation.md with site structure
- handoff.md with specific instructions for UI designer

IMPORTANT: Do NOT add features beyond the locked scope. Focus only on positioning and layout of defined features.
```

---

## PHASE 2: UI DESIGN

**Agents**: > First use the [ui-designer] to create the design system, then use the [brand-guardian] to ensure consistency, then use the [whimsy-injector] to add micro-interactions

**Prompt**:
```
You are creating the visual design for C1 Northstar Sales Intelligence Platform MVP.

INPUTS:
- Read: .agent-context/01-ux-planning/wireframes.json
- Read: .agent-context/01-ux-planning/user-flows.md
- Read: .agent-context/00-requirements/features.md

TASKS:
1. Using [ui-designer]:
   - Create comprehensive design system:
     * Color palette (primary, secondary, success, warning, error)
     * Typography scale (headings, body, captions)
     * Spacing system (8px grid)
     * Component variants for ShadCN UI
   - Design high-fidelity mockups for each screen:
     * Dashboard with job status cards and quick actions
     * Import interface with drag-drop zone
     * Job queue with real-time status indicators
     * Account explorer with data tables
     * Insights viewer with categorized cards
     * Chat interface with streaming responses
   - Save design system: .agent-context/02-ui-design/design-system.json
   - Save component specs: .agent-context/02-ui-design/components.md

2. Using [brand-guardian]:
   - Ensure consistent visual language across all screens
   - Define enterprise-appropriate styling (professional, data-focused)
   - Create loading states and error states
   - Document brand guidelines for future updates
   - Update: .agent-context/02-ui-design/design-system.json

3. Using [whimsy-injector]:
   - Add subtle micro-interactions:
     * Progress bar animations for job processing
     * Smooth transitions for status changes
     * Hover effects for interactive elements
     * Loading skeletons for data fetching
     * Success animations for completed jobs
   - Save interactions: .agent-context/02-ui-design/mockups.json

OUTPUTS:
- design-system.json with complete visual specifications
- components.md with ShadCN UI component configurations
- mockups.json with screen designs and interactions
- handoff.md with implementation notes for developers

CONSTRAINTS: Keep designs professional and data-focused. This is an enterprise B2B application.
```

---

## PHASE 3: FRONTEND DEVELOPMENT

**Agents**: > First use the [frontend-developer] to build core components, then use the [rapid-prototyper] to integrate features, then use the [test-writer-fixer] to ensure quality

**Prompt**:
```
You are building the frontend for C1 Northstar Sales Intelligence Platform MVP.

INPUTS:
- Read: .agent-context/02-ui-design/design-system.json
- Read: .agent-context/02-ui-design/components.md
- Read: .agent-context/02-ui-design/mockups.json
- Read: existing Prisma schema and auth configuration

TASKS:
1. Using [frontend-developer]:
   - Set up Next.js 15 with TypeScript and TailwindCSS
   - Configure ShadCN UI with custom theme from design system
   - Build core components:
     * Layout with EntraID auth wrapper
     * Dashboard with real-time job status cards
     * FileUpload component with drag-drop and validation
     * JobQueue table with WebSocket updates
     * AccountExplorer with pagination and search
     * InsightViewer with categorized cards
     * ChatInterface with streaming support
   - Implement state management with Zustand
   - Create API service layer with type-safe contracts
   - Save progress: .agent-context/03-frontend/components-built.md

2. Using [rapid-prototyper]:
   - Wire up all navigation flows
   - Implement real-time WebSocket connections
   - Add file upload with progress tracking
   - Create job submission forms
   - Build CSV export functionality
   - Integrate Flowise chat API
   - Document API requirements: .agent-context/03-frontend/api-contracts.json

3. Using [test-writer-fixer]:
   - Write component tests for critical paths
   - Test file upload validation
   - Test real-time updates
   - Test error handling
   - Ensure accessibility standards
   - Fix any failing tests

OUTPUTS:
- Complete frontend application in src/app and src/components
- api-contracts.json with all required endpoints
- state-management.md documenting frontend architecture
- handoff.md with backend integration requirements

IMPORTANT: Use only the defined features. Do not add extra functionality.
```

---

## PHASE 4: BACKEND DEVELOPMENT

**Agents**: > First use the [backend-architect] to design the API, then use the [devops-automator] to set up infrastructure, then use the [ai-engineer] to integrate AI services, then use the [api-tester] to verify endpoints

**Prompt**:
```
You are building the backend for C1 Northstar Sales Intelligence Platform MVP.

INPUTS:
- Read: .agent-context/03-frontend/api-contracts.json
- Read: existing Prisma schema
- Read: existing CLI processing logic references

TASKS:
1. Using [backend-architect]:
   - Design RESTful API architecture
   - Implement API routes in src/app/api:
     * /api/auth - EntraID integration
     * /api/import - File upload and processing
     * /api/jobs - Job CRUD and monitoring
     * /api/accounts - Account data and search
     * /api/insights - Generated insights retrieval
     * /api/export - CSV generation
   - Set up Redis with BullMQ for job queue
   - Configure Socket.io for real-time updates
   - Implement job processors for:
     * File parsing (CSV, PDF, DOCX, PPTX)
     * Data normalization
     * Vector generation
     * Insight generation
   - Preserve existing CLI processing logic
   - Save: .agent-context/04-backend/api-implemented.md

2. Using [devops-automator]:
   - Set up Docker configuration
   - Configure environment variables
   - Set up Redis and PostgreSQL connections
   - Configure Qdrant vector database connection
   - Implement health check endpoints
   - Create deployment scripts
   - Document: .agent-context/04-backend/deployment.md

3. Using [ai-engineer]:
   - Integrate Flowise API for chat
   - Set up streaming response handling
   - Implement context management for account-specific chats
   - Connect to existing LLM services:
     * Normalization service
     * Embedding service
     * Insight generation service
   - Implement retry logic and error handling
   - Create AI service abstraction layer

4. Using [api-tester]:
   - Test all API endpoints
   - Verify WebSocket connections
   - Test job processing pipeline
   - Load test with 10 concurrent jobs
   - Test file upload limits
   - Verify data integrity
   - Document: .agent-context/04-backend/integration-tests.md

OUTPUTS:
- Complete backend implementation in src/app/api and src/lib
- Docker configuration ready for deployment
- All tests passing
- deployment.md with Azure deployment instructions

CONSTRAINTS:
- Must handle 10 concurrent jobs
- Must support 9,000+ accounts efficiently
- Page loads must be under 2 seconds
- Preserve all existing AI processing capabilities
```