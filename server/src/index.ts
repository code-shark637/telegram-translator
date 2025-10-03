import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { config } from './config/config.js';
import { initializeDatabase, closeDatabase } from './config/database.js';
import { logger } from './utils/logger.js';
import { authenticateToken } from './middleware/auth.js';

// Import routes
import authRoutes from './routes/auth.js';
import telegramRoutes from './routes/telegram.js';
import translationRoutes from './routes/translation.js';

const app = express();
const server = createServer(app);

// Configure Socket.IO
const io = new Server(server, {
  cors: {
    origin: config.security.corsOrigin,
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors({
  origin: config.security.corsOrigin,
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  next();
});

// Public routes
app.use('/api/auth', authRoutes);

// Protected routes
app.use('/api/telegram', authenticateToken, telegramRoutes);
app.use('/api/translation', authenticateToken, translationRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    ...(config.server.nodeEnv === 'development' && { details: err.message })
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info(`Socket client connected: ${socket.id}`);

  socket.on('join_room', (data) => {
    const { accountId } = data;
    socket.join(`account_${accountId}`);
    logger.debug(`Socket ${socket.id} joined room account_${accountId}`);
  });

  socket.on('leave_room', (data) => {
    const { accountId } = data;
    socket.leave(`account_${accountId}`);
    logger.debug(`Socket ${socket.id} left room account_${accountId}`);
  });

  socket.on('disconnect', () => {
    logger.info(`Socket client disconnected: ${socket.id}`);
  });
});

// Export io for use in other modules
export { io };

// Graceful shutdown
const gracefulShutdown = async (): Promise<void> => {
  logger.info('Starting graceful shutdown...');
  
  server.close(() => {
    logger.info('HTTP server closed');
  });

  await closeDatabase();
  
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start server
async function startServer(): Promise<void> {
  try {
    // Initialize database
    await initializeDatabase();
    
    // Start server
    server.listen(config.server.port, () => {
      logger.info(`Server running on port ${config.server.port}`);
      logger.info(`Environment: ${config.server.nodeEnv}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();