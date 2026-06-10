const { _electron: electron } = require('playwright');
const path = require('path');

class ElectronAppHelper {
  constructor() {
    this.app = null;
    this.window = null;
  }

  async launch(options = {}) {
    // Prepare launch arguments for CI environment
    const baseArgs = [path.join(__dirname, '../../../src/main/js/electron/main.js')];
    
    // Prepare Electron launch options
    const launchOptions = {
      args: baseArgs,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        DAVE_TEST_MODE: 'true'
      },
      ...options
    };
    
    // Add sandbox-disabling arguments for CI environments or Linux
    if (process.env.CI || process.env.GITHUB_ACTIONS || process.platform === 'linux') {
      launchOptions.executablePath = undefined; // Let Playwright find Electron
      
      // Base headless args for CI
      const ciArgs = [
        '--no-sandbox',
        '--disable-setuid-sandbox', 
        '--disable-dev-shm-usage',
        '--disable-extensions',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ];
      
      // Platform-specific headless configuration
      if (process.platform === 'linux' && (process.env.CI || process.env.GITHUB_ACTIONS)) {
        // Linux CI needs additional headless flags
        ciArgs.push(
          '--headless=new',
          '--use-gl=swiftshader',
          '--disable-software-rasterizer',
          '--virtual-time-budget=5000'
        );
        
        // Set DISPLAY for Linux CI
        launchOptions.env = {
          ...launchOptions.env,
          DISPLAY: process.env.DISPLAY || ':99'
        };
      } else if (process.env.CI || process.env.GITHUB_ACTIONS) {
        // Non-Linux CI (macOS, Windows)
        ciArgs.push('--headless');
      }
      
      launchOptions.args = [...ciArgs, ...baseArgs];
    }
    
    // Launch Electron app
    this.app = await electron.launch(launchOptions);

    // Get the first window
    this.window = await this.app.firstWindow();

    // Wait for the window to be ready
    await this.window.waitForLoadState('domcontentloaded');

    // The first window is the splash page (file://), which immediately
    // navigates to the Flask app (http://localhost:5001). That cross-origin
    // navigation swaps renderer processes, and the CDP target taken on the
    // splash can detach mid-swap - any handle held across it dies (screenshot
    // protocol errors, "Target page closed" in waits). Wait for the handoff
    // and re-acquire the live window so callers never hold a pre-swap handle.
    const appUrl = (launchOptions.env && launchOptions.env.PYTHON_URL) || 'http://localhost:5001';
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      const appPage = this.app.windows().find(
        w => !w.isClosed() && w.url().startsWith(appUrl)
      );
      if (appPage) {
        this.window = appPage;
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    await this.window.waitForLoadState('domcontentloaded').catch(() => {});

    return { app: this.app, window: this.window };
  }

  async close() {
    if (this.app) {
      await this.app.close();
    }
  }

  async takeScreenshot(name) {
    if (this.window) {
      await this.window.screenshot({ 
        path: path.join(__dirname, `../../screenshots/${name}.png`),
        fullPage: true 
      });
    }
  }

  async evaluate(fn, ...args) {
    return this.window.evaluate(fn, ...args);
  }

  async waitForSelector(selector, options = {}) {
    return this.window.waitForSelector(selector, options);
  }

  async click(selector) {
    await this.window.click(selector);
  }

  async fill(selector, value) {
    await this.window.fill(selector, value);
  }

  async getText(selector) {
    return this.window.textContent(selector);
  }

  async isVisible(selector) {
    return this.window.isVisible(selector);
  }

  async waitForNavigation(options = {}) {
    return this.window.waitForLoadState('networkidle', options);
  }

  // IPC communication helpers
  async invokeIPC(channel, ...args) {
    return this.evaluate(async (params) => {
      const { channel, args } = params;
      if (window.electronAPI && window.electronAPI[channel]) {
        return await window.electronAPI[channel](...args);
      }
      throw new Error(`IPC channel ${channel} not found`);
    }, { channel, args });
  }

  // Check server status
  async checkServerStatus() {
    return this.invokeIPC('server', 'getStatus');
  }

  // Upload a file
  async uploadFile(filePath) {
    const fileInput = await this.waitForSelector('input[type="file"]');
    await fileInput.setInputFiles(filePath);
  }
}

module.exports = { ElectronAppHelper };