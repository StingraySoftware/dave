# DAVE Tests Backup

This folder contains all the tests that were temporarily moved from the main project structure.
These tests can be referenced when creating new tests in the future.

## Structure

### python-tests/
Contains all Python tests that were in `src/test/`:
- **Unit Tests**: Model and utility function tests
- **Integration Tests**: Flask API and file upload tests  
- **Scientific Validation Tests**: Tests for astronomical analysis features (AGN, PDS, lightcurves, etc.)
- **Performance Tests**: Benchmarking, memory profiling, and performance regression tests
- **Test Resources**: Test data files, images, and reference outputs

### electron-tests/
Contains all JavaScript/Electron tests that were in `src/main/js/electron/tests/`:
- **E2E Tests**: End-to-end tests using Playwright
  - app-launch.spec.js
  - file-operations.spec.js
  - plotting.spec.js
  - server-communication.spec.js
- **Test Helpers**: electron-helpers.js, global-setup.js, global-teardown.js

### playwright.config.js
Playwright configuration file for E2E tests

## Original Locations
- Python tests: `src/test/`
- Electron tests: `src/main/js/electron/tests/`
- Playwright config: `src/main/js/electron/playwright.config.js`

## Test Count Summary
- Python test files: 32 (excluding support files)
- JavaScript test files: 4
- Total: 36 test files

These tests covered:
- Data models (Column, Dataset, Table)
- Utility functions
- Flask REST API endpoints
- Scientific calculations (lightcurves, PDS, cross-correlation, etc.)
- FITS file handling
- Performance and memory usage
- End-to-end UI testing
- File operations and plotting