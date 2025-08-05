# C1 Northstar Sales Intelligence Platform - Deployment Guide

## Overview

This document provides comprehensive deployment instructions for the C1 Northstar Sales Intelligence Platform, including Docker containerization, Azure Container Instances deployment, and infrastructure management.

## Architecture

The platform consists of the following components:

- **Next.js Application**: Main web application (port 3000)
- **WebSocket Server**: Real-time communication (port 3001)
- **Job Workers**: Background job processing (BullMQ)
- **PostgreSQL**: Primary database
- **Redis**: Cache and job queue
- **Qdrant**: Vector database for AI features
- **Nginx**: Load balancer and reverse proxy (production)

## Environment Configuration

### Required Environment Variables

Copy `.env.example` to `.env` and configure the following:

#### Application Settings
```bash
NODE_ENV=production
PORT=3000
WEBSOCKET_PORT=3001
LOG_LEVEL=info
ENABLE_METRICS=true
```

#### Database Configuration
```bash
DATABASE_URL=postgresql://user:password@host:5432/database
POSTGRES_USER=northstar
POSTGRES_PASSWORD=secure_password
POSTGRES_DB=northstar_db
```

#### Redis Configuration
```bash
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=redis_password
```

#### Qdrant Configuration
```bash
QDRANT_HOST=your-qdrant-host
QDRANT_PORT=6333
QDRANT_API_KEY=optional_api_key
```

#### Authentication
```bash
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=your-32-character-secret
AUTH_MICROSOFT_ENTRA_ID_ID=your-client-id
AUTH_MICROSOFT_ENTRA_ID_SECRET=your-client-secret
AUTH_MICROSOFT_ENTRA_ID_TENANT_ID=your-tenant-id
```

#### Azure Storage (Production)
```bash
AZURE_STORAGE_ACCOUNT=your-storage-account
AZURE_STORAGE_KEY=your-storage-key
AZURE_CONTAINER_NAME=northstar-uploads
```

## Local Development

### Using Docker Compose

1. **Start all services**:
   ```bash
   docker-compose up -d
   ```

2. **View logs**:
   ```bash
   docker-compose logs -f app
   ```

3. **Stop services**:
   ```bash
   docker-compose down
   ```

### Database Operations

1. **Run migrations**:
   ```bash
   ./scripts/migrate.sh
   ```

2. **Seed database**:
   ```bash
   ./scripts/seed.sh
   ```

3. **Create backup**:
   ```bash
   ./scripts/migrate.sh backup
   ```

## Production Deployment

### Azure Container Instances Setup

#### Prerequisites

1. **Azure CLI**: Install and configure
   ```bash
   az login
   az account set --subscription your-subscription-id
   ```

2. **Container Registry**: Create Azure Container Registry
   ```bash
   az acr create --resource-group northstar-rg \
     --name northstarregistry --sku Basic
   ```

#### Deployment Process

1. **Configure environment variables**:
   ```bash
   export AZURE_SUBSCRIPTION_ID=your-subscription-id
   export AZURE_RESOURCE_GROUP=northstar-rg
   export AZURE_LOCATION=eastus
   export AZURE_CONTAINER_REGISTRY=northstarregistry.azurecr.io
   ```

2. **Deploy the application**:
   ```bash
   ./scripts/deploy.sh
   ```

3. **Check deployment status**:
   ```bash
   ./scripts/deploy.sh status
   ```

#### Manual Azure Setup

If you prefer manual setup:

1. **Create Resource Group**:
   ```bash
   az group create --name northstar-rg --location eastus
   ```

2. **Create Container Registry**:
   ```bash
   az acr create --resource-group northstar-rg \
     --name northstarregistry --sku Standard \
     --admin-enabled true
   ```

3. **Create PostgreSQL Server**:
   ```bash
   az postgres flexible-server create \
     --resource-group northstar-rg \
     --name northstar-db-server \
     --admin-user northstar \
     --admin-password SecurePassword123! \
     --sku-name Standard_D2s_v3 \
     --storage-size 128 \
     --version 14
   ```

4. **Create Redis Cache**:
   ```bash
   az redis create \
     --resource-group northstar-rg \
     --name northstar-redis \
     --location eastus \
     --sku Standard \
     --vm-size c1
   ```

5. **Deploy Container Instances**:
   ```bash
   az container create \
     --resource-group northstar-rg \
     --name c1-northstar-app \
     --image northstarregistry.azurecr.io/c1-northstar-app:latest \
     --cpu 2 --memory 4 \
     --ports 3000 3001 \
     --environment-variables NODE_ENV=production \
     --secure-environment-variables DATABASE_URL=$DATABASE_URL
   ```

## Scaling Configuration

### Horizontal Scaling

1. **Application Replicas**:
   ```bash
   export APP_REPLICAS=3
   docker-compose -f docker-compose.prod.yml up -d --scale app=3
   ```

