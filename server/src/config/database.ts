import pkg from 'pg';
import { config } from './config.js';
import { logger } from '../utils/logger.js';

const { Pool } = pkg;

// Database connection pool
export const pool = new Pool({
  host: config.database.host,
  port: config.database.port,
  database: config.database.name,
  user: config.database.user,
  password: config.database.password,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close clients after 30 seconds of inactivity
  connectionTimeoutMillis: 5000, // Return an error if connection takes longer than 5 seconds
});

// Test database connection
pool.on('connect', () => {
  logger.info('New database client connected');
});

pool.on('error', (err) => {
  logger.error('Unexpected error on idle client', err);
});

// Initialize database with schema
export async function initializeDatabase(): Promise<void> {
  const client = await pool.connect();
  try {
    // Check if we can connect
    await client.query('SELECT NOW()');
    logger.info('Database connection established successfully');
    
    // Here you would run your schema.sql file
    // For now, we'll just log that initialization is needed
    logger.info('Database schema initialization would run here');
    
  } catch (error) {
    logger.error('Failed to initialize database:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Graceful shutdown
export async function closeDatabase(): Promise<void> {
  try {
    await pool.end();
    logger.info('Database connection pool closed');
  } catch (error) {
    logger.error('Error closing database connection pool:', error);
  }
}