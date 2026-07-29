const { app, BrowserWindow, ipcMain, Menu, dialog } = require('electron');
const path = require('path');
const cp = require('child_process');
const fs = require('fs');
const axios = require('axios');

// Initialize remote for backward compatibility (will be removed in future versions)
require('@electron/remote/main').initialize();

let mainWindow;
const windowParams = {
  width: 1200,
  height: 700,
  minHeight: 300,
  minWidth: 768,
  icon: path.join(__dirname, "../../resources/static/img/icon.png"),
  webPreferences: {
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: false, // Will be true by default in Electron 20+
    preload: path.join(__dirname, 'preload.js')
  }
};

let retryInterval = 0.5 * 1000;
let retries = 0;
let connected = false;
let subpy = null;
let processRunning = false;
let logEnabled = true;
let logDebugMode = false;
let errorShown = false;
let mainConfig = null;
let LOGS_PATH = "";
let PYTHON_URL = "";

app.whenReady().then(() => {
  mainConfig = loadConfig();
  console.log('mainConfig: ' + JSON.stringify(mainConfig));

  createWindow(mainConfig.splash_path);

  if (mainConfig.error == null) {
    logDebugMode = mainConfig.logDebugMode;
    PYTHON_URL = mainConfig.pythonUrl;
    LOGS_PATH = mainConfig.logsPath.replace("$HOME", require('os').homedir());
  } else {
    log('Error loading DAVE configuration: </br> ERROR: ' + mainConfig.error +  '</br> CWD: ' + __dirname);
  }
});

// IPC Handlers with modern async/await pattern
ipcMain.on('onBrowserReady', async () => {
  console.log('Browser is ready, launching Python server...');
  try {
    await launchPythonServer(mainConfig);
    console.log('Connecting to server... URL: ' + PYTHON_URL);
    connectToServer();
  } catch (error) {
    console.error('Failed to launch Python server:', error);
    sendErrorToWindow('Failed to launch Python server: ' + error.message);
  }
});

ipcMain.on('relaunchServer', async () => {
  if (logDebugMode) {
    log('Relaunching Python Server...', "Warn");
  }
  try {
    await launchPythonServer(mainConfig);
  } catch (error) {
    console.error('Failed to relaunch server:', error);
  }
});

ipcMain.on('connectedToServer', () => {
  if (logDebugMode) {
    log('DAVE connected to Python Server...', "Info");
  }
  connected = true;
});

ipcMain.on('enableLogError', () => {
  logEnabled = true;
});

ipcMain.on('disableLogError', () => {
  logEnabled = false;
});

// New IPC handler for Python server spawning
ipcMain.handle('spawn-python-server', async (event, config) => {
  try {
    await launchPythonServer(config || mainConfig);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// File dialog handler (replaces remote.dialog)
ipcMain.handle('show-open-dialog', async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, options);
  return result;
});

ipcMain.handle('show-save-dialog', async (event, options) => {
  const result = await dialog.showSaveDialog(mainWindow, options);
  return result;
});

function loadConfig() {
  try {
    const configPath = path.join(__dirname, 'config.js');
    delete require.cache[configPath]; // Clear cache for hot reload
    const config = require(configPath);

    const configObj = { error: null };

    configObj.envEnabled = config.environment?.enabled === "true";
    configObj.envScriptPath = path.join(__dirname, config.environment?.path || '');

    configObj.pythonEnabled = config.python?.enabled === "true";
    configObj.pythonPath = path.join(__dirname, config.python?.path || '');
    configObj.pythonUrl = config.python?.url || 'http://localhost:5001';

    configObj.logDebugMode = config.logDebugMode === "true";
    configObj.splash_path = config.splash_path || '/../../resources/templates/splash_page.html';

    configObj.logsPath = config.logsPath || '$HOME/dave.log';

    return configObj;
  } catch (ex) {
    return { error: ex.message };
  }
}

async function launchPythonServer(config) {
  const port = config.pythonUrl.split(":")[2] || "5001";

  const inUse = await checkPortInUse(port);
  if (inUse) {
    throw new Error(`Port ${port} already in use!`);
  }

  if (!config.pythonEnabled && !config.envEnabled) {
    log('All server modes are disabled on configuration. Connecting anyways...');
    return;
  }

  if (config.pythonEnabled) {
    launchProcess("python", [config.pythonPath, '/tmp', '..', port, 'PY_ENV'], "Python");
  } else if (config.envEnabled) {
    launchProcess("/bin/bash", [config.envScriptPath], "E&P");
  }
}

function launchProcess(process, argument, processName) {
  try {
    if (logDebugMode) {
      log(`Launching ${processName}... </br> CMD: ${process} ${argument} </br> CWD: ${__dirname}`);
    }

    subpy = cp.spawn(process, argument, {
      cwd: __dirname,
      env: { ...process.env }
    });

    processRunning = true;

    subpy.stdout.on('data', (data) => {
      const dataStr = data.toString();
      const logMsgs = dataStr.replace(/\r?\n/g, "#")
                             .replace(/\\n/g, "#")
                             .split("#");

      for (const msg of logMsgs) {
        if (msg) {
          if (msg.startsWith("@PROGRESS@")) {
            const [, progress, message] = msg.split("|");
            sendProgress(message, parseInt(progress));
          } else if (msg.startsWith("@ERROR@")) {
            const [, errorMsg] = msg.split("|");
            sendErrorToWindow(errorMsg + "|");
          } else {
            log(`${processName}: ${msg}`);
          }
        }
      }
    });

    subpy.stderr.on('data', (data) => {
      if (logDebugMode) {
        log(`${processName} Error: ${data}`, "Error");
      }
    });

    subpy.on('close', (code) => {
      processRunning = false;
      const hadConnection = connected;
      connected = false;
      subpy = null;
      retries = 0;

      if (code === 0) {
        log(`${processName} server stopped!`);
        if (hadConnection) {
          connectionLost();
        }
      } else {
        getTailFromLogFile(LOGS_PATH);
        if (code === 10) {
          sendErrorToWindow("Error creating Python Environment|");
        } else if (!hadConnection) {
          sendErrorToWindow("Error launching Python Server|");
        } else {
          connectionLost();
        }
        log(`${processName} server stopped with code: ${code}`, "Error");
      }
    });

  } catch (ex) {
    sendErrorToWindow("Error creating environment|");
    log(`Error on launchProcess </br> ERROR: ${ex} </br> CWD: ${__dirname}`, "Error");
    throw ex;
  }
}

async function connectToServer() {
  if (!connected && processRunning) {
    if (retries % 10 === 0) {
      const seconds = retries * (retryInterval / 1000);
      log(`Connecting to server..... ${Math.ceil(seconds)}s`);
    }

    try {
      const response = await axios.get(PYTHON_URL, { timeout: 5000 });

      connected = true;
      console.log('Server started!');
      loadDaveContents(PYTHON_URL);

      if (!logDebugMode) {
        prepareMenu();
      }
    } catch (error) {
      console.log('Connection error:', error.message);
      retries++;
      setTimeout(() => {
        console.log('...');
        connectToServer();
      }, retryInterval);
    }
  } else if (processRunning) {
    console.log('Just connected');
  }
}

function createWindow(splash_path) {
  console.log('Creating splash: ' + splash_path);
  mainWindow = new BrowserWindow(windowParams);

  // Enable remote for this window (deprecated, will be removed)
  require('@electron/remote/main').enable(mainWindow.webContents);

  mainWindow.loadFile(path.join(__dirname, splash_path));
  mainWindow.on('closed', () => {
    stop();
  });
}

function loadDaveContents(url) {
  mainWindow.loadURL(url);

  if (logDebugMode) {
    mainWindow.webContents.session.clearCache();
  }

  mainWindow.webContents.on('did-finish-load', () => {
    log(`Electron Version: ${process.versions.electron}, ` +
        `Chrome Version: ${process.versions.chrome}, ` +
        `NODE Version: ${process.version}, ` +
        `Platform: ${process.platform}`, "Info");
  });
}

function log(msg, mode) {
  if (logEnabled) {
    console.log(msg);
    logToWindow(msg, mode);
  }
}

function logToWindow(msg, mode) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const eventName = mode ? `log${mode}` : "logError";
    mainWindow.webContents.send(eventName, escapeSpecialChars(msg));
  }
}

