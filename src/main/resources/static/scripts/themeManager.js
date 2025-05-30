/**
 * Theme Manager for DAVE
 * Handles dark mode and theme switching
 */

var ThemeManager = (function() {
  'use strict';
  
  var themes = {
    light: {
      name: 'Light',
      className: 'theme-light',
      icon: 'fa-sun-o'
    },
    dark: {
      name: 'Dark',
      className: 'theme-dark',
      icon: 'fa-moon-o'
    },
    auto: {
      name: 'Auto',
      className: 'theme-auto',
      icon: 'fa-adjust'
    }
  };
  
  var currentTheme = 'light';
  var systemPreference = 'light';
  var mediaQuery = null;
  
  /**
   * Initialize theme manager
   */
  function init() {
    // Load saved preference
    loadThemePreference();
    
    // Detect system theme preference
    detectSystemTheme();
    
    // Add theme switcher to UI
    addThemeSwitcher();
    
    // Apply initial theme
    applyTheme();
    
    // Listen for system theme changes
    if (mediaQuery) {
      mediaQuery.addListener(handleSystemThemeChange);
    }
    
    log('Theme manager initialized with theme: ' + currentTheme);
  }
  
  /**
   * Detect system theme preference
   */
  function detectSystemTheme() {
    if (window.matchMedia) {
      mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      systemPreference = mediaQuery.matches ? 'dark' : 'light';
    }
    
    // Also check Electron native theme if available
    if (window.electronAPI) {
      window.electronAPI.theme.system().then(function(theme) {
        systemPreference = theme;
        if (currentTheme === 'auto') {
          applyTheme();
        }
      }).catch(function(err) {
        Logger.error('Failed to get system theme:', err);
      });
    }
  }
  
  /**
   * Handle system theme change
   */
  function handleSystemThemeChange(e) {
    systemPreference = e.matches ? 'dark' : 'light';
    if (currentTheme === 'auto') {
      applyTheme();
      log('System theme changed to: ' + systemPreference);
    }
  }
  
  /**
   * Add theme switcher to navbar
   */
  function addThemeSwitcher() {
    var $themeSwitcher = $('<li id="theme-switcher" class="dropdown">')
      .html(
        '<a href="#" class="dropdown-toggle" data-toggle="dropdown" title="Switch theme">' +
          '<i class="fa fa-adjust" aria-hidden="true"></i>' +
        '</a>' +
        '<ul class="dropdown-menu theme-menu">' +
          '<li class="theme-option" data-theme="light">' +
            '<a href="#"><i class="fa fa-sun-o"></i> Light</a>' +
          '</li>' +
          '<li class="theme-option" data-theme="dark">' +
            '<a href="#"><i class="fa fa-moon-o"></i> Dark</a>' +
          '</li>' +
          '<li class="theme-option" data-theme="auto">' +
            '<a href="#"><i class="fa fa-adjust"></i> Auto</a>' +
          '</li>' +
        '</ul>'
      );
    
    $('#right-navbar').append($themeSwitcher);
    
    // Update active indicator
    updateThemeMenu();
    
    // Handle theme selection
    $('.theme-option').on('click', function(e) {
      e.preventDefault();
      var theme = $(this).data('theme');
      setTheme(theme);
    });
    
    // Keyboard shortcut (Alt + T)
    $(document).on('keydown', function(e) {
      if (e.altKey && e.which === 84) { // Alt + T
        e.preventDefault();
        cycleTheme();
      }
    });
  }
  
  /**
   * Update theme menu active state
   */
  function updateThemeMenu() {
    $('.theme-option').removeClass('active');
    $('.theme-option[data-theme="' + currentTheme + '"]').addClass('active');
    
    // Update icon
    var icon = themes[currentTheme].icon;
    $('#theme-switcher > a > i').removeClass().addClass('fa ' + icon);
  }
  
  /**
   * Set theme
   */
  function setTheme(theme) {
    if (!themes[theme]) {
      Logger.error('Invalid theme:', theme);
      return;
    }
    
    currentTheme = theme;
    saveThemePreference();
    applyTheme();
    updateThemeMenu();
    
    // Announce to screen readers
    if (typeof AccessibilityManager !== 'undefined') {
      AccessibilityManager.announce('Theme changed to ' + themes[theme].name);
    }
    
    log('Theme set to: ' + theme);
  }
  
  /**
   * Apply current theme
   */
  function applyTheme() {
    var effectiveTheme = currentTheme;
    
    // Resolve auto theme
    if (currentTheme === 'auto') {
      effectiveTheme = systemPreference;
    }
    
    // Remove all theme classes
    $('body').removeClass('theme-light theme-dark theme-auto');
    
    // Add current theme class
    $('body').addClass(themes[effectiveTheme].className);
    
    // Update meta theme-color for mobile browsers
    updateThemeColor(effectiveTheme);
    
    // Notify Electron to update native theme
    if (window.electronAPI) {
      window.electronAPI.theme.set(effectiveTheme).catch(function(err) {
        Logger.error('Failed to set native theme:', err);
      });
    }
    
    // Update Plotly theme
    updatePlotlyTheme(effectiveTheme);
    
    // Trigger custom event
    $(document).trigger('themeChanged', [effectiveTheme]);
  }
  
  /**
   * Update meta theme-color
   */
  function updateThemeColor(theme) {
    var colors = {
      light: '#ffffff',
      dark: '#1a1a1a'
    };
    
    var $meta = $('meta[name="theme-color"]');
    if ($meta.length === 0) {
      $meta = $('<meta name="theme-color">').appendTo('head');
    }
    $meta.attr('content', colors[theme] || colors.light);
  }
  
  /**
   * Update Plotly theme
   */
  function updatePlotlyTheme(theme) {
    if (typeof Plotly === 'undefined') return;
    
    var plotlyTheme = {
      light: {
        paper_bgcolor: 'white',
        plot_bgcolor: 'white',
        font: { color: '#333' },
        gridcolor: '#e1e1e1',
        zerolinecolor: '#969696'
      },
      dark: {
        paper_bgcolor: '#1a1a1a',
        plot_bgcolor: '#1a1a1a',
        font: { color: '#f0f0f0' },
        gridcolor: '#444',
        zerolinecolor: '#666'
      }
    };
    
    // Store theme for new plots
    window.PLOTLY_THEME = plotlyTheme[theme] || plotlyTheme.light;
    
    // Update existing plots
    $('.plotly-graph-div').each(function() {
      var plotId = this.id;
      if (plotId) {
        try {
          Plotly.relayout(plotId, window.PLOTLY_THEME);
        } catch (e) {
          Logger.error('Failed to update plot theme:', e);
        }
      }
    });
  }
  
  /**
   * Cycle through themes
   */
  function cycleTheme() {
    var themeOrder = ['light', 'dark', 'auto'];
    var currentIndex = themeOrder.indexOf(currentTheme);
    var nextIndex = (currentIndex + 1) % themeOrder.length;
    setTheme(themeOrder[nextIndex]);
  }
  
  /**
   * Load theme preference
   */
  function loadThemePreference() {
    // Try localStorage first
    var saved = localStorage.getItem('dave-theme');
    if (saved && themes[saved]) {
      currentTheme = saved;
      return;
    }
    
    // Try Electron storage
    if (window.electronAPI) {
      window.electronAPI.theme.get().then(function(theme) {
        if (theme && themes[theme]) {
          currentTheme = theme;
          applyTheme();
          updateThemeMenu();
        }
      }).catch(function(err) {
        Logger.error('Failed to load theme preference:', err);
      });
    }
  }
  
  /**
   * Save theme preference
   */
  function saveThemePreference() {
    // Save to localStorage
    try {
      localStorage.setItem('dave-theme', currentTheme);
    } catch (e) {
      Logger.error('Failed to save theme to localStorage:', e);
    }
    
    // Save to Electron storage
    if (window.electronAPI) {
      window.electronAPI.theme.set(currentTheme).catch(function(err) {
        Logger.error('Failed to save theme preference:', err);
      });
    }
  }
  
  /**
   * Get current theme
   */
  function getCurrentTheme() {
    return currentTheme;
  }
  
  /**
   * Get effective theme (resolving auto)
   */
  function getEffectiveTheme() {
    return currentTheme === 'auto' ? systemPreference : currentTheme;
  }
  
  /**
   * Check if dark mode is active
   */
  function isDarkMode() {
    return getEffectiveTheme() === 'dark';
  }
  
  // Public API
  return {
    init: init,
    setTheme: setTheme,
    getCurrentTheme: getCurrentTheme,
    getEffectiveTheme: getEffectiveTheme,
    isDarkMode: isDarkMode,
    cycleTheme: cycleTheme
  };
})();

// Initialize when document is ready
$(document).ready(function() {
  ThemeManager.init();
});