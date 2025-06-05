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
      }, 5000);
    });
  }
};