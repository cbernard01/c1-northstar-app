# Performance & Scale Constraints

## User Capacity
- Maximum concurrent users: <10
- Single-tenant architecture
- No role-based permissions for MVP

## Processing Capacity  
- Parallel job execution: 10 jobs maximum
- Job types supported:
  - Import (CSV, PDF, DOCX, PPTX)
  - Normalization
  - Vectorization
  - Insight generation
  - Export

## Data Scale
- Total accounts: 9,000+
- Must handle efficient pagination
- Search across all accounts
- Bulk operations on multiple accounts

## Performance Requirements
- Page load time: <2 seconds
- Real-time updates: <1 second latency
- File upload: Support files up to 100MB
- Export generation: <30 seconds for full dataset

## Infrastructure Limits
- Single Docker container deployment
- Local storage (no cloud storage for MVP)
- Single Redis instance
- Single PostgreSQL database (existing)
- Single Qdrant instance (existing)