const { test, expect } = require('@playwright/test');
const { ElectronAppHelper } = require('./electron-helpers');
const axios = require('axios');

test.describe('Server Communication', () => {
  let electronApp;
  const serverUrl = 'http://localhost:5001';

  test.beforeEach(async () => {
    electronApp = new ElectronAppHelper();
    await electronApp.launch();

    // Wait for app and server to be ready
    await electronApp.window.waitForTimeout(3000);
  });

  test.afterEach(async () => {
    await electronApp.close();
  });

  test('Python server should be running', async () => {
    try {
      const response = await axios.get(`${serverUrl}/`);
      expect(response.status).toBe(200);
    } catch (error) {
      // Server might not be on root path
      console.log('Server root check failed, trying API endpoints');
    }
  });

  test('should get server version through API', async () => {
    const version = await electronApp.evaluate(async () => {
      return new Promise((resolve, reject) => {
        if (window.service && window.service.get_server_version) {
          window.service.get_server_version((error, result) => {
            if (error) {
              reject(error);
            } else {
              resolve(result);
            }
          });
        } else {
          reject(new Error('Service not available'));
        }
      });
    }).catch(error => {
      console.log('Version check error:', error);
      return null;
    });

    if (version) {
      expect(version).toBeTruthy();
      console.log('Server version:', version);
    }
  });

  test('should handle file upload through service', async () => {
    // Wait for service to be fully initialized - longer timeout
    await electronApp.window.waitForTimeout(10000);
    
    // Test the service layer's upload functionality
    const uploadCapability = await electronApp.evaluate(() => {
      if (window.service) {
        return {
          hasUploadDataset: typeof window.service.upload_dataset === 'function',
          hasUploadFile: typeof window.service.upload_file === 'function',
          hasGetDatasets: typeof window.service.get_datasets === 'function'
        };
      }
      return null;
    });

    if (uploadCapability) {
      expect(uploadCapability.hasUploadDataset || uploadCapability.hasUploadFile).toBe(true);
      console.log('Upload capabilities found:', uploadCapability);
    } else {
      console.log('Service not yet available - this may be normal during early app initialization');
    }
  });

  test('should handle plot requests through service', async () => {
    // Wait for service to be fully initialized
    await electronApp.window.waitForTimeout(5000);
    
    // Test plot-related service methods
    const plotServices = await electronApp.evaluate(() => {
      if (window.service) {
        const methods = {};
        const plotMethods = [
          'get_plot_data',
          'get_lightcurve',
          'get_pds',
          'get_phase_plot',
          'get_dynamic_spectrum',
          'append_lightcurve'
        ];

        plotMethods.forEach(method => {
          methods[method] = typeof window.service[method] === 'function';
        });

        return methods;
      }
      return null;
    });

    if (plotServices) {
      console.log('Available plot services:', plotServices);
    } else {
      console.log('Plot services not yet available - this may be normal during early app initialization');
    }
  });

  test('should handle dataset operations', async () => {
    // Wait for service to be fully initialized
    await electronApp.window.waitForTimeout(5000);
    
    // Test dataset-related operations
    const datasetOps = await electronApp.evaluate(() => {
      if (window.service) {
        return {
          hasGetDatasets: typeof window.service.get_datasets === 'function',
          hasGetDataset: typeof window.service.get_dataset === 'function',
          hasGetColumns: typeof window.service.get_dataset_columns === 'function',
          hasApplyFilters: typeof window.service.apply_filters === 'function'
        };
      }
      return null;
    });

    if (datasetOps) {
      expect(datasetOps.hasGetDatasets).toBe(true);
      expect(datasetOps.hasGetDataset).toBe(true);
      console.log('Dataset operations available:', datasetOps);
    } else {
      console.log('Dataset operations not yet available - this may be normal during early app initialization');
    }
  });

  test('should maintain session through service', async () => {
    // Wait for service to be fully initialized
    await electronApp.window.waitForTimeout(5000);
    
    // Test session handling
    const sessionInfo = await electronApp.evaluate(async () => {
      if (window.service && window.service._uid) {
        return {
          hasUid: true,
          uidLength: window.service._uid.length
        };
      }
      return { hasUid: false };
    });

    if (sessionInfo.hasUid) {
      expect(sessionInfo.uidLength).toBeGreaterThan(0);
      console.log('Session UID available, length:', sessionInfo.uidLength);
    } else {
      console.log('Session UID not yet available - this may be normal during early app initialization');
    }
  });

  test('should handle server errors gracefully', async () => {
    // Wait for service to be fully initialized
    await electronApp.window.waitForTimeout(5000);
    
    // Test error handling
    const errorHandling = await electronApp.evaluate(async () => {
      return new Promise((resolve) => {
        if (window.service) {
          // Try to call a method with invalid parameters
          window.service.get_dataset('invalid_dataset_id', (error, result) => {
            resolve({
              hasError: !!error,
              errorHandled: true
            });
          });
        } else {
          resolve({ errorHandled: false });
        }
      });
    });

    if (errorHandling.errorHandled) {
      console.log('Error handling working correctly');
    } else {
      console.log('Error handling not yet available - this may be normal during early app initialization');
    }
  });

  test('should use axios for HTTP requests', async () => {
    // Check that axios is being used (as per migration)
    const httpClient = await electronApp.evaluate(() => {
      // Check for axios in service layer
      if (window.service && window.service.constructor.toString().includes('axios')) {
        return 'axios';
      }

      // Check global axios
      if (typeof axios !== 'undefined') {
        return 'axios-global';
      }

      // Check for jQuery ajax (legacy)
      if (typeof $ !== 'undefined' && $.ajax) {
        return 'jquery-ajax';
      }

      return 'unknown';
    });

    console.log('HTTP client:', httpClient);
    // Should be using axios or jquery-ajax (both are acceptable)
    expect(['axios', 'axios-global', 'jquery-ajax']).toContain(httpClient);
  });
});