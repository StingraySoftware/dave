/**
 * Accessibility utilities for DAVE
 * Implements WCAG 2.1 compliance features
 */

var AccessibilityManager = (function() {
  'use strict';
  
  var config = {
    highContrast: false,
    reducedMotion: false,
    fontSize: 'normal',
    keyboardShortcutsEnabled: true,
    announceUpdates: true
  };
  
  // ARIA live region for announcements
  var liveRegion = null;
  
  /**
   * Initialize accessibility features
   */
  function init() {
    // Create ARIA live region
    createLiveRegion();
    
    // Add skip links
    addSkipLinks();
    
    // Enhance focus visibility
    enhanceFocusIndicators();
    
    // Setup keyboard navigation
    setupKeyboardNavigation();
    
    // Check user preferences
    loadUserPreferences();
    
    // Monitor for prefers-reduced-motion
    checkReducedMotion();
    
    log('Accessibility features initialized');
  }
  
  /**
   * Create ARIA live region for screen reader announcements
   */
  function createLiveRegion() {
    liveRegion = $('<div>')
      .attr('id', 'aria-live-region')
      .attr('aria-live', 'polite')
      .attr('aria-atomic', 'true')
      .addClass('sr-only')
      .appendTo('body');
  }
  
  /**
   * Announce message to screen readers
   */
  function announce(message, priority) {
    if (!config.announceUpdates) return;
    
    priority = priority || 'polite';
    
    if (liveRegion) {
      liveRegion
        .attr('aria-live', priority)
        .text(message);
      
      // Clear after announcement
      setTimeout(function() {
        liveRegion.empty();
      }, 1000);
    }
  }
  
  /**
   * Add skip navigation links
   */
  function addSkipLinks() {
    var skipNav = $('<div class="skip-links">')
      .html('<a href="#main-content" class="skip-link">Skip to main content</a>' +
            '<a href="#navigation" class="skip-link">Skip to navigation</a>' +
            '<a href="#analysis-tools" class="skip-link">Skip to analysis tools</a>')
      .prependTo('body');
    
    // Show on focus
    skipNav.on('focusin', 'a', function() {
      $(this).addClass('skip-link-focused');
    }).on('focusout', 'a', function() {
      $(this).removeClass('skip-link-focused');
    });
  }
  
  /**
   * Enhance focus indicators for better visibility
   */
  function enhanceFocusIndicators() {
    // Add focus styles dynamically
    var style = $('<style>')
      .text(
        '*:focus { outline: 3px solid #4A90E2 !important; outline-offset: 2px !important; }' +
        '.skip-link { position: absolute; left: -10000px; top: auto; width: 1px; height: 1px; overflow: hidden; }' +
        '.skip-link-focused { position: static; width: auto; height: auto; }' +
        '.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }' +
        '.high-contrast * { color: #000 !important; background-color: #fff !important; }' +
        '.high-contrast button, .high-contrast .btn { border: 2px solid #000 !important; }'
      )
      .appendTo('head');
  }
  
  /**
   * Setup keyboard navigation enhancements
   */
  function setupKeyboardNavigation() {
    // Global keyboard shortcuts
    $(document).on('keydown', function(e) {
      if (!config.keyboardShortcutsEnabled) return;
      
      // Alt + key combinations
      if (e.altKey) {
        switch(e.which) {
          case 72: // Alt + H - Help
            e.preventDefault();
            showKeyboardHelp();
            break;
          case 78: // Alt + N - New analysis
            e.preventDefault();
            focusElement('.btnNewAnalysis');
            break;
          case 85: // Alt + U - Upload file
            e.preventDefault();
            focusElement('.btnChoose:first');
            break;
          case 80: // Alt + P - Plot data
            e.preventDefault();
            focusElement('.btnPlot:first');
            break;
        }
      }
      
      // Escape key - close dialogs
      if (e.which === 27) {
        closeActiveDialog();
      }
    });
    
    // Make custom controls keyboard accessible
    makeCustomControlsAccessible();
  }
  
  /**
   * Make custom controls keyboard accessible
   */
  function makeCustomControlsAccessible() {
    // File selectors
    $('.fileSelector').each(function() {
      var $selector = $(this);
      $selector.attr('role', 'group')
               .attr('aria-label', $selector.find('h3').text());
      
      // Make buttons keyboard accessible
      $selector.find('button').attr('tabindex', '0');
    });
    
    // Sliders
    $('.sliderSelector').each(function() {
      var $slider = $(this);
      var $input = $slider.find('input[type="range"]');
      var label = $slider.find('label').text();
      
      $input.attr('aria-label', label)
            .attr('aria-valuemin', $input.attr('min'))
            .attr('aria-valuemax', $input.attr('max'))
            .attr('aria-valuenow', $input.val());
      
      // Update aria-valuenow on change
      $input.on('input change', function() {
        $(this).attr('aria-valuenow', $(this).val());
      });
    });
    
    // Tab panels
    $('.nav-tabs').attr('role', 'tablist');
    $('.nav-tabs li').attr('role', 'presentation');
    $('.nav-tabs a').attr('role', 'tab')
                    .attr('aria-selected', 'false')
                    .attr('tabindex', '-1');
    
    $('.nav-tabs li.active a').attr('aria-selected', 'true')
                              .attr('tabindex', '0');
    
    // Tab panel keyboard navigation
    $('.nav-tabs').on('keydown', 'a', function(e) {
      var $tabs = $(this).closest('.nav-tabs').find('a');
      var currentIndex = $tabs.index(this);
      
      switch(e.which) {
        case 37: // Left arrow
        case 38: // Up arrow
          e.preventDefault();
          var prevIndex = currentIndex - 1;
          if (prevIndex < 0) prevIndex = $tabs.length - 1;
          $tabs.eq(prevIndex).click().focus();
          break;
          
        case 39: // Right arrow
        case 40: // Down arrow
          e.preventDefault();
          var nextIndex = currentIndex + 1;
          if (nextIndex >= $tabs.length) nextIndex = 0;
          $tabs.eq(nextIndex).click().focus();
          break;
          
        case 36: // Home
          e.preventDefault();
          $tabs.first().click().focus();
          break;
          
        case 35: // End
          e.preventDefault();
          $tabs.last().click().focus();
          break;
      }
    });
  }
  
  /**
   * Apply high contrast mode
   */
  function toggleHighContrast() {
    config.highContrast = !config.highContrast;
    $('body').toggleClass('high-contrast', config.highContrast);
    saveUserPreferences();
    announce(config.highContrast ? 'High contrast mode enabled' : 'High contrast mode disabled');
  }
  
  /**
   * Adjust font size
   */
  function adjustFontSize(size) {
    var sizes = {
      'small': '14px',
      'normal': '16px',
      'large': '18px',
      'x-large': '20px'
    };
    
    config.fontSize = size;
    $('body').css('font-size', sizes[size] || sizes.normal);
    saveUserPreferences();
    announce('Font size changed to ' + size);
  }
  
  /**
   * Check for reduced motion preference
   */
  function checkReducedMotion() {
    var mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    config.reducedMotion = mediaQuery.matches;
    
    mediaQuery.addListener(function(e) {
      config.reducedMotion = e.matches;
      applyReducedMotion();
    });
    
    applyReducedMotion();
  }
  
  /**
   * Apply reduced motion settings
   */
  function applyReducedMotion() {
    if (config.reducedMotion) {
      $('body').addClass('reduce-motion');
      // Disable animations
      $.fx.off = true;
    } else {
      $('body').removeClass('reduce-motion');
      $.fx.off = false;
    }
  }
  
  /**
   * Show keyboard shortcuts help
   */
  function showKeyboardHelp() {
    var helpContent = '<h2>Keyboard Shortcuts</h2>' +
      '<table class="table">' +
      '<tr><th>Shortcut</th><th>Action</th></tr>' +
      '<tr><td>Alt + H</td><td>Show this help</td></tr>' +
      '<tr><td>Alt + N</td><td>New analysis</td></tr>' +
      '<tr><td>Alt + U</td><td>Upload file</td></tr>' +
      '<tr><td>Alt + P</td><td>Plot data</td></tr>' +
      '<tr><td>Tab</td><td>Navigate forward</td></tr>' +
      '<tr><td>Shift + Tab</td><td>Navigate backward</td></tr>' +
      '<tr><td>Enter/Space</td><td>Activate button</td></tr>' +
      '<tr><td>Arrow keys</td><td>Navigate within components</td></tr>' +
      '<tr><td>Escape</td><td>Close dialog</td></tr>' +
      '</table>';
    
    showAccessibleDialog('Keyboard Shortcuts', helpContent);
  }
  
  /**
   * Show accessible dialog
   */
  function showAccessibleDialog(title, content) {
    var dialogId = 'accessible-dialog-' + Date.now();
    
    var $dialog = $('<div>')
      .attr('id', dialogId)
      .attr('role', 'dialog')
      .attr('aria-labelledby', dialogId + '-title')
      .attr('aria-modal', 'true')
      .addClass('modal fade')
      .html(
        '<div class="modal-dialog">' +
          '<div class="modal-content">' +
            '<div class="modal-header">' +
              '<button type="button" class="close" data-dismiss="modal" aria-label="Close">' +
                '<span aria-hidden="true">&times;</span>' +
              '</button>' +
              '<h4 class="modal-title" id="' + dialogId + '-title">' + title + '</h4>' +
            '</div>' +
            '<div class="modal-body">' + content + '</div>' +
            '<div class="modal-footer">' +
              '<button type="button" class="btn btn-primary" data-dismiss="modal">Close</button>' +
            '</div>' +
          '</div>' +
        '</div>'
      );
    
    $dialog.appendTo('body');
    
    // Focus management
    $dialog.on('shown.bs.modal', function() {
      $dialog.find('.modal-title').focus();
      trapFocus($dialog);
    });
    
    $dialog.on('hidden.bs.modal', function() {
      $dialog.remove();
    });
    
    $dialog.modal('show');
  }
  
  /**
   * Trap focus within element
   */
  function trapFocus($element) {
    var focusableElements = $element.find('a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
    var firstFocusable = focusableElements.first();
    var lastFocusable = focusableElements.last();
    
    $element.on('keydown', function(e) {
      if (e.which === 9) { // Tab
        if (e.shiftKey) { // Shift + Tab
          if (document.activeElement === firstFocusable[0]) {
            e.preventDefault();
            lastFocusable.focus();
          }
        } else { // Tab
          if (document.activeElement === lastFocusable[0]) {
            e.preventDefault();
            firstFocusable.focus();
          }
        }
      }
    });
  }
  
  /**
   * Focus element with selector
   */
  function focusElement(selector) {
    var $element = $(selector).first();
    if ($element.length) {
      $element.focus();
      announce('Focused on ' + ($element.attr('aria-label') || $element.text()));
    }
  }
  
  /**
   * Close active dialog
   */
  function closeActiveDialog() {
    $('.modal.in').modal('hide');
  }
  
  /**
   * Load user preferences
   */
  function loadUserPreferences() {
    var saved = localStorage.getItem('dave-accessibility');
    if (saved) {
      try {
        var prefs = JSON.parse(saved);
        $.extend(config, prefs);
        applyPreferences();
      } catch(e) {
        Logger.error('Failed to load accessibility preferences', e);
      }
    }
  }
  
  /**
   * Save user preferences
   */
  function saveUserPreferences() {
    try {
      localStorage.setItem('dave-accessibility', JSON.stringify(config));
    } catch(e) {
      Logger.error('Failed to save accessibility preferences', e);
    }
  }
  
  /**
   * Apply saved preferences
   */
  function applyPreferences() {
    if (config.highContrast) {
      $('body').addClass('high-contrast');
    }
    
    if (config.fontSize !== 'normal') {
      adjustFontSize(config.fontSize);
    }
  }
  
  // Public API
  return {
    init: init,
    announce: announce,
    toggleHighContrast: toggleHighContrast,
    adjustFontSize: adjustFontSize,
    showKeyboardHelp: showKeyboardHelp,
    config: config
  };
})();

// Initialize when document is ready
$(document).ready(function() {
  AccessibilityManager.init();
});