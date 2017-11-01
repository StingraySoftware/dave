const electron = require('electron');
const {ipcMain} = require('electron')
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;

var cp = require('child_process');
var rq = require('request-promise');
var Config = require('config-js');
var Menu = require("menu");
var request = require('request');

let mainWindow,
    windowParams = {
        width:1200,
        height: 700,
        icon: "resources/resources/static/img/icon.png"
    };
var retryInterval = 0.5 * 1000;
var retries = 0;
var connected = false;
var subpy = null;
var processRunning = false;
var logEnabled = true;
var logDebugMode = false;
var errorShown = false;
var mainConfig = null;
var LOGS_PATH = "";
var PYTHON_URL = "";

app.on('ready', function() {

  mainConfig = loadConfig();
  console.log('mainConfig: ' + JSON.stringify(mainConfig));

  createWindow(mainConfig.splash_path);

  if (mainConfig.error == null) {

    logDebugMode = mainConfig.logDebugMode;
    PYTHON_URL = mainConfig.pythonUrl;
    LOGS_PATH = mainConfig.logsPath.replace("$HOME", require('os').homedir());

    launchPythonServer(mainConfig, function() {
      console.log('Connecting to server... URL: ' + PYTHON_URL);
      connectToServer ();
    });

  } else {

    log('Error loading DAVE configuration: </br> ERROR: ' + mainConfig.error +  '</br> CWD: ' + __dirname);
  }
});

function loadConfig(){
  try {
      var config = new Config(__dirname + '/config.js')
      var configObj = { "error" : null };

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

  var port = config.pythonUrl.split(":")[2];
  checkPortInUse(port, function (inUse) {
    if (!inUse) {
      if (!config.pythonEnabled && !config.envEnabled) {
        log('All server modes are disabled on configuration. Connecting anyways...');
      } else if (config.pythonEnabled) {
        launchProcess ("python", [config.pythonPath, '/tmp', '..', port, 'PY_ENV'], "Python");
      } else if (config.envEnabled) {
        launchProcess ("/bin/bash", [config.envScriptPath], "Env&Python");
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
      var logMsgs = data.replace(/\r?\n/g, "#")
                        .replace(/\\n/g, "#").split("#");
      for (i in logMsgs) {
        if (logMsgs[i] != "") {
          if (logMsgs[i].startsWith("@PROGRESS@")) {
            var strArr = logMsgs[i].split("|");
            sendProgress(strArr[2], parseInt(strArr[1]));
          } else if (logMsgs[i].startsWith("@ERROR@")) {
            var strArr = logMsgs[i].split("|");
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
      var hadConnection = connected;
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

function connectToServer (){

  if (!connected && processRunning) {

    if (retries % 10 == 0){
      var seconds = (retries  * (retryInterval/1000));
      log('Connecting to server..... ' + Math.ceil(seconds) + 's');
    }

    rq(PYTHON_URL)
      .then(function(htmlString){

        connected = true;
        console.log('Server started!');
        loadDaveContents(PYTHON_URL);
      })
      .catch(function(err){

        console.log('Connection error: ' + err);
        retries ++;
        setTimeout (function(){
                                console.log('...');
                                connectToServer();
                              }, retryInterval);
      });
    } else if (processRunning) {

      console.log('Just connected');
    }
}

function createWindow (splash_path){
  console.log('Creating splash: ' + splash_path);
  mainWindow = new BrowserWindow(windowParams);
  mainWindow.loadURL("file://" + __dirname + splash_path);
  mainWindow.on('closed', function() { stop(); });
  //mainWindow.webContents.openDevTools();
}

function loadDaveContents (url){
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

function log (msg, mode){
  if (logEnabled){
    console.log(msg);
    logToWindow(msg, mode);
  }
}

function logToWindow (msg, mode){
  if (mainWindow != null) {
    var logCmd = "logError";
    if (!isNull(mode)) {
      //Supported modes: Debug, Info, Warn, Err
      logCmd = "log" + mode;
    }
    mainWindow.webContents.executeJavaScript(logCmd + "('" + escapeSpecialChars(msg) + "');");
  }
}

function sendErrorToWindow (msg){
  if (mainWindow != null) {
    if (!errorShown) {
      errorShown = true;
      mainWindow.webContents.executeJavaScript("showError('" + escapeSpecialChars(msg) + "');");
    } else {
      log(msg);
    }
  }
}

function sendProgress (msg, progress){
  if (mainWindow != null) {
    mainWindow.webContents.executeJavaScript("setProgress('" + escapeSpecialChars(msg) + "', " + progress + ");");
  }
}

function connectionLost (){
  if (mainWindow != null) {
    mainWindow.webContents.executeJavaScript("connectionLost();");
  }
}

function getTailFromLogFile (logFilePath) {
  log('Getting log info from: ' + logFilePath, "Warn");
  var tailProc = cp.spawn("tail", [ "-10", logFilePath ]);
  var stdout = "";
  tailProc.stdout.on('data', (data) => {
    stdout += data;
  });
  tailProc.on('close', (code) => {
    log("LOGFILE: " + stdout);
  });
}

function escapeSpecialChars (text) {
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
};

app.on('window-all-closed', function() {
    stop();
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

function stop (){
  if (mainWindow != null){
    mainWindow = null;
    if (subpy != null) {
      console.log('Stopping server!');
      sendkillToServer ();
    } else {
      app.quit();
    }
  }
}

function sendkillToServer (){
  connected = false;
  try {
    request(PYTHON_URL + '/shutdown', function (error, response, body) {
      setTimeout (function(){
                    killServer();
                    delayedQuit();
                  }
                  , retryInterval);
    });
  } catch (ex) {
    killServer();
    delayedQuit();
  }
}

function killServer (){
  if (subpy != null) {
    subpy.kill('SIGINT');
  }
}

function delayedQuit(){
  setTimeout (function(){ app.quit(); }, retryInterval);
}

function prepareMenu (){

    // Create the Application's main menu
    var template = [{
        label: "DAVE",
        submenu: [
            { label: "About DAVE", selector: "orderFrontStandardAboutPanel:" },
            { type: "separator" },
            { label: "Quit", accelerator: "Command+Q", click: function() { app.quit(); }}
        ]}, {
        label: "Edit",
        submenu: [
            //{ label: "Undo", accelerator: "CmdOrCtrl+Z", selector: "undo:" },
            //{ label: "Redo", accelerator: "Shift+CmdOrCtrl+Z", selector: "redo:" },
            //{ type: "separator" },
            { label: "Cut", accelerator: "CmdOrCtrl+X", selector: "cut:" },
            { label: "Copy", accelerator: "CmdOrCtrl+C", selector: "copy:" },
            { label: "Paste", accelerator: "CmdOrCtrl+V", selector: "paste:" },
            { label: "Select All", accelerator: "CmdOrCtrl+A", selector: "selectAll:" }
        ]}
    ];

    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function checkPortInUse(port, callback) {
  var net = require('net');
  var server = net.createServer();
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

function isNull (value) {
  return (value === undefined) || (value == null);
}
