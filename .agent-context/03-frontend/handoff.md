# Frontend Integration Handoff

## Overview

The C1 Northstar Sales Intelligence Platform frontend is now fully integrated with navigation flows, real-time features, and advanced functionality. This document provides a complete handoff to the backend development team with all requirements and specifications.

## ✅ Completed Integration Tasks

### 1. Navigation and Routing
- ✅ **Enhanced Middleware**: Protected all app routes (`/accounts`, `/insights`, `/jobs`, `/upload`, `/reports`, `/chat`)
- ✅ **Breadcrumb Navigation**: Automatic breadcrumb generation with manual override support
- ✅ **Loading States**: Navigation loading indicators and back button support
- ✅ **Route Protection**: Automatic redirect to sign-in for unauthenticated users

### 2. Real-time Features
- ✅ **WebSocket Service**: Full WebSocket implementation with reconnection logic
- ✅ **Job Status Updates**: Real-time job progress and status updates
- ✅ **System Notifications**: Toast notifications for job completion/failure
- ✅ **Connection Management**: Automatic fallback to SSE when WebSocket unavailable

### 3. File Upload System
- ✅ **Chunked Upload**: Large file support with 2MB chunks
- ✅ **Progress Tracking**: Real-time upload progress for individual and batch uploads
- ✅ **Drag & Drop**: Enhanced drag-and-drop interface with validation
- ✅ **Upload Management**: Cancel, retry, and bulk operations
- ✅ **File Validation**: Type, size, and extension validation

### 4. Job Management
- ✅ **Job Submission Forms**: Multi-step job creation with templates
- ✅ **Job Templates**: Pre-configured templates for common operations
- ✅ **Advanced Configuration**: Scheduling, notifications, and custom settings
- ✅ **Form Validation**: Comprehensive form validation with error handling

### 5. Export Functionality
- ✅ **CSV Export Service**: Client-side and server-side export generation
- ✅ **Export Templates**: Pre-configured export formats for different data types
- ✅ **Bulk Export**: Multiple export jobs with progress tracking
- ✅ **Export History**: Track and manage export history

### 6. AI Chat Integration
- ✅ **Flowise Integration**: Mock integration with comprehensive chat service
- ✅ **Context Awareness**: Account-specific chat context
- ✅ **Message Streaming**: Real-time message streaming support
- ✅ **Session Management**: Multiple chat sessions with persistence

### 7. Enhanced UI Components
- ✅ **Form Components**: Label, Textarea, Select, RadioGroup, Checkbox
- ✅ **Loading Indicators**: Contextual loading states throughout the app
- ✅ **Error Handling**: Comprehensive error display and recovery
- ✅ **Progress Indicators**: Upload and job progress visualization

## 📋 Backend Requirements

### Required API Endpoints

The frontend expects the following API endpoints to be implemented. Full specifications are in `api-contracts.json`.

#### Authentication
- `GET /api/auth/session` - Current user session

#### Jobs
- `GET /api/jobs` - List jobs with pagination/filtering
- `POST /api/jobs` - Create new job
- `GET /api/jobs/{id}` - Get job details
- `DELETE /api/jobs/{id}` - Cancel job
- `POST /api/jobs/{id}/retry` - Retry failed job
- `GET /api/jobs/{id}/logs` - Get job logs
- `GET /api/jobs/{id}/download` - Download job result
- `GET /api/jobs/stream` - SSE for job updates
- `POST /api/jobs/bulk-delete` - Bulk delete jobs
- `POST /api/jobs/bulk-retry` - Bulk retry jobs
- `GET /api/jobs/stats` - Job statistics

#### Accounts
- `GET /api/accounts` - List accounts with search/filtering
- `POST /api/accounts` - Create account
- `GET /api/accounts/{id}` - Get account details
- `PUT /api/accounts/{id}` - Update account
- `DELETE /api/accounts/{id}` - Delete account
- `GET /api/accounts/{id}/insights` - Get account insights
- `GET /api/accounts/{id}/technologies` - Get account technologies
- `POST /api/accounts/bulk-update` - Bulk update accounts
- `POST /api/accounts/bulk-delete` - Bulk delete accounts

#### File Upload
- `POST /api/upload` - Simple file upload
- `POST /api/upload/init` - Initialize chunked upload
- `POST /api/upload/chunk` - Upload file chunk
- `POST /api/upload/complete` - Complete chunked upload
- `GET /api/upload/{id}/status` - Get upload status
- `GET /api/upload/{id}/result` - Get processing result
- `GET /api/upload/{id}/download` - Download processed data
- `POST /api/upload/{id}/retry` - Retry processing
- `DELETE /api/upload/{id}` - Delete upload
- `GET /api/upload/history` - Upload history
- `POST /api/upload/bulk-delete` - Bulk delete uploads
- `GET /api/upload/stats` - Upload statistics

