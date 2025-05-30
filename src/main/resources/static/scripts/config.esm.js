// ES6 Module wrapper for config.js
// This demonstrates how to gradually migrate to modules while maintaining backward compatibility

// Import jQuery globally (will be provided by Vite)
import $ from 'jquery';
import 'jquery-ui';
window.$ = window.jQuery = $;

// Original CONFIG object with modern updates
export const CONFIG = {
  DEBUG_MODE: false,
  IS_DEV_ENV: import.meta.env.DEV,
  APP_VERSION: __APP_VERSION__,
  
  // API endpoints
  URLS: {
    CONFIG: '/get_config',
    UPLOAD: '/upload',
    DATASET_HEADER: '/get_dataset_header',
    APPEND_FILE: '/append_file_to_dataset',
    APPLY_FILTERS: '/apply_filters',
    PLOT_DATA: '/get_plot_data',
    LIGHTCURVE: '/get_lightcurve',
    DIVIDED_LIGHTCURVES: '/get_divided_lightcurves_from_colors',
    JOINED_LIGHTCURVES: '/get_joined_lightcurves',
    DIVIDED_LIGHTCURVE_DS: '/get_divided_lightcurve_ds',
    DATASET_SCHEMA: '/get_dataset_schema'
  },
  
  // UI Configuration
  PLOTS: {
    MIN_PLOT_POINTS: 2,
    MAX_PLOT_POINTS: 5000000,
    DEFAULT_PLOT_WIDTH: 0,
    DEFAULT_PLOT_HEIGHT: 0
  },
  
  // File handling
  FILES: {
    MAX_UPLOAD_SIZE: 250 * 1024 * 1024, // 250MB
    ALLOWED_EXTENSIONS: ['.txt', '.lc', '.evt', '.fits']
  },
  
  // Performance
  CACHE: {
    ENABLED: true,
    TTL: 3600000 // 1 hour
  }
};

// Make CONFIG available globally for backward compatibility
window.CONFIG = CONFIG;

// Helper functions that were in the original config.js
export function isElectron() {
  return window && window.process && window.process.type;
}

export function isDevelopment() {
  return CONFIG.IS_DEV_ENV;
}

export function getApiUrl(endpoint) {
  const baseUrl = isDevelopment() ? 'http://localhost:5000' : '';
  return `${baseUrl}${CONFIG.URLS[endpoint] || endpoint}`;
}

// Export logger configuration
export const Logger = {
  enabled: CONFIG.DEBUG_MODE,
  log: function(...args) {
    if (this.enabled) {
      console.log('[DAVE]', ...args);
    }
  },
  error: function(...args) {
    console.error('[DAVE ERROR]', ...args);
  },
  warn: function(...args) {
    if (this.enabled) {
      console.warn('[DAVE WARN]', ...args);
    }
  }
};

// Make Logger globally available
window.Logger = Logger;

// Initialize on DOM ready
$(document).ready(function() {
  log('Config module loaded: ' + JSON.stringify(CONFIG));
});

export default CONFIG;