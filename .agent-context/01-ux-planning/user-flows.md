# C1 Northstar MVP - User Flows & Journey Maps

## Overview
This document defines the 6 primary user flows for the C1 Northstar Sales Intelligence Platform MVP, focusing on the transition from CLI to web interface for sales teams.

## User Context
**Primary Users**: Sales professionals transitioning from CLI-based tools to web interface
**Core Need**: Efficient access to account intelligence with visual feedback and streamlined workflows
**Key Challenge**: Maintaining CLI efficiency while gaining web interface benefits

---

## 1. File Upload and Import Workflow

### User Goals & Motivations
- **Primary Goal**: Import new data (Accounts, Products, Assets, Opportunities) efficiently
- **Motivation**: Replace manual CLI file commands with visual drag-and-drop interface
- **Success Criteria**: Files uploaded and validated within 2 minutes

### Journey Map

#### Stage 1: File Preparation
**Actions**: User gathers files (CSV, PDF, DOCX, PPTX) for import
**Thoughts**: "I need to make sure these files are in the right format"
**Emotions**: Cautious (want to avoid errors)
**Pain Points**: 
- No CLI command to validate format beforehand
- Uncertainty about file size limits (100MB max)

#### Stage 2: Upload Interface Access
**Actions**: Navigate to import section, select import type
**Thoughts**: "This should be clearer than remembering CLI flags"
**Emotions**: Hopeful
**Touchpoints**: Navigation menu, import type selector
**Opportunities**: Clear visual indicators for supported formats

#### Stage 3: File Upload
**Actions**: Drag and drop files or browse to select
**Thoughts**: "Much easier than typing file paths"
**Emotions**: Satisfied with visual feedback
**Pain Points**:
- Loss of batch upload capability from CLI
- No command-line progress indicators they're used to

#### Stage 4: Validation & Processing
**Actions**: Review file validation results, confirm import
**Thoughts**: "I can see exactly what's wrong instead of parsing error logs"
**Emotions**: Relief when validation passes, frustration with errors
**Success Metrics**: 
- Validation feedback within 10 seconds
- Clear error messaging
- 95% first-time validation success rate

#### Stage 5: Import Confirmation
**Actions**: Monitor import progress, view completion status
**Thoughts**: "I can see progress instead of wondering if it crashed"
**Emotions**: Confidence in system reliability
**Opportunities**: Real-time progress updates, estimated completion time

---

## 2. Job Creation and Monitoring Workflow

### User Goals & Motivations
- **Primary Goal**: Create and monitor processing jobs with real-time visibility
- **Motivation**: Replace CLI job scheduling with visual queue management
- **Success Criteria**: Jobs created and monitored without CLI context switching

### Journey Map

#### Stage 1: Job Planning
**Actions**: Determine job type (Import, Normalization, Vectorization, Insight generation, Export)
**Thoughts**: "I used to just chain these commands together"
**Emotions**: Uncertainty about optimal job sequencing
**Pain Points**: Loss of command chaining capabilities

#### Stage 2: Job Creation
**Actions**: Select job type, configure parameters, submit to queue
**Thoughts**: "The interface guides me through options I had to remember"
**Emotions**: Appreciation for guided process
**Touchpoints**: Job type selector, parameter forms, submission button
**Opportunities**: Job templates for common workflows

#### Stage 3: Queue Monitoring
**Actions**: View job queue status, monitor parallel execution (max 10 jobs)
**Thoughts**: "I can see all jobs at once instead of checking each individually"
**Emotions**: Control and visibility
**Success Metrics**:
- Real-time status updates within 1 second
- Clear queue position indicators
- Visual progress bars

#### Stage 4: Progress Tracking
**Actions**: Monitor individual job progress, view completion percentages
**Thoughts**: "Much better than tailing log files"
**Emotions**: Confidence in job completion
**Pain Points**: No CLI shortcuts to jump between jobs

#### Stage 5: Error Handling
**Actions**: Review error messages, use retry options
**Thoughts**: "Error details are clearer than CLI stack traces"
**Emotions**: Less frustration with debugging
**Opportunities**: One-click retry with parameter adjustment

---

## 3. Account Exploration Workflow

### User Goals & Motivations
- **Primary Goal**: Explore and analyze 9,000+ accounts efficiently
- **Motivation**: Visual account exploration vs. CLI grep/search commands
- **Success Criteria**: Find relevant accounts within 30 seconds

