import { Router } from 'express';
import { AuthController } from './auth.controller';
import { requireAuth } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { redisRateLimiter } from '../../middleware/rateLimit';
import {
  registerSchema,
  loginSchema,
  googleLoginSchema,
  refreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  logoutSchema,
} from '../../validation/schemas';

const router = Router();

// Registration
router.post('/register', validateBody(registerSchema), AuthController.register);

// Login with Redis rate limiting (10 attempts per minute)
router.post(
  '/login',
  redisRateLimiter({ prefix: 'login', limit: 10, windowSeconds: 60 }),
  validateBody(loginSchema),
  AuthController.login
);

// Google Sign-In
router.post('/google', validateBody(googleLoginSchema), AuthController.google);

// Token refresh
router.post('/refresh', validateBody(refreshSchema), AuthController.refresh);

// Password reset with Redis rate limiting
router.post(
  '/forgot-password',
  redisRateLimiter({ prefix: 'forgot_password', limit: 5, windowSeconds: 900 }),
  validateBody(forgotPasswordSchema),
  AuthController.forgotPassword
);

router.post(
  '/reset-password',
  redisRateLimiter({ prefix: 'reset_password', limit: 10, windowSeconds: 900 }),
  validateBody(resetPasswordSchema),
  AuthController.resetPassword
);

// Verification and sessions
router.post('/verify-email', requireAuth, validateBody(verifyEmailSchema), AuthController.verifyEmail);
router.post('/resend-verification', requireAuth, AuthController.resendVerification);
router.post('/logout', requireAuth, validateBody(logoutSchema), AuthController.logout);
router.post('/logout-all', requireAuth, AuthController.logoutAll);
router.get('/me', requireAuth, AuthController.me);

export default router;
