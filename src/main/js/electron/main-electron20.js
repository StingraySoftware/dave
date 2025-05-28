const { app, BrowserWindow, ipcMain, Menu, dialog, shell, nativeTheme } = require('electron');
const path = require('path');
const cp = require('child_process');
const fs = require('fs').promises;
const axios = require('axios');
const log = require('electron-log');

// Configure logging
log.transports.file.level = 'info';
log.transports.console.level = 'debug';

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
    shell.openExternal(navigationUrl);
  });
});

let mainWindow;
let subpy = null;
let processRunning = false;
let connected = false;
let mainConfig = null;
let PYTHON_URL = "";

const windowParams = {
  width: 1200,
  height: 700,
  minHeight: 300,
  minWidth: 768,
  icon: path.join(__dirname, "../../resources/static/img/icon.png"),
  webPreferences: {
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true, // Sandboxing is now default in Electron 20+
    webSecurity: true,
    allowRunningInsecureContent: false,
    preload: path.join(__dirname, 'preload.js')
  }
};

// Enable sandboxing for all renderers
app.enableSandbox();

app.whenReady().then(async () => {
  // Set Content Security Policy
  const { session } = require('electron');
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ["default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' http://localhost:5000"]
      }
    });
  });
  
  mainConfig = await loadConfig();
  log.info('Config loaded:', mainConfig);
  
  createWindow(mainConfig.splash_path);
  
  if (mainConfig.error == null) {
    PYTHON_URL = mainConfig.pythonUrl;
  } else {
    log.error('Error loading DAVE configuration:', mainConfig.error);
  }
});

// IPC Handlers
ipcMain.handle('get-config', async () => {
  return mainConfig;
});

ipcMain.handle('launch-python-server', async () => {
  log.info('Launching Python server...');
  try {
    await launchPythonServer(mainConfig);
    await connectToServer();
    return { success: true };
  } catch (error) {
    log.error('Failed to launch Python server:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('relaunch-server', async () => {
  log.warn('Relaunching Python Server...');
  try {
    if (subpy) {
      await stopServer();
    }
    await launchPythonServer(mainConfig);
    await connectToServer();
    return { success: true };
  } catch (error) {
    log.error('Failed to relaunch server:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('server-status', async () => {
  return { connected, processRunning };
});

// File dialog handlers
ipcMain.handle('show-open-dialog', async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    ...options,
    securityScopedBookmarks: process.platform === 'darwin'
  });
  return result;
});

ipcMain.handle('show-save-dialog', async (event, options) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    ...options,
    securityScopedBookmarks: process.platform === 'darwin'
  });
  return result;
});

ipcMain.handle('show-message-box', async (event, options) => {
  const result = await dialog.showMessageBox(mainWindow, options);
  return result;
});

// Theme handlers
ipcMain.handle('get-theme', () => {
  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
});

ipcMain.handle('set-theme', (event, theme) => {
  nativeTheme.themeSource = theme;
});

async function loadConfig() {
  try {
    const configPath = path.join(__dirname, 'config.js');
    delete require.cache[configPath];
    const config = require(configPath);
    
    const configObj = { error: null };
    
    configObj.envEnabled = config.environment?.enabled === "true";
    configObj.envScriptPath = path.join(__dirname, config.environment?.path || '');
    
    configObj.pythonEnabled = config.python?.enabled === "true";
    configObj.pythonPath = path.join(__dirname, config.python?.path || '');
    configObj.pythonUrl = config.python?.url || 'http://localhost:5000';
    
    configObj.logDebugMode = config.logDebugMode === "true";
    configObj.splash_path = config.splash_path || '/../../resources/templates/splash_page.html';
    
    configObj.logsPath = config.logsPath || path.join(app.getPath('logs'), 'dave.log');
    
    return configObj;
  } catch (ex) {
    return { error: ex.message };
  }
}

async function launchPythonServer(config) {
  const port = config.pythonUrl.split(":")[2] || "5000";
  
  const inUse = await checkPortInUse(port);
  if (inUse) {
    throw new Error(`Port ${port} already in use!`);
  }
  
  if (!config.pythonEnabled && !config.envEnabled) {
    log.info('All server modes are disabled on configuration.');
    return;
  }
  
  const spawnOptions = {
    cwd: path.dirname(config.pythonPath),
    env: { ...process.env },
    detached: false
  };
  
  if (config.pythonEnabled) {
    await launchProcess("python", [config.pythonPath], "Python", spawnOptions);
  } else if (config.envEnabled) {
    await launchProcess("/bin/bash", [config.envScriptPath], "E&P", spawnOptions);
  }
}

async function launchProcess(command, args, processName, options) {
  return new Promise((resolve, reject) => {
    try {
      log.info(`Launching ${processName}:`, command, args);
      
      subpy = cp.spawn(command, args, options);
      processRunning = true;
      
      subpy.stdout.on('data', (data) => {
        const dataStr = data.toString();
        const messages = dataStr.split(/\r?\n/).filter(msg => msg.trim());
        
        for (const msg of messages) {
          if (msg.startsWith("@PROGRESS@")) {
            const [, progress, message] = msg.split("|");
            sendToRenderer('progress-update', { message, progress: parseInt(progress) });
          } else if (msg.startsWith("@ERROR@")) {
            const [, errorMsg] = msg.split("|");
            sendToRenderer('server-error', errorMsg);
          } else {
            log.info(`${processName}:`, msg);
          }
        }
      });
      
      subpy.stderr.on('data', (data) => {
        log.error(`${processName} Error:`, data.toString());
      });
      
      subpy.on('spawn', () => {
        log.info(`${processName} process spawned successfully`);
        resolve();
      });
      
      subpy.on('error', (error) => {
        processRunning = false;
        log.error(`${processName} spawn error:`, error);
        reject(error);
      });
      
      subpy.on('close', (code) => {
        processRunning = false;
        connected = false;
        subpy = null;
        
        log.info(`${processName} process closed with code:`, code);
        sendToRenderer('server-disconnected', { code });
      });
      
    } catch (ex) {
      processRunning = false;
      log.error(`Error launching ${processName}:`, ex);
      reject(ex);
    }
  });
}

