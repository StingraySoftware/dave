const electron = require('electron');
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;

var cp = require('child_process');
var rq = require('request-promise');
var Config = require('config-js');

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

var envEnabled = false;
var envScriptPath = "";

var pythonEnabled = false;
var pythonPath = "";
var pythonUrl = "";

var logMessage = "";

app.on('window-all-closed', function() {
    app.quit();
});

app.on('ready', function() {
  createWindow();
  if (loadConfig()) {

    if (!pythonEnabled && !envEnabled) {
      log('All server modes are disabled on configuration. Connecting anyways...');
    } else if (pythonEnabled) {
      launchProcess ("python", pythonPath, "Python");
    } else if (envEnabled) {
      launchProcess ("/bin/sh", envScriptPath, "Env&Python");
    }

    console.log('Connecting to server... URL: ' + pythonUrl);
    connectToServer ();
  }
});

// Quit when all windows are closed.
app.on('window-all-closed', function() {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit();
    }
})

function loadConfig(){
  try {
      var config = new Config(__dirname + '/config.js')

      envEnabled = config.get('environment.enabled') == "true";
      envScriptPath = __dirname + "/" + config.get('environment.path');

      pythonEnabled = config.get('python.enabled') == "true";
      pythonPath = __dirname + "/" + config.get('python.path');
      pythonUrl = config.get('python.url');

      return true;

    } catch (ex) {

      log('Error loading DAVE configuration: </br> ERROR: ' + ex +  '</br> CWD: ' + __dirname);
      return false;
    }
}

function launchProcess(process, argument, processName) {
  try {
    log('Launching ' + processName + '... </br> CMD: ' + process + " " + argument + '</br> CWD: ' + __dirname );
    subpy = cp.spawn(process, [argument]);

    subpy.stdout.on('data', (data) => {
      log(processName +  ' stdout: ' + data);
    });

    subpy.stderr.on('data', (data) => {
      log(processName +  ' stderr: ' + data);
    });

    subpy.on('close', (code) => {
      processRunning = false;
      if (code == 0) {
        log(processName + ' server stopped!');
      } else {
        log(processName + ' process exited with code: ' + code);
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
      log('checking server..... ' + Math.ceil(seconds) + 's');
    }

    rq(pythonUrl)
      .then(function(htmlString){

        connected = true;
        console.log('server started!');
        loadDaveContents();
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

function createWindow (){
  mainWindow = new BrowserWindow(windowParams);
  mainWindow.on('closed', function() {
                                        mainWindow = null;
                                        if (subpy != null) {
                                          subpy.kill('SIGINT');
                                        }
                                      });
}

function loadDaveContents (){

  mainWindow.loadURL(pythonUrl);
  mainWindow.webContents.session.clearCache(function(){})
  // mainWindow.webContents.openDevTools();

}

function log (msg){

  logMessage = msg + "</br>" + logMessage;
  console.log(logMessage);
  logToWindow(logMessage);
}

function logToWindow (msg){
  var style = '<style>.myclass {position: absolute;top: 50%;width:95%;text-align:center}</style>'
  var html = '<div class="myclass">' + msg + '</div>'
  mainWindow.loadURL("data:text/html;charset=utf-8," + encodeURI(style + html));
}
