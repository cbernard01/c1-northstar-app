# Database Migration Guide: RSF Integration

This guide explains the database schema updates required to integrate the C1 Northstar Sales Intelligence Platform with the RSF prototype data processing pipeline.

## Overview of Changes

The schema has been extended with the following new models and enhancements:

### New Models Added

1. **ProcessingJob** - Enhanced job tracking for data processing pipelines
2. **ProcessingStage** - Granular tracking of job processing stages
3. **Product** - Product catalog from RSF prototype
4. **Opportunity** - Sales opportunities tracking
5. **PurchaseProduct** - Many-to-many relationship between opportunities and products
6. **Document** - Enhanced document tracking beyond basic uploads
7. **VectorChunk** - Vector embeddings and chunk management

### Enhanced Models

1. **CompanyAccount** - Added normalized summary fields and RSF business fields
2. **User** - Added processing jobs and document relations
3. **JobType** - Extended with new processing types
4. **JobStatus** - Added PAUSED status

### New Enums

1. **ProcessingJobType** - Specific job types for import and processing operations
2. **DocumentStatus** - Document processing lifecycle states
3. **DocumentScope** - Document categorization for vector search

## Migration Commands

### Step 1: Generate Migration

```bash
# Generate the migration file
npx prisma migrate dev --name "add-rsf-models"
```

This will create a new migration file in `prisma/migrations/` with the schema changes.

### Step 2: Apply Migration

```bash
# Apply the migration to your database
npx prisma migrate deploy
```

### Step 3: Generate Updated Client

```bash
# Generate the updated Prisma client
npx prisma generate
```

### Step 4: Verify Migration

```bash
# Check the database schema
npx prisma db pull
```

## Development Setup

### Local Development

1. **Start your PostgreSQL database** (via Docker Compose):
```bash
docker-compose up -d postgres
```

2. **Run migrations**:
```bash
npm run db:migrate
```

3. **Seed initial data** (optional):
```bash
npm run db:seed
```

### Environment Variables

Add these new environment variables to your `.env` file:

```env
# Vector Database Configuration
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=northstar_vectors
QDRANT_VECTOR_DIMENSIONS=768
QDRANT_DISTANCE_METRIC=Cosine

# LLM Configuration
LLM_INSIGHT_SERVER_URL=http://localhost:11434
LLM_INSIGHT_MODEL=llama3.1:8b
LLM_EMBEDDING_SERVER_URL=http://localhost:11434
LLM_EMBEDDING_MODEL=nomic-embed-text

# File Processing
MAX_FILE_SIZE=50000000
UPLOAD_DIR=./uploads
PROCESSING_TEMP_DIR=./temp
```

## Data Model Relationships

### Core Business Flow

```
User → ProcessingJob → Document → VectorChunk
                    ↓
CompanyAccount → Opportunity → PurchaseProduct → Product
```

### Key Relationships

- **Users** can have multiple processing jobs and documents
- **CompanyAccounts** can have opportunities, vector chunks, and insights
- **Opportunities** link to accounts and can have multiple products via PurchaseProduct
- **Documents** can be chunked into multiple VectorChunks for vector search
- **VectorChunks** can reference either documents or accounts as sources

## Index Strategy

The schema includes strategic indexes for:

1. **Performance**: Frequent query patterns (userId, status, dates)
2. **Uniqueness**: Business keys (accountNumber, opportunityNumber, itemNumber)
3. **Search**: Vector search metadata (scope, sourceType, contentHash)
4. **Analytics**: Reporting fields (revenue, stages, categories)

## Post-Migration Steps

### 1. Update TypeScript Types

```bash
# This will automatically update types after prisma generate
npm run type-check
```

### 2. Create Seed Data (Optional)

Create `prisma/seed.ts` with sample data:

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create sample products
  await prisma.product.createMany({
    data: [
      {
        itemNumber: 'PROD-001',
        itemDescription: 'Sample Product 1',
        itemManufacturer: 'Sample Corp',
        itemCategory: 'Software',
        currentCost: 1000.00
      }
      // Add more sample data...
    ]
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
```

### 3. Test the Schema

Create a test script to verify the new models work:

```typescript
// test-schema.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testNewModels() {
  // Test ProcessingJob creation
  const job = await prisma.processingJob.create({
    data: {
      type: 'IMPORT_ACCOUNTS',
      title: 'Test Import Job',
      userId: 'your-user-id'
    }
  });
  
  console.log('Created job:', job);
  
  // Test CompanyAccount with new fields
  const account = await prisma.companyAccount.create({
    data: {
      name: 'Test Company',
      accountNumber: 'ACC-001',
      gemStatus: 'Active',
      targetSolutions: 'UC, CC'
    }
  });
  
  console.log('Created account:', account);
}

testNewModels().catch(console.error).finally(() => prisma.$disconnect());
```

## Rollback Plan

If you need to rollback the migration:

```bash
# Reset to previous migration
npx prisma migrate reset

# Or manually rollback specific migration
npx prisma migrate resolve --rolled-back "migration-name"
```

## Next Steps

After successful migration:

1. **Implement Service Classes**: Create services for handling the new models
2. **Add API Endpoints**: Build REST APIs for the new data operations
3. **Create UI Components**: Build React components for managing the new data
4. **Set up Vector Database**: Install and configure Qdrant for vector search
5. **Implement Processing Pipeline**: Create the job processing system

## Troubleshooting

### Common Issues

1. **Migration fails**: Check database connectivity and permissions
2. **Constraint violations**: Ensure existing data doesn't conflict with new unique constraints
3. **Type errors**: Run `npx prisma generate` after successful migration

### Validation Commands

```bash
# Validate schema syntax
npx prisma validate

# Check migration status
npx prisma migrate status

# View database schema
npx prisma studio
```

## Support

For issues with this migration:

1. Check the Prisma documentation: https://www.prisma.io/docs/
2. Review the RSF prototype implementation in `docs/prototype-technical-analysis.md`
3. Contact the development team for assistance

---

**Important**: Always backup your database before running migrations in production!