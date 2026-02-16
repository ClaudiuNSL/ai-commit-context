type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  [key: string]: unknown
}

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: LogContext
  error?: {
    name: string
    message: string
    stack?: string
  }
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

function getMinLevel(): LogLevel {
  if (process.env.NODE_ENV === 'production') {
    return 'info'
  }
  return 'debug'
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[getMinLevel()]
}

function formatError(error: unknown): LogEntry['error'] | undefined {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    }
  }
  if (error) {
    return {
      name: 'Unknown',
      message: String(error),
    }
  }
  return undefined
}

function createLogEntry(
  level: LogLevel,
  message: string,
  context?: LogContext,
  error?: unknown
): LogEntry {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
  }

  if (context && Object.keys(context).length > 0) {
    entry.context = context
  }

  if (error) {
    entry.error = formatError(error)
  }

  return entry
}

function output(entry: LogEntry): void {
  const isProduction = process.env.NODE_ENV === 'production'

  if (isProduction) {
    // JSON format for production (easy to parse by log aggregators)
    const logFn = entry.level === 'error' ? console.error :
                  entry.level === 'warn' ? console.warn : console.log
    logFn(JSON.stringify(entry))
  } else {
    // Human-readable format for development
    const prefix = `[${entry.timestamp}] ${entry.level.toUpperCase()}`
    const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : ''
    const errorStr = entry.error ? `\n  Error: ${entry.error.message}${entry.error.stack ? `\n${entry.error.stack}` : ''}` : ''

    const logFn = entry.level === 'error' ? console.error :
                  entry.level === 'warn' ? console.warn : console.log
    logFn(`${prefix}: ${entry.message}${contextStr}${errorStr}`)
  }
}

export const logger = {
  debug(message: string, context?: LogContext): void {
    if (shouldLog('debug')) {
      output(createLogEntry('debug', message, context))
    }
  },

  info(message: string, context?: LogContext): void {
    if (shouldLog('info')) {
      output(createLogEntry('info', message, context))
    }
  },

  warn(message: string, context?: LogContext): void {
    if (shouldLog('warn')) {
      output(createLogEntry('warn', message, context))
    }
  },

  error(message: string, error?: unknown, context?: LogContext): void {
    if (shouldLog('error')) {
      output(createLogEntry('error', message, context, error))
    }
  },

  // Create a child logger with preset context
  child(baseContext: LogContext) {
    return {
      debug: (message: string, context?: LogContext) =>
        logger.debug(message, { ...baseContext, ...context }),
      info: (message: string, context?: LogContext) =>
        logger.info(message, { ...baseContext, ...context }),
      warn: (message: string, context?: LogContext) =>
        logger.warn(message, { ...baseContext, ...context }),
      error: (message: string, error?: unknown, context?: LogContext) =>
        logger.error(message, error, { ...baseContext, ...context }),
    }
  },
}

export type Logger = typeof logger
