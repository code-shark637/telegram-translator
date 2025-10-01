import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

export const config = {
  // Server configuration
  server: {
    port: parseInt(process.env.PORT || '3001', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
  },
  
  // Database configuration
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'telegram_translator',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
  },
  
  // JWT configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'fallback-secret-change-in-production',
    expiresIn: '24h',
  },
  
  // Translation services
  translation: {
    google: {
      apiKey: process.env.GOOGLE_TRANSLATE_KEY || '',
    },
    defaultEngine: 'google',
  },
  
  // Telegram configuration
  telegram: {
    apiId: parseInt(process.env.TELEGRAM_API_ID || '0', 10),
    apiHash: process.env.TELEGRAM_API_HASH || '',
    sessionStoragePath: process.env.SESSION_STORAGE_PATH || './sessions',
  },
  
  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
  
  // Security
  security: {
    bcryptRounds: 12,
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  },
} as const;

// Validate required environment variables
const requiredEnvVars = [
  'DB_PASSWORD',
  'JWT_SECRET',
  'TELEGRAM_API_ID',
  'TELEGRAM_API_HASH',
];

const missingEnvVars = requiredEnvVars.filter(
  (envVar) => !process.env[envVar]
);

if (missingEnvVars.length > 0) {
  console.error('Missing required environment variables:', missingEnvVars);
  console.error('Please check your .env file');
  process.exit(1);
}