async function connectToServer() {
  const maxRetries = 30;
  const retryInterval = 1000;
  
  for (let i = 0; i < maxRetries; i++) {
    if (!processRunning) {
      throw new Error('Server process not running');
    }
    
    try {
      const response = await axios.get(PYTHON_URL, { timeout: 5000 });
      connected = true;
      log.info('Connected to Python server');
      sendToRenderer('server-connected');
      loadDaveContents(PYTHON_URL);
      return;
    } catch (error) {
      log.debug(`Connection attempt ${i + 1}/${maxRetries} failed`);
      await new Promise(resolve => setTimeout(resolve, retryInterval));
    }
  }
  
  throw new Error('Failed to connect to Python server after ' + maxRetries + ' attempts');
}

function createWindow(splash_path) {
  mainWindow = new BrowserWindow(windowParams);
  
  // Security: Prevent navigation to external URLs
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://') && !url.startsWith(PYTHON_URL)) {
      event.preventDefault();
    }
  });
  
  mainWindow.loadFile(path.join(__dirname, splash_path));
  
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  
  // Handle window state
  mainWindow.on('maximize', () => sendToRenderer('window-maximized'));
  mainWindow.on('unmaximize', () => sendToRenderer('window-unmaximized'));
  
  // Set up menu
  prepareMenu();
  
  // Auto-updater
  if (!config.logDebugMode) {
    const { autoUpdater } = require('electron-updater');
    autoUpdater.checkForUpdatesAndNotify();
  }
}

function loadDaveContents(url) {
  if (mainWindow) {
    mainWindow.loadURL(url);
    
    mainWindow.webContents.on('did-finish-load', () => {
      log.info('DAVE loaded successfully');
      sendToRenderer('app-info', {
        versions: {
          electron: process.versions.electron,
          chrome: process.versions.chrome,
          node: process.version
        },
        platform: process.platform
      });
    });
  }
}

function sendToRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

async function stopServer() {
  if (subpy) {
    connected = false;
    
    try {
      // Try graceful shutdown first
      await axios.get(`${PYTHON_URL}/shutdown`, { timeout: 5000 });
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (ex) {
      log.warn('Graceful shutdown failed, forcing kill');
    }
    
    if (subpy) {
      subpy.kill('SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (subpy) {
        subpy.kill('SIGKILL');
      }
    }
  }
}

function prepareMenu() {
  const isMac = process.platform === 'darwin';
  
  const template = [
    ...(isMac ? [{
      label: app.getName(),
      submenu: [
        { label: 'About ' + app.getName(), role: 'about' },
        { type: 'separator' },
        { label: 'Services', role: 'services', submenu: [] },
        { type: 'separator' },
        { label: 'Hide ' + app.getName(), role: 'hide' },
        { label: 'Hide Others', role: 'hideothers' },
        { label: 'Show All', role: 'unhide' },
        { type: 'separator' },
        { label: 'Quit', role: 'quit' }
      ]
    }] : []),
    {
      label: 'File',
      submenu: [
        isMac ? { label: 'Close', role: 'close' } : { label: 'Quit', role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', role: 'undo' },
        { label: 'Redo', role: 'redo' },
        { type: 'separator' },
        { label: 'Cut', role: 'cut' },
        { label: 'Copy', role: 'copy' },
        { label: 'Paste', role: 'paste' },
        { label: 'Select All', role: 'selectall' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Reload', role: 'reload' },
        { label: 'Force Reload', role: 'forcereload' },
        { label: 'Toggle Developer Tools', role: 'toggledevtools' },
        { type: 'separator' },
        { label: 'Actual Size', role: 'resetzoom' },
        { label: 'Zoom In', role: 'zoomin' },
        { label: 'Zoom Out', role: 'zoomout' },
        { type: 'separator' },
        { label: 'Toggle Fullscreen', role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { label: 'Minimize', role: 'minimize' },
        ...(isMac ? [
          { type: 'separator' },
          { label: 'Bring All to Front', role: 'front' }
        ] : [
          { label: 'Close', role: 'close' }
        ])
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Learn More',
          click: async () => {
            await shell.openExternal('https://github.com/StingraySoftware/dave');
          }
        },
        {
          label: 'Report Issue',
          click: async () => {
            await shell.openExternal('https://github.com/StingraySoftware/dave/issues');
          }
        }
      ]
    }
  ];
  
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

async function checkPortInUse(port) {
  const net = require('net');
  
  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(true);
      }
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
    createWindow(mainConfig.splash_path);
  }
});

app.on('before-quit', async (event) => {
  if (subpy) {
    event.preventDefault();
    await stopServer();
    app.quit();
  }
});

// Handle certificate errors
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  if (url.startsWith('https://localhost')) {
    // Allow self-signed certificates for localhost
    event.preventDefault();
    callback(true);
  } else {
    // Use default behavior for other URLs
    callback(false);
  }
});