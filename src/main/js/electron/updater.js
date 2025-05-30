/**
 * Auto-updater implementation for DAVE
 * Uses electron-updater for cross-platform automatic updates
 */

const { autoUpdater } = require('electron-updater');
const { dialog, BrowserWindow } = require('electron');
const log = require('electron-log');

// Configure logging
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';
log.info('Auto-updater starting...');

class AppUpdater {
  constructor() {
    // Configure auto-updater
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    
    // Check for updates every hour
    this.checkInterval = 60 * 60 * 1000; // 1 hour
    this.updateCheckTimer = null;
    
    // Track update state
    this.updateAvailable = false;
    this.updateDownloaded = false;
    this.downloadProgress = 0;
    
    // Setup event handlers
    this.setupEventHandlers();
  }
  
  /**
   * Initialize auto-updater
   */
  init() {
    // Don't run auto-updater in development
    if (process.env.NODE_ENV === 'development') {
      log.info('Auto-updater disabled in development mode');
      return;
    }
    
    // Check for updates on startup
    this.checkForUpdates();
    
    // Schedule periodic update checks
    this.scheduleUpdateChecks();
  }
  
  /**
   * Setup event handlers for auto-updater
   */
  setupEventHandlers() {
    // Update available
    autoUpdater.on('update-available', (info) => {
      log.info('Update available:', info);
      this.updateAvailable = true;
      
      dialog.showMessageBox(BrowserWindow.getFocusedWindow(), {
        type: 'info',
        title: 'Update Available',
        message: `A new version (${info.version}) is available. Would you like to download it now?`,
        detail: `Current version: ${autoUpdater.currentVersion}\nNew version: ${info.version}\n\nRelease notes:\n${info.releaseNotes || 'No release notes available'}`,
        buttons: ['Download Now', 'Later'],
        defaultId: 0,
        cancelId: 1
      }).then((result) => {
        if (result.response === 0) {
          this.downloadUpdate();
        }
      });
    });
    
    // No update available
    autoUpdater.on('update-not-available', (info) => {
      log.info('No update available');
      this.updateAvailable = false;
    });
    
    // Download progress
    autoUpdater.on('download-progress', (progressObj) => {
      this.downloadProgress = progressObj.percent;
      
      let logMessage = `Download speed: ${this.formatBytes(progressObj.bytesPerSecond)}/s`;
      logMessage += ` - Downloaded ${progressObj.percent.toFixed(2)}%`;
      logMessage += ` (${this.formatBytes(progressObj.transferred)} / ${this.formatBytes(progressObj.total)})`;
      
      log.info(logMessage);
      
      // Send progress to renderer if needed
      const windows = BrowserWindow.getAllWindows();
      windows.forEach((window) => {
        window.webContents.send('update-download-progress', {
          percent: progressObj.percent,
          bytesPerSecond: progressObj.bytesPerSecond,
          transferred: progressObj.transferred,
          total: progressObj.total
        });
      });
    });
    
    // Update downloaded
    autoUpdater.on('update-downloaded', (info) => {
      log.info('Update downloaded:', info);
      this.updateDownloaded = true;
      
      dialog.showMessageBox(BrowserWindow.getFocusedWindow(), {
        type: 'info',
        title: 'Update Ready',
        message: 'Update downloaded. The application will restart to apply the update.',
        detail: 'Save any unsaved work before clicking "Restart Now".',
        buttons: ['Restart Now', 'Later'],
        defaultId: 0,
        cancelId: 1
      }).then((result) => {
        if (result.response === 0) {
          this.installUpdate();
        }
      });
    });
    
    // Error handling
    autoUpdater.on('error', (err) => {
      log.error('Auto-updater error:', err);
      
      dialog.showErrorBox('Update Error', 
        `An error occurred while checking for updates:\n${err.message}\n\nPlease try again later or download the update manually.`
      );
    });
  }
  
  /**
   * Check for updates
   */
  checkForUpdates() {
    log.info('Checking for updates...');
    autoUpdater.checkForUpdates().catch(err => {
      log.error('Failed to check for updates:', err);
    });
  }
  
  /**
   * Download update
   */
  downloadUpdate() {
    log.info('Starting update download...');
    autoUpdater.downloadUpdate().catch(err => {
      log.error('Failed to download update:', err);
      dialog.showErrorBox('Download Error', 
        `Failed to download update:\n${err.message}`
      );
    });
  }
  
  /**
   * Install update and restart
   */
  installUpdate() {
    log.info('Installing update and restarting...');
    autoUpdater.quitAndInstall(false, true);
  }
  
  /**
   * Schedule periodic update checks
   */
  scheduleUpdateChecks() {
    // Clear existing timer
    if (this.updateCheckTimer) {
      clearInterval(this.updateCheckTimer);
    }
    
    // Schedule periodic checks
    this.updateCheckTimer = setInterval(() => {
      this.checkForUpdates();
    }, this.checkInterval);
    
    log.info(`Scheduled update checks every ${this.checkInterval / 1000 / 60} minutes`);
  }
  
  /**
   * Format bytes to human readable format
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
  
  /**
   * Get update status
   */
  getStatus() {
    return {
      checking: autoUpdater.isUpdaterActive(),
      updateAvailable: this.updateAvailable,
      updateDownloaded: this.updateDownloaded,
      downloadProgress: this.downloadProgress,
      currentVersion: autoUpdater.currentVersion,
      allowPrerelease: autoUpdater.allowPrerelease
    };
  }
  
  /**
   * Set update channel (stable, beta, alpha)
   */
  setChannel(channel) {
    switch(channel) {
      case 'beta':
        autoUpdater.allowPrerelease = true;
        autoUpdater.channel = 'beta';
        break;
      case 'alpha':
        autoUpdater.allowPrerelease = true;
        autoUpdater.channel = 'alpha';
        break;
      default:
        autoUpdater.allowPrerelease = false;
        autoUpdater.channel = 'stable';
    }
    
    log.info(`Update channel set to: ${channel}`);
  }
  
  /**
   * Enable/disable auto-download
   */
  setAutoDownload(enabled) {
    autoUpdater.autoDownload = enabled;
    log.info(`Auto-download ${enabled ? 'enabled' : 'disabled'}`);
  }
  
  /**
   * Set update feed URL (for custom update servers)
   */
  setFeedURL(url) {
    if (url) {
      autoUpdater.setFeedURL({
        provider: 'generic',
        url: url
      });
      log.info(`Update feed URL set to: ${url}`);
    }
  }
}

// Export singleton instance
module.exports = new AppUpdater();