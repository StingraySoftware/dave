#!/bin/bash
# Modern build script for Windows - wrapper around Python build system
# Can be run from Git Bash, WSL, or Cygwin on Windows

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Building DAVE for Windows...${NC}"

# Check if Pixi is available
if ! command -v pixi &> /dev/null; then
    echo -e "${RED}Error: Pixi not found. Please install Pixi first.${NC}"
    echo "Visit: https://pixi.sh"
    exit 1
fi

# Check if running on Windows
if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]] || [[ "$OS" == "Windows_NT" ]]; then
    echo -e "${GREEN}Windows environment detected.${NC}"
else
    echo -e "${YELLOW}Warning: Not running on Windows. Cross-compilation may have limitations.${NC}"
fi

# Run the modern Python build system
echo -e "${YELLOW}Using modern Python build system...${NC}"
pixi run build-windows

echo -e "${GREEN}Build complete!${NC}"
echo "Distribution packages are in the 'dist' directory."