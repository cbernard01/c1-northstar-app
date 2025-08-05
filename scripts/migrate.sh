#!/bin/bash

# Database migration script for C1 Northstar
# Handles database migrations in different environments

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Load environment variables
if [ -f "$PROJECT_ROOT/.env" ]; then
    source "$PROJECT_ROOT/.env"
fi

# Default values
MIGRATION_MODE=${MIGRATION_MODE:-deploy}
BACKUP_ENABLED=${BACKUP_ENABLED:-true}
BACKUP_DIR=${BACKUP_DIR:-"$PROJECT_ROOT/backups"}

echo "C1 Northstar - Database Migration"
echo "================================="

# Function to check if database is accessible
check_database() {
    echo "Checking database connectivity..."
    
    if [ -z "$DATABASE_URL" ]; then
        echo "ERROR: DATABASE_URL is not set"
        exit 1
    fi
    
    # Test connection using npx prisma
    cd "$PROJECT_ROOT"
    if ! npx prisma db execute --stdin <<< "SELECT 1;" >/dev/null 2>&1; then
        echo "ERROR: Cannot connect to database"
        echo "Please ensure the database is running and DATABASE_URL is correct"
        exit 1
    fi
    
    echo "✓ Database connection successful"
}

# Function to create backup
create_backup() {
    if [ "$BACKUP_ENABLED" != "true" ]; then
        echo "Skipping backup (BACKUP_ENABLED=false)"
        return 0
    fi
    
    echo "Creating database backup..."
    
    # Create backup directory
    mkdir -p "$BACKUP_DIR"
    
    # Extract database connection details from DATABASE_URL
    if [[ $DATABASE_URL =~ postgresql://([^:]+):([^@]+)@([^:]+):([0-9]+)/(.+) ]]; then
        DB_USER="${BASH_REMATCH[1]}"
        DB_PASSWORD="${BASH_REMATCH[2]}"
        DB_HOST="${BASH_REMATCH[3]}"
        DB_PORT="${BASH_REMATCH[4]}"
        DB_NAME="${BASH_REMATCH[5]}"
    else
        echo "ERROR: Cannot parse DATABASE_URL"
        exit 1
    fi
    
    # Create backup filename with timestamp
    BACKUP_FILE="$BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).sql"
    
    # Create backup using pg_dump
    export PGPASSWORD="$DB_PASSWORD"
    if pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" > "$BACKUP_FILE"; then
        echo "✓ Backup created: $BACKUP_FILE"
        
        # Compress backup
        gzip "$BACKUP_FILE"
        echo "✓ Backup compressed: $BACKUP_FILE.gz"
        
        # Clean up old backups (keep last 10)
        find "$BACKUP_DIR" -name "backup_*.sql.gz" -type f | sort -r | tail -n +11 | xargs rm -f
        echo "✓ Old backups cleaned up"
    else
        echo "ERROR: Backup failed"
        exit 1
    fi
}

# Function to run migrations
run_migrations() {
    echo "Running database migrations..."
    
    cd "$PROJECT_ROOT"
    
    case "$MIGRATION_MODE" in
        "dev")
            echo "Running development migrations..."
            npx prisma migrate dev
            ;;
        "deploy")
            echo "Running production migrations..."
            npx prisma migrate deploy
            ;;
        "reset")
            echo "WARNING: This will reset the database and apply all migrations"
            read -p "Are you sure? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                npx prisma migrate reset --force
            else
                echo "Migration reset cancelled"
                exit 1
            fi
            ;;
        *)
            echo "ERROR: Invalid migration mode: $MIGRATION_MODE"
            echo "Valid modes: dev, deploy, reset"
            exit 1
            ;;
    esac
    
    echo "✓ Migrations completed successfully"
}

# Function to generate Prisma client
generate_client() {
    echo "Generating Prisma client..."
    
    cd "$PROJECT_ROOT"
    npx prisma generate
    
    echo "✓ Prisma client generated"
}

# Function to seed database
seed_database() {
    echo "Seeding database..."
    
    cd "$PROJECT_ROOT"
    
    # Check if seed script exists
    if [ -f "$PROJECT_ROOT/scripts/seed.sh" ]; then
        bash "$PROJECT_ROOT/scripts/seed.sh"
    elif npm run | grep -q "db:seed"; then
        npm run db:seed
    else
        echo "No seed script found, skipping..."
    fi
    
    echo "✓ Database seeding completed"
}

