import winston from 'winston';
import { config } from '../config/config.js';

// Create logger instance
export const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'telegram-translator' },
  transports: [
    // Write all logs with importance level of 'error' or less to error.log
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    
    // Write all logs to combined.log
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

// If we're not in production, log to console as well
if (config.server.nodeEnv !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// Create logs directory if it doesn't exist
import fs from 'fs';
if (!fs.existsSync('logs')) {
  fs.mkdirSync('logs');
}