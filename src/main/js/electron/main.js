const { app, BrowserWindow, ipcMain, Menu, dialog, shell, nativeTheme, session } = require('electron');
const path = require('path');
const cp = require('child_process');
const fs = require('fs').promises;
const axios = require('axios');
const logger = require('./logger');
const { autoUpdater } = require('electron-updater');
const updater = require('./updater');


// Initialize DAVE logger
logger.section('DAVE Application Startup');

// Security: Set up Electron fuses for enhanced security
if (process.env.NODE_ENV === 'production') {
  const { FusesPlugin } = require('@electron-forge/plugin-fuses');
  const { FuseV1Options, FuseVersion } = require('@electron/fuses');

  // These fuses disable dangerous Electron features
  FusesPlugin({
    version: FuseVersion.V1,
    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableCookieEncryption]: true,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.OnlyLoadAppFromAsar]: true
  });
}

// Global references
let mainWindow = null;
let subpy = null;
let processRunning = false;
let connected = false;
let mainConfig = null;
let PYTHON_URL = "";

// Window configuration
const windowConfig = {
  width: 1280,
  height: 800,
  minWidth: 1024,
  minHeight: 600,
  icon: path.join(__dirname, "../../resources/static/img/icon.png"),
  backgroundColor: '#ffffff',
  titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
  webPreferences: {
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: false,
    webSecurity: true,
    allowRunningInsecureContent: false,
    preload: path.join(__dirname, 'preload.js'),
    spellcheck: true
  }
};

// Sandboxing is enabled per-window in webPreferences.sandbox
// app.enableSandbox(); // Removed global sandbox to avoid conflicts

// Set application name
app.setName('DAVE');

// Configure auto-updater
const log = require('electron-log/main');
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';

// App initialization
app.whenReady().then(async () => {
  // Set up Content Security Policy
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob: https:",
          "connect-src 'self' http://localhost:* ws://localhost:*",
          "font-src 'self' data:",
          "media-src 'self'",
          "worker-src 'self' blob:"
        ].join('; ')
      }
    });
  });

  // Set up permissions
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowedPermissions = ['clipboard-read', 'clipboard-write'];
    callback(allowedPermissions.includes(permission));
  });

  // Load configuration
  try {
    mainConfig = await loadConfig();
    logger.logConfig({ ...mainConfig, pythonPath: '***' });
  } catch (error) {
    logger.error('CONFIG', 'Failed to load configuration', { error: error.message });
    mainConfig = { error: error.message };
  }

  // Create main window
  createMainWindow();

  // Initialize auto-updater
  updater.init();

  // Check for updates
  if (process.env.NODE_ENV !== 'development') {
    autoUpdater.checkForUpdatesAndNotify();
  }

  // Set up PYTHON_URL
  if (mainConfig.error == null) {
    PYTHON_URL = mainConfig.pythonUrl || 'http://localhost:5001';
  }
});

// IPC Handlers
ipcMain.handle('app:getConfig', () => mainConfig);

ipcMain.handle('app:getVersion', () => ({
  app: app.getVersion(),
  electron: process.versions.electron,
  node: process.versions.node,
  chrome: process.versions.chrome
}));

// Auto-updater IPC handlers
ipcMain.handle('updater:check', () => {
  updater.checkForUpdates();
});

ipcMain.handle('updater:getStatus', () => {
  return updater.getStatus();
});

ipcMain.handle('updater:setChannel', (event, channel) => {
  updater.setChannel(channel);
});

ipcMain.handle('updater:setAutoDownload', (event, enabled) => {
  updater.setAutoDownload(enabled);
});

ipcMain.handle('server:launch', async () => {
  logger.process('PYTHON', 'Launching Python server...');
  try {
    // Check if we're in test mode
    const isTestMode = process.env.DAVE_TEST_MODE === 'true';
    
    if (isTestMode) {
      // In test mode, server should already be running from test setup
      log.info('Test mode detected - checking for existing server...');
      
      // Try to connect to existing server
      try {
        await axios.get(PYTHON_URL, { timeout: 5000 });
        connected = true;
        log.info('Connected to existing test server');
        
        // Load the main application
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.loadURL(PYTHON_URL);
        }
        
        sendToRenderer('server:connected', { url: PYTHON_URL });
        return { success: true };
      } catch (error) {
        log.error('Test server not available:', error.message);
        return { success: false, error: 'Test server not available at ' + PYTHON_URL };
      }
    } else {
      // Production mode - launch our own server
      await launchPythonServer(mainConfig);
      await waitForServerConnection();
      return { success: true };
    }
  } catch (error) {
    logger.error('PYTHON', 'Failed to launch Python server', { error: error.message });
    return { success: false, error: error.message };
  }
});

