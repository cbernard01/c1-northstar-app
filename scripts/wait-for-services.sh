#!/bin/bash

# Wait for services to be ready before starting the application
# This script is used in Docker containers to ensure dependencies are available

set -e

POSTGRES_HOST=${POSTGRES_HOST:-postgres}
POSTGRES_PORT=${POSTGRES_PORT:-5432}
POSTGRES_USER=${POSTGRES_USER:-northstar}
POSTGRES_DB=${POSTGRES_DB:-northstar_db}

REDIS_HOST=${REDIS_HOST:-redis}
REDIS_PORT=${REDIS_PORT:-6379}

QDRANT_HOST=${QDRANT_HOST:-qdrant}
QDRANT_PORT=${QDRANT_PORT:-6333}

TIMEOUT=${WAIT_TIMEOUT:-60}

echo "Waiting for services to be ready..."

# Function to wait for a service
wait_for_service() {
    local host=$1
    local port=$2
    local service_name=$3
    local timeout=$4
    
    echo "Waiting for $service_name at $host:$port..."
    
    for i in $(seq 1 "$timeout"); do
        if nc -z "$host" "$port" 2>/dev/null; then
            echo "$service_name is ready!"
            return 0
        fi
        echo "Waiting for $service_name... ($i/$timeout)"
        sleep 1
    done
    
    echo "ERROR: $service_name at $host:$port is not ready after $timeout seconds"
    return 1
}

# Function to wait for PostgreSQL specifically
wait_for_postgres() {
    echo "Waiting for PostgreSQL to accept connections..."
    
    for i in $(seq 1 "$TIMEOUT"); do
        if pg_isready -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" 2>/dev/null; then
            echo "PostgreSQL is ready!"
            return 0
        fi
        echo "Waiting for PostgreSQL... ($i/$TIMEOUT)"
        sleep 1
    done
    
    echo "ERROR: PostgreSQL is not ready after $TIMEOUT seconds"
    return 1
}

# Function to wait for Redis
wait_for_redis() {
    echo "Waiting for Redis..."
    
    for i in $(seq 1 "$TIMEOUT"); do
        if redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping 2>/dev/null | grep -q PONG; then
            echo "Redis is ready!"
            return 0
        fi
        echo "Waiting for Redis... ($i/$TIMEOUT)"
        sleep 1
    done
    
    echo "ERROR: Redis is not ready after $TIMEOUT seconds"
    return 1
}

# Function to wait for Qdrant
wait_for_qdrant() {
    echo "Waiting for Qdrant..."
    
    for i in $(seq 1 "$TIMEOUT"); do
        if curl -sf "http://$QDRANT_HOST:$QDRANT_PORT/health" >/dev/null 2>&1; then
            echo "Qdrant is ready!"
            return 0
        fi
        echo "Waiting for Qdrant... ($i/$TIMEOUT)"
        sleep 1
    done
    
    echo "ERROR: Qdrant is not ready after $TIMEOUT seconds"
    return 1
}

# Install required tools if not available
if ! command -v nc >/dev/null 2>&1; then
    echo "Installing netcat..."
    apk add --no-cache netcat-openbsd 2>/dev/null || apt-get update && apt-get install -y netcat-openbsd 2>/dev/null || yum install -y nc 2>/dev/null || true
fi

if ! command -v pg_isready >/dev/null 2>&1; then
    echo "Installing postgresql-client..."
    apk add --no-cache postgresql-client 2>/dev/null || apt-get update && apt-get install -y postgresql-client 2>/dev/null || yum install -y postgresql 2>/dev/null || true
fi

if ! command -v redis-cli >/dev/null 2>&1; then
    echo "Installing redis-tools..."
    apk add --no-cache redis 2>/dev/null || apt-get update && apt-get install -y redis-tools 2>/dev/null || yum install -y redis 2>/dev/null || true
fi

if ! command -v curl >/dev/null 2>&1; then
    echo "Installing curl..."
    apk add --no-cache curl 2>/dev/null || apt-get update && apt-get install -y curl 2>/dev/null || yum install -y curl 2>/dev/null || true
fi

# Wait for all services
echo "Starting service availability checks..."

# PostgreSQL is critical
if ! wait_for_postgres; then
    exit 1
fi

# Redis is critical
if ! wait_for_redis; then
    exit 1
fi

# Qdrant is optional but recommended
if ! wait_for_qdrant; then
    echo "WARNING: Qdrant is not available. Vector search features may not work."
    echo "Continuing startup without Qdrant..."
fi

echo "All critical services are ready!"
echo "Application can now start safely."