-- Database initialization script for C1 Northstar
-- This script runs when the PostgreSQL container starts for the first time

-- Create extensions if they don't exist
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- Create custom types
DO $$ BEGIN
    CREATE TYPE job_status AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE job_priority AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE account_status AS ENUM ('ACTIVE', 'INACTIVE', 'PROSPECT', 'CLOSED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE opportunity_stage AS ENUM ('LEAD', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE activity_type AS ENUM ('CALL', 'EMAIL', 'MEETING', 'TASK', 'NOTE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE activity_status AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Performance optimization settings
-- These settings are applied when the database is first created
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
ALTER SYSTEM SET max_connections = '200';
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = '0.9';
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = '100';
ALTER SYSTEM SET random_page_cost = '1.1';
ALTER SYSTEM SET effective_io_concurrency = '200';

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create a function for full-text search
CREATE OR REPLACE FUNCTION create_search_vector(title TEXT, description TEXT)
RETURNS tsvector AS $$
BEGIN
    RETURN to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(description, ''));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create indexes for better performance (these will be created after Prisma migration)
-- Note: Actual indexes will be created by Prisma migrations
-- This is just documentation of recommended indexes

-- Log successful initialization
DO $$ 
BEGIN
    RAISE NOTICE 'C1 Northstar database initialization completed successfully';
    RAISE NOTICE 'Extensions created: uuid-ossp, pg_trgm, btree_gin, btree_gist';
    RAISE NOTICE 'Custom types created: job_status, job_priority, account_status, etc.';
    RAISE NOTICE 'Performance settings applied';
    RAISE NOTICE 'Utility functions created: update_updated_at_column, create_search_vector';
END $$;