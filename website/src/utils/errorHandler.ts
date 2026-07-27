/**
 * Centralized error handling utility for production-grade error management
 * Provides user-friendly error messages while logging technical details for developers
 */

export class AppError extends Error {
  constructor(
    message: string,
    public userMessage: string,
    public statusCode?: number,
    public isTechnical = false
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const ErrorMessages = {
  NETWORK_ERROR: 'Unable to connect. Please check your internet connection.',
  TIMEOUT_ERROR: 'Request timed out. Please try again.',
  SERVER_ERROR: 'Service temporarily unavailable. Please try again later.',
  NOT_FOUND: 'The requested content was not found.',
  UNAUTHORIZED: 'Please sign in to continue.',
  FORBIDDEN: 'You do not have permission to access this content.',
  RATE_LIMIT: 'Too many requests. Please wait a moment and try again.',
  GENERIC_ERROR: 'Something went wrong. Please try again.',
  LOAD_ERROR: 'Unable to load content. Please refresh the page.',
  AUTH_ERROR: 'Authentication failed. Please sign in again.',
};

/**
 * Logs technical errors to console for developers
 * In production, this would send to an error tracking service
 */
export function logError(error: Error | unknown, context?: string) {
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction) {
    // In production, send to error tracking service
    console.error('[Production Error]', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      context,
      timestamp: new Date().toISOString(),
    });
  } else {
    // In development, show full details
    console.error(`[Error${context ? ` in ${context}` : ''}]:`, error);
  }
}

/**
 * Converts any error into a user-friendly message
 */
export function getUserMessage(error: unknown): string {
  if (error instanceof AppError) {
    return error.userMessage;
  }
  
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('network') || message.includes('fetch')) {
      return ErrorMessages.NETWORK_ERROR;
    }
    if (message.includes('timeout')) {
      return ErrorMessages.TIMEOUT_ERROR;
    }
    if (message.includes('404') || message.includes('not found')) {
      return ErrorMessages.NOT_FOUND;
    }
    if (message.includes('401') || message.includes('unauthorized')) {
      return ErrorMessages.UNAUTHORIZED;
    }
    if (message.includes('403') || message.includes('forbidden')) {
      return ErrorMessages.FORBIDDEN;
    }
    if (message.includes('429') || message.includes('rate limit')) {
      return ErrorMessages.RATE_LIMIT;
    }
    if (message.includes('500') || message.includes('server error')) {
      return ErrorMessages.SERVER_ERROR;
    }
  }
  
  return ErrorMessages.GENERIC_ERROR;
}

/**
 * Wraps async functions with error handling
 */
export function withErrorHandler<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context?: string
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      logError(error, context);
      throw new AppError(
        error instanceof Error ? error.message : String(error),
        getUserMessage(error),
        error instanceof AppError ? error.statusCode : undefined
      );
    }
  }) as T;
}

/**
 * Safely executes a function and returns a fallback value on error
 */
export async function safeExecute<T>(
  fn: () => Promise<T>,
  fallback: T,
  context?: string
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    logError(error, context);
    return fallback;
  }
}

/**
 * Checks if an error is recoverable (should retry)
 */
export function isRecoverableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('timeout') ||
      message.includes('network') ||
      message.includes('500') ||
      message.includes('502') ||
      message.includes('503') ||
      message.includes('504')
    );
  }
  return false;
}
