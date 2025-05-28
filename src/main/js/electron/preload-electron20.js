const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Configuration
  getConfig: () => ipcRenderer.invoke('get-config'),
  
  // Server management
  launchPythonServer: () => ipcRenderer.invoke('launch-python-server'),
  relaunchServer: () => ipcRenderer.invoke('relaunch-server'),
  getServerStatus: () => ipcRenderer.invoke('server-status'),
  
  // File dialogs
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
  showMessageBox: (options) => ipcRenderer.invoke('show-message-box', options),
  
  // Theme management
  getTheme: () => ipcRenderer.invoke('get-theme'),
  setTheme: (theme) => ipcRenderer.invoke('set-theme', theme),
  
  // Event listeners
  on: (channel, callback) => {
    const validChannels = [
      'server-connected',
      'server-disconnected',
      'server-error',
      'progress-update',
      'window-maximized',
      'window-unmaximized',
      'app-info'
    ];
    
    if (validChannels.includes(channel)) {
      // Deliberately strip event as it includes `sender`
      const subscription = (event, ...args) => callback(...args);
      ipcRenderer.on(channel, subscription);
      
      // Return unsubscribe function
      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    }
    
    throw new Error(`Invalid channel: ${channel}`);
  },
  
  // One-time listeners
  once: (channel, callback) => {
    const validChannels = [
      'server-connected',
      'server-disconnected',
      'app-info'
    ];
    
    if (validChannels.includes(channel)) {
      ipcRenderer.once(channel, (event, ...args) => callback(...args));
    } else {
      throw new Error(`Invalid channel: ${channel}`);
    }
  },
  
  // Platform info
  platform: {
    os: process.platform,
    arch: process.arch,
    versions: {
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.version
    }
  },
  
  // Paths (sandboxed - limited access)
  paths: {
    separator: require('path').sep,
    delimiter: require('path').delimiter
  }
});

// Log that preload script is loaded
console.log('Electron preload script loaded');
console.log('Platform:', process.platform);
console.log('Electron:', process.versions.electron);
console.log('Node:', process.version);