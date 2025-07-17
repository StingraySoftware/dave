# E2E Tests for DAVE Electron Application

This directory contains end-to-end tests for the DAVE Electron application using Playwright.

## Overview

The E2E tests cover:
- Application launch and initialization
- Server communication and API endpoints
- File upload and processing
- Plotting functionality
- Security features (context isolation, IPC)

## Running Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run tests with UI mode (interactive)
npm run test:e2e:ui

# Debug tests
npm run test:e2e:debug

# View test report
npm run test:e2e:report
```

## Test Structure

- `app-launch.spec.js` - Tests for application startup and initialization
- `file-operations.spec.js` - Tests for file upload and dataset management
- `plotting.spec.js` - Tests for Plotly integration and plot creation
- `server-communication.spec.js` - Tests for Flask server API communication
- `electron-helpers.js` - Helper utilities for Electron testing
- `global-setup.js` - Starts Python server before tests
- `global-teardown.js` - Stops Python server after tests

## Prerequisites

1. Python environment must be activated (handled by global-setup.js)
2. Flask server dependencies must be installed
3. Node dependencies must be installed (`npm install`)

## Writing New Tests

Use the `ElectronAppHelper` class for common operations:

```javascript
const { test, expect } = require('@playwright/test');
const { ElectronAppHelper } = require('./electron-helpers');

test('my test', async () => {
  const electronApp = new ElectronAppHelper();
  await electronApp.launch();
  
  // Your test code here
  
  await electronApp.close();
});
```

## Configuration

Tests are configured in `playwright.config.js`:
- Single worker to avoid conflicts
- Video and screenshots on failure
- HTML reporter for test results

## Notes

- Tests run against the actual Electron app, not a mock
- Python server is automatically started/stopped
- Tests are designed to be resilient to UI changes
- Context isolation is enforced for security testing