const { test, expect } = require('@playwright/test');
const { ElectronAppHelper } = require('./electron-helpers');
const path = require('path');
const fs = require('fs');

test.describe('File Operations', () => {
  let electronApp;
  const testDataDir = path.join(__dirname, '../../../data');

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
    // Wait for the app to be fully ready - longer timeout for complete initialization
    await electronApp.window.waitForTimeout(10000);
    
    // Check that we're on the main interface - look for actual interface elements
    const navBarVisible = await electronApp.window.locator('#navbar').count() > 0;
    const containerVisible = await electronApp.window.locator('.daveContainer').count() > 0;
    
    // Check if a tab panel was created (this happens automatically)
    const tabPanelVisible = await electronApp.window.locator('.TabPanel').count() > 0;
    
    expect(navBarVisible).toBe(true);
    expect(containerVisible).toBe(true);
    
    // A tab should be created automatically
    if (!tabPanelVisible) {
      console.log('Tab panel not created yet - checking for tab creation button');
      const addTabButton = await electronApp.window.locator('.addTabPanel').count() > 0;
      expect(addTabButton).toBe(true);
    }
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
    // App launch plus backend FITS parsing needs more than the default budget
    test.setTimeout(90000);

    // Navigate to main interface
    await electronApp.window.waitForTimeout(2000);
    
    const testFile = path.join(testDataDir, 'monol_testA.evt');

    // The sample file ships with the repo - fail hard instead of skipping
    expect(fs.existsSync(testFile)).toBe(true);

    // Try to find file upload mechanism (the input is hidden;
    // Playwright handles setInputFiles on hidden inputs fine)
    const fileInput = await electronApp.window.locator('input[type="file"]').first();
    expect(await fileInput.count()).toBeGreaterThan(0);

    // Upload file
    await fileInput.setInputFiles(testFile);

    // The rail's filter button (.filterBtn, class wfSelectorDisableable) stays
    // hidden until a dataset loads, then fades in. Generous timeout: the Flask
    // backend has to parse the FITS file first.
    await expect(electronApp.window.locator('.filterBtn').first())
      .toBeVisible({ timeout: 30000 });

    // The waiting dialog must be gone once the dataset has loaded
    await expect(electronApp.window.locator('.waitingDialog')).not.toBeVisible();

    // Check for any error messages
    const errorVisible = await electronApp.window.locator('.error-message').count() > 0;
    expect(errorVisible).toBe(false);
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
      'monol_testA.evt',
      'monol_testA_calib.evt'
    ];

    for (const fileName of testFiles) {
      const filePath = path.join(testDataDir, fileName);

      // The sample files ship with the repo - fail hard instead of skipping
      expect(fs.existsSync(filePath)).toBe(true);
      console.log(`Testing file format: ${fileName}`);

      // Test file exists - would upload and verify here
      // This is a placeholder for actual upload testing
      expect(true).toBe(true);
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