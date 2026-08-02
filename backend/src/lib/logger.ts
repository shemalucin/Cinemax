/**
 * Production-grade logging system
 * Logs technical errors for developers while keeping user-facing messages clean
 */

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

class Logger {
  private isProduction: boolean;
  private logs: LogEntry[] = [];
  private maxLogs: number = 1000;

  constructor() {
    this.isProduction = process.env.NODE_ENV === 'production';
  }

  private formatLog(level: LogLevel, message: string, context?: Record<string, any>, error?: Error): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: this.isProduction ? undefined : error.stack,
      } : undefined,
    };
  }

  private log(level: LogLevel, message: string, context?: Record<string, any>, error?: Error) {
    const entry = this.formatLog(level, message, context, error);
    
    // Store in memory (in production, this would send to a logging service)
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Console output
    const prefix = `[${level.toUpperCase()}]`;
    const timestamp = entry.timestamp;
    
    switch (level) {
      case 'error':
        console.error(prefix, timestamp, message, context || '', error || '');
        break;
      case 'warn':
        console.warn(prefix, timestamp, message, context || '');
        break;
      case 'info':
        console.info(prefix, timestamp, message, context || '');
        break;
      case 'debug':
        if (!this.isProduction) {
          console.debug(prefix, timestamp, message, context || '');
        }
        break;
    }
  }

  error(message: string, context?: Record<string, any>, error?: Error) {
    this.log('error', message, context, error);
  }

  warn(message: string, context?: Record<string, any>) {
    this.log('warn', message, context);
  }

  info(message: string, context?: Record<string, any>) {
    this.log('info', message, context);
  }

  debug(message: string, context?: Record<string, any>) {
    this.log('debug', message, context);
  }

  // Get recent logs (for debugging/admin)
  getLogs(level?: LogLevel, limit: number = 100): LogEntry[] {
    let filtered = this.logs;
    if (level) {
      filtered = filtered.filter(log => log.level === level);
    }
    return filtered.slice(-limit);
  }

  // Clear logs
  clearLogs() {
    this.logs = [];
  }
}

export const logger = new Logger();
