/**
 * Custom Logger Module for DAVE
 * Provides clean, colorful, and well-formatted console output
 */

const log = require('electron-log/main');

// Initialize electron-log
log.initialize();
log.transports.file.level = 'info';
log.transports.console.level = process.env.NODE_ENV === 'development' ? 'debug' : 'info';

class DAVELogger {
  constructor() {
    this.startTime = Date.now();
    this.processName = 'DAVE';
    this.colors = {
      reset: '\x1b[0m',
      bright: '\x1b[1m',
      dim: '\x1b[2m',
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      magenta: '\x1b[35m',
      cyan: '\x1b[36m',
      white: '\x1b[37m',
      gray: '\x1b[90m'
    };
  }

  // Get current timestamp in clean format
  getTimestamp() {
    const now = new Date();
    return now.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  // Format the log prefix with timestamp and process name
  formatPrefix(level, component = 'MAIN') {
    const timestamp = this.getTimestamp();
    const levelColor = this.getLevelColor(level);
    const componentColor = this.colors.cyan;

    return `${this.colors.gray}[${timestamp}]${this.colors.reset} ${levelColor}${level.toUpperCase().padEnd(5)}${this.colors.reset} ${componentColor}[${component}]${this.colors.reset}`;
  }

  // Get color for log level
  getLevelColor(level) {
    switch (level) {
      case 'error': return this.colors.red;
      case 'warn': return this.colors.yellow;
      case 'success': return this.colors.green;
      case 'info': return this.colors.blue;
      case 'debug': return this.colors.gray;
      default: return this.colors.white;
    }
  }

  // Format message with proper indentation
  formatMessage(message, indent = 0) {
    const indentStr = ' '.repeat(indent * 2);
    if (typeof message === 'object') {
      return '\n' + indentStr + JSON.stringify(message, null, 2).split('\n').join('\n' + indentStr);
    }
    return indentStr + message;
  }

  // Core logging method
  log(level, component, message, data = null) {
    const prefix = this.formatPrefix(level, component);
    const formattedMessage = this.formatMessage(message, 1);

    let fullMessage = `${prefix} ${formattedMessage}`;

    if (data) {
      fullMessage += '\n' + this.formatMessage(data, 2);
    }

    // Add visual separators for major events
    if (level === 'success' || level === 'error') {
      const separator = level === 'success' ? '─' : '═';
      const color = level === 'success' ? this.colors.green : this.colors.red;
      console.log(`${color}${separator.repeat(60)}${this.colors.reset}`);
      console.log(fullMessage);
      console.log(`${color}${separator.repeat(60)}${this.colors.reset}`);
    } else {
      console.log(fullMessage);
    }

    // Map custom levels to standard electron-log levels
    const logLevel = level === 'success' ? 'info' :
                     level === 'warn' ? 'warn' :
                     level === 'error' ? 'error' :
                     level === 'debug' ? 'debug' : 'info';

    // Also log to electron-log for file output
    log[logLevel](`[${component}] ${message}`, data || '');
  }

  // Convenience methods
  info(component, message, data) {
    this.log('info', component, message, data);
  }

  success(component, message, data) {
    this.log('success', component, message, data);
  }

  warn(component, message, data) {
    this.log('warn', component, message, data);
  }

  error(component, message, data) {
    this.log('error', component, message, data);
  }

  debug(component, message, data) {
    this.log('debug', component, message, data);
  }

  // Specialized logging methods for DAVE
  startup(message, data) {
    this.success('STARTUP', message, data);
  }

  config(message, data) {
    this.info('CONFIG', message, data);
  }

  server(message, data) {
    this.info('SERVER', message, data);
  }

  http(message, data) {
    this.debug('HTTP', message, data);
  }

  updater(message, data) {
    this.info('UPDATER', message, data);
  }

  process(component, message, data) {
    this.info(component, message, data);
  }

  // HTTP request/response formatter
  logHttpRequest(method, url, status, responseTime) {
    const statusColor = status >= 400 ? this.colors.red : status >= 300 ? this.colors.yellow : this.colors.green;
    const message = `${method} ${url} ${statusColor}${status}${this.colors.reset} ${this.colors.gray}(${responseTime}ms)${this.colors.reset}`;
    this.http('Request', message);
  }

  // Process lifecycle events
  processEvent(processName, event, data = null) {
    const eventMessages = {
      'launch': { level: 'info', message: `Launching ${processName}...` },
      'spawn': { level: 'success', message: `${processName} process spawned successfully` },
      'connect': { level: 'success', message: `Connected to ${processName}` },
      'disconnect': { level: 'warn', message: `Disconnected from ${processName}` },
      'error': { level: 'error', message: `${processName} process error` },
      'exit': { level: 'info', message: `${processName} process exited` }
    };

    const eventConfig = eventMessages[event];
    if (eventConfig) {
      this[eventConfig.level](processName.toUpperCase(), eventConfig.message, data);
    }
  }

  // Configuration loading with pretty formatting
  logConfig(config) {
    this.config('Configuration loaded successfully');
    console.log(`${this.colors.cyan}    ├─ Environment Mode:${this.colors.reset} ${config.envEnabled ? this.colors.green : this.colors.red}${config.envEnabled}${this.colors.reset}`);
    console.log(`${this.colors.cyan}    ├─ Python Enabled:${this.colors.reset} ${config.pythonEnabled ? this.colors.green : this.colors.red}${config.pythonEnabled}${this.colors.reset}`);
    console.log(`${this.colors.cyan}    ├─ Python Server:${this.colors.reset} ${this.colors.blue}${config.pythonUrl}${this.colors.reset}`);
    console.log(`${this.colors.cyan}    ├─ Debug Mode:${this.colors.reset} ${config.logDebugMode ? this.colors.green : this.colors.red}${config.logDebugMode}${this.colors.reset}`);
    console.log(`${this.colors.cyan}    └─ Log File:${this.colors.reset} ${this.colors.gray}${config.logsPath}${this.colors.reset}`);
    console.log('');
  }

  // File upload/download events
  fileEvent(event, filename, details = null) {
    const messages = {
      'upload': { level: 'info', prefix: 'Uploading' },
      'upload-complete': { level: 'success', prefix: 'Upload complete' },
      'download': { level: 'info', prefix: 'Downloading' },
      'download-complete': { level: 'success', prefix: 'Download complete' },
      'error': { level: 'error', prefix: 'File error' }
    };

    const eventConfig = messages[event];
    if (eventConfig) {
      this[eventConfig.level]('FILE', `${eventConfig.prefix}: ${this.colors.blue}${filename}${this.colors.reset}`, details);
    }
  }

  // Performance monitoring
  performance(operation, duration, details = null) {
    const durationColor = duration > 1000 ? this.colors.yellow : duration > 5000 ? this.colors.red : this.colors.green;
    this.info('PERF', `${operation} completed in ${durationColor}${duration}ms${this.colors.reset}`, details);
  }

  // Section headers for better organization
  section(title) {
    console.log('');
    console.log(`${this.colors.bright}${this.colors.cyan}╔${'═'.repeat(58)}╗${this.colors.reset}`);
    console.log(`${this.colors.bright}${this.colors.cyan}║${' '.repeat((58 - title.length) / 2)}${title}${' '.repeat((58 - title.length) / 2)}║${this.colors.reset}`);
    console.log(`${this.colors.bright}${this.colors.cyan}╚${'═'.repeat(58)}╝${this.colors.reset}`);
    console.log('');
  }
}

// Create singleton instance
const daveLogger = new DAVELogger();

// Export the logger instance and the class
module.exports = daveLogger;
module.exports.DAVELogger = DAVELogger;