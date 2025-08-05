#!/bin/bash

# Azure Container Instances deployment script for C1 Northstar
# This script deploys the application to Azure Container Instances

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Load environment variables
if [ -f "$PROJECT_ROOT/.env" ]; then
    source "$PROJECT_ROOT/.env"
fi

# Required environment variables
REQUIRED_VARS=(
    "AZURE_SUBSCRIPTION_ID"
    "AZURE_RESOURCE_GROUP"
    "AZURE_LOCATION"
    "AZURE_CONTAINER_REGISTRY"
    "DATABASE_URL"
    "REDIS_HOST"
    "NEXTAUTH_SECRET"
    "AUTH_MICROSOFT_ENTRA_ID_ID"
    "AUTH_MICROSOFT_ENTRA_ID_SECRET"
    "AUTH_MICROSOFT_ENTRA_ID_TENANT_ID"
)

# Default values
AZURE_LOCATION=${AZURE_LOCATION:-eastus}
CONTAINER_GROUP_NAME=${CONTAINER_GROUP_NAME:-c1-northstar-app}
IMAGE_TAG=${IMAGE_TAG:-latest}
CPU_CORES=${CPU_CORES:-2}
MEMORY_GB=${MEMORY_GB:-4}
WORKER_REPLICAS=${WORKER_REPLICAS:-2}

echo "C1 Northstar - Azure Container Instances Deployment"
echo "=================================================="

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to validate required tools
validate_tools() {
    echo "Validating required tools..."
    
    if ! command_exists az; then
        echo "ERROR: Azure CLI is not installed. Please install it first."
        echo "Visit: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
        exit 1
    fi
    
    if ! command_exists docker; then
        echo "ERROR: Docker is not installed. Please install it first."
        exit 1
    fi
    
    echo "✓ All required tools are available"
}

# Function to validate environment variables
validate_environment() {
    echo "Validating environment variables..."
    
    missing_vars=()
    for var in "${REQUIRED_VARS[@]}"; do
        if [ -z "${!var}" ]; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -ne 0 ]; then
        echo "ERROR: Missing required environment variables:"
        printf " - %s\n" "${missing_vars[@]}"
        echo ""
        echo "Please set these variables in your .env file or environment."
        exit 1
    fi
    
    echo "✓ All required environment variables are set"
}

# Function to login to Azure
azure_login() {
    echo "Checking Azure login status..."
    
    if ! az account show >/dev/null 2>&1; then
        echo "Logging in to Azure..."
        az login
    fi
    
    echo "Setting subscription: $AZURE_SUBSCRIPTION_ID"
    az account set --subscription "$AZURE_SUBSCRIPTION_ID"
    
    echo "✓ Azure authentication complete"
}

# Function to create resource group if it doesn't exist
create_resource_group() {
    echo "Checking resource group: $AZURE_RESOURCE_GROUP"
    
    if ! az group show --name "$AZURE_RESOURCE_GROUP" >/dev/null 2>&1; then
        echo "Creating resource group: $AZURE_RESOURCE_GROUP"
        az group create \
            --name "$AZURE_RESOURCE_GROUP" \
            --location "$AZURE_LOCATION"
    fi
    
    echo "✓ Resource group ready"
}

# Function to build and push Docker images
build_and_push_images() {
    echo "Building and pushing Docker images..."
    
    # Login to container registry
    echo "Logging in to container registry: $AZURE_CONTAINER_REGISTRY"
    az acr login --name "${AZURE_CONTAINER_REGISTRY%%.*}"
    
    # Build application image
    echo "Building application image..."
    docker build -t "$AZURE_CONTAINER_REGISTRY/c1-northstar-app:$IMAGE_TAG" "$PROJECT_ROOT"
    
    # Push application image
    echo "Pushing application image..."
    docker push "$AZURE_CONTAINER_REGISTRY/c1-northstar-app:$IMAGE_TAG"
    
    echo "✓ Docker images built and pushed"
}