ipcMain.handle('server:relaunch', async () => {
  logger.process('PYTHON', 'Relaunching Python server...');
  try {
    await stopServer();
    await launchPythonServer(mainConfig);
    await waitForServerConnection();
    return { success: true };
  } catch (error) {
    logger.error('PYTHON', 'Failed to relaunch server', { error: error.message });
    return { success: false, error: error.message };
  }
});

ipcMain.handle('server:status', () => ({
  connected,
  processRunning,
  url: PYTHON_URL
}));

ipcMain.handle('server:stop', async () => {
  try {
    await stopServer();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Dialog handlers
ipcMain.handle('dialog:open', async (event, options) => {
  const defaultOptions = {
    properties: ['openFile'],
    filters: [
      { name: 'All Supported', extensions: ['txt', 'lc', 'evt', 'fits'] },
      { name: 'Text Files', extensions: ['txt'] },
      { name: 'Light Curves', extensions: ['lc'] },
      { name: 'Event Files', extensions: ['evt'] },
      { name: 'FITS Files', extensions: ['fits'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  };

  const result = await dialog.showOpenDialog(mainWindow, { ...defaultOptions, ...options });
  return result;
});

ipcMain.handle('dialog:save', async (event, options) => {
  const result = await dialog.showSaveDialog(mainWindow, options);
  return result;
});

ipcMain.handle('dialog:message', async (event, options) => {
  const result = await dialog.showMessageBox(mainWindow, options);
  return result;
});

// Theme handlers
ipcMain.handle('theme:get', () => nativeTheme.shouldUseDarkColors);
ipcMain.handle('theme:set', (event, theme) => {
  nativeTheme.themeSource = theme;
});
ipcMain.handle('theme:system', () => nativeTheme.themeSource = 'system');

// Shell handlers
ipcMain.handle('shell:openExternal', async (event, url) => {
  // Validate URL for security
  const allowedProtocols = ['http:', 'https:', 'mailto:'];
  const parsedUrl = new URL(url);
  if (allowedProtocols.includes(parsedUrl.protocol)) {
    await shell.openExternal(url);
    return { success: true };
  }
  return { success: false, error: 'Invalid URL protocol' };
});

// Window management handlers
ipcMain.handle('window:minimize', () => mainWindow?.minimize());
ipcMain.handle('window:maximize', () => mainWindow?.maximize());
ipcMain.handle('window:unmaximize', () => mainWindow?.unmaximize());
ipcMain.handle('window:close', () => mainWindow?.close());
ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() || false);

// Configuration loader
async function loadConfig() {
  const configPath = path.join(__dirname, 'config.js');

  try {
    // Clear require cache
    delete require.cache[configPath];
    const config = require(configPath);

    // Disable Python server startup in test mode
    const isTestMode = process.env.DAVE_TEST_MODE === 'true';
    
    return {
      envEnabled: config.environment?.enabled === "true" && !isTestMode,
      envScriptPath: path.join(__dirname, config.environment?.path || ''),
      pythonEnabled: config.python?.enabled === "true" && !isTestMode,
      pythonPath: path.join(__dirname, config.python?.path || ''),
      pythonUrl: config.python?.url || 'http://localhost:5001',
      logDebugMode: config.logDebugMode === "true",
      splash_path: config.splash_path || '/../../resources/templates/splash_page.html',
      logsPath: config.logsPath || path.join(app.getPath('logs'), 'dave.log')
    };
  } catch (error) {
    throw new Error(`Failed to load config: ${error.message}`);
  }
}

// Python server management
async function launchPythonServer(config) {
  const port = config.pythonUrl.split(':')[2] || '5001';

  // Check if port is already in use
  if (await isPortInUse(port)) {
    throw new Error(`Port ${port} is already in use`);
  }

  if (!config.pythonEnabled && !config.envEnabled) {
    logger.info('CONFIG', 'Server modes disabled in configuration');
    return;
  }

  const spawnOptions = {
    cwd: path.dirname(config.pythonPath || __dirname),
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '0' },
    detached: false,
    shell: false
  };

  if (config.pythonEnabled) {
    return launchProcess('python', [config.pythonPath, '.', '.', port], 'Python', spawnOptions);
  } else if (config.envEnabled) {
    return launchProcess('/bin/bash', [config.envScriptPath], 'Environment', spawnOptions);
  }
}

function launchProcess(command, args, name, options) {
  return new Promise((resolve, reject) => {
    try {
      logger.process(name.toUpperCase(), `Initializing process launch`, { command, args });

      subpy = cp.spawn(command, args, options);
      processRunning = true;

      // Handle stdout
      subpy.stdout.on('data', (data) => {
        const messages = data.toString().split(/\r?\n/).filter(Boolean);

        messages.forEach(msg => {
          if (msg.startsWith('@PROGRESS@')) {
            const [, progress, message] = msg.split('|');
            sendToRenderer('server:progress', { progress: parseInt(progress), message });
          } else if (msg.startsWith('@ERROR@')) {
            const [, error] = msg.split('|');
            sendToRenderer('server:error', { error });
          } else {
            logger.debug(name.toUpperCase(), msg);
          }
        });
      });

      // Handle stderr
      subpy.stderr.on('data', (data) => {
        const messages = data.toString().split(/\r?\n/).filter(Boolean);

        messages.forEach(msg => {
          // HTTP access logs (Flask default logs to stderr)
          if (msg.match(/^\S+ - - \[.*\] "(GET|POST|PUT|DELETE|HEAD|OPTIONS).*" \d{3}/)) {
            // Parse HTTP log for cleaner display
            const match = msg.match(/^(\S+) - - \[.*\] "(\w+) (\S+).*" (\d+) (\d+)?/);
            if (match) {
              const [, ip, method, url, status, size] = match;
              logger.logHttpRequest(method, url, status, 'N/A');
            } else {
              logger.http(msg);
            }
          }
          // Warnings (like NetCDF warning)
          else if (msg.includes('Warning') || msg.includes('UserWarning')) {
            logger.warn(name.toUpperCase(), msg);
          }
          // Actual errors
          else if (msg.includes('Error') || msg.includes('Exception') || msg.includes('Traceback')) {
            logger.error(name.toUpperCase(), msg);
          }
          // Everything else as info
          else {
            logger.info(name.toUpperCase(), msg);
          }
        });
      });

      // Handle spawn event
      subpy.on('spawn', () => {
        logger.processEvent(name.toLowerCase(), 'spawn');
        resolve();
      });

      // Handle errors
      subpy.on('error', (error) => {
        processRunning = false;
        logger.processEvent(name.toLowerCase(), 'error', { error: error.message });
        reject(error);
      });

      // Handle exit
      subpy.on('exit', (code, signal) => {
        processRunning = false;
        connected = false;
        subpy = null;

        logger.processEvent(name.toLowerCase(), 'exit', { code, signal });
        sendToRenderer('server:disconnected', { code, signal });
      });

    } catch (error) {
      processRunning = false;
      logger.error(name.toUpperCase(), `Failed to launch ${name}`, { error: error.message });
      reject(error);
    }
  });
}

async function waitForServerConnection() {
  // The Python backend imports a heavy scientific stack (numpy/scipy/astropy/
  // matplotlib/numba/stingray). On a cold OS file cache - especially when the
  // repo and its environment live on a slow or external disk - the first import
  // can take 1-3 minutes, versus ~15s once the cache is warm. Allow generous
  // headroom so first launch does not false-fail. This is safe: the loop below
  // throws immediately if the backend process dies, so a real crash still fails
  // fast rather than waiting out the full timeout.
  const maxRetries = 180;
  const retryInterval = 1000;

  for (let i = 0; i < maxRetries; i++) {
    if (!processRunning) {
      throw new Error('Server process died during startup');
    }

    try {
      await axios.get(PYTHON_URL, { timeout: 5000 });
      connected = true;
      logger.processEvent('python', 'connect', { url: PYTHON_URL });
      sendToRenderer('server:connected', { url: PYTHON_URL });

      // Load the main application
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadURL(PYTHON_URL);
      }

      return;
    } catch (error) {
      if (i < 3) { // Only show first few connection attempts
        logger.debug('PYTHON', `Connection attempt ${i + 1}/${maxRetries} failed`);
      }
      await new Promise(resolve => setTimeout(resolve, retryInterval));
    }
  }

  throw new Error(`Failed to connect to server after ${maxRetries} attempts`);
}

async function stopServer() {
  if (!subpy) return;

  connected = false;
  logger.process('PYTHON', 'Stopping Python server...');

  try {
    // Try graceful shutdown
    await axios.post(`${PYTHON_URL}/shutdown`, {}, { timeout: 5000 });
    await new Promise(resolve => setTimeout(resolve, 1000));
  } catch (error) {
    logger.debug('PYTHON', 'Graceful shutdown failed, forcing termination');
  }

  if (subpy && !subpy.killed) {
    subpy.kill('SIGTERM');
    await new Promise(resolve => setTimeout(resolve, 1000));

    if (subpy && !subpy.killed) {
      subpy.kill('SIGKILL');
    }
  }

  subpy = null;
  processRunning = false;
}

// Main window creation
function createMainWindow() {
  mainWindow = new BrowserWindow(windowConfig);

  // DevTools commented out to eliminate console warnings
  // mainWindow.webContents.openDevTools()

  // Load splash screen
  const splashPath = mainConfig.splash_path || '/../../resources/templates/splash_page.html';
  mainWindow.loadFile(path.join(__dirname, splashPath));

  // Set up event handlers
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.on('maximize', () => sendToRenderer('window:maximized'));
  mainWindow.on('unmaximize', () => sendToRenderer('window:unmaximized'));
  mainWindow.on('enter-full-screen', () => sendToRenderer('window:fullscreen', true));
  mainWindow.on('leave-full-screen', () => sendToRenderer('window:fullscreen', false));

  // Prevent navigation to external URLs
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://') && !url.startsWith(PYTHON_URL)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // Set up application menu
  createApplicationMenu();

  // Handle window ready
  mainWindow.webContents.on('did-finish-load', () => {
    logger.startup('Application window loaded successfully');
    sendToRenderer('app:ready', {
      version: app.getVersion(),
      platform: process.platform,
      config: { ...mainConfig, pythonPath: undefined }
    });
  });
}

// Application menu
function createApplicationMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    ...(isMac ? [{
      label: app.getName(),
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services', submenu: [] },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Open...',
          accelerator: 'CmdOrCtrl+O',
          click: () => sendToRenderer('menu:open')
        },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => sendToRenderer('menu:save')
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' },
        ...(isMac ? [
          { type: 'separator' },
          { role: 'front' },
          { type: 'separator' },
          { role: 'window' }
        ] : [])
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Documentation',
          click: () => shell.openExternal('https://github.com/StingraySoftware/dave/wiki')
        },
        {
          label: 'Report Issue',
          click: () => shell.openExternal('https://github.com/StingraySoftware/dave/issues')
        },
        { type: 'separator' },
        {
          label: 'View License',
          click: () => shell.openExternal('https://github.com/StingraySoftware/dave/blob/master/LICENSE')
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Utility functions
function sendToRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

async function isPortInUse(port) {
  const net = require('net');

  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', (err) => {
      resolve(err.code === 'EADDRINUSE');
    });

    server.once('listening', () => {
      server.close();
      resolve(false);
    });

    server.listen(port);
  });
}

// App event handlers
app.on('window-all-closed', async () => {
  await stopServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

app.on('before-quit', async (event) => {
  if (subpy && !subpy.killed) {
    event.preventDefault();
    await stopServer();
    app.quit();
  }
});

// Security: Handle certificate errors
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  if (url.startsWith('https://localhost')) {
    // Allow self-signed certificates for localhost only
    event.preventDefault();
    callback(true);
  } else {
    // Use default behavior
    callback(false);
  }
});

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();

    // Open in external browser if it's a valid URL
    const allowedProtocols = ['http:', 'https:'];
    try {
      const url = new URL(navigationUrl);
      if (allowedProtocols.includes(url.protocol)) {
        shell.openExternal(navigationUrl);
      }
    } catch (error) {
      logger.error('SECURITY', 'Invalid URL blocked', { url: navigationUrl });
    }
  });
});

