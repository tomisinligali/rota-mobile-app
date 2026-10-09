import argon2 from 'argon2';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { pool, query } from '../../db/pool';
import { EmailService } from '../notifications/email.service';
import { acquireCooldown, rateLimit } from '../../lib/rateLimit';

const JWT_SECRET = process.env.JWT_SECRET || 'rota-super-secret-key-change-in-production';
const SESSION_EXPIRY_DAYS = 14;

// Google OAuth client ID used to verify ID tokens from the mobile app.
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

// bcrypt cost factor. 12 is a good balance for a server-side login flow
// (~200-400ms). Higher costs (15+) become a CPU/DoS liability, not a benefit.
const BCRYPT_COST = 12;

// Email verification policy (PRD 5.1.1 / AGENTS.md §2.8).
const VERIFICATION_TOKEN_TTL_MINUTES = 60;
// 32 random bytes = 256 bits of entropy (AGENTS.md §2.8 requires crypto.randomBytes).
const VERIFICATION_TOKEN_BYTES = 32;
const VERIFICATION_ATTEMPTS_WINDOW_SECONDS = 15 * 60;
const VERIFICATION_ATTEMPTS_PER_WINDOW = 20;
const RESEND_COOLDOWN_SECONDS = 60;
const RESEND_MAX_PER_HOUR = 5;

// Typed application error helper (safe client-facing envelope).
function authError(
  code: string,
  message: string,
  status: number,
  details: Record<string, unknown> = {}
): any {
  const err: any = new Error(message);
  err.code = code;
  err.status = status;
  err.details = details;
  return err;
}

/**
 * Generates a cryptographically-random verification token.
 * Uses crypto.randomBytes(32) — 256 bits of entropy — hex-encoded (64 chars).
 * AGENTS.md §2.8 forbids Math.random()/crypto.randomInt() for verification
 * secrets; crypto.randomBytes is the required CSPRNG.
 */
function generateVerificationToken(): string {
  return crypto.randomBytes(VERIFICATION_TOKEN_BYTES).toString('hex');
}

