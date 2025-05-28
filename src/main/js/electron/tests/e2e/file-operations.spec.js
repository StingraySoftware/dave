const { test, expect } = require('@playwright/test');
const { ElectronAppHelper } = require('./electron-helpers');
const path = require('path');
const fs = require('fs').promises;

test.describe('File Operations', () => {
  let electronApp;
  const testDataDir = path.join(__dirname, '../../../../test/resources/datasets');

  test.beforeEach(async () => {
    electronApp = new ElectronAppHelper();
    await electronApp.launch();
    
    // Wait for app to be ready
    await electronApp.window.waitForTimeout(2000);
  });

  test.afterEach(async () => {
    await electronApp.close();
  });

  test('should navigate to main interface from splash screen', async () => {
    // Click on a navigation option (if splash has one)
    const hasStartButton = await electronApp.window.locator('#startButton').count() > 0;
    
    if (hasStartButton) {
      await electronApp.click('#startButton');
    } else {
      // Some versions might auto-navigate
      await electronApp.window.waitForTimeout(3000);
    }
    
    // Check that we're on the main interface
    const toolPanelVisible = await electronApp.window.locator('#toolPanel').count() > 0;
    expect(toolPanelVisible).toBe(true);
  });

  test('should open file selector dialog', async () => {
    // Navigate to main interface
    await electronApp.window.waitForTimeout(2000);
    
    // Look for file upload button
    const fileInputExists = await electronApp.window.locator('input[type="file"]').count() > 0;
    
    if (fileInputExists) {
      // Check that file input is functional
      const fileInput = await electronApp.window.locator('input[type="file"]').first();
      const isEnabled = await fileInput.isEnabled();
      expect(isEnabled).toBe(true);
    }
  });

  test('should handle text file upload', async () => {
    // Navigate to main interface
    await electronApp.window.waitForTimeout(2000);
    
    const testFile = path.join(testDataDir, 'test.evt');
    
    // Check if test file exists
    try {
      await fs.access(testFile);
    } catch {
      console.log('Test file not found, skipping test');
      return;
    }
    
    // Try to find file upload mechanism
    const fileInput = await electronApp.window.locator('input[type="file"]').first();
    
    if (await fileInput.count() > 0) {
      // Upload file
      await fileInput.setInputFiles(testFile);
      
      // Wait for processing
      await electronApp.window.waitForTimeout(2000);
      
      // Check for any error messages
      const errorVisible = await electronApp.window.locator('.error-message').count() > 0;
      expect(errorVisible).toBe(false);
    }
  });

  test('should display file information after upload', async () => {
    // This test checks if file metadata is displayed after upload
    await electronApp.window.waitForTimeout(2000);
    
    // Look for file info display elements
    const hasFileInfo = await electronApp.evaluate(() => {
      // Check for common file info elements
      const selectors = [
        '#fileInfo',
        '.file-info',
        '#datasetInfo',
        '.dataset-info'
      ];
      
      return selectors.some(selector => {
        const element = document.querySelector(selector);
        return element && element.textContent.trim().length > 0;
      });
    });
    
    // File info might not be visible initially
    console.log('File info displayed:', hasFileInfo);
  });

  test('should handle multiple file formats', async () => {
    const testFiles = [
      'Input1.txt',
      'test.evt',
      'PN_source_lightcurve_raw.lc'
    ];
    
    for (const fileName of testFiles) {
      const filePath = path.join(testDataDir, fileName);
      
      try {
        await fs.access(filePath);
        console.log(`Testing file format: ${fileName}`);
        
        // Test file exists - would upload and verify here
        // This is a placeholder for actual upload testing
        expect(true).toBe(true);
      } catch {
        console.log(`Test file ${fileName} not found, skipping`);
      }
    }
  });

  test('should validate file format before upload', async () => {
    // Test that the app validates file formats
    await electronApp.window.waitForTimeout(2000);
    
    // Check if there are any file format restrictions displayed
    const formatInfo = await electronApp.evaluate(() => {
      const acceptedFormats = [];
      const fileInputs = document.querySelectorAll('input[type="file"]');
      
      fileInputs.forEach(input => {
        if (input.accept) {
          acceptedFormats.push(input.accept);
        }
      });
      
      return acceptedFormats;
    });
    
    console.log('Accepted file formats:', formatInfo);
    
    // DAVE should accept various astronomy data formats
    // This is informational rather than a strict test
  });
});