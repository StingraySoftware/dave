// This file provides compatibility between the old direct DOM manipulation
// and the new secure IPC-based approach

// Set up listeners for IPC messages from main process
if (window.electronAPI) {
  // Log handlers
  window.electronAPI.onLogError((msg) => {
    if (typeof logError === 'function') {
      logError(msg);
    }
  });
  
  window.electronAPI.onLogInfo((msg) => {
    if (typeof logInfo === 'function') {
      logInfo(msg);
    }
  });
  
  window.electronAPI.onLogWarn((msg) => {
    if (typeof logWarn === 'function') {
      logWarn(msg);
    }
  });
  
  window.electronAPI.onLogDebug((msg) => {
    if (typeof logDebug === 'function') {
      logDebug(msg);
    }
  });
  
  // Error and progress handlers
  window.electronAPI.onShowError((msg) => {
    if (typeof showError === 'function') {
      showError(msg);
    }
  });
  
  window.electronAPI.onSetProgress((msg, progress) => {
    if (typeof setProgress === 'function') {
      setProgress(msg, progress);
    }
  });
  
  // Connection handlers
  window.electronAPI.onConnectionLost(() => {
    if (typeof connectionLost === 'function') {
      connectionLost();
    }
  });
  
  // About dialog
  window.electronAPI.onShowAboutDialog(() => {
    if (typeof showAboutDialog === 'function') {
      showAboutDialog();
    }
  });
  
  // Expose functions that the renderer can call
  window.onBrowserReady = function() {
    window.electronAPI.onBrowserReady();
  };
  
  window.relaunchServer = function() {
    window.electronAPI.relaunchServer();
  };
  
  window.connectedToServer = function() {
    window.electronAPI.connectedToServer();
  };
  
  window.enableLogError = function() {
    window.electronAPI.enableLogError();
  };
  
  window.disableLogError = function() {
    window.electronAPI.disableLogError();
  };
}