// Only the SHA-256 hash of a token is ever persisted or logged.
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

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

    // Validate password length (8-64 chars). Upper bound also avoids silent
    // bcrypt truncation at 72 bytes.
    if (!password || password.length < 8 || password.length > 64) {
      const error: any = new Error('Password must be between 8 and 64 characters long');
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

    // bcrypt password hash (adaptive, intentionally slow — cost factor 12).
    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

    const insertUserRes = await query(
      `INSERT INTO users (email, password_hash, first_name, last_name, status)
       VALUES ($1, $2, $3, $4, 'ACTIVE')
       RETURNING id, email, first_name, last_name, status, created_at`,
      [normalizedEmail, passwordHash, firstName.trim(), lastName?.trim() || null]
    );

    const user = insertUserRes.rows[0];

    // Create session and token
    const token = await AuthService.createSession(user.id);

    // Issue + enqueue the verification email. Delivery is asynchronous and must
    // never fail signup — the user can request a resend if it does not arrive.
    try {
      await AuthService.dispatchVerificationEmail(user.id, user.email);
    } catch (err: any) {
      console.error('Failed to dispatch verification email:', err.message);
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        status: user.status,
        emailVerified: false,
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
      `SELECT id, email, password_hash, first_name, last_name, status, email_verified_at, created_at
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
    const storedHash: string | null = user.password_hash;

    // Google-only accounts have no local password.
    if (!storedHash) {
      const error: any = new Error('This account uses Google sign-in. Please continue with Google.');
      error.code = 'USE_GOOGLE_SIGNIN';
      error.status = 401;
      throw error;
    }

    let isMatch = false;

    if (storedHash.startsWith('$argon2')) {
      // Legacy Argon2id hashes remain verifiable, then transparently upgraded to bcrypt.
      isMatch = await argon2.verify(storedHash, password);
      if (isMatch) {
        const upgradedHash = await bcrypt.hash(password, BCRYPT_COST);
        await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [
          upgradedHash,
          user.id,
        ]);
      }
    } else {
      isMatch = await bcrypt.compare(password, storedHash);
    }

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
        emailVerified: user.email_verified_at !== null,
        createdAt: user.created_at,
      },
      token,
    };
  }

  /**
   * Sign in (or sign up) with a Google ID token supplied by the mobile app.
   * The token is verified server-side; the backend remains authoritative.
   */
  static async googleLogin(idToken: string) {
    if (!idToken) {
      const error: any = new Error('Google ID token is required');
      error.code = 'VALIDATION_ERROR';
      error.status = 400;
      throw error;
    }

    if (!GOOGLE_CLIENT_ID) {
      const error: any = new Error('Google sign-in is not configured on the server');
      error.code = 'GOOGLE_NOT_CONFIGURED';
      error.status = 500;
      throw error;
    }

    const client = new OAuth2Client(GOOGLE_CLIENT_ID);
    let payload;
    try {
      const ticket = await client.verifyIdToken({ idToken, audience: GOOGLE_CLIENT_ID });
      payload = ticket.getPayload();
    } catch {
      const error: any = new Error('Invalid Google token');
      error.code = 'INVALID_GOOGLE_TOKEN';
      error.status = 401;
      throw error;
    }

    // Normalise email casing, consistent with password sign-up.
    const email = payload?.email?.trim().toLowerCase();
    if (!email || !payload?.email_verified) {
      const error: any = new Error('Google account email is not verified');
      error.code = 'GOOGLE_EMAIL_UNVERIFIED';
      error.status = 401;
      throw error;
    }

    const existing = await query(
      `SELECT id, email, first_name, last_name, status, created_at FROM users WHERE email = $1`,
      [email]
    );

    let user;
    if (existing.rowCount === 0) {
      const firstName = payload?.given_name?.trim() || email.split('@')[0];
      const lastName = payload?.family_name?.trim() || null;
      const insert = await query(
        `INSERT INTO users (email, password_hash, first_name, last_name, status, email_verified_at)
         VALUES ($1, NULL, $2, $3, 'ACTIVE', NOW())
         RETURNING id, email, first_name, last_name, status, created_at`,
        [email, firstName, lastName]
      );
      user = insert.rows[0];
    } else {
      user = existing.rows[0];
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
        emailVerified: true,
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

  /**
   * Creates a fresh verification token (crypto.randomBytes(32)), invalidating
   * any prior unconsumed token for the user so exactly one is active at a time.
   * Returns the plaintext token for delivery; only its SHA-256 hash is stored.
   */
  private static async issueVerificationToken(userId: string): Promise<string> {
    const token = generateVerificationToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MINUTES * 60 * 1000);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE email_verification_codes
         SET consumed_at = NOW()
         WHERE user_id = $1 AND consumed_at IS NULL`,
        [userId]
      );
      await client.query(
        `INSERT INTO email_verification_codes (user_id, code_hash, expires_at)
         VALUES ($1, $2, $3)`,
        [userId, tokenHash, expiresAt]
      );
      await client.query('COMMIT');
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // ignore rollback failure; surface the original error
      }
      throw err;
    } finally {
      client.release();
    }

    return token;
  }

  /**
   * Persists a new token and enqueues its delivery as a verification link.
   * The token is never logged or returned to the client.
   */
  private static async dispatchVerificationEmail(userId: string, email: string): Promise<void> {
    const token = await AuthService.issueVerificationToken(userId);
    const baseUrl = (
      process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || '5001'}`
    ).replace(/\/+$/, '');
    const link = `${baseUrl}/api/v1/auth/verify-email/confirm?token=${token}`;
    await EmailService.sendVerificationLink(email, link, token, VERIFICATION_TOKEN_TTL_MINUTES);
  }

  /**
   * Verifies a 32-byte verification token. Tokens are single-use and
   * time-limited; the conditional UPDATE guarantees single-use under
   * concurrent requests. The token itself is the credential, so no session is
   * required (the emailed link calls this).
   */
  static async verifyEmail(token: string, scopeKey = 'anonymous') {
    if (!token || !/^[a-f0-9]{64}$/i.test(token.trim())) {
      throw authError('VALIDATION_ERROR', 'A valid verification token is required', 400);
    }

    // Rate-limit submissions (Redis fixed window) to blunt online guessing.
    const attemptLimit = await rateLimit(
      `verify-email:attempts:${scopeKey}`,
      VERIFICATION_ATTEMPTS_PER_WINDOW,
      VERIFICATION_ATTEMPTS_WINDOW_SECONDS
    );
    if (!attemptLimit.allowed) {
      throw authError('TOO_MANY_ATTEMPTS', 'Too many verification attempts. Please try again later.', 429, {
        retryAfterSeconds: attemptLimit.retryAfterSeconds,
      });
    }

    const tokenHash = hashToken(token.trim());
    const tokenRes = await query(
      `SELECT id, user_id
       FROM email_verification_codes
       WHERE code_hash = $1 AND consumed_at IS NULL AND expires_at > NOW()
       LIMIT 1`,
      [tokenHash]
    );

    if (tokenRes.rowCount === 0) {
      throw authError('INVALID_OR_EXPIRED_CODE', 'This verification link is invalid or has expired', 400);
    }

    const record = tokenRes.rows[0];

    // Atomically consume the token and mark the account verified. The
    // consumed_at IS NULL guard makes the token strictly single-use.
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const consume = await client.query(
        `UPDATE email_verification_codes
         SET consumed_at = NOW(), attempts = attempts + 1
         WHERE id = $1 AND consumed_at IS NULL AND expires_at > NOW()
         RETURNING id`,
        [record.id]
      );
      if (consume.rowCount === 0) {
        await client.query('ROLLBACK');
        throw authError('INVALID_OR_EXPIRED_CODE', 'This verification link has already been used or has expired', 400);
      }
      await client.query(
        `UPDATE users SET email_verified_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [record.user_id]
      );
      await client.query('COMMIT');
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // ignore rollback failure; surface the original error
      }
      throw err;
    } finally {
      client.release();
    }

    return { emailVerified: true };
  }

  /**
   * Re-sends a verification code, subject to a cooldown and an hourly cap.
   * Safe (no enumeration) even if the account is already verified.
   */
  static async resendVerification(userId: string) {
    const userRes = await query(
      `SELECT id, email, email_verified_at FROM users WHERE id = $1`,
      [userId]
    );

    if (userRes.rowCount === 0) {
      throw authError('NOT_FOUND', 'Account not found', 404);
    }

    const user = userRes.rows[0];
    if (user.email_verified_at) {
      return { alreadyVerified: true };
    }

    const cooldown = await acquireCooldown(`verify-email:cooldown:${userId}`, RESEND_COOLDOWN_SECONDS);
    if (!cooldown.allowed) {
      throw authError('RESEND_COOLDOWN', 'Please wait before requesting another verification email', 429, {
        retryAfterSeconds: cooldown.retryAfterSeconds,
      });
    }

    const hourly = await rateLimit(`verify-email:resend:${userId}`, RESEND_MAX_PER_HOUR, 3600);
    if (!hourly.allowed) {
      throw authError('RESEND_LIMIT_REACHED', 'Too many verification emails requested. Please try again later.', 429, {
        retryAfterSeconds: hourly.retryAfterSeconds,
      });
    }

    await AuthService.dispatchVerificationEmail(user.id, user.email);
    return { sent: true };
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
