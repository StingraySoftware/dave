const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const http = require('http');

let pythonServer;

module.exports = async function globalSetup() {
  console.log('Starting Python Flask server for E2E tests...');
  
  // Clean up any existing server processes before starting
  console.log('Cleaning up any existing server processes...');
  try {
    const { spawn } = require('child_process');
    const cleanup = spawn('bash', ['-c', 'lsof -ti:5001 | xargs kill -9 2>/dev/null || true']);
    await new Promise((resolve) => {
      cleanup.on('exit', resolve);
      setTimeout(resolve, 1000); // Don't wait too long
    });
  } catch (error) {
    console.log('Cleanup error (non-fatal):', error.message);
  }
  
  // Ensure upload directory exists
  const uploadDir = path.join(__dirname, '../../../src/main/python/uploadeddataset');
  await fs.mkdir(uploadDir, { recursive: true });
  
  // Start Python server using pixi
  const projectRoot = path.join(__dirname, '../../..');
  console.log('Project root:', projectRoot);
  
  return new Promise((resolve, reject) => {
    pythonServer = spawn('pixi', ['run', 'server'], {
      cwd: projectRoot,
      env: { ...process.env, FLASK_ENV: 'testing', PYTHONUNBUFFERED: '1', DAVE_TEST_MODE: 'true' },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    let serverStarted = false;
    let resolved = false;
    let healthCheckTimeout;
    
    pythonServer.stdout.on('data', (data) => {
      console.log(`Python server: ${data}`);
      if (!serverStarted && (data.toString().includes('dave_reader loaded') || data.toString().includes('Serving Flask app'))) {
        serverStarted = true;
        console.log('Server starting, waiting for full initialization...');
        
        // Simple health check with proper cleanup
        
        const checkHealth = (attempt = 1) => {
          if (resolved) return;
          
          const req = http.get('http://localhost:5001/', (res) => {
            if (!resolved) {
              resolved = true;
              clearTimeout(healthCheckTimeout);
              console.log('Python server is ready and responding');
              resolve();
            }
          });
          
          req.on('error', () => {
            if (resolved) return;
            
            if (attempt < 3) {
              console.log(`Health check attempt ${attempt} failed, retrying...`);
              setTimeout(() => checkHealth(attempt + 1), 1000);
            } else {
              resolved = true;
              console.log('Health check failed, assuming server is ready');
              resolve();
            }
          });
          
          req.setTimeout(1000, () => {
            req.destroy();
          });
        };
        
        // Start health check after 2 seconds
        setTimeout(() => {
          if (!resolved) {
            checkHealth();
          }
        }, 2000);
        
        // Fallback timeout - resolve after 8 seconds no matter what
        healthCheckTimeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            console.log('Health check timeout, assuming server is ready');
            resolve();
          }
        }, 8000);
      }
    });
    
    pythonServer.stderr.on('data', (data) => {
      console.error(`Python server error: ${data}`);
    });
    
    pythonServer.on('error', (err) => {
      console.error('Failed to start Python server:', err);
      reject(err);
    });
    
    pythonServer.on('exit', (code, signal) => {
      console.log(`Python server exited with code ${code} and signal ${signal}`);
      
      // Clean up health check timers if server exits
      if (healthCheckTimeout) {
        clearTimeout(healthCheckTimeout);
      }
      
      if (!resolved) {
        resolved = true;
        if (code !== 0 && code !== null) {
          reject(new Error(`Python server exited with code ${code}`));
        } else {
          // If server exits cleanly but setup isn't complete, treat as failure
          reject(new Error('Python server exited during setup'));
        }
      }
    });
    
    // Store server process globally so teardown can access it
    global.__PYTHON_SERVER__ = pythonServer;
    
    // Add overall timeout for setup
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        reject(new Error('Server setup timed out after 15 seconds'));
      }
    }, 15000);
  });
};