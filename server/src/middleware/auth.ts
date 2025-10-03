import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/config.js';
import { logger } from '../utils/logger.js';

export interface AuthenticatedRequest extends Request {
  userId?: number;
  username?: string;
}

export interface JWTPayload {
  userId: number;
  username: string;
  iat?: number;
  exp?: number;
}

export const authenticateToken = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;
    req.userId = decoded.userId;
    req.username = decoded.username;
    
    logger.debug(`Authenticated request from user ${decoded.username} (ID: ${decoded.userId})`);
    next();
  } catch (error) {
    logger.warn(`Invalid token attempt:`, { error: (error as Error).message });
    res.status(403).json({ error: 'Invalid or expired token' });
  }
};

export const generateToken = (userId: number, username: string): string => {
  const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
    userId,
    username
  };
  
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn
  });
};