#### Insights
- `GET /api/insights` - List insights with filtering
- `POST /api/insights` - Create insight
- `GET /api/insights/{id}` - Get insight details
- `PUT /api/insights/{id}` - Update insight
- `DELETE /api/insights/{id}` - Delete insight
- `POST /api/insights/{id}/bookmark` - Bookmark insight
- `DELETE /api/insights/{id}/bookmark` - Remove bookmark
- `GET /api/insights/categories` - Get categories

#### Export
- `POST /api/export` - Create export job
- `GET /api/export/{id}` - Get export status
- `DELETE /api/export/{id}` - Cancel export
- `GET /api/export/{id}/download` - Download export
- `POST /api/export/preview` - Preview export data
- `GET /api/export/history` - Export history
- `POST /api/export/bulk` - Bulk export

#### Chat (Mock Integration)
- `GET /api/chat/sessions` - List chat sessions
- `POST /api/chat/sessions` - Create chat session
- `GET /api/chat/sessions/{id}` - Get chat session
- `DELETE /api/chat/sessions/{id}` - Delete chat session
- `POST /api/chat/sessions/{id}/messages` - Send message
- `POST /api/chat/stream` - Stream chat response

#### Reports
- `GET /api/reports` - List reports
- `GET /api/reports/{id}` - Get report data
- `GET /api/reports/dashboard` - Dashboard metrics

### WebSocket Events

The frontend expects these WebSocket events on `ws://localhost:3001/ws`:

#### Incoming Events
- `job-update` - Job status/progress updates
- `notification` - System notifications
- `account-updated` - Account data changes
- `insight-generated` - New insights
- `system-status` - System status updates

#### Outgoing Events
- `get-job-status` - Request job status
- `join-job-room` - Subscribe to job updates
- `leave-job-room` - Unsubscribe from job updates

### Database Schema Requirements

Based on the frontend data models, the following database entities are required:

#### Users
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  image TEXT,
  role VARCHAR(50) DEFAULT 'user',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Jobs
```sql
CREATE TABLE jobs (
  id UUID PRIMARY KEY,
  type VARCHAR(50) NOT NULL, -- 'account_analysis', 'data_export', 'insight_generation'
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'queued', -- 'queued', 'running', 'completed', 'failed', 'pending'
  progress INTEGER DEFAULT 0, -- 0-100
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  failed_at TIMESTAMP,
  error_message TEXT,
  result JSONB,
  metadata JSONB,
  created_by UUID REFERENCES users(id)
);
```

