const { _electron: electron } = require('playwright');
const path = require('path');

class ElectronAppHelper {
  constructor() {
    this.app = null;
    this.window = null;
  }

  async launch(options = {}) {
    // Launch Electron app
    this.app = await electron.launch({
      args: [path.join(__dirname, '../../main.js')],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        DAVE_TEST_MODE: 'true'
      },
      ...options
    });

    // Get the first window
    this.window = await this.app.firstWindow();
    
    // Wait for the window to be ready
    await this.window.waitForLoadState('domcontentloaded');
    
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