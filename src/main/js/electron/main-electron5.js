const electron = require('electron');
const {app, BrowserWindow, ipcMain, Menu} = electron;
const path = require('path');
const cp = require('child_process');
const rq = require('request-promise');
const Config = require('config-js');
const request = require('request');
const fs = require('fs');

let mainWindow;
const windowParams = {
  width: 1200,
  height: 700,
  minHeight: 300,
  minWidth: 768,
  icon: path.join(__dirname, "../../resources/static/img/icon.png"),
  webPreferences: {
    // Context isolation is the key security feature in Electron 5+
    contextIsolation: true,
    nodeIntegration: false,
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

app.on('ready', function() {
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

// Modern IPC handlers
ipcMain.on('onBrowserReady', function(){
  //Browser is loaded and ready, launch Python server.
  launchPythonServer(mainConfig, function() {
    console.log('Connecting to server... URL: ' + PYTHON_URL);
    connectToServer();
  });
});

ipcMain.on('relaunchServer', function(){
  if (logDebugMode) {
    log('Relaunching Python Server...', "Warn");
  }
  launchPythonServer(mainConfig, null);
});

ipcMain.on('connectedToServer', function(){
  if (logDebugMode) {
    log('DAVE connected to Python Server...', "Info");
  }
  connected = true;
});

ipcMain.on('enableLogError', function(){
  logEnabled = true;
});

ipcMain.on('disableLogError', function(){
  logEnabled = false;
});

function loadConfig(){
  try {
    const config = new Config(__dirname + '/config.js');
    const configObj = { "error" : null };
    
    configObj.envEnabled = config.get('environment.enabled') == "true";
    configObj.envScriptPath = __dirname + "/" + config.get('environment.path');
    
    configObj.pythonEnabled = config.get('python.enabled') == "true";
    configObj.pythonPath = __dirname + "/" + config.get('python.path');
    configObj.pythonUrl = config.get('python.url');
    
    configObj.logDebugMode = config.get('logDebugMode') == "true";
    configObj.splash_path = config.get('splash_path');
    
    configObj.logsPath = config.get('logsPath');
    
    return configObj;
  } catch (ex) {
    return { "error" : ex };
  }
}

function launchPythonServer(config, callback) {
  const port = config.pythonUrl.split(":")[2];
  checkPortInUse(port, function (inUse) {
    if (!inUse) {
      if (!config.pythonEnabled && !config.envEnabled) {
        log('All server modes are disabled on configuration. Connecting anyways...');
      } else if (config.pythonEnabled) {
        launchProcess("python", [config.pythonPath, '/tmp', '..', port, 'PY_ENV'], "Python");
      } else if (config.envEnabled) {
        launchProcess("/bin/bash", [config.envScriptPath], "E&P");
      }
      
      if (callback != null) {
        callback();
      }
    } else {
      sendErrorToWindow("Port " + port + " already in use!|");
    }
  });
}

function launchProcess(process, argument, processName) {
  try {
    if (logDebugMode) {
      log('Launching ' + processName + '... </br> CMD: ' + process + " " + argument + '</br> CWD: ' + __dirname );
    }
    
    subpy = cp.spawn(process, argument);
    processRunning = true;
    
    subpy.stdout.on('data', (data) => {
      data = "" + data;
      const logMsgs = data.replace(/\r?\n/g, "#")
                        .replace(/\\n/g, "#").split("#");
      for (let i in logMsgs) {
        if (logMsgs[i] != "") {
          if (logMsgs[i].startsWith("@PROGRESS@")) {
            const strArr = logMsgs[i].split("|");
            sendProgress(strArr[2], parseInt(strArr[1]));
          } else if (logMsgs[i].startsWith("@ERROR@")) {
            const strArr = logMsgs[i].split("|");
            sendErrorToWindow(strArr[1] + "|");
          } else {
            log(processName + ': ' + logMsgs[i]);
          }
        }
      }
    });
    
    subpy.stderr.on('data', (data) => {
      if (logDebugMode) {
        log(processName + ' Error: ' + data);
      }
    });
    
    subpy.on('close', (code) => {
      processRunning = false;
      const hadConnection = connected;
      connected = false;
      subpy = null;
      retries = 0;
      
      if (code == 0) {
        log(processName + ' server stopped!');
        if (hadConnection) {
          connectionLost();
        }
      } else {
        getTailFromLogFile(LOGS_PATH);
        if (parseInt(code) == 10){
          sendErrorToWindow("Error creating Python Environment|");
        } else if (!hadConnection) {
          sendErrorToWindow("Error launching Python Server|");
        } else {
          connectionLost();
        }
        log(processName + ' server stopped with code: ' + code);
      }
    });
    
  } catch (ex) {
    sendErrorToWindow("Error creating environment|");
    log('Error on launchProcess </br> ERROR: ' + ex +  '</br> CWD: ' + __dirname);
    return false;
  }
}

function connectToServer(){
  if (!connected && processRunning) {
    if (retries % 10 == 0){
      const seconds = (retries  * (retryInterval/1000));
      log('Connecting to server..... ' + Math.ceil(seconds) + 's');
    }
    
    rq(PYTHON_URL)
      .then(function(htmlString){
        connected = true;
        console.log('Server started!');
        loadDaveContents(PYTHON_URL);
        if (!logDebugMode){
          //If app is not in debug mode, show app menu
          prepareMenu();
        }
      })
      .catch(function(err){
        console.log('Connection error: ' + err);
        retries ++;
        setTimeout(function(){
          console.log('...');
          connectToServer();
        }, retryInterval);
      });
  } else if (processRunning) {
    console.log('Just connected');
  }
}

function createWindow(splash_path){
  console.log('Creating splash: ' + splash_path);
  mainWindow = new BrowserWindow(windowParams);
  mainWindow.loadURL("file://" + __dirname + splash_path);
  mainWindow.on('closed', function() { stop(); });
  //mainWindow.webContents.openDevTools();
}

function loadDaveContents(url){
  mainWindow.loadURL(url);
  if (logDebugMode){
    //If app is in debug mode, clears browser cache
    mainWindow.webContents.session.clearCache(function(){})
  }
  mainWindow.webContents.on('did-finish-load', function() {
    log("Electron Version: " + process.versions.electron +
        ", Chrome Version: " + process.versions.chrome +
        ", NODE Version: " + process.version +
        ", Platform: " + process.platform, "Info");
  });
}

// Modern approach: Send IPC messages instead of executeJavaScript
function log(msg, mode){
  if (logEnabled){
    console.log(msg);
    logToWindow(msg, mode);
  }
}

function logToWindow(msg, mode){
  if (mainWindow != null) {
    let eventName = "logError";
    if (!isNull(mode)) {
      //Supported modes: Debug, Info, Warn, Error
      eventName = "log" + mode;
    }
    mainWindow.webContents.send(eventName, escapeSpecialChars(msg));
  }
}

function sendErrorToWindow(msg){
  if (mainWindow != null) {
    if (!errorShown) {
      errorShown = true;
      mainWindow.webContents.send('showError', escapeSpecialChars(msg));
    } else {
      log(msg);
    }
  }
}

function sendProgress(msg, progress){
  if (mainWindow != null) {
    mainWindow.webContents.send('setProgress', escapeSpecialChars(msg), progress);
  }
}

function connectionLost(){
  if (mainWindow != null) {
    mainWindow.webContents.send('connectionLost');
  }
}

function showAbout(){
  if (mainWindow != null) {
    mainWindow.webContents.send('showAboutDialog');
  }
}

function getTailFromLogFile(logFilePath) {
  if (fs.existsSync(logFilePath)) {
    log('Getting log info from: ' + logFilePath, "Warn");
    const tailProc = cp.spawn("tail", [ "-10", logFilePath ]);
    let stdout = "";
    tailProc.stdout.on('data', (data) => {
      stdout += data;
    });
    tailProc.on('close', (code) => {
      log("LOGFILE: " + stdout);
    });
  }
}

function escapeSpecialChars(text) {
  if (!isNull(text.replace)){
    return text.replace(/\r?\n/g, "#")
                 .replace(/\\n/g, "#")
                 .replace(/\\'/g, "")
                 .replace(/\\"/g, "")
                 .replace(/\\&/g, "")
                 .replace(/\\r/g, "")
                 .replace(/\\t/g, "")
                 .replace(/\\b/g, "")
                 .replace(/\\f/g, "");
   } else {
     return text;
   }
}

app.on('window-all-closed', function() {
  stop();
});

function stop(){
  if (mainWindow != null){
    mainWindow = null;
    if (subpy != null) {
      console.log('Stopping server!');
      sendkillToServer();
    } else {
      app.quit();
    }
  }
}

function sendkillToServer(){
  connected = false;
  try {
    request(PYTHON_URL + '/shutdown', function (error, response, body) {
      setTimeout(function(){
        killServer();
        delayedQuit();
      }, retryInterval);
    });
  } catch (ex) {
    killServer();
    delayedQuit();
  }
}

function killServer(){
  if (subpy != null) {
    subpy.kill('SIGINT');
  }
}

function delayedQuit(){
  setTimeout(function(){ app.quit(); }, retryInterval);
}

function prepareMenu(){
  // Create the Application's main menu
  const template = [{
    label: "DAVE",
    submenu: [
      { label: "About DAVE", click: function() { showAbout(); } },
      { type: "separator" },
      { label: "Quit", accelerator: "Command+Q", click: function() { stop(); }}
    ]}, {
    label: "Edit",
    submenu: [
      { label: "Copy", accelerator: "CmdOrCtrl+C", selector: "copy:" },
      { label: "Paste", accelerator: "CmdOrCtrl+V", selector: "paste:" }
    ]}
  ];
  
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function checkPortInUse(port, callback) {
  const net = require('net');
  const server = net.createServer();
  server.once('error', function(err) {
    if (err.code === 'EADDRINUSE') {
      // port is currently in use
      console.log('Port ' + port + ' is in use!');
      callback(true);
    }
  });
  server.once('listening', function() {
    // close the server if listening doesn't fail
    server.close();
    console.log('Port ' + port + ' available!');
    callback(false);
  });
  server.listen(port);
}

function isNull(value) {
  return (value === undefined) || (value == null);
}