// Auto-updater events
autoUpdater.on('checking-for-update', () => {
  logger.updater('Checking for application updates...');
  sendToRenderer('updater:checking');
});

autoUpdater.on('update-available', (info) => {
  logger.success('UPDATER', `Update available: v${info.version}`, {
    currentVersion: app.getVersion(),
    availableVersion: info.version
  });
  sendToRenderer('updater:available', info);
});

autoUpdater.on('update-not-available', (info) => {
  logger.updater('Application is up to date', { currentVersion: app.getVersion() });
  sendToRenderer('updater:not-available', info);
});

autoUpdater.on('download-progress', (progress) => {
  if (progress.percent && Math.floor(progress.percent) % 25 === 0) {
    logger.updater(`Download progress: ${Math.floor(progress.percent)}%`);
  }
  sendToRenderer('updater:progress', progress);
});

autoUpdater.on('update-downloaded', (info) => {
  logger.success('UPDATER', `Update downloaded successfully: v${info.version}`);
  sendToRenderer('updater:downloaded', info);

  // Prompt user to restart
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Update Ready',
    message: 'A new version has been downloaded. Restart the application to apply the update?',
    buttons: ['Restart Now', 'Later']
  }).then(result => {
    if (result.response === 0) {
      logger.updater('Restarting to apply update...');
      autoUpdater.quitAndInstall();
    }
  });
});

// Export for testing
module.exports = { app, createMainWindow };