import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { query } from '../db/pool';

export interface AuthenticatedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string | null;
  status: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      sessionToken?: string;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'rota-super-secret-key-change-in-production';

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication token is missing or malformed',
        details: {},
      },
    });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; sessionId?: string };
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Authoritative server-controlled session check
    const sessionRes = await query(
      `SELECT s.id, s.user_id, s.expires_at, s.revoked_at,
              u.id as u_id, u.email, u.first_name, u.last_name, u.status
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > NOW()`,
      [tokenHash]
    );

    if (sessionRes.rowCount === 0) {
      res.status(401).json({
        error: {
          code: 'SESSION_EXPIRED_OR_REVOKED',
          message: 'Session has expired or been revoked',
          details: {},
        },
      });
      return;
    }

    const row = sessionRes.rows[0];
    if (row.status !== 'ACTIVE') {
      res.status(403).json({
        error: {
          code: 'ACCOUNT_DEACTIVATED',
          message: 'Your account is deactivated',
          details: {},
        },
      });
      return;
    }

    req.user = {
      id: row.u_id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      status: row.status,
    };
    req.sessionToken = token;

    next();
  } catch (err) {
    res.status(401).json({
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired authentication token',
        details: {},
      },
    });
  }
}