### Journey Map

#### Stage 1: Account Discovery
**Actions**: Access account list, apply initial filters
**Thoughts**: "I need to find accounts matching specific criteria"
**Emotions**: Overwhelmed by volume (9,000+ accounts)
**Pain Points**: 
- Loss of CLI grep patterns and regex searches
- Need to learn new filter interface

#### Stage 2: Search & Filter
**Actions**: Use search functionality, apply multiple filters
**Thoughts**: "Visual filters are more intuitive than command flags"
**Emotions**: Growing confidence with interface
**Touchpoints**: Search bar, filter panels, pagination controls
**Success Metrics**: Search results within 2 seconds

#### Stage 3: Account Selection
**Actions**: Browse paginated results, select accounts of interest
**Thoughts**: "I can see more account details at a glance"
**Emotions**: Satisfaction with visual overview
**Opportunities**: Saved search criteria, bulk selection tools

#### Stage 4: Account Deep Dive
**Actions**: View account details, technology stack, opportunity timeline
**Thoughts**: "This visualization beats text dumps from CLI"
**Emotions**: Delight with data presentation
**Touchpoints**: Detail views, interactive visualizations

#### Stage 5: Context Building
**Actions**: Review AI-generated insights, processing status
**Thoughts**: "I can see the complete picture in one place"
**Emotions**: Confidence in account understanding
**Pain Points**: No CLI command to export this view for sharing

---

## 4. Insight Review and Export Workflow

### User Goals & Motivations
- **Primary Goal**: Review AI insights and export relevant data
- **Motivation**: Replace CLI data extraction with visual insight exploration
- **Success Criteria**: Export actionable insights within 5 minutes

### Journey Map

#### Stage 1: Insight Access
**Actions**: Navigate to results viewer, select insight categories
**Thoughts**: "I need to find the most relevant insights quickly"
**Emotions**: Expectation for organized information
**Touchpoints**: Category tabs (Customer Ecosystem, Value, Interests, Next Steps)

#### Stage 2: Insight Review
**Actions**: Review categorized insights, check confidence scores
**Thoughts**: "Confidence scores help me prioritize better than CLI output"
**Emotions**: Trust in AI recommendations
**Pain Points**: No CLI shortcuts to filter by confidence threshold

#### Stage 3: Evidence Validation
**Actions**: Follow evidence links, verify insight sources
**Thoughts**: "I can trace back to source data easily"
**Emotions**: Confidence in insight accuracy
**Opportunities**: Visual evidence trails, source highlighting

#### Stage 4: Export Preparation
**Actions**: Select insights for export, choose CSV format
**Thoughts**: "I used to pipe this to different tools"
**Emotions**: Adaptation to new workflow
**Pain Points**: Limited to CSV export (no PDF/Excel in MVP)

#### Stage 5: Export Generation
**Actions**: Generate export, download file (must complete within 30 seconds)
**Thoughts**: "At least I get a progress indicator"
**Emotions**: Relief when export completes successfully
**Success Metrics**: Export generation under 30 seconds for full dataset

---

## 5. AI Chat Interaction Workflow

### User Goals & Motivations
- **Primary Goal**: Get contextual answers about specific accounts
- **Motivation**: Interactive Q&A vs. static CLI outputs
- **Success Criteria**: Relevant answers with source attribution

### Journey Map

#### Stage 1: Chat Initiation
**Actions**: Open AI chat interface, select account context
**Thoughts**: "I can ask natural language questions instead of constructing queries"
**Emotions**: Excitement about conversational interface
**Touchpoints**: Chat panel, account context selector

#### Stage 2: Question Formulation
**Actions**: Type questions about account insights, technology, opportunities
**Thoughts**: "This is much more natural than CLI syntax"
**Emotions**: Confidence in communication method
**Pain Points**: No command history or shortcuts from CLI habits

#### Stage 3: Response Processing
**Actions**: Read streaming responses, follow source attributions
**Thoughts**: "I can see where this information comes from"
**Emotions**: Trust in AI responses
**Opportunities**: Response history, bookmarking useful answers

#### Stage 4: Follow-up Interaction
**Actions**: Ask clarifying questions, drill down into details
**Thoughts**: "I can have a conversation instead of running new commands"
**Emotions**: Appreciation for interactive exploration
**Success Metrics**: Response relevance, source accuracy

