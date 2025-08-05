# C1 Northstar MVP - Locked Feature Scope

## Core Features (DO NOT ADD BEYOND THIS LIST)

### 1. Authentication & Session Management
- Microsoft EntraID SSO integration
- JWT token management
- Session persistence
- Basic user profile display

### 2. File Import System
- Drag-and-drop upload interface for CSV, PDF, DOCX, PPTX
- File validation with real-time feedback
- Import type selection (Accounts, Products, Assets, Opportunities)
- Upload progress tracking
- Import history with status indicators

### 3. Job Queue Dashboard
- Job creation interface with type selection
- Real-time job status monitoring (WebSocket)
- Progress bars and completion percentages
- Job history with filtering
- Error display and retry options
- Support for 10 parallel jobs

### 4. Account Explorer
- Paginated account list (9,000+ accounts)
- Search and filter capabilities
- Account detail views with:
  - Technology stack visualization
  - Opportunity timeline
  - AI-generated insights display
  - Processing status indicators

### 5. Results Viewer
- Categorized insight display:
  - Customer Ecosystem
  - Customer Value
  - Customer Interests
  - Next Steps
- Confidence score visualization
- Evidence linking
- Export to CSV functionality

### 6. AI Chat Interface
- Flowise-powered streaming chat
- Account-specific context
- Chat history persistence
- Source attribution in responses

## Out of Scope for MVP
- Multi-tenancy
- Advanced reporting dashboards
- Mobile optimization
- External CRM integrations
- Automated/scheduled jobs
- Advanced export formats (PDF, Excel)