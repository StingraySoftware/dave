const electron = require('electron');
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;

var cp = require('child_process');
var rq = require('request-promise');

var mainWindow = null;
var retryInterval = 0.5 * 1000;
var connected = false;
var subpy = null;

var mainAddr = 'http://localhost:5000';

app.on('window-all-closed', function() {
    app.quit();
});

app.on('ready', function() {

  console.log('Launching Python server...');
  subpy = cp.spawn('python', ['../../python/server.py']);

  console.log('Connecting to Python server...');
  connectToServer ();
});

function connectToServer (){

  if (!connected) {

    console.log('checking server.....');
    rq(mainAddr)
      .then(function(htmlString){

        connected = true;
        console.log('server started!');
        openWindow();
      })
      .catch(function(err){

        console.log('Connection error: ' + err);
        setTimeout (function(){ console.log('.....'); connectToServer(); }, retryInterval);
      });
    } else {

      console.log('Just connected');
    }
};

function openWindow (){

  mainWindow = new BrowserWindow({width:1200, height: 700});

  mainWindow.loadURL(mainAddr);
  mainWindow.webContents.session.clearCache(function(){})
  // mainWindow.webContents.openDevTools();
  mainWindow.on('closed', function() {
                                        mainWindow = null;
                                        if (subpy != null) {
                                          subpy.kill('SIGINT');
                                        }
                                      });
};
