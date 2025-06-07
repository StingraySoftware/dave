const { contextBridge, ipcRenderer } = require('electron');

// Channel whitelist for security - using Object.freeze to prevent iteration issues
const validChannels = Object.freeze({
  send: Object.freeze([
    'app:ready',
    'server:launch',
    'server:relaunch',
    'server:stop'
  ]),
  receive: Object.freeze([
    'server:connected',
    'server:disconnected',
    'server:error',
    'server:progress',
    'window:maximized',
    'window:unmaximized',
    'window:fullscreen',
    'menu:open',
    'menu:save',
    'updater:checking',
    'updater:available',
    'updater:not-available',
    'updater:progress',
    'updater:downloaded',
    'app:ready'
  ]),
  invoke: Object.freeze([
    'app:getConfig',
    'app:getVersion',
    'server:launch',
    'server:relaunch',
    'server:status',
    'server:stop',
    'dialog:open',
    'dialog:save',
    'dialog:message',
    'theme:get',
    'theme:set',
    'theme:system',
    'shell:openExternal',
    'window:minimize',
    'window:maximize',
    'window:unmaximize',
    'window:close',
    'window:isMaximized',
    'updater:check',
    'updater:getStatus',
    'updater:setChannel',
    'updater:setAutoDownload'
  ])
});

// Expose protected electron API to the renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // App information
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  getConfig: () => ipcRenderer.invoke('app:getConfig'),
  
  // Server management
  server: {
    launch: () => ipcRenderer.invoke('server:launch'),
    relaunch: () => ipcRenderer.invoke('server:relaunch'),
    status: () => ipcRenderer.invoke('server:status'),
    stop: () => ipcRenderer.invoke('server:stop')
  },
  
  // Dialog operations
  dialog: {
    open: (options) => ipcRenderer.invoke('dialog:open', options),
    save: (options) => ipcRenderer.invoke('dialog:save', options),
    message: (options) => ipcRenderer.invoke('dialog:message', options)
  },
  
  // Theme management
  theme: {
    get: () => ipcRenderer.invoke('theme:get'),
    set: (theme) => ipcRenderer.invoke('theme:set', theme),
    system: () => ipcRenderer.invoke('theme:system')
  },
  
  // Window controls
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    unmaximize: () => ipcRenderer.invoke('window:unmaximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized')
  },
  
  // Shell operations
  shell: {
    openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url)
  },
  
  // Auto-updater
  updater: {
    check: () => ipcRenderer.invoke('updater:check'),
    getStatus: () => ipcRenderer.invoke('updater:getStatus'),
    setChannel: (channel) => ipcRenderer.invoke('updater:setChannel', channel),
    setAutoDownload: (enabled) => ipcRenderer.invoke('updater:setAutoDownload', enabled)
  },
  
  // Event subscription
  on: (channel, callback) => {
    if (!validChannels.receive.includes(channel)) {
      throw new Error(`Invalid channel: ${channel}`);
    }
    
    // Create a wrapper that removes the event parameter - avoid spread operator in sandbox
    const subscription = function(event) {
      const args = Array.prototype.slice.call(arguments, 1);
      return callback.apply(null, args);
    };
    ipcRenderer.on(channel, subscription);
    
    // Return unsubscribe function
    return () => {
      ipcRenderer.removeListener(channel, subscription);
    };
  },
  
  // One-time event subscription
  once: (channel, callback) => {
    if (!validChannels.receive.includes(channel)) {
      throw new Error(`Invalid channel: ${channel}`);
    }
    
    ipcRenderer.once(channel, function(event) {
      const args = Array.prototype.slice.call(arguments, 1);
      return callback.apply(null, args);
    });
  },
  
  // Remove all listeners for a channel
  removeAllListeners: (channel) => {
    if (!validChannels.receive.includes(channel)) {
      throw new Error(`Invalid channel: ${channel}`);
    }
    
    ipcRenderer.removeAllListeners(channel);
  },
  
  // Platform information (read-only)
  platform: (() => {
    try {
      return {
        os: process.platform,
        arch: process.arch,
        isWindows: process.platform === 'win32',
        isMac: process.platform === 'darwin',
        isLinux: process.platform === 'linux',
        versions: {
          electron: process.versions?.electron || 'unknown',
          chrome: process.versions?.chrome || 'unknown',
          node: process.version || 'unknown'
        }
      };
    } catch (error) {
      console.warn('Platform info access restricted in sandbox:', error.message);
      return {
        os: 'unknown',
        arch: 'unknown',
        isWindows: false,
        isMac: false,
        isLinux: false,
        versions: {
          electron: 'unknown',
          chrome: 'unknown',
          node: 'unknown'
        }
      };
    }
  })()
});

// Expose a compatibility layer for legacy code
contextBridge.exposeInMainWorld('daveAPI', {
  // Legacy function names mapped to new API
  onBrowserReady: () => {
    console.warn('daveAPI.onBrowserReady is deprecated. Use electronAPI.server.launch()');
    return ipcRenderer.invoke('server:launch');
  },
  
  relaunchServer: () => {
    console.warn('daveAPI.relaunchServer is deprecated. Use electronAPI.server.relaunch()');
    return ipcRenderer.invoke('server:relaunch');
  },
  
  connectedToServer: () => {
    console.warn('daveAPI.connectedToServer is deprecated. Use electronAPI.server.status()');
    return ipcRenderer.invoke('server:status');
  }
});

// Debug: Check what objects might be causing iteration issues
console.log('=== PRELOAD DEBUG START ===');
try {
  console.log('contextBridge available:', typeof contextBridge);
  console.log('ipcRenderer available:', typeof ipcRenderer);
  
  // Check if validChannels arrays are properly iterable
  console.log('validChannels.send is array:', Array.isArray(validChannels.send));
  console.log('validChannels.receive is array:', Array.isArray(validChannels.receive));
  console.log('validChannels.invoke is array:', Array.isArray(validChannels.invoke));
  
  // Test iteration on the arrays
  console.log('Testing validChannels.send iteration...');
  for (const channel of validChannels.send) {
    // Just test iteration, don't log each item
    break;
  }
  console.log('validChannels.send iteration OK');
  
} catch (error) {
  console.error('PRELOAD DEBUG ERROR:', error);
}

// Log initialization
console.log('DAVE preload script initialized');
console.log('Platform:', process.platform);
console.log('Electron:', process.versions.electron);
console.log('Node:', process.version);
console.log('Chrome:', process.versions.chrome);
console.log('=== PRELOAD DEBUG END ===');