# Function to deploy container instances
deploy_containers() {
    echo "Deploying container instances..."
    
    # Generate deployment YAML
    cat > "$SCRIPT_DIR/azure-deployment.yaml" << EOF
apiVersion: 2021-03-01
location: $AZURE_LOCATION
name: $CONTAINER_GROUP_NAME
properties:
  containers:
  - name: c1-northstar-app
    properties:
      image: $AZURE_CONTAINER_REGISTRY/c1-northstar-app:$IMAGE_TAG
      resources:
        requests:
          cpu: $CPU_CORES
          memoryInGb: $MEMORY_GB
      ports:
      - port: 3000
        protocol: TCP
      - port: 3001
        protocol: TCP
      environmentVariables:
      - name: NODE_ENV
        value: production
      - name: DATABASE_URL
        secureValue: $DATABASE_URL
      - name: REDIS_HOST
        value: $REDIS_HOST
      - name: REDIS_PORT
        value: ${REDIS_PORT:-6379}
      - name: REDIS_PASSWORD
        secureValue: ${REDIS_PASSWORD:-}
      - name: QDRANT_HOST
        value: ${QDRANT_HOST:-}
      - name: QDRANT_PORT
        value: ${QDRANT_PORT:-6333}
      - name: NEXTAUTH_URL
        value: $NEXTAUTH_URL
      - name: NEXTAUTH_SECRET
        secureValue: $NEXTAUTH_SECRET
      - name: AUTH_MICROSOFT_ENTRA_ID_ID
        secureValue: $AUTH_MICROSOFT_ENTRA_ID_ID
      - name: AUTH_MICROSOFT_ENTRA_ID_SECRET
        secureValue: $AUTH_MICROSOFT_ENTRA_ID_SECRET
      - name: AUTH_MICROSOFT_ENTRA_ID_TENANT_ID
        secureValue: $AUTH_MICROSOFT_ENTRA_ID_TENANT_ID
      - name: AZURE_STORAGE_ACCOUNT
        value: ${AZURE_STORAGE_ACCOUNT:-}
      - name: AZURE_STORAGE_KEY
        secureValue: ${AZURE_STORAGE_KEY:-}
      - name: AZURE_CONTAINER_NAME
        value: ${AZURE_CONTAINER_NAME:-northstar-uploads}
      - name: LOG_LEVEL
        value: ${LOG_LEVEL:-info}
      - name: ENABLE_METRICS
        value: ${ENABLE_METRICS:-true}
  osType: Linux
  restartPolicy: Always
  ipAddress:
    type: Public
    ports:
    - protocol: TCP
      port: 3000
    - protocol: TCP
      port: 3001
    dnsNameLabel: $CONTAINER_GROUP_NAME
  imageRegistryCredentials:
  - server: $AZURE_CONTAINER_REGISTRY
    username: ${AZURE_CONTAINER_REGISTRY%%.*}
    password: $(az acr credential show --name ${AZURE_CONTAINER_REGISTRY%%.*} --query passwords[0].value -o tsv)
tags:
  environment: production
  application: c1-northstar
  version: $IMAGE_TAG
type: Microsoft.ContainerInstance/containerGroups
EOF

    # Deploy the container group
    echo "Deploying container group: $CONTAINER_GROUP_NAME"
    az container create \
        --resource-group "$AZURE_RESOURCE_GROUP" \
        --file "$SCRIPT_DIR/azure-deployment.yaml"
    
    # Deploy worker containers
    for i in $(seq 1 "$WORKER_REPLICAS"); do
        worker_name="$CONTAINER_GROUP_NAME-worker-$i"
        echo "Deploying worker container: $worker_name"
        
        az container create \
            --resource-group "$AZURE_RESOURCE_GROUP" \
            --name "$worker_name" \
            --image "$AZURE_CONTAINER_REGISTRY/c1-northstar-app:$IMAGE_TAG" \
            --cpu "$CPU_CORES" \
            --memory "$MEMORY_GB" \
            --restart-policy Always \
            --command-line "node scripts/start-workers.js" \
            --environment-variables \
                NODE_ENV=production \
                REDIS_HOST="$REDIS_HOST" \
                REDIS_PORT="${REDIS_PORT:-6379}" \
                QDRANT_HOST="${QDRANT_HOST:-}" \
                QDRANT_PORT="${QDRANT_PORT:-6333}" \
                WORKER_CONCURRENCY="${WORKER_CONCURRENCY:-4}" \
                LOG_LEVEL="${LOG_LEVEL:-info}" \
            --secure-environment-variables \
                DATABASE_URL="$DATABASE_URL" \
                REDIS_PASSWORD="${REDIS_PASSWORD:-}" \
                AZURE_STORAGE_ACCOUNT="${AZURE_STORAGE_ACCOUNT:-}" \
                AZURE_STORAGE_KEY="${AZURE_STORAGE_KEY:-}" \
            --registry-login-server "$AZURE_CONTAINER_REGISTRY" \
            --registry-username "${AZURE_CONTAINER_REGISTRY%%.*}" \
            --registry-password "$(az acr credential show --name ${AZURE_CONTAINER_REGISTRY%%.*} --query passwords[0].value -o tsv)"
    done
    
    echo "✓ Container instances deployed"
}

