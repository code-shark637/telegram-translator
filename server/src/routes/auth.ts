import express from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../config/database.js';
import { generateToken } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/config.js';

const router = express.Router();

// Register new user
router.post('/register', async (req, res) => {
  const { username, password, email } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }

  const client = await pool.connect();
  try {
    // Check if user already exists
    const existingUser = await client.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, config.security.bcryptRounds);

    // Create user
    const result = await client.query(
      'INSERT INTO users (username, password_hash, email) VALUES ($1, $2, $3) RETURNING id, username, email, created_at',
      [username, passwordHash, email || null]
    );

    const user = result.rows[0];
    const token = generateToken(user.id, user.username);

    logger.info(`New user registered: ${username} (ID: ${user.id})`);

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        createdAt: user.created_at
      },
      token
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// Login user
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const client = await pool.connect();
  try {
    // Get user from database
    const result = await client.query(
      'SELECT id, username, password_hash, email, is_active FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    // Check password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Update last login
    await client.query(
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      [user.id]
    );

    const token = generateToken(user.id, user.username);

    logger.info(`User logged in: ${username} (ID: ${user.id})`);

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      },
      token
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// Get current user info
router.get('/me', async (req, res) => {
  // This would use the auth middleware in the main app
  res.json({ message: 'This endpoint requires authentication middleware' });
});

export default router;