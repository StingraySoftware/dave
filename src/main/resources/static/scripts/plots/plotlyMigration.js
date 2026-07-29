// Plotly.js Migration Helper Functions
// For migrating from Plotly 1.30.1 to 2.35.2

// Fix for Electron context isolation - ensure Plotly is available globally
(function() {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePlotly);
  } else {
    initializePlotly();
  }
  
  function initializePlotly() {
    // In Electron with context isolation, Plotly might not expose itself to window
    // This ensures it's available globally for our application
    var attempts = 0;
    var maxAttempts = 50; // 5 seconds max
    
    function checkPlotly() {
      attempts++;
      
      // Check if Plotly is already available
      if (typeof window.Plotly !== 'undefined') {
        console.log('Plotly already available globally');
        return;
      }
      
      // Try to find Plotly in various locations
      var plotlyObj = null;
      
      // Check if it's in a module context
      if (typeof Plotly !== 'undefined') {
        plotlyObj = Plotly;
      }
      
      // Check if it was loaded but not exposed
      try {
        // Some versions expose themselves differently
        if (typeof require !== 'undefined') {
          // This won't work in browser context, but we're checking anyway
          plotlyObj = require('plotly.js');
        }
      } catch (e) {
        // Expected in browser context
      }
      
      // If we found Plotly, expose it to window
      if (plotlyObj && typeof plotlyObj.newPlot === 'function') {
        window.Plotly = plotlyObj;
        console.log('Plotly exposed to window object, version:', plotlyObj.version || 'unknown');
        return;
      }
      
      // If not found and we haven't exceeded attempts, try again
      if (attempts < maxAttempts) {
        setTimeout(checkPlotly, 100);
      } else {
        console.warn('Failed to initialize Plotly after', maxAttempts, 'attempts');
        // Create a placeholder to prevent errors
        window.Plotly = {
          version: 'not-loaded',
          newPlot: function() { console.error('Plotly not properly loaded'); },
          react: function() { console.error('Plotly not properly loaded'); }
        };
      }
    }
    
    // Start checking for Plotly
    checkPlotly();
  }
})();

// Add migration defaults to maintain backward compatibility
function addPlotlyMigrationDefaults(layout) {
  // Ensure layout object exists
  layout = layout || {};

  // Maintain old margin behavior (don't auto-expand)
  if (layout.margin && !layout.margin.hasOwnProperty('autoexpand')) {
    layout.margin.autoexpand = false;
  }

  // Keep autosize behavior consistent
  if (!layout.hasOwnProperty('autosize')) {
    layout.autosize = true;
  }

  // Ensure hover behavior remains consistent
  if (!layout.hasOwnProperty('hovermode')) {
    layout.hovermode = 'closest';
  }

  // Add default dragmode if not specified
  if (!layout.hasOwnProperty('dragmode')) {
    layout.dragmode = 'zoom';
  }

  return layout;
}

// Create default config for all plots
function getPlotlyDefaultConfig(plotId) {
  return {
    responsive: true,  // Make plots responsive
    displayModeBar: true,  // Show the toolbar
    displaylogo: false,  // Hide Plotly logo
    modeBarButtonsToRemove: ['sendDataToCloud'],  // Remove cloud button
    modeBarButtonsToAdd: [],
    toImageButtonOptions: {
      format: 'png',
      filename: 'dave_plot_' + (plotId || Date.now()),
      height: 800,
      width: 1200,
      scale: 2  // Higher resolution
    },
    editable: false,  // Disable edit in place
    scrollZoom: true  // Enable scroll zoom
  };
}

// Optimize trace for performance based on data size
function optimizeTraceForPerformance(trace) {
  if (!trace || !trace.x) return trace;

  var dataLength = trace.x.length;

  // // Use WebGL for large datasets
  // if (dataLength > 1000) {
  //   switch (trace.type) {
  //     case 'scatter':
  //       trace.type = 'scattergl';
  //       break;
  //     case 'scatter3d':
  //       // Already uses WebGL
  //       break;
  //   }
  // }

  // Optimize marker mode for very large datasets
  if (dataLength > 10000 && trace.mode === 'lines+markers') {
    trace.mode = 'lines';  // Skip markers for performance
  }

  return trace;
}

// Safe Plotly method wrapper with error handling
function safePlotlyCall(method, ...args) {
  return new Promise((resolve, reject) => {
    try {
      var result = Plotly[method](...args);
      if (result && result.then) {
        result.then(resolve).catch(reject);
      } else {
        resolve(result);
      }
    } catch (error) {
      console.error('Plotly error in ' + method + ':', error);
      reject(error);
    }
  });
}

// Enhanced newPlot with migration support
function plotlyNewPlot(divId, data, layout, config) {
  // Apply migration defaults
  layout = addPlotlyMigrationDefaults(layout);

  // Apply default config if not provided
  config = config || getPlotlyDefaultConfig(divId);

  // Optimize traces for performance
  if (Array.isArray(data)) {
    data = data.map(optimizeTraceForPerformance);
  }

  // Call Plotly with error handling
  return safePlotlyCall('newPlot', divId, data, layout, config);
}

// Enhanced react for updating plots
function plotlyReact(divId, data, layout, config) {
  // Apply migration defaults
  layout = addPlotlyMigrationDefaults(layout);

  // Apply default config if not provided
  config = config || getPlotlyDefaultConfig(divId);

  // Optimize traces for performance
  if (Array.isArray(data)) {
    data = data.map(optimizeTraceForPerformance);
  }

  // Use react for better performance
  return safePlotlyCall('react', divId, data, layout, config);
}

// Export functions for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    addPlotlyMigrationDefaults,
    getPlotlyDefaultConfig,
    optimizeTraceForPerformance,
    safePlotlyCall,
    plotlyNewPlot,
    plotlyReact
  };
}