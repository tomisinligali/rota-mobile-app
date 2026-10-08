import { Request, Response } from 'express';
import { AuthService } from './auth.service';

export class AuthController {
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, firstName, lastName } = req.body;
      const result = await AuthService.register({ email, password, firstName, lastName });
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

  static async logout(req: Request, res: Response): Promise<void> {
    try {
      if (req.sessionToken) {
        await AuthService.logout(req.sessionToken);
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