# Function to get deployment status
get_deployment_status() {
    echo "Getting deployment status..."
    
    # Get main application status
    az container show \
        --resource-group "$AZURE_RESOURCE_GROUP" \
        --name "$CONTAINER_GROUP_NAME" \
        --query "{name:name,state:containers[0].instanceView.currentState.state,fqdn:ipAddress.fqdn,ip:ipAddress.ip}" \
        --output table
    
    # Get worker status
    for i in $(seq 1 "$WORKER_REPLICAS"); do
        worker_name="$CONTAINER_GROUP_NAME-worker-$i"
        echo ""
        echo "Worker $i status:"
        az container show \
            --resource-group "$AZURE_RESOURCE_GROUP" \
            --name "$worker_name" \
            --query "{name:name,state:containers[0].instanceView.currentState.state}" \
            --output table 2>/dev/null || echo "Worker $i not found"
    done
    
    echo ""
    echo "Application URL: http://$(az container show --resource-group "$AZURE_RESOURCE_GROUP" --name "$CONTAINER_GROUP_NAME" --query ipAddress.fqdn -o tsv)"
}

# Function to show logs
show_logs() {
    echo "Recent application logs:"
    az container logs \
        --resource-group "$AZURE_RESOURCE_GROUP" \
        --name "$CONTAINER_GROUP_NAME" \
        --tail 50
}

# Main deployment flow
main() {
    case "${1:-deploy}" in
        "deploy")
            validate_tools
            validate_environment
            azure_login
            create_resource_group
            build_and_push_images
            deploy_containers
            echo ""
            echo "Deployment complete!"
            get_deployment_status
            ;;
        "status")
            azure_login
            get_deployment_status
            ;;
        "logs")
            azure_login
            show_logs
            ;;
        "clean")
            azure_login
            echo "Cleaning up deployment..."
            az container delete --resource-group "$AZURE_RESOURCE_GROUP" --name "$CONTAINER_GROUP_NAME" --yes
            for i in $(seq 1 "$WORKER_REPLICAS"); do
                worker_name="$CONTAINER_GROUP_NAME-worker-$i"
                az container delete --resource-group "$AZURE_RESOURCE_GROUP" --name "$worker_name" --yes 2>/dev/null || true
            done
            echo "Cleanup complete!"
            ;;
        *)
            echo "Usage: $0 [deploy|status|logs|clean]"
            echo ""
            echo "Commands:"
            echo "  deploy  - Deploy the application (default)"
            echo "  status  - Show deployment status"
            echo "  logs    - Show recent logs"
            echo "  clean   - Remove all containers"
            exit 1
            ;;
    esac
}

main "$@"