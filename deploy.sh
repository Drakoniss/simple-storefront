#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== StoreFront Kubernetes Deploy ===${NC}"

# Check kubeconfig
if [ ! -f ~/.kube/config ]; then
    echo -e "${RED}Error: ~/.kube/config not found${NC}"
    exit 1
fi

# Check docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker not installed${NC}"
    exit 1
fi

# Check terraform
if ! command -v terraform &> /dev/null; then
    echo -e "${RED}Error: Terraform not installed${NC}"
    exit 1
fi

# Build Docker image
echo -e "${YELLOW}Building Docker image...${NC}"
cd "$(dirname "$0")"
docker build -t rasprilla/storefront:latest .

# Push to Docker Hub
echo -e "${YELLOW}Pushing to Docker Hub...${NC}"
if [ -z "$DOCKER_USERNAME" ] || [ -z "$DOCKER_PASSWORD" ]; then
    echo -e "${YELLOW}Warning: DOCKER_USERNAME or DOCKER_PASSWORD not set. Assuming already logged in.${NC}"
else
    echo "$DOCKER_PASSWORD" | docker login -u "$DOCKER_USERNAME" --password-stdin
fi
docker push rasprilla/storefront:latest

# Apply Terraform
echo -e "${YELLOW}Applying Terraform...${NC}"
cd infrastructure/terraform
terraform init
terraform apply -auto-approve

# Show status
echo -e "${GREEN}=== Deployment Complete ===${NC}"
echo -e "${YELLOW}Pods:${NC}"
kubectl get pods -n storefront
echo -e "${YELLOW}Service:${NC}"
kubectl get svc -n storefront

echo -e "${GREEN}Waiting for LoadBalancer IP...${NC}"
sleep 5
kubectl get svc storefront-svc -n storefront -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "IP not yet assigned"
echo