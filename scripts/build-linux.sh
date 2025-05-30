#!/bin/bash
# Modern build script for Linux - wrapper around Python build system

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Building DAVE for Linux...${NC}"

# Check if Pixi is available
if ! command -v pixi &> /dev/null; then
    echo -e "${RED}Error: Pixi not found. Please install Pixi first.${NC}"
    echo "Visit: https://pixi.sh"
    exit 1
fi

# Run the modern Python build system
echo -e "${YELLOW}Using modern Python build system...${NC}"
pixi run build-linux

echo -e "${GREEN}Build complete!${NC}"
echo "Distribution packages are in the 'dist' directory."