import * as winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import * as path from 'path';
import * as fs from 'fs';

const logDir = path.resolve(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Custom log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'cyan',
};

winston.addColors(colors);

// Format for file logs (structured text with timestamp, level, context, requestId)
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(
    ({ timestamp, level, message, context, requestId, stack, ...meta }) => {
      const ctx = context ? `[${context}]` : '[App]';
      const reqId = requestId ? `[Req:${requestId}]` : '';
      const metaStr = Object.keys(meta).length
        ? ` | meta: ${JSON.stringify(meta)}`
        : '';
      const stackStr = stack ? `\nStack: ${stack}` : '';
      return `${timestamp} [${level.toUpperCase().padEnd(5)}] ${ctx} ${reqId} ${message}${metaStr}${stackStr}`;
    },
  ),
);

// Format for console logs (colorized)
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    ({ timestamp, level, message, context, requestId, stack }) => {
      const ctx = context ? `[${context}]` : '';
      const reqId = requestId ? `(${requestId})` : '';
      const stackStr = stack ? `\n${stack}` : '';
      return `${timestamp} ${level} ${ctx} ${reqId} ${message}${stackStr}`;
    },
  ),
);

export const winstonLogger = winston.createLogger({
  levels,
  level: process.env.NODE_ENV === 'production' ? 'http' : 'debug',
  transports: [
    // 1. Console transport
    new winston.transports.Console({
      format: consoleFormat,
    }),

    // 2. All application logs (rotated daily, keeps 14 days, max 20MB per file)
    new DailyRotateFile({
      level: 'http',
      dirname: logDir,
      filename: 'application-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      format: fileFormat,
    }),

    // 3. Error logs only (rotated daily, keeps 30 days, max 20MB per file)
    new DailyRotateFile({
      level: 'error',
      dirname: logDir,
      filename: 'error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d',
      format: fileFormat,
    }),

    // 4. Dedicated HTTP access log (for auditing every request & response)
    new DailyRotateFile({
      level: 'http',
      dirname: logDir,
      filename: 'http-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      format: fileFormat,
    }),
  ],
});
