import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { query } from '../../db/pool';

const JWT_SECRET = process.env.JWT_SECRET || 'rota-super-secret-key-change-in-production';
const SESSION_EXPIRY_DAYS = 14;

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export class AuthService {
  static async register(input: RegisterInput) {
    const { email, password, firstName, lastName } = input;

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email.trim())) {
      const error: any = new Error('Invalid email format');
      error.code = 'VALIDATION_ERROR';
      error.status = 400;
      throw error;
    }

    // Validate password (min 8 chars)
    if (!password || password.length < 8) {
      const error: any = new Error('Password must be at least 8 characters long');
      error.code = 'VALIDATION_ERROR';
      error.status = 400;
      throw error;
    }

    if (!firstName || firstName.trim().length === 0) {
      const error: any = new Error('First name is required');
      error.code = 'VALIDATION_ERROR';
      error.status = 400;
      throw error;
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check duplicate email
    const existing = await query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existing.rowCount && existing.rowCount > 0) {
      const error: any = new Error('An account with this email already exists');
      error.code = 'EMAIL_ALREADY_EXISTS';
      error.status = 409;
      throw error;
    }

    // Argon2id password hash
    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
    });

    const insertUserRes = await query(
      `INSERT INTO users (email, password_hash, first_name, last_name, status)
       VALUES ($1, $2, $3, $4, 'ACTIVE')
       RETURNING id, email, first_name, last_name, status, created_at`,
      [normalizedEmail, passwordHash, firstName.trim(), lastName?.trim() || null]
    );

    const user = insertUserRes.rows[0];

    // Create session and token
    const token = await AuthService.createSession(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        status: user.status,
        createdAt: user.created_at,
      },
      token,
    };
  }

  static async login(input: LoginInput) {
    const { email, password } = input;

    if (!email || !password) {
      const error: any = new Error('Email and password are required');
      error.code = 'VALIDATION_ERROR';
      error.status = 400;
      throw error;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const userRes = await query(
      `SELECT id, email, password_hash, first_name, last_name, status, created_at
       FROM users WHERE email = $1`,
      [normalizedEmail]
    );

    if (userRes.rowCount === 0) {
      const error: any = new Error('Invalid email or password');
      error.code = 'INVALID_CREDENTIALS';
      error.status = 401;
      throw error;
    }

    const user = userRes.rows[0];

    const isMatch = await argon2.verify(user.password_hash, password);
    if (!isMatch) {
      const error: any = new Error('Invalid email or password');
      error.code = 'INVALID_CREDENTIALS';
      error.status = 401;
      throw error;
    }

    if (user.status !== 'ACTIVE') {
      const error: any = new Error('Your account is deactivated');
      error.code = 'ACCOUNT_DEACTIVATED';
      error.status = 403;
      throw error;
    }

    const token = await AuthService.createSession(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        status: user.status,
        createdAt: user.created_at,
      },
      token,
    };
  }

  static async logout(token: string) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    await query('UPDATE sessions SET revoked_at = NOW() WHERE token_hash = $1', [tokenHash]);
    return { success: true };
  }

  private static async createSession(userId: string): Promise<string> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + SESSION_EXPIRY_DAYS);

    // Generate JWT token with secure signature
    const token = jwt.sign(
      {
        userId,
        issuedAt: Date.now(),
      },
      JWT_SECRET,
      { expiresIn: `${SESSION_EXPIRY_DAYS}d` }
    );

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    await query(
      `INSERT INTO sessions (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, tokenHash, expiresAt]
    );

    return token;
  }
}
