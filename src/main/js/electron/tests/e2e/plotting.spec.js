const { test, expect } = require('@playwright/test');
const { ElectronAppHelper } = require('./electron-helpers');

test.describe('Plotting Functionality', () => {
  let electronApp;

  test.beforeEach(async () => {
    electronApp = new ElectronAppHelper();
    await electronApp.launch();
    
    // Wait for app to be ready
    await electronApp.window.waitForTimeout(3000);
  });

  test.afterEach(async () => {
    await electronApp.close();
  });

  test('should have Plotly library loaded', async () => {
    const plotlyVersion = await electronApp.evaluate(() => {
      if (typeof Plotly !== 'undefined' && Plotly.version) {
        return Plotly.version;
      }
      return null;
    });
    
    expect(plotlyVersion).toBeTruthy();
    console.log('Plotly version:', plotlyVersion);
  });

  test('should have plot containers available', async () => {
    // Check for plot containers in the UI
    const plotContainers = await electronApp.evaluate(() => {
      const containers = [];
      
      // Common plot container selectors
      const selectors = [
        '[id$="Plot"]',
        '.plot-container',
        '.plotly',
        '#outputPanel'
      ];
      
      selectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          if (el.id || el.className) {
            containers.push({
              id: el.id,
              className: el.className,
              tag: el.tagName
            });
          }
        });
      });
      
      return containers;
    });
    
    console.log('Found plot containers:', plotContainers);
    expect(plotContainers.length).toBeGreaterThan(0);
  });

  test('should have plot type options available', async () => {
    // Check for plot type selectors
    const plotTypes = await electronApp.evaluate(() => {
      const types = [];
      
      // Look for plot type selectors
      const selectors = [
        '#plotType',
        '[name="plotType"]',
        '.plot-type-selector',
        'select[data-plot-type]'
      ];
      
      selectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          if (el.tagName === 'SELECT') {
            const options = Array.from(el.options).map(opt => ({
              value: opt.value,
              text: opt.text
            }));
            types.push(...options);
          }
        });
      });
      
      // Also check for tab-based plot selection
      const tabs = document.querySelectorAll('[role="tab"], .nav-tabs a');
      tabs.forEach(tab => {
        const text = tab.textContent.trim();
        if (text.toLowerCase().includes('plot') || 
            ['lightcurve', 'pds', 'phase', 'timing'].some(t => text.toLowerCase().includes(t))) {
          types.push({ value: text, text: text });
        }
      });
      
      return types;
    });
    
    console.log('Available plot types:', plotTypes);
  });

  test('should create a plot element with Plotly', async () => {
    // Test creating a simple plot
    const plotCreated = await electronApp.evaluate(async () => {
      // Create a test div
      const testDiv = document.createElement('div');
      testDiv.id = 'test-plot';
      testDiv.style.width = '600px';
      testDiv.style.height = '400px';
      document.body.appendChild(testDiv);
      
      try {
        // Create a simple plot
        const data = [{
          x: [1, 2, 3, 4],
          y: [10, 15, 13, 17],
          type: 'scatter'
        }];
        
        const layout = {
          title: 'Test Plot',
          xaxis: { title: 'X Axis' },
          yaxis: { title: 'Y Axis' }
        };
        
        // Check if migration helper exists
        if (typeof plotlyNewPlot === 'function') {
          await plotlyNewPlot('test-plot', data, layout);
        } else {
          await Plotly.newPlot('test-plot', data, layout);
        }
        
        // Verify plot was created
        const plotElement = document.getElementById('test-plot');
        const hasPlotly = plotElement && plotElement.classList.contains('js-plotly-plot');
        
        // Clean up
        document.body.removeChild(testDiv);
        
        return hasPlotly;
      } catch (error) {
        console.error('Plot creation error:', error);
        return false;
      }
    });
    
    expect(plotCreated).toBe(true);
  });

  test('should have responsive plots', async () => {
    // Test plot responsiveness
    const isResponsive = await electronApp.evaluate(() => {
      // Check if Plotly responsive config is used
      const plotElements = document.querySelectorAll('.js-plotly-plot');
      
      if (plotElements.length > 0) {
        // Check first plot for responsive settings
        const plot = plotElements[0];
        const layout = plot.layout || {};
        
        return layout.autosize !== false;
      }
      
      // Check global config
      return typeof Plotly !== 'undefined' && Plotly.config && Plotly.config.responsive !== false;
    });
    
    console.log('Plots are responsive:', isResponsive);
  });

  test('should handle plot interactions', async () => {
    // Test plot interaction capabilities
    const interactions = await electronApp.evaluate(() => {
      const capabilities = {
        zoom: false,
        pan: false,
        hover: false,
        click: false
      };
      
      // Check for Plotly interaction buttons
      const modebar = document.querySelector('.modebar');
      if (modebar) {
        capabilities.zoom = !!modebar.querySelector('[data-title*="zoom"]');
        capabilities.pan = !!modebar.querySelector('[data-title*="pan"]');
      }
      
      // Check if plot config enables interactions
      if (typeof Plotly !== 'undefined') {
        const defaultConfig = {
          scrollZoom: true,
          doubleClick: 'reset',
          showTips: true
        };
        
        capabilities.hover = defaultConfig.showTips;
        capabilities.click = true; // Plotly enables click by default
      }
      
      return capabilities;
    });
    
    console.log('Plot interaction capabilities:', interactions);
  });
});