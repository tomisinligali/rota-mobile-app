import { Request, Response } from 'express';
import { AuthService } from './auth.service';

export class AuthController {
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, firstName, lastName } = req.body;
      const idempotencyKey = (req.headers['idempotency-key'] as string | undefined)?.trim();
      const result = await AuthService.register({ email, password, firstName, lastName }, idempotencyKey);
      if (idempotencyKey) {
        res.setHeader('Idempotency-Key', idempotencyKey);
      }
      res.status(201).json({
        data: result,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({
        error: {
          code: err.code || 'INTERNAL_SERVER_ERROR',
          message: err.message || 'An unexpected error occurred during registration',
          details: err.details || {},
        },
      });
    }
  }

  static async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;
      const result = await AuthService.login({ email, password });
      res.status(200).json({
        data: result,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({
        error: {
          code: err.code || 'INTERNAL_SERVER_ERROR',
          message: err.message || 'An unexpected error occurred during login',
          details: err.details || {},
        },
      });
    }
  }

  static async google(req: Request, res: Response): Promise<void> {
    try {
      const { idToken } = req.body;
      const result = await AuthService.googleLogin(idToken);
      res.status(200).json({
        data: result,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({
        error: {
          code: err.code || 'INTERNAL_SERVER_ERROR',
          message: err.message || 'An unexpected error occurred during Google sign-in',
          details: err.details || {},
        },
      });
    }
  }

  static async refresh(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;
      const result = await AuthService.rotateRefreshToken(refreshToken);
      res.status(200).json({
        data: result,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (err: any) {
      const status = err.status || 401;
      res.status(status).json({
        error: {
          code: err.code || 'INVALID_REFRESH_TOKEN',
          message: err.message || 'Failed to refresh authentication token',
          details: err.details || {},
        },
      });
    }
  }

  static async logout(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body || {};
      if (req.sessionToken) {
        await AuthService.logout(req.sessionToken, refreshToken);
      }
      res.status(200).json({
        data: { message: 'Logged out successfully' },
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (err: any) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occurred during logout',
          details: {},
        },
      });
    }
  }

  static async logoutAll(req: Request, res: Response): Promise<void> {
    try {
      const result = await AuthService.logoutAll(req.user!.id);
      res.status(200).json({
        data: result,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (err: any) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to log out of all devices',
          details: {},
        },
      });
    }
  }

  static async forgotPassword(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body;
      const result = await AuthService.forgotPassword(email);
      res.status(200).json({
        data: result,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({
        error: {
          code: err.code || 'INTERNAL_SERVER_ERROR',
          message: err.message || 'An unexpected error occurred during password reset request',
          details: err.details || {},
        },
      });
    }
  }

  static async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const { email, code, newPassword } = req.body;
      const result = await AuthService.resetPassword(email, code, newPassword);
      res.status(200).json({
        data: result,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({
        error: {
          code: err.code || 'INTERNAL_SERVER_ERROR',
          message: err.message || 'An unexpected error occurred while resetting password',
          details: err.details || {},
        },
      });
    }
  }

  static async verifyEmail(req: Request, res: Response): Promise<void> {
    try {
      const { code } = req.body;
      const result = await AuthService.verifyEmail(code, req.user!.id);
      res.status(200).json({
        data: result,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({
        error: {
          code: err.code || 'INTERNAL_SERVER_ERROR',
          message: err.message || 'An unexpected error occurred during email verification',
          details: err.details || {},
        },
      });
    }
  }

  static async resendVerification(req: Request, res: Response): Promise<void> {
    try {
      const result = await AuthService.resendVerification(req.user!.id);
      res.status(200).json({
        data: result,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({
        error: {
          code: err.code || 'INTERNAL_SERVER_ERROR',
          message: err.message || 'An unexpected error occurred while resending the verification email',
          details: err.details || {},
        },
      });
    }
  }

  static async me(req: Request, res: Response): Promise<void> {
    try {
      res.status(200).json({
        data: { user: req.user },
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (err: any) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve profile',
          details: {},
        },
      });
    }
  }
}
