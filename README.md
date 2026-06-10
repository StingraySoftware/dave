# DAVE - Data Analysis of Variable Events

<div align="center">
<img src="src/main/resources/static/img/icon.png" alt="DAVE Icon" width="200"/>
</div>

A modern desktop GUI application for astronomical X-ray timing analysis built on the Stingray library. DAVE provides an intuitive interface for analyzing variable X-ray sources with enterprise-grade performance and security.

![Python](https://img.shields.io/badge/python-3.13-blue.svg)
![Electron](https://img.shields.io/badge/electron-42.3.2-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## Quick Start

### Prerequisites
- **Pixi Package Manager** ([install here](https://pixi.sh))
### Installation

```bash
# Clone the repository
git clone https://github.com/StingraySoftware/dave.git
cd dave

# Switch to modernization branch (required)
git checkout modernization-2025

# Install Python environment and dependencies
pixi install

# Install Node.js dependencies for Electron frontend
pixi run install-node-deps

# Verify installation
pixi run test                    # Python tests
pixi run test-e2e               # End-to-end tests (requires pixi run test-e2e-install first)
```

### Running the Application

```bash
# Start the full application (recommended)
pixi run electron

# Alternative: Start components separately
pixi run server          # Flask backend only
# Then in another terminal:
cd src/main/js/electron && npm start  # Electron frontend
```

## Architecture

DAVE uses a hybrid client-server architecture:

```
┌─────────────────────────────────────────┐
│           ELECTRON FRONTEND             │
│    (Desktop Wrapper + Web UI)          │
│                                         │
│  ┌─────────────┐    ┌─────────────┐    │
│  │   Main      │    │  Renderer   │    │
│  │  Process    │◄──►│   Process   │    │
│  │  (Node.js)  │    │ (Chromium)  │    │
│  └─────────────┘    └─────────────┘    │
└─────────────┬───────────────────────────┘
              │ HTTP Requests (localhost:5001)
              │
┌─────────────▼───────────────────────────┐
│           PYTHON BACKEND                │
│         (Flask REST API)                │
│                                         │
│  ┌─────────────┐    ┌─────────────┐    │
│  │   Flask     │    │  Scientific │    │
│  │   Server    │◄──►│   Engine    │    │
│  │  (Routes)   │    │ (Stingray)  │    │
│  └─────────────┘    └─────────────┘    │
└─────────────────────────────────────────┘
```

## Development Commands

### Code Quality & Linting

```bash
# Python linting (uses ruff)
pixi run lint                   # Check Python code for issues
pixi run format                 # Auto-format Python code

# Fix all linting issues before committing
pixi run lint                   # Must show 0 errors before commit
```

### Building the Application

```bash
# Build for current platform (macOS/Linux/Windows)
pixi run build                  # Full build with tests
pixi run build --no-tests      # Skip tests during build

# Build for specific platforms
python build.py --platform linux --no-tests    # Linux build
python build.py --platform windows --no-tests  # Windows build  
python build.py --platform macos --no-tests    # macOS build

# Use legacy Electron Builder instead of Forge
python build.py --legacy --no-tests

# Clean build artifacts
python build.py --clean
```

### Build Output Locations

After building, find your packages at:
- **macOS**: `src/main/js/electron/out/make/DAVE.dmg`
- **Linux**: `src/main/js/electron/out/make/deb/` and `src/main/js/electron/out/make/rpm/`
- **Windows**: `src/main/js/electron/out/make/squirrel.windows/`

