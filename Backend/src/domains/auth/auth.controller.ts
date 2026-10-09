import { Request, Response } from 'express';
import { AuthService } from './auth.service';

/**
 * Minimal HTML page shown in the browser after clicking the emailed link.
 * Content is static/escaped (no user input is interpolated), so it is safe.
 */
function confirmPage(success: boolean, message?: string): string {
  const title = success ? 'Email verified' : 'Verification failed';
  const body = success
    ? 'Your email address has been verified. You can return to the Rota app.'
    : message || 'This verification link is invalid or has expired.';
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title></head>
  <body style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f4f4f5;margin:0;padding:48px 24px;text-align:center;color:#1a1a1a;">
    <div style="max-width:420px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;">
      <h1 style="margin:0 0 12px;font-size:20px;">${title}</h1>
      <p style="margin:0;color:#555;">${body}</p>
    </div>
  </body></html>`;
}

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

  static async verifyEmail(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.body;
      const result = await AuthService.verifyEmail(token, req.user!.id);
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

  /**
   * Public endpoint hit by the emailed verification link. Renders a minimal
   * HTML page so the user gets feedback in the browser.
   */
  static async confirmEmail(req: Request, res: Response): Promise<void> {
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    try {
      await AuthService.verifyEmail(token, req.ip || 'anonymous');
      res.status(200).type('html').send(confirmPage(true));
    } catch (err: any) {
      const status = err.status === 429 ? 429 : 400;
      res.status(status).type('html').send(confirmPage(false, err.message));
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