function sendErrorToWindow(msg) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (!errorShown) {
      errorShown = true;
      mainWindow.webContents.send('showError', escapeSpecialChars(msg));
    } else {
      log(msg);
    }
  }
}

function sendProgress(msg, progress) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('setProgress', escapeSpecialChars(msg), progress);
  }
}

function connectionLost() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('connectionLost');
  }
}

function showAbout() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('showAboutDialog');
  }
}

function getTailFromLogFile(logFilePath) {
  if (fs.existsSync(logFilePath)) {
    log(`Getting log info from: ${logFilePath}`, "Warn");
    const tailProc = cp.spawn("tail", ["-10", logFilePath]);
    let stdout = "";

    tailProc.stdout.on('data', (data) => {
      stdout += data;
    });

    tailProc.on('close', () => {
      log(`LOGFILE: ${stdout}`);
    });
  }
}

function escapeSpecialChars(text) {
  if (typeof text !== 'string') return text;

  return text.replace(/\r?\n/g, "#")
             .replace(/\\n/g, "#")
             .replace(/\\'/g, "")
             .replace(/\\"/g, "")
             .replace(/\\&/g, "")
             .replace(/\\r/g, "")
             .replace(/\\t/g, "")
             .replace(/\\b/g, "")
             .replace(/\\f/g, "");
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    stop();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow(mainConfig.splash_path);
  }
});

async function stop() {
  if (mainWindow) {
    mainWindow = null;
    if (subpy) {
      console.log('Stopping server!');
      await sendkillToServer();
    } else {
      app.quit();
    }
  }
}

async function sendkillToServer() {
  connected = false;
  try {
    await axios.get(`${PYTHON_URL}/shutdown`, { timeout: 5000 });
  } catch (ex) {
    console.log('Error sending shutdown request:', ex.message);
  }

  killServer();
  setTimeout(() => {
    app.quit();
  }, retryInterval);
}

function killServer() {
  if (subpy) {
    subpy.kill('SIGINT');
  }
}

function prepareMenu() {
  const template = [
    {
      label: "DAVE",
      submenu: [
        { label: "About DAVE", click: showAbout },
        { type: "separator" },
        {
          label: "Quit",
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: stop
        }
      ]
    },
    {
      label: "Edit",
      submenu: [
        { label: "Copy", accelerator: "CmdOrCtrl+C", role: "copy" },
        { label: "Paste", accelerator: "CmdOrCtrl+V", role: "paste" },
        { label: "Select All", accelerator: "CmdOrCtrl+A", role: "selectAll" }
      ]
    },
    {
      label: "View",
      submenu: [
        { label: "Reload", accelerator: "CmdOrCtrl+R", role: "reload" },
        { label: "Force Reload", accelerator: "CmdOrCtrl+Shift+R", role: "forceReload" },
        { type: "separator" },
        { label: "Toggle Developer Tools", accelerator: "F12", role: "toggleDevTools" }
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
        console.log(`Port ${port} is in use!`);
        resolve(true);
      }
    });

    server.once('listening', () => {
      server.close();
      console.log(`Port ${port} available!`);
      resolve(false);
    });

    server.listen(port);
  });
}