#!/bin/bash

# Database seeding script for C1 Northstar
# Populates database with initial data for testing and development

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Load environment variables
if [ -f "$PROJECT_ROOT/.env" ]; then
    source "$PROJECT_ROOT/.env"
fi

echo "C1 Northstar - Database Seeding"
echo "==============================="

# Function to check if database is accessible
check_database() {
    echo "Checking database connectivity..."
    
    if [ -z "$DATABASE_URL" ]; then
        echo "ERROR: DATABASE_URL is not set"
        exit 1
    fi
    
    cd "$PROJECT_ROOT"
    if ! npx prisma db execute --stdin <<< "SELECT 1;" >/dev/null 2>&1; then
        echo "ERROR: Cannot connect to database"
        exit 1
    fi
    
    echo "✓ Database connection successful"
}

# Function to seed initial data
seed_data() {
    echo "Seeding initial data..."
    
    cd "$PROJECT_ROOT"
    
    # Use Prisma's seeding mechanism if available
    if npm run | grep -q "db:seed"; then
        echo "Running npm seed script..."
        npm run db:seed
        return 0
    fi
    
    # Otherwise, run manual seeding
    echo "Running manual seed data insertion..."
    
    # Create seed data using Prisma queries
    npx prisma db execute --stdin << 'EOF'
-- Seed data for C1 Northstar Sales Intelligence Platform

-- Insert sample user roles and permissions
INSERT INTO "Role" (id, name, description, permissions, "createdAt", "updatedAt") 
VALUES 
    ('role_admin', 'Administrator', 'Full system access', '["*"]', NOW(), NOW()),
    ('role_manager', 'Sales Manager', 'Manage team and accounts', '["accounts:read", "accounts:write", "reports:read", "team:read"]', NOW(), NOW()),
    ('role_agent', 'Sales Agent', 'Basic access to assigned accounts', '["accounts:read", "reports:read"]', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Insert sample account types
INSERT INTO "AccountType" (id, name, description, "createdAt", "updatedAt")
VALUES 
    ('enterprise', 'Enterprise', 'Large enterprise accounts', NOW(), NOW()),
    ('smb', 'Small/Medium Business', 'Small to medium business accounts', NOW(), NOW()),
    ('startup', 'Startup', 'Early-stage companies', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Insert sample industries
INSERT INTO "Industry" (id, name, description, "createdAt", "updatedAt")
VALUES 
    ('technology', 'Technology', 'Software, hardware, and IT services', NOW(), NOW()),
    ('finance', 'Financial Services', 'Banking, insurance, and fintech', NOW(), NOW()),
    ('healthcare', 'Healthcare', 'Medical devices, pharmaceuticals, and health services', NOW(), NOW()),
    ('manufacturing', 'Manufacturing', 'Industrial and consumer goods manufacturing', NOW(), NOW()),
    ('retail', 'Retail', 'Consumer retail and e-commerce', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Insert sample job types
INSERT INTO "JobType" (id, name, description, priority, "createdAt", "updatedAt")
VALUES 
    ('data_import', 'Data Import', 'Import and process customer data files', 'HIGH', NOW(), NOW()),
    ('lead_scoring', 'Lead Scoring', 'Calculate and update lead scores', 'MEDIUM', NOW(), NOW()),
    ('email_sync', 'Email Sync', 'Synchronize email communications', 'LOW', NOW(), NOW()),
    ('report_generation', 'Report Generation', 'Generate sales reports and analytics', 'MEDIUM', NOW(), NOW()),
    ('data_enrichment', 'Data Enrichment', 'Enrich account data with external sources', 'LOW', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Insert sample configurations
INSERT INTO "Configuration" (key, value, description, "createdAt", "updatedAt")
VALUES 
    ('max_file_size', '10485760', 'Maximum file upload size in bytes (10MB)', NOW(), NOW()),
    ('allowed_file_types', '.pdf,.docx,.xlsx,.csv,.txt', 'Allowed file extensions for uploads', NOW(), NOW()),
    ('lead_score_threshold', '75', 'Minimum score for hot leads', NOW(), NOW()),
    ('data_retention_days', '365', 'Days to retain processed data', NOW(), NOW()),
    ('email_sync_interval', '300', 'Email sync interval in seconds', NOW(), NOW()),
    ('report_cache_ttl', '3600', 'Report cache time-to-live in seconds', NOW(), NOW())
ON CONFLICT (key) DO NOTHING;

-- Insert sample notification templates
INSERT INTO "NotificationTemplate" (id, name, type, subject, body, "isActive", "createdAt", "updatedAt")
VALUES 
    ('welcome_email', 'Welcome Email', 'EMAIL', 'Welcome to C1 Northstar', 'Welcome to the C1 Northstar Sales Intelligence Platform. Get started by uploading your first data file.', true, NOW(), NOW()),
    ('job_completed', 'Job Completed', 'EMAIL', 'Data Processing Complete', 'Your data processing job has completed successfully. {{jobType}} for {{fileName}} is now ready.', true, NOW(), NOW()),
    ('job_failed', 'Job Failed', 'EMAIL', 'Data Processing Failed', 'Your data processing job has failed. Please check the file format and try again. Error: {{error}}', true, NOW(), NOW()),
    ('lead_alert', 'Hot Lead Alert', 'EMAIL', 'New Hot Lead Detected', 'A new hot lead has been identified: {{companyName}} with a score of {{score}}.', true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Insert sample API endpoints for monitoring
INSERT INTO "ApiEndpoint" (path, method, description, "isActive", "rateLimitPerMinute", "createdAt", "updatedAt")
VALUES 
    ('/api/health', 'GET', 'Basic health check endpoint', true, 60, NOW(), NOW()),
    ('/api/health/ready', 'GET', 'Readiness probe endpoint', true, 30, NOW(), NOW()),
    ('/api/upload', 'POST', 'File upload endpoint', true, 10, NOW(), NOW()),
    ('/api/accounts', 'GET', 'List accounts endpoint', true, 120, NOW(), NOW()),
    ('/api/reports', 'GET', 'Reports endpoint', true, 60, NOW(), NOW())
ON CONFLICT (path, method) DO NOTHING;

-- Log seeding completion
INSERT INTO "AuditLog" (action, "entityType", "entityId", details, "createdAt")
VALUES ('SEED_DATA', 'SYSTEM', 'initial_seed', '{"message": "Initial seed data inserted successfully"}', NOW());

EOF

    echo "✓ Manual seed data inserted"
}

# Function to seed test data for development
seed_test_data() {
    echo "Seeding test data for development..."
    
    cd "$PROJECT_ROOT"
    
    npx prisma db execute --stdin << 'EOF'
-- Test data for development environment

-- Insert test users (these would normally come from Azure AD)
INSERT INTO "User" (id, email, name, role, "isActive", "lastLoginAt", "createdAt", "updatedAt")
VALUES 
    ('test_admin', 'admin@c1northstar.com', 'Test Administrator', 'role_admin', true, NOW(), NOW(), NOW()),
    ('test_manager', 'manager@c1northstar.com', 'Test Sales Manager', 'role_manager', true, NOW(), NOW(), NOW()),
    ('test_agent', 'agent@c1northstar.com', 'Test Sales Agent', 'role_agent', true, NOW(), NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Insert test accounts
INSERT INTO "Account" (id, name, domain, industry, "accountType", website, "employeeCount", revenue, location, "assignedTo", "leadScore", status, "createdAt", "updatedAt")
VALUES 
    ('acc_001', 'Acme Corporation', 'acme.com', 'technology', 'enterprise', 'https://acme.com', 5000, 50000000.00, 'San Francisco, CA', 'test_manager', 85, 'ACTIVE', NOW(), NOW()),
    ('acc_002', 'TechStart Inc', 'techstart.io', 'technology', 'startup', 'https://techstart.io', 25, 500000.00, 'Austin, TX', 'test_agent', 72, 'ACTIVE', NOW(), NOW()),
    ('acc_003', 'MegaBank', 'megabank.com', 'finance', 'enterprise', 'https://megabank.com', 15000, 2000000000.00, 'New York, NY', 'test_manager', 91, 'ACTIVE', NOW(), NOW()),
    ('acc_004', 'HealthCorp', 'healthcorp.com', 'healthcare', 'enterprise', 'https://healthcorp.com', 3000, 150000000.00, 'Boston, MA', 'test_agent', 68, 'ACTIVE', NOW(), NOW()),
    ('acc_005', 'RetailPlus', 'retailplus.com', 'retail', 'smb', 'https://retailplus.com', 500, 10000000.00, 'Chicago, IL', 'test_agent', 45, 'INACTIVE', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Insert test contacts
INSERT INTO "Contact" (id, "accountId", "firstName", "lastName", email, phone, title, department, "isDecisionMaker", "lastContactDate", "createdAt", "updatedAt")
VALUES 
    ('con_001', 'acc_001', 'John', 'Smith', 'john.smith@acme.com', '+1-555-0101', 'CTO', 'Technology', true, NOW() - INTERVAL '5 days', NOW(), NOW()),
    ('con_002', 'acc_001', 'Sarah', 'Johnson', 'sarah.johnson@acme.com', '+1-555-0102', 'VP of Sales', 'Sales', true, NOW() - INTERVAL '2 days', NOW(), NOW()),
    ('con_003', 'acc_002', 'Mike', 'Wilson', 'mike@techstart.io', '+1-555-0201', 'CEO', 'Executive', true, NOW() - INTERVAL '1 day', NOW(), NOW()),
    ('con_004', 'acc_003', 'Lisa', 'Brown', 'lisa.brown@megabank.com', '+1-555-0301', 'Director of IT', 'Technology', true, NOW() - INTERVAL '7 days', NOW(), NOW()),
    ('con_005', 'acc_004', 'David', 'Davis', 'david.davis@healthcorp.com', '+1-555-0401', 'CMO', 'Marketing', false, NOW() - INTERVAL '14 days', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Insert test opportunities
INSERT INTO "Opportunity" (id, "accountId", name, value, stage, probability, "expectedCloseDate", "assignedTo", "createdAt", "updatedAt")
VALUES 
    ('opp_001', 'acc_001', 'Enterprise Software License', 250000.00, 'NEGOTIATION', 75, NOW() + INTERVAL '30 days', 'test_manager', NOW(), NOW()),
    ('opp_002', 'acc_002', 'Startup Package', 15000.00, 'PROPOSAL', 60, NOW() + INTERVAL '45 days', 'test_agent', NOW(), NOW()),
    ('opp_003', 'acc_003', 'Banking Platform Integration', 500000.00, 'DISCOVERY', 25, NOW() + INTERVAL '90 days', 'test_manager', NOW(), NOW()),
    ('opp_004', 'acc_004', 'Healthcare Analytics', 75000.00, 'QUALIFIED', 40, NOW() + INTERVAL '60 days', 'test_agent', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Insert test activities
INSERT INTO "Activity" (id, "accountId", "contactId", "opportunityId", type, subject, description, "scheduledAt", "completedAt", "assignedTo", status, "createdAt", "updatedAt")
VALUES 
    ('act_001', 'acc_001', 'con_001', 'opp_001', 'CALL', 'Technical Discussion', 'Discuss integration requirements and timeline', NOW() + INTERVAL '2 days', NULL, 'test_manager', 'SCHEDULED', NOW(), NOW()),
    ('act_002', 'acc_002', 'con_003', 'opp_002', 'EMAIL', 'Follow-up on Proposal', 'Send updated proposal with pricing', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day', 'test_agent', 'COMPLETED', NOW(), NOW()),
    ('act_003', 'acc_003', 'con_004', 'opp_003', 'MEETING', 'Discovery Call', 'Initial discovery meeting with stakeholders', NOW() + INTERVAL '7 days', NULL, 'test_manager', 'SCHEDULED', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Insert test jobs
INSERT INTO "Job" (id, type, status, priority, data, progress, result, "createdBy", "createdAt", "updatedAt", "completedAt")
VALUES 
    ('job_001', 'data_import', 'COMPLETED', 'HIGH', '{"fileName": "accounts_import.csv", "recordCount": 150}', 100, '{"imported": 148, "skipped": 2, "errors": []}', 'test_manager', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour'),
    ('job_002', 'lead_scoring', 'RUNNING', 'MEDIUM', '{"accountIds": ["acc_001", "acc_002", "acc_003"]}', 66, NULL, 'system', NOW() - INTERVAL '30 minutes', NOW(), NULL),
    ('job_003', 'report_generation', 'PENDING', 'LOW', '{"reportType": "monthly_sales", "period": "2024-01"}', 0, NULL, 'test_agent', NOW() - INTERVAL '10 minutes', NOW(), NULL)
ON CONFLICT (id) DO NOTHING;

-- Log test data seeding
INSERT INTO "AuditLog" (action, "entityType", "entityId", details, "createdAt")
VALUES ('SEED_TEST_DATA', 'SYSTEM', 'test_seed', '{"message": "Test data inserted successfully for development"}', NOW());

EOF

    echo "✓ Test data inserted for development"
}

# Function to seed production-safe data
seed_production_data() {
    echo "Seeding production-safe initial data..."
    
    cd "$PROJECT_ROOT"
    
    npx prisma db execute --stdin << 'EOF'
-- Production-safe seed data (no test users or sensitive data)

-- Essential configuration for production
INSERT INTO "Configuration" (key, value, description, "createdAt", "updatedAt")
VALUES 
    ('system_initialized', 'true', 'System initialization flag', NOW(), NOW()),
    ('app_version', '1.0.0', 'Application version', NOW(), NOW()),
    ('maintenance_mode', 'false', 'System maintenance mode flag', NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET 
    value = EXCLUDED.value,
    "updatedAt" = NOW();

-- Log production seeding
INSERT INTO "AuditLog" (action, "entityType", "entityId", details, "createdAt")
VALUES ('SEED_PRODUCTION', 'SYSTEM', 'prod_seed', '{"message": "Production seed data initialized"}', NOW());

EOF

    echo "✓ Production-safe data inserted"
}

# Function to verify seeded data
verify_seed() {
    echo "Verifying seeded data..."
    
    cd "$PROJECT_ROOT"
    
    # Count records in key tables
    npx prisma db execute --stdin << 'EOF' | grep -E "count|role|config"
SELECT 'Roles' as table_name, COUNT(*) as count FROM "Role"
UNION ALL
SELECT 'Account Types' as table_name, COUNT(*) as count FROM "AccountType"
UNION ALL
SELECT 'Industries' as table_name, COUNT(*) as count FROM "Industry"
UNION ALL
SELECT 'Job Types' as table_name, COUNT(*) as count FROM "JobType"
UNION ALL
SELECT 'Configurations' as table_name, COUNT(*) as count FROM "Configuration"
UNION ALL
SELECT 'Notification Templates' as table_name, COUNT(*) as count FROM "NotificationTemplate"
ORDER BY table_name;
EOF

    echo "✓ Seed verification completed"
}

# Main function
main() {
    case "${1:-seed}" in
        "seed")
            check_database
            seed_data
            if [ "$NODE_ENV" != "production" ]; then
                seed_test_data
            else
                seed_production_data
            fi
            verify_seed
            echo ""
            echo "Database seeding completed successfully!"
            ;;
        "production")
            check_database
            seed_data
            seed_production_data
            verify_seed
            echo ""
            echo "Production database seeding completed!"
            ;;
        "test")
            check_database
            seed_data
            seed_test_data
            verify_seed
            echo ""
            echo "Test database seeding completed!"
            ;;
        "verify")
            check_database
            verify_seed
            ;;
        "clean")
            echo "WARNING: This will remove all seeded data"
            read -p "Are you sure? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                cd "$PROJECT_ROOT"
                npx prisma db execute --stdin << 'EOF'
-- Clean up seed data (be careful in production!)
DELETE FROM "AuditLog" WHERE action LIKE 'SEED_%';
DELETE FROM "Activity" WHERE id LIKE 'act_%';
DELETE FROM "Opportunity" WHERE id LIKE 'opp_%';
DELETE FROM "Contact" WHERE id LIKE 'con_%';
DELETE FROM "Account" WHERE id LIKE 'acc_%';
DELETE FROM "User" WHERE id LIKE 'test_%';
-- Keep configurations and templates as they're essential
EOF
                echo "✓ Seed data cleaned up"
            else
                echo "Clean up cancelled"
            fi
            ;;
        *)
            echo "Usage: $0 [seed|production|test|verify|clean]"
            echo ""
            echo "Commands:"
            echo "  seed       - Seed database with initial data (default)"
            echo "  production - Seed with production-safe data only"
            echo "  test       - Seed with test data for development"
            echo "  verify     - Verify seeded data"
            echo "  clean      - Remove seeded test data"
            echo ""
            echo "Environment variables:"
            echo "  NODE_ENV   - Environment (production skips test data)"
            exit 1
            ;;
    esac
}

main "$@"