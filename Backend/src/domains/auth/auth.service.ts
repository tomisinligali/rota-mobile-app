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
const VERIFICATION_CODE_TTL_MINUTES = 60;
const VERIFICATION_CODE_LENGTH = 6;
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
 * Generates a cryptographically-random 6-digit verification code.
 * Uses crypto.randomBytes with rejection sampling so the digits are uniform.
 * AGENTS.md §2.8 forbids Math.random() and crypto.randomInt() for verification
 * secrets; crypto.randomBytes is the required CSPRNG.
 */
function generateVerificationCode(): string {
  const max = 10 ** VERIFICATION_CODE_LENGTH;
  // Largest multiple of `max` that fits in 32 bits. Values at or above it are
  // rejected so the final modulo stays unbiased.
  const limit = Math.floor(0xffffffff / max) * max;
  let value: number;
  do {
    value = crypto.randomBytes(4).readUInt32BE(0);
  } while (value >= limit);
  return (value % max).toString().padStart(VERIFICATION_CODE_LENGTH, '0');
}

// Only the SHA-256 hash of a verification code is ever persisted or logged.
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

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  token: string;
  expiresIn: number;
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

    // Create session and tokens (short-lived access + refresh)
    const sessionTokens = await AuthService.createSession(user.id);

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
      token: sessionTokens.token,
      accessToken: sessionTokens.accessToken,
      refreshToken: sessionTokens.refreshToken,
      expiresIn: sessionTokens.expiresIn,
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

    const sessionTokens = await AuthService.createSession(user.id);

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
      token: sessionTokens.token,
      accessToken: sessionTokens.accessToken,
      refreshToken: sessionTokens.refreshToken,
      expiresIn: sessionTokens.expiresIn,
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

    const sessionTokens = await AuthService.createSession(user.id);

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
      token: sessionTokens.token,
      accessToken: sessionTokens.accessToken,
      refreshToken: sessionTokens.refreshToken,
      expiresIn: sessionTokens.expiresIn,
    };
  }

  static async logout(token: string, refreshToken?: string) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    await query('UPDATE sessions SET revoked_at = NOW() WHERE token_hash = $1', [tokenHash]);
    if (refreshToken) {
      const refreshHash = hashToken(refreshToken.trim());
      await query('UPDATE refresh_tokens SET is_revoked = TRUE WHERE token_hash = $1', [refreshHash]);
    }
    return { success: true };
  }

  /**
   * Creates a fresh 6-digit verification code, invalidating any prior
   * unconsumed code for the user so exactly one is active at a time.
   * Returns the plaintext code for delivery; only its SHA-256 hash is stored.
   */
  private static async issueVerificationCode(userId: string): Promise<string> {
    const code = generateVerificationCode();
    const codeHash = hashToken(code);
    const expiresAt = new Date(Date.now() + VERIFICATION_CODE_TTL_MINUTES * 60 * 1000);

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
        [userId, codeHash, expiresAt]
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

    return code;
  }

  /**
   * Persists a new verification code and enqueues its delivery by email.
   * The code is never logged and is never returned to the client.
   */
  private static async dispatchVerificationEmail(userId: string, email: string): Promise<void> {
    const code = await AuthService.issueVerificationCode(userId);
    await EmailService.sendVerificationCode(email, code, VERIFICATION_CODE_TTL_MINUTES);
  }

  /**
   * Verifies a 6-digit code for the authenticated user. Codes are single-use
   * and time-limited; the conditional UPDATE guarantees single-use under
   * concurrent requests. The lookup is scoped to the caller's own account, so
   * the short code space cannot be used to confirm another user's email, and
   * submissions are rate-limited to blunt guessing.
   */
  static async verifyEmail(code: string, userId: string) {
    if (!code || !/^[0-9]{6}$/.test(code.trim())) {
      throw authError('VALIDATION_ERROR', 'A valid 6-digit verification code is required', 400);
    }

    // Rate-limit submissions (Redis fixed window) to blunt online guessing.
    const attemptLimit = await rateLimit(
      `verify-email:attempts:${userId}`,
      VERIFICATION_ATTEMPTS_PER_WINDOW,
      VERIFICATION_ATTEMPTS_WINDOW_SECONDS
    );
    if (!attemptLimit.allowed) {
      throw authError('TOO_MANY_ATTEMPTS', 'Too many verification attempts. Please try again later.', 429, {
        retryAfterSeconds: attemptLimit.retryAfterSeconds,
      });
    }

    const codeHash = hashToken(code.trim());
    const codeRes = await query(
      `SELECT id
       FROM email_verification_codes
       WHERE code_hash = $1 AND user_id = $2 AND consumed_at IS NULL AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [codeHash, userId]
    );

    if (codeRes.rowCount === 0) {
      throw authError('INVALID_OR_EXPIRED_CODE', 'This verification code is invalid or has expired', 400);
    }

    const record = codeRes.rows[0];

    // Atomically consume the code and mark the account verified. The
    // consumed_at IS NULL guard makes the code strictly single-use.
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
        throw authError('INVALID_OR_EXPIRED_CODE', 'This verification code has already been used or has expired', 400);
      }
      await client.query(
        `UPDATE users SET email_verified_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [userId]
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

  static async rotateRefreshToken(oldRefreshToken: string): Promise<SessionTokens> {
    if (!oldRefreshToken || typeof oldRefreshToken !== 'string') {
      throw authError('VALIDATION_ERROR', 'Refresh token is required', 400);
    }

    const tokenHash = hashToken(oldRefreshToken.trim());
    const res = await query(
      `SELECT id, user_id, family_id, is_revoked, consumed_at, expires_at
       FROM refresh_tokens
       WHERE token_hash = $1`,
      [tokenHash]
    );

    if (res.rowCount === 0) {
      throw authError('INVALID_REFRESH_TOKEN', 'Invalid or unrecognized refresh token', 401);
    }

    const record = res.rows[0];

    // If already explicitly revoked, reject
    if (record.is_revoked) {
      throw authError('REFRESH_TOKEN_REVOKED', 'Refresh token has been revoked', 401);
    }

    // THEFT / REUSE DETECTION:
    // If a refresh token that has ALREADY been consumed is used again,
    // this signals the token was compromised / stolen. Immediately revoke
    // the entire token family and all active sessions for this user.
    if (record.consumed_at !== null) {
      await query(
        `UPDATE refresh_tokens SET is_revoked = TRUE WHERE family_id = $1`,
        [record.family_id]
      );
      await query(
        `UPDATE sessions SET revoked_at = NOW() WHERE user_id = $1`,
        [record.user_id]
      );
      throw authError(
        'REFRESH_TOKEN_REUSED',
        'Refresh token has already been used. Possible token theft detected. All active sessions have been revoked.',
        401
      );
    }

    // Check expiry
    if (new Date(record.expires_at) < new Date()) {
      throw authError('REFRESH_TOKEN_EXPIRED', 'Refresh token has expired', 401);
    }

    // Ensure the user account is still active
    const userRes = await query(`SELECT id, status FROM users WHERE id = $1`, [record.user_id]);
    if (userRes.rowCount === 0 || userRes.rows[0].status !== 'ACTIVE') {
      throw authError('ACCOUNT_DEACTIVATED', 'Your account is deactivated', 403);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Mark the incoming refresh token as consumed
      await client.query(
        `UPDATE refresh_tokens SET consumed_at = NOW() WHERE id = $1`,
        [record.id]
      );

      // 2. Create fresh server-side session
      const sessionExpiresAt = new Date();
      sessionExpiresAt.setDate(sessionExpiresAt.getDate() + SESSION_EXPIRY_DAYS);
      const sessionRes = await client.query(
        `INSERT INTO sessions (user_id, token_hash, expires_at)
         VALUES ($1, 'pending', $2)
         RETURNING id`,
        [record.user_id, sessionExpiresAt]
      );
      const newSessionId = sessionRes.rows[0].id;

      // 3. Issue fresh 15-minute access token
      const accessToken = jwt.sign(
        {
          userId: record.user_id,
          sessionId: newSessionId,
          issuedAt: Date.now(),
        },
        JWT_SECRET,
        { expiresIn: '15m' }
      );
      const accessHash = crypto.createHash('sha256').update(accessToken).digest('hex');
      await client.query(
        `UPDATE sessions SET token_hash = $1 WHERE id = $2`,
        [accessHash, newSessionId]
      );

      // 4. Issue rotated refresh token belonging to the SAME family
      const newRefreshToken = crypto.randomBytes(40).toString('hex');
      const newRefreshHash = hashToken(newRefreshToken);
      const refreshExpiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

      await client.query(
        `INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [record.user_id, newRefreshHash, record.family_id, refreshExpiresAt]
      );

      await client.query('COMMIT');

      return {
        accessToken,
        refreshToken: newRefreshToken,
        token: accessToken,
        expiresIn: 900,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Revokes all active sessions and refresh tokens across all devices for the user.
   */
  static async logoutAll(userId: string) {
    await query(
      `UPDATE sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId]
    );
    await query(
      `UPDATE refresh_tokens SET is_revoked = TRUE WHERE user_id = $1 AND is_revoked = FALSE`,
      [userId]
    );
    return { success: true, message: 'Logged out of all devices successfully' };
  }

  /**
   * Initiates password reset by issuing a single-use, 15-minute verification code.
   * Prevents account enumeration by returning a generic message regardless of email existence.
   */
  static async forgotPassword(email: string) {
    if (!email || !email.trim()) {
      throw authError('VALIDATION_ERROR', 'Email address is required', 400);
    }

    const normalizedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      throw authError('VALIDATION_ERROR', 'Invalid email format', 400);
    }

    // Rate limit: 5 requests per hour per email to prevent spam/abuse
    const rl = await rateLimit(`forgot-password:${normalizedEmail}`, 5, 3600);
    if (!rl.allowed) {
      throw authError('RATE_LIMIT_EXCEEDED', 'Too many password reset requests. Please try again later.', 429, {
        retryAfterSeconds: rl.retryAfterSeconds,
      });
    }

    const userRes = await query(
      `SELECT id, email, status FROM users WHERE email = $1`,
      [normalizedEmail]
    );

    // No account enumeration: return identical generic message if user does not exist
    if (userRes.rowCount === 0 || userRes.rows[0].status !== 'ACTIVE') {
      return {
        message: 'If an account exists with that email, a password reset code has been sent.',
      };
    }

    const user = userRes.rows[0];
    const code = generateVerificationCode();
    const codeHash = hashToken(code);
    const ttlMinutes = 15;
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Invalidate any previous unconsumed reset tokens
      await client.query(
        `UPDATE password_reset_tokens
         SET consumed_at = NOW()
         WHERE user_id = $1 AND consumed_at IS NULL`,
        [user.id]
      );
      await client.query(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, $3)`,
        [user.id, codeHash, expiresAt]
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    try {
      await EmailService.sendPasswordReset(user.email, code, ttlMinutes);
    } catch (err: any) {
      console.error('Failed to dispatch password reset email:', err.message);
    }

    return {
      message: 'If an account exists with that email, a password reset code has been sent.',
    };
  }

  /**
   * Resets the user's password using the single-use expiring token.
   * On success, updates the password and revokes all active sessions/refresh tokens.
   */
  static async resetPassword(email: string, code: string, newPassword: string) {
    if (!email || !code || !newPassword) {
      throw authError('VALIDATION_ERROR', 'Email, reset code, and new password are required', 400);
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Password validation (8-64 chars)
    if (newPassword.length < 8 || newPassword.length > 64) {
      throw authError('VALIDATION_ERROR', 'Password must be between 8 and 64 characters long', 400);
    }

    // Rate limit verification attempts: 10 per 15 minutes per email
    const attemptRl = await rateLimit(`reset-password:attempts:${normalizedEmail}`, 10, 900);
    if (!attemptRl.allowed) {
      throw authError('RATE_LIMIT_EXCEEDED', 'Too many attempts. Please try again later.', 429, {
        retryAfterSeconds: attemptRl.retryAfterSeconds,
      });
    }

    const userRes = await query(
      `SELECT id, email, status FROM users WHERE email = $1`,
      [normalizedEmail]
    );

    if (userRes.rowCount === 0 || userRes.rows[0].status !== 'ACTIVE') {
      throw authError('INVALID_RESET_CODE', 'Invalid or expired password reset code', 400);
    }

    const user = userRes.rows[0];
    const codeHash = hashToken(code.trim());

    const tokenRes = await query(
      `SELECT id, user_id, expires_at, consumed_at
       FROM password_reset_tokens
       WHERE user_id = $1 AND token_hash = $2`,
      [user.id, codeHash]
    );

    if (tokenRes.rowCount === 0) {
      throw authError('INVALID_RESET_CODE', 'Invalid or expired password reset code', 400);
    }

    const record = tokenRes.rows[0];
    if (record.consumed_at !== null) {
      throw authError('RESET_CODE_ALREADY_USED', 'This password reset code has already been used', 400);
    }

    if (new Date(record.expires_at) < new Date()) {
      throw authError('RESET_CODE_EXPIRED', 'Password reset code has expired. Please request a new one.', 400);
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Mark token consumed
      await client.query(
        `UPDATE password_reset_tokens SET consumed_at = NOW() WHERE id = $1`,
        [record.id]
      );

      // 2. Update user's password
      await client.query(
        `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
        [passwordHash, user.id]
      );

      // 3. Revoke all active sessions and refresh tokens across all devices
      await client.query(
        `UPDATE sessions SET revoked_at = NOW() WHERE user_id = $1`,
        [user.id]
      );
      await client.query(
        `UPDATE refresh_tokens SET is_revoked = TRUE WHERE user_id = $1`,
        [user.id]
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    return {
      success: true,
      message: 'Password has been reset successfully. Please log in with your new password.',
    };
  }

  private static async createSession(userId: string): Promise<SessionTokens> {
    const sessionExpiresAt = new Date();
    sessionExpiresAt.setDate(sessionExpiresAt.getDate() + SESSION_EXPIRY_DAYS);

    // 1. Create session in database
    const sessionRes = await query(
      `INSERT INTO sessions (user_id, token_hash, expires_at)
       VALUES ($1, 'pending', $2)
       RETURNING id`,
      [userId, sessionExpiresAt]
    );
    const sessionId = sessionRes.rows[0].id;

    // 2. Issue 15-minute access token
    const accessToken = jwt.sign(
      {
        userId,
        sessionId,
        issuedAt: Date.now(),
      },
      JWT_SECRET,
      { expiresIn: '15m' }
    );
    const accessHash = crypto.createHash('sha256').update(accessToken).digest('hex');

    await query(
      `UPDATE sessions SET token_hash = $1 WHERE id = $2`,
      [accessHash, sessionId]
    );

    // 3. Issue cryptographically secure refresh token (14 days)
    const refreshToken = crypto.randomBytes(40).toString('hex');
    const refreshHash = hashToken(refreshToken);
    const familyId = crypto.randomUUID();
    const refreshExpiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    await query(
      `INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [userId, refreshHash, familyId, refreshExpiresAt]
    );

    return {
      accessToken,
      refreshToken,
      token: accessToken,
      expiresIn: 900,
    };
  }
}