#### Stage 5: Knowledge Capture
**Actions**: Review chat history, extract actionable insights
**Thoughts**: "I need to remember this conversation for later"
**Emotions**: Concern about information retention
**Pain Points**: No easy way to export or share chat insights

---

## 6. Dashboard Navigation Workflow

### User Goals & Motivations
- **Primary Goal**: Efficiently navigate between different system functions
- **Motivation**: Unified interface vs. multiple CLI tools and scripts
- **Success Criteria**: Access any function within 3 clicks

### Journey Map

#### Stage 1: System Entry
**Actions**: Login via Microsoft EntraID SSO, access main dashboard
**Thoughts**: "Single sign-on is better than managing CLI credentials"
**Emotions**: Appreciation for streamlined authentication
**Touchpoints**: SSO login, dashboard landing page

#### Stage 2: Function Discovery
**Actions**: Explore navigation menu, understand available functions
**Thoughts**: "I need to learn where everything is located"
**Emotions**: Initial disorientation from CLI muscle memory
**Pain Points**: No CLI tab completion or help commands

#### Stage 3: Context Switching
**Actions**: Move between import, jobs, accounts, results, and chat
**Thoughts**: "I used to switch contexts with command aliases"
**Emotions**: Adaptation to visual navigation
**Opportunities**: Breadcrumb navigation, quick access shortcuts

#### Stage 4: Multi-tasking
**Actions**: Monitor jobs while exploring accounts, chat while reviewing insights
**Thoughts**: "I can see multiple things at once instead of terminal windows"
**Emotions**: Appreciation for visual multitasking
**Success Metrics**: Page load times under 2 seconds

#### Stage 5: Session Management
**Actions**: Maintain work context across sessions, resume activities
**Thoughts**: "My work state persists between sessions"
**Emotions**: Confidence in system reliability
**Opportunities**: Session state restoration, bookmarked workflows

---

## Critical Pain Points: CLI to Web Transition

### 1. Command Efficiency Loss
- **CLI Advantage**: Single commands for complex operations
- **Web Challenge**: Multi-step processes through forms
- **Mitigation**: Keyboard shortcuts, batch operations

### 2. Muscle Memory Disruption
- **CLI Advantage**: Memorized command patterns and aliases
- **Web Challenge**: Visual navigation learning curve
- **Mitigation**: Search functionality, consistent navigation patterns

### 3. Scripting and Automation Loss
- **CLI Advantage**: Scriptable workflows, command chaining
- **Web Challenge**: Manual point-and-click operations
- **Mitigation**: Job templates, workflow presets

### 4. Output Control Loss
- **CLI Advantage**: Precise output formatting, piping to other tools
- **Web Challenge**: Fixed visual presentations
- **Mitigation**: Multiple export formats, customizable views

### 5. Speed Perception
- **CLI Advantage**: Immediate feedback, text-based speed
- **Web Challenge**: Loading states, visual processing
- **Mitigation**: Real-time updates, progress indicators

## Success Metrics by Flow

### File Upload Success
- Validation feedback: <10 seconds
- Upload completion: <2 minutes for 100MB files
- First-time success rate: >95%

### Job Monitoring Success
- Status update latency: <1 second
- Queue visibility: All 10 parallel jobs visible
- Error resolution time: <5 minutes average

### Account Exploration Success
- Search response time: <2 seconds
- Account detail load: <2 seconds
- Filter application: <1 second

### Insight Export Success
- Export generation: <30 seconds for full dataset
- Insight relevance score: >85% user satisfaction
- Evidence traceability: 100% of insights linked

### AI Chat Success
- Response streaming: Real-time with <1 second start
- Source attribution: 100% of responses
- Context accuracy: >90% user satisfaction

### Navigation Success
- Any function access: <3 clicks
- Page load time: <2 seconds
- Session persistence: 100% across browser sessions

## Implementation Priorities

### Phase 1: Core Workflows (Week 1-2)
1. Dashboard navigation foundation
2. File upload with validation
3. Basic job queue monitoring

### Phase 2: Data Exploration (Week 3-4)
1. Account exploration with search/filter
2. Results viewer with categorized insights
3. Export functionality

### Phase 3: AI Enhancement (Week 5-6)
1. AI chat interface with streaming
2. Context-aware responses
3. Source attribution

This user flow analysis provides the foundation for creating a web interface that respects CLI user habits while leveraging the advantages of visual interfaces for sales intelligence workflows.