#### Accounts
```sql
CREATE TABLE accounts (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  domain VARCHAR(255),
  industry VARCHAR(100),
  size VARCHAR(50),
  location VARCHAR(255),
  description TEXT,
  website VARCHAR(255),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Technologies
```sql
CREATE TABLE technologies (
  id UUID PRIMARY KEY,
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  version VARCHAR(50),
  confidence DECIMAL(3,2), -- 0.00-1.00
  source VARCHAR(100),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### Insights
```sql
CREATE TABLE insights (
  id UUID PRIMARY KEY,
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  type VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  confidence DECIMAL(3,2), -- 0.00-1.00
  category VARCHAR(100),
  tags TEXT[],
  is_bookmarked BOOLEAN DEFAULT FALSE,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### File Uploads
```sql
CREATE TABLE file_uploads (
  id UUID PRIMARY KEY,
  original_name VARCHAR(255) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_size BIGINT NOT NULL,
  file_type VARCHAR(100) NOT NULL,
  status VARCHAR(50) DEFAULT 'uploading', -- 'uploading', 'processing', 'completed', 'failed'
  progress INTEGER DEFAULT 0,
  uploaded_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  failed_at TIMESTAMP,
  error_message TEXT,
  processing_job_id UUID REFERENCES jobs(id),
  result JSONB,
  uploaded_by UUID REFERENCES users(id)
);
```

#### Export Jobs
```sql
CREATE TABLE export_jobs (
  id UUID PRIMARY KEY,
  type VARCHAR(50) NOT NULL, -- 'accounts', 'insights', 'jobs', 'reports'
  format VARCHAR(10) NOT NULL, -- 'csv', 'xlsx', 'json'
  status VARCHAR(50) DEFAULT 'queued', -- 'queued', 'processing', 'completed', 'failed'
  progress INTEGER DEFAULT 0,
  filters JSONB,
  columns TEXT[],
  include_metadata BOOLEAN DEFAULT FALSE,
  date_range JSONB,
  file_path TEXT,
  file_size BIGINT,
  record_count INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  error_message TEXT,
  created_by UUID REFERENCES users(id)
);
```

#### Chat Sessions
```sql
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  context JSONB, -- { accountId, accountName }
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

CREATE TABLE chat_messages (
  id UUID PRIMARY KEY,
  session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL, -- 'user', 'assistant', 'system'
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 🔧 Required Environment Variables

### Production Environment
```env
# Required
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=your-nextauth-secret
DATABASE_URL=postgresql://user:password@host:port/database
AZURE_AD_CLIENT_ID=your-azure-ad-client-id
AZURE_AD_CLIENT_SECRET=your-azure-ad-client-secret
AZURE_AD_TENANT_ID=your-azure-ad-tenant-id

# Optional
FLOWISE_API_URL=http://localhost:3000
FLOWISE_CHATFLOW_ID=default-flow
FLOWISE_API_KEY=your-flowise-api-key
WEBSOCKET_URL=ws://localhost:3001/ws
REDIS_URL=redis://localhost:6379
FILE_STORAGE_URL=https://your-storage-url
MAX_FILE_SIZE=52428800  # 50MB
MAX_FILES_PER_UPLOAD=10
```

### Development Environment
```env
# Required
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=development-secret
DATABASE_URL=postgresql://postgres:password@localhost:5432/northstar_dev
AZURE_AD_CLIENT_ID=your-dev-azure-ad-client-id
AZURE_AD_CLIENT_SECRET=your-dev-azure-ad-client-secret
AZURE_AD_TENANT_ID=your-azure-ad-tenant-id

# Optional
FLOWISE_API_URL=http://localhost:3000
WEBSOCKET_URL=ws://localhost:3001/ws
```

## 🚀 Deployment Configuration

### Next.js Configuration

The application requires these Next.js configuration updates:

```javascript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client']
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false
    }
    return config
  },
  async rewrites() {
    return [
      {
        source: '/api/ws',
        destination: process.env.WEBSOCKET_URL || 'ws://localhost:3001/ws'
      }
    ]
  }
}

module.exports = nextConfig
```

### Docker Configuration

```dockerfile
# Dockerfile
FROM node:18-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --only=production

FROM node:18-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT 3000

CMD ["node", "server.js"]
```

## 📊 Performance Requirements

### Response Time Targets
- Page load: < 2 seconds
- API responses: < 500ms
- File upload: Real-time progress updates
- WebSocket latency: < 100ms
- Export generation: Progress updates every 2 seconds

### Scalability Requirements
- Support 100+ concurrent users
- Handle file uploads up to 50MB
- Process batch jobs efficiently
- Maintain WebSocket connections reliably

## 🔍 Testing Requirements

### API Testing
All endpoints should include:
- Unit tests for business logic
- Integration tests for API endpoints
- Load testing for file upload/export
- WebSocket connection testing

### Database Testing
- Migration testing
- Performance testing for large datasets
- Data integrity testing
- Backup/restore testing

## 🛡️ Security Requirements

### Authentication
- Microsoft Entra ID (Azure AD) integration
- JWT token validation
- Session management

### Authorization
- Role-based access control
- Resource-level permissions
- API rate limiting

### Data Security
- Input validation and sanitization
- File upload security scanning
- SQL injection prevention
- XSS protection

## 📈 Monitoring Requirements

### Application Monitoring
- API endpoint performance
- Database query performance
- WebSocket connection health
- File upload/processing metrics

### Business Metrics
- User engagement
- Job success/failure rates
- File processing times
- Export usage patterns

## 🔄 Development Workflow

### API Development Process
1. Implement endpoint according to API contract
2. Add comprehensive error handling
3. Include input validation
4. Add logging and monitoring
5. Write tests
6. Update API documentation

### Database Migration Process
1. Create migration scripts
2. Test on development environment
3. Backup production database
4. Run migration with rollback plan
5. Verify data integrity

## 📞 Support and Handoff

### Technical Contacts
- **Frontend Lead**: Integration specifications and requirements
- **DevOps**: Deployment and infrastructure setup
- **QA**: Testing scenarios and acceptance criteria

### Documentation
- ✅ API Contracts: `api-contracts.json`
- ✅ State Management: `state-management.md`
- ✅ Component Documentation: `components-built.md`
- ✅ User Flows: `../01-ux-planning/user-flows.md`
- ✅ Design System: `../02-ui-design/brand-guidelines.md`

### Next Steps
1. **Backend Team**: Implement API endpoints per specification
2. **DevOps Team**: Set up production infrastructure
3. **QA Team**: Create test plans based on user flows
4. **Product Team**: Review and approve functionality

## ⚠️ Known Limitations

### Current Limitations
- WebSocket service uses mock implementation
- Chat service uses mock Flowise integration
- File storage uses local filesystem (needs cloud storage)
- No real-time notifications persistence
- Limited offline support

### Future Enhancements
- Push notifications
- Offline data synchronization
- Advanced caching strategies
- Real-time collaboration features
- Mobile app support

## 🎯 Success Criteria

The integration is considered successful when:
- ✅ All navigation flows work seamlessly
- ✅ Real-time updates function correctly
- ✅ File uploads process with progress tracking
- ✅ Job submission and monitoring work end-to-end
- ✅ Export functionality generates correct files
- ✅ Chat integration provides meaningful responses
- ✅ All error states are handled gracefully
- ✅ Performance meets specified targets
- ✅ Security requirements are satisfied

---

**Status**: Frontend Integration Complete ✅  
**Next Phase**: Backend API Implementation  
**Timeline**: Ready for backend development to begin  
**Priority**: High - Critical path for MVP launch