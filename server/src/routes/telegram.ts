import express from 'express';
import multer from 'multer';
import path from 'path';
import { pool } from '../config/database.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { telegramService } from '../services/telegramService.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Configure multer for TData uploads
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow any file type for TData folders
    cb(null, true);
  }
});

// Get all Telegram accounts for the authenticated user
router.get('/accounts', async (req: AuthenticatedRequest, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT id, session_name, phone_number, account_name, is_active, 
       source_language, target_language, created_at, last_used
       FROM telegram_accounts 
       WHERE user_id = $1 
       ORDER BY last_used DESC NULLS LAST, created_at DESC`,
      [req.userId]
    );

    const accounts = result.rows.map(row => ({
      id: row.id,
      sessionName: row.session_name,
      phoneNumber: row.phone_number,
      accountName: row.account_name,
      isActive: row.is_active,
      sourceLanguage: row.source_language,
      targetLanguage: row.target_language,
      createdAt: row.created_at,
      lastUsed: row.last_used,
      isConnected: telegramService.getSession(row.session_name)?.isConnected || false
    }));

    res.json({ accounts });
  } catch (error) {
    logger.error('Error fetching Telegram accounts:', error);
    res.status(500).json({ error: 'Failed to fetch accounts' });
  } finally {
    client.release();
  }
});

// Add new Telegram account from TData
router.post('/accounts', upload.single('tdata'), async (req: AuthenticatedRequest, res) => {
  const { sessionName, accountName, sourceLanguage, targetLanguage } = req.body;
  
  if (!sessionName) {
    return res.status(400).json({ error: 'Session name is required' });
  }

  const client = await pool.connect();
  try {
    // Check if session name already exists for this user
    const existing = await client.query(
      'SELECT id FROM telegram_accounts WHERE user_id = $1 AND session_name = $2',
      [req.userId, sessionName]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Session name already exists' });
    }

    // Create session from TData (mock implementation)
    const tdataPath = req.file?.path || '';
    await telegramService.createSessionFromTData(sessionName, tdataPath);

    // Save to database
    const result = await client.query(
      `INSERT INTO telegram_accounts 
       (user_id, session_name, account_name, source_language, target_language)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, session_name, account_name, source_language, target_language, created_at`,
      [
        req.userId,
        sessionName,
        accountName || sessionName,
        sourceLanguage || 'auto',
        targetLanguage || 'en'
      ]
    );

    const account = result.rows[0];

    logger.info(`New Telegram account added: ${sessionName} for user ${req.userId}`);

    res.status(201).json({
      message: 'Telegram account added successfully',
      account: {
        id: account.id,
        sessionName: account.session_name,
        accountName: account.account_name,
        sourceLanguage: account.source_language,
        targetLanguage: account.target_language,
        createdAt: account.created_at,
        isConnected: false
      }
    });
  } catch (error) {
    logger.error('Error adding Telegram account:', error);
    res.status(500).json({ error: 'Failed to add Telegram account' });
  } finally {
    client.release();
  }
});

// Connect to a Telegram account
router.post('/accounts/:id/connect', async (req: AuthenticatedRequest, res) => {
  const accountId = parseInt(req.params.id);
  
  const client = await pool.connect();
  try {
    // Get account info
    const result = await client.query(
      'SELECT session_name FROM telegram_accounts WHERE id = $1 AND user_id = $2',
      [accountId, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const sessionName = result.rows[0].session_name;
    const connected = await telegramService.connectSession(sessionName);

    if (connected) {
      // Update last used timestamp
      await client.query(
        'UPDATE telegram_accounts SET last_used = NOW() WHERE id = $1',
        [accountId]
      );

      res.json({ message: 'Connected successfully', connected: true });
    } else {
      res.status(500).json({ error: 'Failed to connect to Telegram' });
    }
  } catch (error) {
    logger.error('Error connecting to Telegram account:', error);
    res.status(500).json({ error: 'Failed to connect to account' });
  } finally {
    client.release();
  }
});

// Disconnect from a Telegram account
router.post('/accounts/:id/disconnect', async (req: AuthenticatedRequest, res) => {
  const accountId = parseInt(req.params.id);
  
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT session_name FROM telegram_accounts WHERE id = $1 AND user_id = $2',
      [accountId, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const sessionName = result.rows[0].session_name;
    await telegramService.disconnectSession(sessionName);

    res.json({ message: 'Disconnected successfully', connected: false });
  } catch (error) {
    logger.error('Error disconnecting from Telegram account:', error);
    res.status(500).json({ error: 'Failed to disconnect from account' });
  } finally {
    client.release();
  }
});

// Delete Telegram account
router.delete('/accounts/:id', async (req: AuthenticatedRequest, res) => {
  const accountId = parseInt(req.params.id);
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      'SELECT session_name FROM telegram_accounts WHERE id = $1 AND user_id = $2',
      [accountId, req.userId]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Account not found' });
    }

    const sessionName = result.rows[0].session_name;

    // Delete from Telegram service
    await telegramService.deleteSession(sessionName);

    // Delete from database (cascade will handle related records)
    await client.query(
      'DELETE FROM telegram_accounts WHERE id = $1 AND user_id = $2',
      [accountId, req.userId]
    );

    await client.query('COMMIT');

    logger.info(`Telegram account deleted: ${sessionName} for user ${req.userId}`);
    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error deleting Telegram account:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  } finally {
    client.release();
  }
});

export default router;