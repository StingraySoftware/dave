module.exports = async function globalTeardown() {
  console.log('Stopping Python Flask server...');

  if (global.__PYTHON_SERVER__) {
    global.__PYTHON_SERVER__.kill('SIGTERM');

    // Wait for process to exit
    await new Promise((resolve) => {
      global.__PYTHON_SERVER__.on('exit', () => {
        console.log('Python server stopped');
        resolve();
      });

      // Force kill after 5 seconds if it doesn't exit gracefully
      setTimeout(() => {
        if (!global.__PYTHON_SERVER__.killed) {
          global.__PYTHON_SERVER__.kill('SIGKILL');
        }
        resolve();
      }, 5001);
    });
  }

  // Stop Xvfb if it was started
  if (global.__XVFB_PROCESS__) {
    console.log('Stopping Xvfb...');
    global.__XVFB_PROCESS__.kill('SIGTERM');
    
    await new Promise((resolve) => {
      global.__XVFB_PROCESS__.on('exit', () => {
        console.log('Xvfb stopped');
        resolve();
      });
      
      // Force kill after 2 seconds
      setTimeout(() => {
        if (!global.__XVFB_PROCESS__.killed) {
          global.__XVFB_PROCESS__.kill('SIGKILL');
        }
        resolve();
      }, 2000);
    });
  }
};