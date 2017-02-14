const electron = require('electron');
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
        height: 700
    };
var retryInterval = 0.5 * 1000;
var retries = 0;
var connected = false;
var subpy = null;
var processRunning = true; //If false could cause fail of first connectToServer call
var logDebugMode = false;

var PYTHON_URL = "";

app.on('ready', function() {

  var config = loadConfig();
  console.log('config: ' + JSON.stringify(config));

  createWindow(config.splash_path);

  if (config.error == null) {

    logDebugMode = config.logDebugMode;

    if (!config.pythonEnabled && !config.envEnabled) {
      log('All server modes are disabled on configuration. Connecting anyways...');
    } else if (config.pythonEnabled) {
      launchProcess ("python", [config.pythonPath, '/tmp', '..'], "Python");
    } else if (config.envEnabled) {
      launchProcess ("/bin/bash", [config.envScriptPath], "Env&Python");
    }

    PYTHON_URL = config.pythonUrl;
    console.log('Connecting to server... URL: ' + PYTHON_URL);
    connectToServer ();

  } else {

    log('Error loading DAVE configuration: </br> ERROR: ' + config.error +  '</br> CWD: ' + __dirname);
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

      return configObj;

    } catch (ex) {
      return { "error" : ex };
    }
}

function launchProcess(process, argument, processName) {
  try {
    if (logDebugMode) {
      log('Launching ' + processName + '... </br> CMD: ' + process + " " + argument + '</br> CWD: ' + __dirname );
    }

    subpy = cp.spawn(process, argument);

    subpy.stdout.on('data', (data) => {
      log(processName + ': ' + data);
    });

    subpy.stderr.on('data', (data) => {
      if (logDebugMode) {
        log(processName + ' Error: ' + data);
      }
    });

    subpy.on('close', (code) => {
      processRunning = false;
      if (code == 0) {
        log(processName + ' server stopped!');
      } else {
        log(processName + ' server stopped with code: ' + code);
      }
    });

  } catch (ex) {

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
        setTimeout (function(){ console.log('.....'); connectToServer(); }, retryInterval);
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
  mainWindow.webContents.session.clearCache(function(){})
}

function log (msg){
  console.log(msg);
  logToWindow(msg);
}

function logToWindow (msg){
  if (mainWindow != null) {
    mainWindow.webContents.executeJavaScript("log('" + msg + "');");
  }
}

app.on('window-all-closed', function() {
    stop();
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
  subpy.kill('SIGINT');
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
