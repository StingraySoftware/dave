const electron = require('electron');
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;
var mainWindow = null;

app.on('window-all-closed', function() {
    app.quit();
});


app.on('ready', function() {
  var subpy = require('child_process').spawn('python', ['../../python/server.py']);

  var rq = require('request-promise');
  var mainAddr = 'http://localhost:5000';

  var openWindow = function(){
    mainWindow = new BrowserWindow({width:1200, height: 700});

    mainWindow.loadURL('http://localhost:5000');
     mainWindow.webContents.session.clearCache(function(){})
    // mainWindow.webContents.openDevTools();
    mainWindow.on('closed', function() {
      mainWindow = null;
      subpy.kill('SIGINT');
    });
  };

  var startUp = function(){
    rq(mainAddr)
      .then(function(htmlString){
        console.log('server started!');
        openWindow();
      })
      .catch(function(err){
        startUp();
      });
  };

  startUp();
});
