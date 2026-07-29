/**
 * Update Manager for DAVE
 * Handles auto-update UI and settings
 */

var UpdateManager = (function() {
  'use strict';

  var updateStatus = {
    checking: false,
    available: false,
    downloaded: false,
    version: null,
    progress: 0
  };

  var settings = {
    autoDownload: true,
    channel: 'stable'
  };

  /**
   * Initialize update manager
   */
  function init() {
    if (!window.electronAPI) {
      log('Update manager not available in web mode');
      return;
    }

    // Load saved settings
    loadSettings();

    // Set up event listeners
    setupEventListeners();

    // Add update UI to navbar
    addUpdateUI();

    // Check initial status
    checkStatus();

    log('Update manager initialized');
  }

  /**
   * Set up event listeners for update events
   */
  function setupEventListeners() {
    // Update events from main process
    window.electronAPI.on('updater:checking', function() {
      updateStatus.checking = true;
      updateUI();
    });

    window.electronAPI.on('updater:available', function(event, info) {
      updateStatus.checking = false;
      updateStatus.available = true;
      updateStatus.version = info.version;
      updateUI();

      if (settings.autoDownload) {
        showNotification('Update Available',
          'Version ' + info.version + ' is being downloaded automatically.');
      } else {
        showUpdateDialog(info);
      }
    });

    window.electronAPI.on('updater:not-available', function() {
      updateStatus.checking = false;
      updateStatus.available = false;
      updateUI();
    });

    window.electronAPI.on('updater:progress', function(event, progress) {
      updateStatus.progress = progress.percent;
      updateProgressBar(progress);
    });

    window.electronAPI.on('updater:downloaded', function(event, info) {
      updateStatus.downloaded = true;
      updateStatus.progress = 100;
      updateUI();
      showRestartDialog(info);
    });
  }

  /**
   * Add update UI elements to navbar
   */
  function addUpdateUI() {
    // Add update indicator to navbar
    var $updateIndicator = $('<li id="update-indicator" class="dropdown">')
      .html(
        '<a href="#" class="dropdown-toggle" data-bs-toggle="dropdown">' +
          '<i class="fa fa-download" aria-hidden="true"></i>' +
          '<span class="update-badge" style="display:none;"></span>' +
        '</a>' +
        '<ul class="dropdown-menu update-dropdown">' +
          '<li class="update-status">' +
            '<div class="update-info">' +
              '<h4>Updates</h4>' +
              '<p class="status-text">Checking for updates...</p>' +
              '<div class="progress update-progress" style="display:none;">' +
                '<div class="progress-bar" role="progressbar"></div>' +
              '</div>' +
            '</div>' +
          '</li>' +
          '<li class="divider"></li>' +
          '<li><a href="#" id="check-updates">Check Now</a></li>' +
          '<li><a href="#" id="update-settings">Settings</a></li>' +
        '</ul>'
      );

    $('#right-navbar').prepend($updateIndicator);

    // Event handlers
    $('#check-updates').on('click', function(e) {
      e.preventDefault();
      checkForUpdates();
    });

    $('#update-settings').on('click', function(e) {
      e.preventDefault();
      showSettingsDialog();
    });
  }

  /**
   * Update UI based on current status
   */
  function updateUI() {
    var $indicator = $('#update-indicator');
    var $badge = $indicator.find('.update-badge');
    var $statusText = $indicator.find('.status-text');
    var $icon = $indicator.find('> a > i');

    if (updateStatus.checking) {
      $statusText.text('Checking for updates...');
      $icon.removeClass().addClass('fa fa-spinner fa-spin');
      $badge.hide();
    } else if (updateStatus.downloaded) {
      $statusText.html('Update ready to install<br><small>Restart to apply</small>');
      $icon.removeClass().addClass('fa fa-check-circle');
      $badge.text('!').show();
    } else if (updateStatus.available) {
      $statusText.html('Update available: v' + updateStatus.version + '<br><small>Downloading...</small>');
      $icon.removeClass().addClass('fa fa-download');
      $badge.text('1').show();
    } else {
      $statusText.text('DAVE is up to date');
      $icon.removeClass().addClass('fa fa-check');
      $badge.hide();
    }
  }

  /**
   * Update progress bar
   */
  function updateProgressBar(progress) {
    var $progress = $('.update-progress');
    var $bar = $progress.find('.progress-bar');

    $progress.show();
    $bar.css('width', progress.percent + '%')
        .text(Math.round(progress.percent) + '%');

    var speed = formatBytes(progress.bytesPerSecond) + '/s';
    var downloaded = formatBytes(progress.transferred) + ' / ' + formatBytes(progress.total);

    $('.update-info').append(
      '<p class="progress-info"><small>' + downloaded + ' (' + speed + ')</small></p>'
    );
  }

  /**
   * Check for updates
   */
  function checkForUpdates() {
    updateStatus.checking = true;
    updateUI();

    window.electronAPI.updater.check().catch(function(err) {
      Logger.error('Failed to check for updates:', err);
      updateStatus.checking = false;
      updateUI();
    });
  }

  /**
   * Check update status
   */
  function checkStatus() {
    window.electronAPI.updater.getStatus().then(function(status) {
      updateStatus = status;
      updateUI();
    }).catch(function(err) {
      Logger.error('Failed to get update status:', err);
    });
  }

  /**
   * Show update available dialog
   */
  function showUpdateDialog(info) {
    var content = '<p>A new version of DAVE is available!</p>' +
      '<p><strong>Current version:</strong> ' + info.currentVersion + '<br>' +
      '<strong>New version:</strong> ' + info.version + '</p>';

    if (info.releaseNotes) {
      content += '<h5>Release Notes:</h5>' +
        '<div style="max-height: 200px; overflow-y: auto;">' +
        info.releaseNotes +
        '</div>';
    }

    content += '<p>Would you like to download it now?</p>';

    var $dialog = createDialog('Update Available', content, [
      {
        text: 'Download',
        class: 'btn-primary',
        click: function() {
          // Download will start automatically
          bsModal($dialog).hide();
        }
      },
      {
        text: 'Later',
        click: function() {
          bsModal($dialog).hide();
        }
      }
    ]);
  }

  /**
   * Show restart dialog
   */
  function showRestartDialog(info) {
    var content = '<p>The update has been downloaded and is ready to install.</p>' +
      '<p>DAVE will restart to apply the update.</p>' +
      '<p><strong>Make sure to save any unsaved work before restarting.</strong></p>';

    var $dialog = createDialog('Update Ready', content, [
      {
        text: 'Restart Now',
        class: 'btn-primary',
        click: function() {
          // The main process will handle the restart
          bsModal($dialog).hide();
        }
      },
      {
        text: 'Later',
        click: function() {
          bsModal($dialog).hide();
        }
      }
    ]);
  }

  /**
   * Show settings dialog
   */
  function showSettingsDialog() {
    var content = '<form>' +
      '<div class="form-group">' +
        '<label>Update Channel</label>' +
        '<select class="form-control" id="update-channel">' +
          '<option value="stable"' + (settings.channel === 'stable' ? ' selected' : '') + '>Stable (Recommended)</option>' +
          '<option value="beta"' + (settings.channel === 'beta' ? ' selected' : '') + '>Beta</option>' +
          '<option value="alpha"' + (settings.channel === 'alpha' ? ' selected' : '') + '>Alpha (Unstable)</option>' +
        '</select>' +
        '<span class="help-block">Choose which updates to receive</span>' +
      '</div>' +
      '<div class="form-group">' +
        '<div class="checkbox">' +
          '<label>' +
            '<input type="checkbox" id="auto-download"' + (settings.autoDownload ? ' checked' : '') + '> ' +
            'Automatically download updates' +
          '</label>' +
        '</div>' +
        '<span class="help-block">Download updates in the background when available</span>' +
      '</div>' +
    '</form>';

    var $dialog = createDialog('Update Settings', content, [
      {
        text: 'Save',
        class: 'btn-primary',
        click: function() {
          // Save settings
          settings.channel = $('#update-channel').val();
          settings.autoDownload = $('#auto-download').is(':checked');

          saveSettings();
          applySettings();

          bsModal($dialog).hide();
          showNotification('Settings Saved', 'Update settings have been saved.');
        }
      },
      {
        text: 'Cancel',
        click: function() {
          bsModal($dialog).hide();
        }
      }
    ]);
  }

  /**
   * Bootstrap 5 modal helper: BS5 dropped the jQuery plugin in favour of the
   * bootstrap.Modal class, so resolve (or create) the instance for a $element.
   */
  function bsModal($el) {
    return bootstrap.Modal.getOrCreateInstance($el[0]);
  }

  /**
   * Create dialog helper
   */
  function createDialog(title, content, buttons) {
    var dialogId = 'update-dialog-' + Date.now();

    var buttonsHtml = '';
    buttons.forEach(function(btn) {
      buttonsHtml += '<button type="button" class="btn ' + (btn.class || 'btn-default') +
        '" data-action="' + (btn.action || '') + '">' + btn.text + '</button>';
    });

    var $dialog = $('<div>')
      .attr('id', dialogId)
      .addClass('modal fade')
      .html(
        '<div class="modal-dialog">' +
          '<div class="modal-content">' +
            '<div class="modal-header">' +
              '<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>' +
              '<h4 class="modal-title">' + title + '</h4>' +
            '</div>' +
            '<div class="modal-body">' + content + '</div>' +
            '<div class="modal-footer">' + buttonsHtml + '</div>' +
          '</div>' +
        '</div>'
      );

    // Attach button handlers
    buttons.forEach(function(btn, index) {
      $dialog.find('.modal-footer button').eq(index).on('click', btn.click);
    });

    $dialog.appendTo('body');
    bsModal($dialog).show();

    $dialog.on('hidden.bs.modal', function() {
      $dialog.remove();
    });

    return $dialog;
  }

  /**
   * Show notification
   */
  function showNotification(title, message) {
    // Simple notification - could be enhanced with a toast library
    var $notification = $('<div class="update-notification">')
      .html('<strong>' + title + '</strong><br>' + message)
      .appendTo('body');

    setTimeout(function() {
      $notification.fadeOut(function() {
        $notification.remove();
      });
    }, 5000);
  }

  /**
   * Format bytes
   */
  function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    var k = 1024;
    var sizes = ['Bytes', 'KB', 'MB', 'GB'];
    var i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Load settings from localStorage
   */
  function loadSettings() {
    var saved = localStorage.getItem('dave-update-settings');
    if (saved) {
      try {
        settings = JSON.parse(saved);
      } catch(e) {
        Logger.error('Failed to load update settings', e);
      }
    }
  }

  /**
   * Save settings to localStorage
   */
  function saveSettings() {
    try {
      localStorage.setItem('dave-update-settings', JSON.stringify(settings));
    } catch(e) {
      Logger.error('Failed to save update settings', e);
    }
  }

  /**
   * Apply settings to updater
   */
  function applySettings() {
    window.electronAPI.updater.setChannel(settings.channel);
    window.electronAPI.updater.setAutoDownload(settings.autoDownload);
  }

  // Public API
  return {
    init: init,
    checkForUpdates: checkForUpdates,
    getStatus: function() { return updateStatus; },
    getSettings: function() { return settings; }
  };
})();

// Initialize when document is ready
$(document).ready(function() {
  if (window.electronAPI) {
    UpdateManager.init();
  }
});