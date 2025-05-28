const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

let pythonServer;

module.exports = async function globalSetup() {
  console.log('Starting Python Flask server for E2E tests...');
  
  // Ensure upload directory exists
  const uploadDir = path.join(__dirname, '../../../../python/uploadeddataset');
  await fs.mkdir(uploadDir, { recursive: true });
  
  // Start Python server
  const pythonPath = path.join(__dirname, '../../../../python/server.py');
  const activateScript = path.join(__dirname, '../../../../../resources/bash/activate_and_launch_dev.bash');
  
  return new Promise((resolve, reject) => {
    pythonServer = spawn('bash', ['-c', `source ${activateScript} && python ${pythonPath}`], {
      cwd: path.join(__dirname, '../../../../python'),
      env: { ...process.env, FLASK_ENV: 'testing' }
    });
    
    pythonServer.stdout.on('data', (data) => {
      console.log(`Python server: ${data}`);
      if (data.toString().includes('Running on')) {
        // Server is ready
        setTimeout(() => {
          console.log('Python server is ready');
          resolve();
        }, 2000); // Give it 2 seconds to fully initialize
      }
    });
    
    pythonServer.stderr.on('data', (data) => {
      console.error(`Python server error: ${data}`);
    });
    
    pythonServer.on('error', (err) => {
      console.error('Failed to start Python server:', err);
      reject(err);
    });
    
    // Store server process globally so teardown can access it
    global.__PYTHON_SERVER__ = pythonServer;
  });
};