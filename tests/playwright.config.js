const { defineConfig } = require('@playwright/test');
const path = require('path');

module.exports = defineConfig({
  testDir: './electron/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    trace: 'on-first-retry',
    video: 'on-first-retry',
    screenshot: 'only-on-failure'
  },

  projects: [
    {
      name: 'electron',
      use: {
        // Use Playwright's Electron support
        launchOptions: {
          // Let electron-helpers.js handle the launch configuration
          // This avoids conflicts with our custom sandbox handling
        },
      },
    },
  ],

  // Global setup/teardown
  globalSetup: path.join(__dirname, 'electron/e2e/global-setup.js'),
  globalTeardown: path.join(__dirname, 'electron/e2e/global-teardown.js'),
});