# Technology Stack

## Frontend
- Next.js 15.x
- TypeScript 5.x
- TailwindCSS 3.x
- ShadCN UI (latest)
- Zustand (state management)
- Socket.io-client (WebSocket)

## Backend
- Next.js API Routes
- Prisma ORM (existing schema - DO NOT MODIFY)
- PostgreSQL (existing database)
- Redis + BullMQ (job queue)
- Socket.io (real-time updates)

## AI & Vector Services
- Flowise API (chat interface)
- Qdrant (existing vector database)
- Existing LLM services:
  - Normalization service
  - Embedding service  
  - Insight generation service

## Authentication
- Microsoft EntraID (already configured)
- NextAuth.js

## Deployment
- Docker
- Azure Container Instance
- Local storage volumes