2. **Worker Replicas**:
   ```bash
   export WORKER_REPLICAS=2
   export WORKER_CONCURRENCY=4
   ```

### Resource Limits

Configure resource limits in `docker-compose.prod.yml`:

```yaml
deploy:
  resources:
    limits:
      memory: 1G
      cpus: '1.0'
    reservations:
      memory: 512M
      cpus: '0.5'
```

## Health Checks and Monitoring

### Health Check Endpoints

- **Basic Health**: `GET /api/health`
- **Database Health**: `GET /api/health/db`
- **Redis Health**: `GET /api/health/redis`
- **Readiness Probe**: `GET /api/health/ready`

### Monitoring Setup

1. **Application Metrics**: Available at `/api/metrics`
2. **Container Health Checks**: Configured in Docker
3. **Log Aggregation**: Structured JSON logging

### Monitoring Commands

```bash
# Check container health
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# View application logs
docker-compose logs -f app

# Monitor resource usage
docker stats

# Check health endpoints
curl http://localhost:3000/api/health/ready
```

## Backup and Restore

### Database Backup

1. **Automated Backup**:
   ```bash
   # Runs daily at 2 AM (configured in cron)
   ./scripts/migrate.sh backup
   ```

2. **Manual Backup**:
   ```bash
   ./scripts/migrate.sh backup
   ```

3. **Restore from Backup**:
   ```bash
   ./scripts/migrate.sh restore /path/to/backup.sql.gz
   ```

### Volume Backup

```bash
# Backup Docker volumes
docker run --rm -v postgres_data:/data -v $(pwd)/backups:/backup \
  alpine tar czf /backup/postgres_data_$(date +%Y%m%d).tar.gz -C /data .

docker run --rm -v redis_data:/data -v $(pwd)/backups:/backup \
  alpine tar czf /backup/redis_data_$(date +%Y%m%d).tar.gz -C /data .
```

## Security Configuration

### SSL/TLS Setup

1. **Generate SSL Certificates**:
   ```bash
   mkdir -p scripts/ssl
   openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
     -keyout scripts/ssl/key.pem \
     -out scripts/ssl/cert.pem
   ```

2. **Update Nginx Configuration**:
   - Uncomment HTTPS server block in `scripts/nginx.conf`
   - Configure certificate paths

### Security Headers

The Nginx configuration includes:
- HTTPS enforcement
- Security headers (CSP, HSTS, etc.)
- Rate limiting
- DDoS protection

## Troubleshooting

### Common Issues

1. **Database Connection Issues**:
   ```bash
   # Check database connectivity
   docker-compose exec app npx prisma db execute --stdin <<< "SELECT 1;"
   
   # Check database logs
   docker-compose logs postgres
   ```

2. **Redis Connection Issues**:
   ```bash
   # Test Redis connection
   docker-compose exec redis redis-cli ping
   
   # Check Redis logs
   docker-compose logs redis
   ```

3. **Memory Issues**:
   ```bash
   # Check container memory usage
   docker stats
   
   # Increase memory limits in docker-compose.yml
   ```

4. **Job Processing Issues**:
   ```bash
   # Check worker logs
   docker-compose logs worker
   
   # Monitor job queue
   docker-compose exec redis redis-cli monitor
   ```

### Performance Tuning

1. **Database Optimization**:
   - Enable connection pooling
   - Configure appropriate indexes
   - Monitor slow queries

2. **Redis Optimization**:
   - Configure memory limits
   - Enable AOF persistence
   - Monitor memory usage

3. **Application Optimization**:
   - Enable caching
   - Configure CDN
   - Optimize bundle size

## Deployment Commands Quick Reference

```bash
# Local development
docker-compose up -d
./scripts/migrate.sh
./scripts/seed.sh

# Production deployment
./scripts/deploy.sh
./scripts/deploy.sh status
./scripts/deploy.sh logs

# Database operations
./scripts/migrate.sh
./scripts/migrate.sh backup
./scripts/migrate.sh restore backup.sql.gz

# Worker management
docker-compose logs worker
docker-compose restart worker

# Health checks
curl http://localhost:3000/api/health/ready
curl http://localhost:3000/api/health/db
curl http://localhost:3000/api/health/redis
```

## Support and Maintenance

### Log Locations

- Application logs: `/app/logs/`
- Nginx logs: `/var/log/nginx/`
- Container logs: `docker-compose logs [service]`

### Maintenance Tasks

1. **Weekly**:
   - Review error logs
   - Check disk usage
   - Monitor performance metrics

2. **Monthly**:
   - Update dependencies
   - Review security patches
   - Clean up old backups

3. **Quarterly**:
   - Performance review
   - Security audit
   - Disaster recovery test

For additional support, refer to the application documentation and Azure Container Instances documentation.