# Function to verify migrations
verify_migrations() {
    echo "Verifying migration status..."
    
    cd "$PROJECT_ROOT"
    npx prisma migrate status
    
    echo "✓ Migration verification completed"
}

# Function to show database info
show_database_info() {
    echo "Database Information:"
    echo "===================="
    
    cd "$PROJECT_ROOT"
    
    # Show migration status
    echo "Migration Status:"
    npx prisma migrate status
    
    echo ""
    echo "Database Schema:"
    npx prisma db execute --stdin <<< "
        SELECT 
            schemaname,
            tablename,
            tableowner
        FROM pg_tables 
        WHERE schemaname NOT IN ('information_schema', 'pg_catalog')
        ORDER BY schemaname, tablename;
    " 2>/dev/null || echo "Could not retrieve schema information"
}

# Function to restore from backup
restore_backup() {
    local backup_file="$1"
    
    if [ -z "$backup_file" ]; then
        echo "Available backups:"
        ls -la "$BACKUP_DIR"/*.sql.gz 2>/dev/null | tail -10 || echo "No backups found"
        echo ""
        read -p "Enter backup file path: " backup_file
    fi
    
    if [ ! -f "$backup_file" ]; then
        echo "ERROR: Backup file not found: $backup_file"
        exit 1
    fi
    
    echo "WARNING: This will restore the database from backup"
    echo "Current data will be lost!"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Restore cancelled"
        exit 1
    fi
    
    # Extract database connection details
    if [[ $DATABASE_URL =~ postgresql://([^:]+):([^@]+)@([^:]+):([0-9]+)/(.+) ]]; then
        DB_USER="${BASH_REMATCH[1]}"
        DB_PASSWORD="${BASH_REMATCH[2]}"
        DB_HOST="${BASH_REMATCH[3]}"
        DB_PORT="${BASH_REMATCH[4]}"
        DB_NAME="${BASH_REMATCH[5]}"
    else
        echo "ERROR: Cannot parse DATABASE_URL"
        exit 1
    fi
    
    # Restore from backup
    export PGPASSWORD="$DB_PASSWORD"
    
    # Drop and recreate database
    dropdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" --if-exists
    createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME"
    
    # Restore data
    if [[ "$backup_file" == *.gz ]]; then
        gunzip -c "$backup_file" | psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME"
    else
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" < "$backup_file"
    fi
    
    echo "✓ Database restored from backup"
    
    # Regenerate Prisma client
    generate_client
}

# Main function
main() {
    case "${1:-migrate}" in
        "migrate")
            check_database
            create_backup
            run_migrations
            generate_client
            verify_migrations
            echo ""
            echo "Migration completed successfully!"
            ;;
        "dev")
            MIGRATION_MODE="dev"
            check_database
            create_backup
            run_migrations
            generate_client
            verify_migrations
            ;;
        "reset")
            MIGRATION_MODE="reset"
            check_database
            create_backup
            run_migrations
            generate_client
            seed_database
            verify_migrations
            ;;
        "seed")
            check_database
            seed_database
            ;;
        "generate")
            generate_client
            ;;
        "status")
            check_database
            verify_migrations
            ;;
        "info")
            check_database
            show_database_info
            ;;
        "backup")
            check_database
            create_backup
            ;;
        "restore")
            check_database
            restore_backup "$2"
            ;;
        *)
            echo "Usage: $0 [migrate|dev|reset|seed|generate|status|info|backup|restore]"
            echo ""
            echo "Commands:"
            echo "  migrate  - Run migrations in deploy mode (default)"
            echo "  dev      - Run migrations in development mode"
            echo "  reset    - Reset database and run all migrations"
            echo "  seed     - Seed database with initial data"
            echo "  generate - Generate Prisma client"
            echo "  status   - Show migration status"
            echo "  info     - Show database information"
            echo "  backup   - Create database backup"
            echo "  restore  - Restore from backup"
            echo ""
            echo "Environment variables:"
            echo "  MIGRATION_MODE     - Migration mode (dev, deploy, reset)"
            echo "  BACKUP_ENABLED     - Enable backups (true/false)"
            echo "  BACKUP_DIR         - Backup directory path"
            exit 1
            ;;
    esac
}

main "$@"