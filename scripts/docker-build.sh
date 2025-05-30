#!/bin/bash
# Docker build script for DAVE

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Parse arguments
BUILD_TYPE="${1:-standard}"
TAG="${2:-latest}"

echo -e "${GREEN}Building DAVE Docker image...${NC}"
echo "Build type: $BUILD_TYPE"
echo "Tag: $TAG"

cd "$PROJECT_DIR"

case "$BUILD_TYPE" in
  "standard")
    echo -e "${YELLOW}Building standard DAVE image...${NC}"
    docker build -t dave:$TAG -f Dockerfile .
    ;;
  "vnc")
    echo -e "${YELLOW}Building VNC-enabled DAVE image...${NC}"
    docker build -t dave:vnc-$TAG -f Dockerfile.vnc .
    ;;
  "both")
    echo -e "${YELLOW}Building both standard and VNC images...${NC}"
    docker build -t dave:$TAG -f Dockerfile .
    docker build -t dave:vnc-$TAG -f Dockerfile.vnc .
    ;;
  *)
    echo -e "${RED}Unknown build type: $BUILD_TYPE${NC}"
    echo "Usage: $0 [standard|vnc|both] [tag]"
    exit 1
    ;;
esac

echo -e "${GREEN}Build completed successfully!${NC}"

# Show image info
echo -e "\n${YELLOW}Built images:${NC}"
docker images | grep "dave" | grep "$TAG"

echo -e "\n${YELLOW}To run the container:${NC}"
echo "Standard: docker run -p 5000:5000 dave:$TAG"
echo "VNC: docker run -p 6080:6080 -p 5900:5900 dave:vnc-$TAG"
echo "Or use: docker-compose up"