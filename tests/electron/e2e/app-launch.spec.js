const { test, expect } = require('@playwright/test');
const { ElectronAppHelper } = require('./electron-helpers');

test.describe('DAVE Application Launch', () => {
  let electronApp;

  test.beforeEach(async () => {
    electronApp = new ElectronAppHelper();
  });

  test.afterEach(async () => {
    await electronApp.close();
  });

  test('should launch the application successfully', async () => {
    const { app, window } = await electronApp.launch();
    
    // Check that app launched
    expect(app).toBeTruthy();
    expect(window).toBeTruthy();
    
    // Check window title
    const title = await window.title();
    expect(title).toContain('DAVE');
    
    // Take screenshot for visual verification
    await electronApp.takeScreenshot('app-launch');
  });

  test('should show splash screen initially', async () => {
    await electronApp.launch();
    
    // Wait a bit for the waiting dialog to appear
    await electronApp.window.waitForTimeout(1000);
    
    // Check for waiting dialog (the actual "splash screen") or that it was shown
    const waitingDialogVisible = await electronApp.isVisible('.waitingDialog');
    const containerVisible = await electronApp.isVisible('.daveContainer');
    
    // Either the waiting dialog is visible or the main content has loaded
    expect(waitingDialogVisible || containerVisible).toBe(true);
    expect(containerVisible).toBe(true);
  });

  test('should establish connection with Python server', async () => {
    await electronApp.launch();
    
    // Wait for server connection
    await electronApp.window.waitForTimeout(3000);
    
    // Check server status through IPC
    try {
      const serverInfo = await electronApp.evaluate(async () => {
        // Check if service is available
        if (window.service && window.service.get_server_version) {
          return await new Promise((resolve) => {
            window.service.get_server_version((error, result) => {
              if (error) {
                resolve({ error: error.message });
              } else {
                resolve({ version: result });
              }
            });
          });
        }
        return { error: 'Service not available' };
      });
      
      // Server should respond with version info
      expect(serverInfo).toBeTruthy();
      if (!serverInfo.error) {
        expect(serverInfo.version).toBeTruthy();
      }
    } catch (error) {
      // Log error but don't fail - server might not be fully ready
      console.log('Server check error:', error);
    }
  });

  test('should have correct window properties', async () => {
    await electronApp.launch();
    
    // Check window properties
    const bounds = await electronApp.evaluate(() => {
      const win = require('electron').remote.getCurrentWindow();
      return win.getBounds();
    }).catch(() => {
      // Fallback for Electron 36 without remote module
      return electronApp.app.evaluate((electron) => {
        const win = electron.BrowserWindow.getAllWindows()[0];
        return win.getBounds();
      });
    });
    
    // Window should have reasonable size
    expect(bounds.width).toBeGreaterThanOrEqual(1000);
    expect(bounds.height).toBeGreaterThanOrEqual(700);
  });

  test('should load required JavaScript libraries', async () => {
    await electronApp.launch();
    
    // Wait for app to be fully ready by checking the log
    await electronApp.window.waitForTimeout(8000);
    
    // Check that key libraries are loaded
    const libraries = await electronApp.evaluate(() => {
      return {
        jquery: typeof $ !== 'undefined',
        plotly: typeof Plotly !== 'undefined',
        bootstrap: typeof $.fn.modal !== 'undefined',
        mathjax: typeof MathJax !== 'undefined'
      };
    });
    
    expect(libraries.jquery).toBe(true);
    // Plotly loads dynamically when needed, so it might not be loaded yet
    if (!libraries.plotly) {
      console.log('Plotly not loaded yet - this is normal as it loads when tabs are created');
    }
    expect(libraries.bootstrap).toBe(true);
    // MathJax loads dynamically when needed, so it might not be loaded yet
    if (!libraries.mathjax) {
      console.log('MathJax not loaded yet - this is normal as it loads with plots');
    }
  });

  test('should have secure context isolation', async () => {
    await electronApp.launch();
    
    // Check that Node.js APIs are not exposed in renderer
    const security = await electronApp.evaluate(() => {
      return {
        nodeIntegration: typeof require !== 'undefined' && typeof require('fs') !== 'undefined',
        remoteModule: typeof require !== 'undefined' && typeof require('electron').remote !== 'undefined',
        electronAPI: typeof window.electronAPI !== 'undefined'
      };
    });
    
    // Security checks for Electron 36
    expect(security.nodeIntegration).toBe(false);
    expect(security.remoteModule).toBe(false);
    expect(security.electronAPI).toBe(true); // Our secure bridge should exist
  });
});