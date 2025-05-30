#!/bin/bash
set -e

# Deploy DAVE to Kubernetes
# Usage: ./deploy-k8s.sh [namespace]

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

NAMESPACE=${1:-dave}
KUBECTL=${KUBECTL:-kubectl}

echo -e "${GREEN}Deploying DAVE to Kubernetes...${NC}"
echo "Namespace: $NAMESPACE"

# Check if kubectl is available
if ! command -v $KUBECTL &> /dev/null; then
    echo -e "${RED}kubectl not found. Please install kubectl first.${NC}"
    exit 1
fi

# Check if connected to a cluster
if ! $KUBECTL cluster-info &> /dev/null; then
    echo -e "${RED}Not connected to a Kubernetes cluster. Please configure kubectl first.${NC}"
    exit 1
fi

# Create namespace if it doesn't exist
echo -e "${YELLOW}Creating namespace...${NC}"
$KUBECTL apply -f kubernetes/namespace.yaml

# Wait for namespace to be active
$KUBECTL wait --for=condition=Active namespace/$NAMESPACE --timeout=30s

# Apply configurations in order
echo -e "${YELLOW}Applying ConfigMap...${NC}"
$KUBECTL apply -f kubernetes/configmap.yaml

echo -e "${YELLOW}Creating Persistent Volume Claim...${NC}"
$KUBECTL apply -f kubernetes/pvc.yaml

echo -e "${YELLOW}Deploying DAVE application...${NC}"
$KUBECTL apply -f kubernetes/deployment.yaml

echo -e "${YELLOW}Creating Services...${NC}"
$KUBECTL apply -f kubernetes/service.yaml

echo -e "${YELLOW}Setting up Horizontal Pod Autoscaler...${NC}"
$KUBECTL apply -f kubernetes/hpa.yaml

echo -e "${YELLOW}Creating Ingress (optional)...${NC}"
if $KUBECTL get ingressclass nginx &> /dev/null; then
    $KUBECTL apply -f kubernetes/ingress.yaml
else
    echo -e "${YELLOW}NGINX Ingress Controller not found. Skipping Ingress creation.${NC}"
fi

# Wait for deployment to be ready
echo -e "${YELLOW}Waiting for deployment to be ready...${NC}"
$KUBECTL -n $NAMESPACE rollout status deployment/dave --timeout=300s

# Get service information
echo -e "${GREEN}Deployment complete!${NC}"
echo ""
echo "Service information:"
$KUBECTL -n $NAMESPACE get services

echo ""
echo "Pod status:"
$KUBECTL -n $NAMESPACE get pods

echo ""
echo -e "${GREEN}To access DAVE:${NC}"
echo "1. Using port-forward (for testing):"
echo "   $KUBECTL -n $NAMESPACE port-forward service/dave 5000:5000"
echo "   Then access http://localhost:5000"
echo ""
echo "2. Using LoadBalancer (if available):"
echo "   Check the EXTERNAL-IP of dave-lb service above"
echo ""
echo "3. Using Ingress (if configured):"
echo "   Configure your DNS to point to the Ingress controller"
echo "   Access http://dave.example.com or http://dave-gui.example.com"

# Show logs command
echo ""
echo -e "${YELLOW}To view logs:${NC}"
echo "$KUBECTL -n $NAMESPACE logs -l app=dave -f"