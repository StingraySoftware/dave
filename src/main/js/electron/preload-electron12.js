const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // IPC Communication
  onBrowserReady: () => ipcRenderer.send('onBrowserReady'),
  relaunchServer: () => ipcRenderer.send('relaunchServer'),
  connectedToServer: () => ipcRenderer.send('connectedToServer'),
  enableLogError: () => ipcRenderer.send('enableLogError'),
  disableLogError: () => ipcRenderer.send('disableLogError'),
  
  // Server spawning (moved from renderer)
  spawnPythonServer: (config) => ipcRenderer.invoke('spawn-python-server', config),
  
  // File dialogs (replaces remote.dialog)
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
  
  // Receive messages from main
  onLogError: (callback) => ipcRenderer.on('logError', (event, msg) => callback(msg)),
  onLogInfo: (callback) => ipcRenderer.on('logInfo', (event, msg) => callback(msg)),
  onLogWarn: (callback) => ipcRenderer.on('logWarn', (event, msg) => callback(msg)),
  onLogDebug: (callback) => ipcRenderer.on('logDebug', (event, msg) => callback(msg)),
  onShowError: (callback) => ipcRenderer.on('showError', (event, msg) => callback(msg)),
  onSetProgress: (callback) => ipcRenderer.on('setProgress', (event, msg, progress) => callback(msg, progress)),
  onConnectionLost: (callback) => ipcRenderer.on('connectionLost', callback),
  onShowAboutDialog: (callback) => ipcRenderer.on('showAboutDialog', callback),
  
  // Platform info
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.version
  },
  
  // Path utilities (replaces remote.app.getPath)
  getPaths: () => ({
    home: process.env.HOME || process.env.USERPROFILE,
    temp: process.env.TMPDIR || process.env.TEMP || '/tmp'
  })
});