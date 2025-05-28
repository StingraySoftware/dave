// Plotly.js Migration Helper Functions
// For migrating from Plotly 1.30.1 to 2.35.2

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
  
  // Use WebGL for large datasets
  if (dataLength > 1000) {
    switch (trace.type) {
      case 'scatter':
        trace.type = 'scattergl';
        break;
      case 'scatter3d':
        // Already uses WebGL
        break;
    }
  }
  
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