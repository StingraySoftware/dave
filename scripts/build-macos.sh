#!/bin/bash
# Modern build script for macOS - wrapper around Python build system

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Building DAVE for macOS...${NC}"

# Check if Pixi is available
if ! command -v pixi &> /dev/null; then
    echo -e "${RED}Error: Pixi not found. Please install Pixi first.${NC}"
    echo "Visit: https://pixi.sh"
    exit 1
fi

# Check for code signing identity (optional)
if security find-identity -p codesigning -v | grep -q "Developer ID Application"; then
    echo -e "${GREEN}Code signing identity found.${NC}"
else
    echo -e "${YELLOW}Warning: No code signing identity found. The app will not be signed.${NC}"
    echo "To sign the app, you need an Apple Developer ID."
fi

# Run the modern Python build system
echo -e "${YELLOW}Using modern Python build system...${NC}"
pixi run build-macos

echo -e "${GREEN}Build complete!${NC}"
echo "Distribution packages are in the 'dist' directory."